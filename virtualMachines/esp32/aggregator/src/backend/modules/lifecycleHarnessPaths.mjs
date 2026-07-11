export function createLifecycleHarnessPathApi(deps = {}) {
  const {
    lifecycleHarness,
    touchLifecycleActivity,
    getLifecycleOutgoingTransitions,
    evaluateLifecycleTransitionGuard,
    buildDefaultMt103Message,
    buildDefaultPacsMessage,
    dequeueLifecycleStateMessage,
    enqueueLifecycleStateMessage,
    runLifecycleTransitionAction,
    recordTransactionStateTransition
  } = deps;

  async function lifecycleHarnessStartTransaction(compiled, { txId, message } = {}) {
    const transactionId = String(txId || `TX-${Date.now()}`);
    const initialState = String(compiled?.initialState || '').trim();
    if (!initialState) {
      throw new Error('Compiled lifecycle has no initialState');
    }

    const payload = message || buildDefaultMt103Message(transactionId);
    await enqueueLifecycleStateMessage(compiled, initialState, payload, 'lifecycle-harness:start');
    await recordTransactionStateTransition(compiled, {
      message: payload,
      fromState: null,
      toState: initialState,
      eventName: 'start'
    });

    lifecycleHarness.active = {
      transactionId,
      currentState: initialState,
      message: payload,
      startedAt: new Date().toISOString(),
      lastEvent: null
    };
    lifecycleHarness.history.push({
      at: new Date().toISOString(),
      kind: 'start',
      transactionId,
      state: initialState
    });
    touchLifecycleActivity();

    return lifecycleHarness.active;
  }

  async function lifecycleHarnessAdvance(compiled, { eventName, context = {}, replacementMessage = null } = {}) {
    if (!lifecycleHarness.active) {
      throw new Error('No active lifecycle test transaction. Start one first.');
    }

    const fromState = lifecycleHarness.active.currentState;
    const outgoing = getLifecycleOutgoingTransitions(compiled, fromState);
    if (outgoing.length === 0) {
      throw new Error(`State ${fromState} has no outgoing transitions`);
    }

    const candidates = eventName
      ? outgoing.filter(t => t.event === eventName)
      : outgoing;

    const transition = candidates.find(t => evaluateLifecycleTransitionGuard(t, context));
    if (!transition) {
      const eventText = eventName ? ` for event ${eventName}` : '';
      throw new Error(`No eligible transition from ${fromState}${eventText}`);
    }

    await dequeueLifecycleStateMessage(compiled, fromState, 'lifecycle-harness:step');
    if (replacementMessage != null) {
      lifecycleHarness.active.message = replacementMessage;
    }

    if (transition.action) {
      const runtimeContext = {
        ...context,
        message: lifecycleHarness.active.message,
        worker: { workerId: 'lifecycle-harness' }
      };
      const harnessWorkerState = { sourceService: 'lifecycle-harness' };
      await runLifecycleTransitionAction(transition.action, runtimeContext, harnessWorkerState);
      lifecycleHarness.active.message = runtimeContext.message;
    }

    await enqueueLifecycleStateMessage(compiled, transition.to, lifecycleHarness.active.message, 'lifecycle-harness:step', transition.event);
    await recordTransactionStateTransition(compiled, {
      message: lifecycleHarness.active.message,
      fromState,
      toState: transition.to,
      eventName: transition.event
    });

    lifecycleHarness.active.currentState = transition.to;
    lifecycleHarness.active.lastEvent = transition.event;

    lifecycleHarness.history.push({
      at: new Date().toISOString(),
      kind: 'transition',
      transactionId: lifecycleHarness.active.transactionId,
      from: transition.from,
      to: transition.to,
      event: transition.event
    });
    touchLifecycleActivity();

    return {
      transition,
      active: lifecycleHarness.active
    };
  }

  function isLikelyRejectTransition(transition) {
    const to = String(transition?.to || '').toLowerCase();
    const event = String(transition?.event || '').toLowerCase();
    const when = String(transition?.when || '').toLowerCase();
    return to.includes('reject') || event.includes('reject') || when.includes('rejected');
  }

  function deriveLifecycleHappyPath(compiled, { startState = null } = {}) {
    const initialState = String(startState || compiled?.initialState || '').trim();
    if (!initialState) {
      throw new Error('Compiled lifecycle has no initialState');
    }

    const happyContext = {
      status: 'approved',
      statement_match: true,
      statementMatch: true
    };

    const path = [];
    const seen = new Set();
    let current = initialState;
    let guard = 0;
    const maxSteps = Math.max(10, (Array.isArray(compiled?.states) ? compiled.states.length : 0) + 5);

    while (guard < maxSteps) {
      guard += 1;
      const key = `${current}#${guard}`;
      if (seen.has(key)) break;
      seen.add(key);

      const outgoing = getLifecycleOutgoingTransitions(compiled, current);
      if (!outgoing.length) break;

      const nonReject = outgoing.filter(t => !isLikelyRejectTransition(t));
      const preferred = nonReject.find(t => evaluateLifecycleTransitionGuard(t, happyContext));
      const fallbackPreferred = nonReject.find(t => evaluateLifecycleTransitionGuard(t, {}));
      const picked = preferred || fallbackPreferred || nonReject[0] || outgoing[0];
      if (!picked) break;

      path.push({
        from: picked.from,
        to: picked.to,
        event: picked.event,
        when: picked.when || null,
        action: picked.action || null
      });
      current = picked.to;
    }

    return {
      initialState,
      terminalState: current,
      transitionCount: path.length,
      context: happyContext,
      transitions: path
    };
  }

  function deriveLifecycleSadPath(compiled, { startState = null } = {}) {
    const initialState = String(startState || compiled?.initialState || '').trim();
    if (!initialState) {
      throw new Error('Compiled lifecycle has no initialState');
    }

    const sadContext = {
      status: 'rejected',
      statement_match: false,
      statementMatch: false
    };

    const path = [];
    let current = initialState;
    let guard = 0;
    const maxSteps = Math.max(10, (Array.isArray(compiled?.states) ? compiled.states.length : 0) + 5);

    while (guard < maxSteps) {
      guard += 1;
      const outgoing = getLifecycleOutgoingTransitions(compiled, current);
      if (!outgoing.length) break;

      const rejectCandidates = outgoing.filter(t => isLikelyRejectTransition(t));
      const preferredReject = rejectCandidates.find(t => evaluateLifecycleTransitionGuard(t, sadContext));
      const fallbackReject = rejectCandidates.find(t => evaluateLifecycleTransitionGuard(t, {}));
      const fallbackAny = outgoing.find(t => evaluateLifecycleTransitionGuard(t, sadContext))
        || outgoing.find(t => evaluateLifecycleTransitionGuard(t, {}));
      const picked = preferredReject || fallbackReject || fallbackAny || outgoing[0];
      if (!picked) break;

      path.push({
        from: picked.from,
        to: picked.to,
        event: picked.event,
        when: picked.when || null,
        action: picked.action || null
      });
      current = picked.to;

      if (isLikelyRejectTransition(picked)) {
        break;
      }
    }

    return {
      initialState,
      terminalState: current,
      transitionCount: path.length,
      context: sadContext,
      transitions: path
    };
  }

  async function runLifecycleHappyPath(compiled, { txId = null, message = null } = {}) {
    const derived = deriveLifecycleHappyPath(compiled);
    const transactionId = String(txId || `HAPPY-${Date.now()}`);
    const active = await lifecycleHarnessStartTransaction(compiled, {
      txId: transactionId,
      message: message || buildDefaultMt103Message(transactionId)
    });

    const steps = [];
    for (const transition of derived.transitions) {
      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: transition.event,
        context: derived.context
      });
      steps.push({
        event: transition.event,
        from: transition.from,
        to: transition.to,
        currentState: result?.active?.currentState || transition.to
      });
    }

    return {
      transactionId: active.transactionId,
      initialState: derived.initialState,
      terminalState: lifecycleHarness.active?.currentState || derived.terminalState,
      transitionCount: steps.length,
      steps,
      context: derived.context
    };
  }

  async function runLifecycleSadPath(compiled, { txId = null, message = null } = {}) {
    const derived = deriveLifecycleSadPath(compiled);
    const transactionId = String(txId || `SAD-${Date.now()}`);
    const active = await lifecycleHarnessStartTransaction(compiled, {
      txId: transactionId,
      message: message || buildDefaultMt103Message(transactionId)
    });

    const steps = [];
    for (const transition of derived.transitions) {
      const replacementMessage = transition.to === 'rejected'
        ? buildDefaultPacsMessage(transactionId)
        : null;
      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: transition.event,
        context: derived.context,
        replacementMessage
      });
      steps.push({
        event: transition.event,
        from: transition.from,
        to: transition.to,
        currentState: result?.active?.currentState || transition.to
      });
    }

    return {
      transactionId: active.transactionId,
      initialState: derived.initialState,
      terminalState: lifecycleHarness.active?.currentState || derived.terminalState,
      transitionCount: steps.length,
      steps,
      context: derived.context
    };
  }

  return {
    lifecycleHarnessStartTransaction,
    lifecycleHarnessAdvance,
    deriveLifecycleHappyPath,
    deriveLifecycleSadPath,
    runLifecycleHappyPath,
    runLifecycleSadPath
  };
}
