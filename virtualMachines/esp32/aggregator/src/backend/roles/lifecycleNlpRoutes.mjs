export function registerLifecycleNlpRoutes(app, deps) {
  const {
    requirePermission,
    getFsmTransactionSummaryFromSql,
    getFsmEntityStateFromSql,
    formatErrorDetails,
    extractEntityIdFromInquiry,
    resolveActor,
    isSettlementSummaryInquiry,
    extractEntityRefsFromInquiry,
    buildFsmClarificationOptions,
    logNlpInteractionToSql,
    readTransactionLifecycleCompiled,
    getLifecycleTransitionOptions,
    DEFAULT_ACTOR_USER_ID,
    updateNlpUserProfileFromFeedback,
    getTopologyNodeState = null  // Optional: topology awareness injection
  } = deps;

  // Track node topology state changes over time
  let lastKnownNodeState = null;
  let nodeDiscoveryLog = [];

  function extractTimeWindowMinutes(queryText) {
    const text = String(queryText || '').toLowerCase();
    if (!text) return 60;

    const minuteMatch = text.match(/\b(?:last|past)\s+(\d{1,4})\s+minutes?\b/);
    if (minuteMatch) return Math.max(1, Number(minuteMatch[1]) || 60);

    const hourMatch = text.match(/\b(?:last|past)\s+(\d{1,3})\s+hours?\b/);
    if (hourMatch) return Math.max(1, (Number(hourMatch[1]) || 1) * 60);

    if (/\btoday\b/.test(text)) return 24 * 60;
    return 60;
  }

  // Get current topology state and detect changes
  async function getTopologyContext() {
    if (!getTopologyNodeState) {
      return { nodeCount: null, discoveredCount: 0, droppedCount: 0, topologyChanged: false };
    }

    try {
      const currentState = await getTopologyNodeState();
      const nodeCount = currentState?.nodes?.length || 0;
      let discoveredCount = 0;
      let droppedCount = 0;
      let topologyChanged = false;

      if (lastKnownNodeState) {
        const previousCount = lastKnownNodeState.nodes?.length || 0;
        if (nodeCount > previousCount) {
          discoveredCount = nodeCount - previousCount;
          topologyChanged = true;
        } else if (nodeCount < previousCount) {
          droppedCount = previousCount - nodeCount;
          topologyChanged = true;
        }
      }

      if (topologyChanged) {
        nodeDiscoveryLog.push({
          timestamp: Date.now(),
          nodeCount,
          discoveredCount,
          droppedCount,
          nodes: currentState?.nodes?.map(n => ({ id: n.nodeId || n.id, name: n.nodeName || n.name, status: n.status })) || []
        });
      }

      lastKnownNodeState = currentState;

      return { nodeCount, discoveredCount, droppedCount, topologyChanged };
    } catch (e) {
      console.error('[NLP] Failed to get topology state:', e.message);
      return { nodeCount: null, discoveredCount: 0, droppedCount: 0, topologyChanged: false };
    }
  }

  function extractVolumeMetric(queryText) {
    const text = String(queryText || '').toLowerCase();
    if (/\b(settled|reconciled)\b/.test(text)) return 'settled';
    return 'processed';
  }

  function isTransactionVolumeInquiry(queryText) {
    const text = String(queryText || '').toLowerCase();
    if (!text) return false;
    const asksForCount = /\b(how many|count|number of|volume)\b/.test(text);
    const mentionsEntities = /\b(transactions?|payments?|messages?)\b/.test(text);
    const mentionsWindow = /\b(last|past)\s+\d+\s+(minutes?|hours?)\b/.test(text) || /\btoday\b/.test(text);
    const mentionsMetric = /\b(processed|handled|ingested|settled|reconciled|completed)\b/.test(text);
    return asksForCount && mentionsEntities && (mentionsWindow || mentionsMetric);
  }

  function buildVolumeReply(metric, summary) {
    if (metric === 'settled') {
      return `PULSE shows ${summary.settledCount} settled transaction(s) in the last ${summary.windowMinutes} minute(s). Reconciled: ${summary.reconciledCount}. Terminal: ${summary.terminalCount}.`;
    }
    return `PULSE processed ${summary.processedCount} distinct transaction(s) in the last ${summary.windowMinutes} minute(s). Settled currently in that same window: ${summary.settledCount}.`;
  }

  app.post('/api/fsm/chat', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const userMessage = String(req.body?.message || req.body?.query || req.body?.q || '').trim();
      if (!userMessage) {
        return res.status(400).json({ error: 'message is required' });
      }
      const actor = req.actor || resolveActor(req);
      const languageCode = req.body?.language || null;
      const topologyContext = await getTopologyContext();

      if (isTransactionVolumeInquiry(userMessage)) {
        const metric = extractVolumeMetric(userMessage);
        const windowMinutes = extractTimeWindowMinutes(userMessage);
        const summary = await getFsmTransactionSummaryFromSql({ windowMinutes });
        const reply = buildVolumeReply(metric, summary);

        await logNlpInteractionToSql({
          actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
          languageCode,
          userMessage,
          normalizedIntent: 'transaction-volume',
          intentConfidence: 0.93,
          responseKind: 'fsm-chat-reply',
          clarificationRequested: false,
          wasSuccessful: true,
          metadata: {
            metric,
            windowMinutes: summary.windowMinutes,
            processedCount: summary.processedCount,
            settledCount: summary.settledCount,
            reconciledCount: summary.reconciledCount,
            terminalCount: summary.terminalCount,
            topology: topologyContext
          }
        });

        return res.json({
          kind: 'fsm-chat-reply',
          ok: true,
          intent: 'transaction-volume',
          metric,
          reply,
          summary
        });
      }

      if (isSettlementSummaryInquiry(userMessage)) {
        const refs = extractEntityRefsFromInquiry(userMessage);
        if (refs.length === 0) {
          const clarificationOptions = buildFsmClarificationOptions(userMessage);
          await logNlpInteractionToSql({
            actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
            languageCode,
            userMessage,
            normalizedIntent: 'settlement-summary',
            intentConfidence: 0.85,
            responseKind: 'fsm-chat-hint',
            clarificationRequested: true,
            wasSuccessful: false,
            suggestions: clarificationOptions,
            metadata: { reason: 'missing_reference_list' }
          });
          return res.json({
            kind: 'fsm-chat-reply',
            ok: false,
            clarificationRequested: true,
            reply: 'I can summarize settlement status, but I need references. Provide a list like: "are these references settled: REF1, REF2, REF3".',
            alternatives: clarificationOptions,
            hints: clarificationOptions.map(item => `Try: ${item.example}`)
          });
        }

        const results = [];
        for (const ref of refs) {
          const state = await getFsmEntityStateFromSql(ref, { historyLimit: 1 }).catch(() => null);
          if (!state?.current) {
            results.push({ entityId: ref, found: false, settled: false, stateId: null });
            continue;
          }
          const stateId = String(state.current.state_id || '').toLowerCase();
          const queueName = String(state.current.queue_name || '').toLowerCase();
          const settled = stateId === 'reconciled' || stateId === 'settled' || queueName === 'tx.reconciled' || Boolean(state.current.is_terminal);
          results.push({
            entityId: ref,
            found: true,
            settled,
            stateId: state.current.state_id || null,
            queueName: state.current.queue_name || null,
            updatedAt: state.current.updated_at || null
          });
        }

        const total = results.length;
        const found = results.filter(item => item.found).length;
        const settledCount = results.filter(item => item.settled).length;
        const allSettled = total > 0 && settledCount === total;
        const missing = results.filter(item => !item.found).map(item => item.entityId);
        const unsettled = results.filter(item => item.found && !item.settled).map(item => `${item.entityId}:${item.stateId || 'unknown'}`);

        const summaryParts = [
          `Settlement summary: ${settledCount}/${total} reference(s) are settled.`,
          allSettled ? 'All provided references are settled.' : 'Not all provided references are settled.'
        ];
        if (missing.length > 0) summaryParts.push(`Missing in FSM store: ${missing.join(', ')}.`);
        if (unsettled.length > 0) summaryParts.push(`Unsettled: ${unsettled.join(', ')}.`);

        await logNlpInteractionToSql({
          actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
          languageCode,
          userMessage,
          normalizedIntent: 'settlement-summary',
          intentConfidence: 0.94,
          responseKind: 'fsm-chat-reply',
          clarificationRequested: false,
          wasSuccessful: true,
          metadata: {
            total,
            found,
            settledCount,
            allSettled
          }
        });

        return res.json({
          kind: 'fsm-chat-reply',
          ok: true,
          intent: 'settlement-summary',
          reply: summaryParts.join(' '),
          summary: {
            total,
            found,
            settledCount,
            allSettled
          },
          results
        });
      }

      const entityId = extractEntityIdFromInquiry(userMessage);
      if (!entityId) {
        const clarificationOptions = buildFsmClarificationOptions(userMessage);
        await logNlpInteractionToSql({
          actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
          languageCode,
          userMessage,
          normalizedIntent: 'clarification',
          intentConfidence: 0.4,
          responseKind: 'fsm-chat-hint',
          clarificationRequested: true,
          wasSuccessful: false,
          suggestions: clarificationOptions,
          metadata: {
            reason: 'missing_entity_id'
          }
        });
        return res.json({
          kind: 'fsm-chat-reply',
          ok: false,
          clarificationRequested: true,
          reply: 'I could not determine exactly what you want yet. Pick one option below or rewrite your message, and I will learn from your selection.',
          alternatives: clarificationOptions,
          hints: clarificationOptions.map(item => `Try: ${item.example}`)
        });
      }

      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        await logNlpInteractionToSql({
          actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
          languageCode,
          userMessage,
          normalizedIntent: 'entity',
          intentConfidence: 0.9,
          responseKind: 'fsm-chat-error',
          clarificationRequested: false,
          wasSuccessful: false,
          metadata: { reason: 'lifecycle_compiled_missing' }
        });
        return res.status(404).json({
          kind: 'fsm-chat-reply',
          ok: false,
          error: 'Lifecycle compiled artifact not found',
          hint: 'Run: npm run compile:lifecycle'
        });
      }

      const historyLimit = Number(req.body?.limit || 25);
      const state = await getFsmEntityStateFromSql(entityId, { historyLimit });
      if (!state) {
        await logNlpInteractionToSql({
          actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
          languageCode,
          userMessage,
          normalizedIntent: 'entity',
          intentConfidence: 0.92,
          responseKind: 'fsm-chat-not-found',
          clarificationRequested: false,
          wasSuccessful: false,
          metadata: { entityId }
        });
        return res.json({
          kind: 'fsm-chat-reply',
          ok: false,
          entityId,
          reply: `I could not find entity ${entityId} in the FSM state store.`
        });
      }

      const currentStateId = String(state.current.state_id || '').trim();
      const options = getLifecycleTransitionOptions(compiled, currentStateId);
      const optionText = options.length
        ? options.map(opt => `${opt.eventName || 'auto'} -> ${opt.toStateLabel || opt.toState}`).join('; ')
        : 'No further transitions available.';

      const reply = [
        `Entity ${entityId} is currently in state ${state.current.state_id}${state.current.state_label ? ` (${state.current.state_label})` : ''}.`,
        `Last event: ${state.current.last_event_id || 'n/a'}.`,
        `Available options: ${optionText}`
      ].join(' ');

      await logNlpInteractionToSql({
        actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
        languageCode,
        userMessage,
        normalizedIntent: 'entity',
        intentConfidence: 0.96,
        responseKind: 'fsm-chat-reply',
        clarificationRequested: false,
        wasSuccessful: true,
        metadata: {
          entityId,
          stateId: state.current.state_id,
          isTerminal: Boolean(state.current.is_terminal),
          optionCount: options.length
        }
      });

      return res.json({
        kind: 'fsm-chat-reply',
        ok: true,
        entityId,
        reply,
        state: {
          machineId: state.current.machine_id,
          stateId: state.current.state_id,
          stateLabel: state.current.state_label,
          queueName: state.current.queue_name,
          lastEventId: state.current.last_event_id,
          isTerminal: Boolean(state.current.is_terminal),
          payloadType: state.current.payload_type,
          updatedAt: state.current.updated_at
        },
        options,
        history: state.history.map(item => ({
          id: item.id,
          fromState: item.from_state,
          toState: item.to_state,
          toStateLabel: item.to_state_label,
          eventName: item.event_name,
          queueName: item.queue_name,
          isTerminal: Boolean(item.is_terminal),
          updatedAt: item.updated_at
        }))
      });
    } catch (e) {
      await logNlpInteractionToSql({
        actorUserId: req.actor?.userId || DEFAULT_ACTOR_USER_ID,
        languageCode: req.body?.language || null,
        userMessage: String(req.body?.message || req.body?.query || req.body?.q || '').trim(),
        normalizedIntent: 'entity',
        intentConfidence: null,
        responseKind: 'fsm-chat-error',
        clarificationRequested: false,
        wasSuccessful: false,
        metadata: { error: formatErrorDetails(e) }
      });
      return res.status(500).json({ kind: 'fsm-chat-reply', ok: false, error: formatErrorDetails(e) });
    }
  });

  app.post('/api/nlp/interaction', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const actor = req.actor || resolveActor(req);
      const message = String(req.body?.message || '').trim();
      const topologyContext = await getTopologyContext();
      if (!message) {
        return res.status(400).json({ ok: false, error: 'message is required' });
      }

      await logNlpInteractionToSql({
        actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
        languageCode: req.body?.language || null,
        userMessage: message,
        normalizedIntent: req.body?.intent || null,
        intentConfidence: req.body?.intentConfidence,
        responseKind: req.body?.responseKind || 'chat-summary',
        clarificationRequested: Boolean(req.body?.clarificationRequested),
        wasSuccessful: req.body?.wasSuccessful !== false,
        screenContext: req.body?.screenContext || null,
        suggestions: req.body?.suggestions || null,
        metadata: {
          ...(req.body?.metadata || {}),
          topology: topologyContext
        },
      });

      if (req.body?.selectedOptionId) {
        await updateNlpUserProfileFromFeedback({
          actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
          languageCode: req.body?.language || null,
          selectedOptionId: req.body?.selectedOptionId,
          originalMessage: req.body?.originalMessage || message,
          rewrittenMessage: req.body?.rewrittenMessage || null,
          preferredPromptStyle: req.body?.preferredPromptStyle || null
        });
      }

      return res.json({ ok: true, kind: 'nlp-interaction-logged' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  app.post('/api/nlp/feedback', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const actor = req.actor || resolveActor(req);
      const selectedOptionId = String(req.body?.selectedOptionId || '').trim();
      const originalMessage = String(req.body?.originalMessage || '').trim();
        const topologyContext = await getTopologyContext();
      if (!selectedOptionId) {
        return res.status(400).json({ ok: false, error: 'selectedOptionId is required' });
      }

      await logNlpInteractionToSql({
        actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
        languageCode: req.body?.language || null,
        userMessage: originalMessage || '[clarification-feedback]',
        normalizedIntent: req.body?.intent || 'clarification-feedback',
        intentConfidence: req.body?.intentConfidence,
        responseKind: 'nlp-feedback',
        clarificationRequested: false,
        wasSuccessful: req.body?.wasHelpful !== false,
        suggestions: req.body?.alternatives || null,
        metadata: {
          selectedOptionId,
          rewrittenMessage: req.body?.rewrittenMessage || null,
          wasHelpful: req.body?.wasHelpful !== false,
          source: req.body?.source || 'chat-clarification'
                            , topology: topologyContext
                  topology: topologyContext,
        }
      });

      await updateNlpUserProfileFromFeedback({
        actorUserId: actor?.userId || DEFAULT_ACTOR_USER_ID,
        languageCode: req.body?.language || null,
        selectedOptionId,
        originalMessage: originalMessage || null,
        rewrittenMessage: req.body?.rewrittenMessage || null,
        preferredPromptStyle: req.body?.preferredPromptStyle || null
      });

      return res.json({ ok: true, kind: 'nlp-feedback-logged', selectedOptionId });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  // NLP topology awareness endpoints
  app.get('/api/nlp/topology/current', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const topologyContext = await getTopologyContext();
      return res.json({
        ok: true,
        timestamp: Date.now(),
        topology: topologyContext,
        discoveryLogLength: nodeDiscoveryLog.length
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  app.get('/api/nlp/topology/history', requirePermission('lifecycle.read'), (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 100), 500);
      const history = nodeDiscoveryLog.slice(-limit);
      return res.json({
        ok: true,
        count: history.length,
        total: nodeDiscoveryLog.length,
        changes: history
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  app.post('/api/nlp/topology/reset-discovery-log', requirePermission('lifecycle.write'), (req, res) => {
    try {
      const previousLength = nodeDiscoveryLog.length;
      nodeDiscoveryLog = [];
      lastKnownNodeState = null;
      return res.json({
        ok: true,
        message: `Cleared ${previousLength} discovery log entries`
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });
}
