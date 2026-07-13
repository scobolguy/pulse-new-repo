export function registerLifecycleInquiryRoutes(app, deps) {
  const {
    requirePermission,
    readTransactionLifecycleCompiled,
    getFsmEntityStateFromSql,
    getTransactionTrace,
    getFsmTransactionSummaryFromSql,
    getLifecycleTransitionOptions,
    getGatewayStatusPayload,
    formatErrorDetails,
    extractEntityIdFromInquiry
  } = deps;

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

  function extractVolumeMetric(queryText) {
    const text = String(queryText || '').toLowerCase();
    if (/\b(settled|reconciled)\b/.test(text)) return 'settled';
    return 'processed';
  }

  function buildVolumeReply(metric, summary) {
    if (metric === 'settled') {
      return `PULSE shows ${summary.settledCount} settled transaction(s) in the last ${summary.windowMinutes} minute(s). Reconciled: ${summary.reconciledCount}. Terminal: ${summary.terminalCount}.`;
    }
    return `PULSE processed ${summary.processedCount} distinct transaction(s) in the last ${summary.windowMinutes} minute(s). Settled currently in that same window: ${summary.settledCount}.`;
  }

  function buildMergedTimeline(history, trace) {
    const historyEvents = (history || []).map(item => ({
      eventSource: 'fsm-history',
      timestamp: item.updatedAt || null,
      fromState: item.fromState,
      toState: item.toState,
      toStateLabel: item.toStateLabel,
      eventName: item.eventName,
      queueName: item.queueName,
      isTerminal: Boolean(item.isTerminal)
    }));

    const traceEvents = (trace || []).map(item => ({
      eventSource: 'trace',
      timestamp: item.occurredAt || null,
      eventKind: item.eventKind || null,
      fromState: item.transition?.fromState || null,
      toState: item.transition?.toState || null,
      toStateLabel: item.transition?.toStateLabel || null,
      eventName: item.transition?.eventName || null,
      queueName: item.transition?.queueName || item.coordination?.queueName || null,
      managerId: item.coordination?.managerId || null,
      nodeId: item.coordination?.nodeId || null,
      workerId: item.worker?.workerId || null,
      sourceService: item.worker?.sourceService || null,
      consumerService: item.worker?.consumerService || null,
      mode: item.coordination?.mode || null
    }));

    return historyEvents
      .concat(traceEvents)
      .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  }

  function normalizedText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function firstTruthyTimestamp(values = []) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) return text;
    }
    return null;
  }

  function maybeIsoTimestamp(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const ms = Date.parse(text);
    if (Number.isNaN(ms)) return null;
    return new Date(ms).toISOString();
  }

  function matchesAny(text, tokens = []) {
    const hay = normalizedText(text);
    if (!hay) return false;
    return tokens.some(token => hay.includes(normalizedText(token)));
  }

  function findFirstTimestampByPredicate(trace = [], timeline = [], predicate) {
    const fromTrace = (trace || []).find(item => predicate(item, 'trace'));
    if (fromTrace) {
      const ts = firstTruthyTimestamp([fromTrace.occurredAt, fromTrace.timestamp]);
      if (ts) return ts;
    }

    const fromTimeline = (timeline || []).find(item => predicate(item, 'timeline'));
    if (fromTimeline) {
      const ts = firstTruthyTimestamp([fromTimeline.timestamp]);
      if (ts) return ts;
    }

    return null;
  }

  function findLastTimestampByPredicate(trace = [], timeline = [], predicate) {
    const reversedTrace = [...(trace || [])].reverse();
    const fromTrace = reversedTrace.find(item => predicate(item, 'trace'));
    if (fromTrace) {
      const ts = firstTruthyTimestamp([fromTrace.occurredAt, fromTrace.timestamp]);
      if (ts) return ts;
    }

    const reversedTimeline = [...(timeline || [])].reverse();
    const fromTimeline = reversedTimeline.find(item => predicate(item, 'timeline'));
    if (fromTimeline) {
      const ts = firstTruthyTimestamp([fromTimeline.timestamp]);
      if (ts) return ts;
    }

    return null;
  }

  function hasStageApproval(trace = [], timeline = [], tokens = []) {
    return Boolean(findFirstTimestampByPredicate(trace, timeline, (item) => {
      const eventKind = item.eventKind || item.event_name || '';
      const eventName = item.eventName || item.event_name || item.transition?.eventName || '';
      const toState = item.toState || item.to_state || item.transition?.toState || '';
      const label = item.toStateLabel || item.to_state_label || item.transition?.toStateLabel || '';
      return matchesAny(eventKind, tokens)
        || matchesAny(eventName, tokens)
        || matchesAny(toState, tokens)
        || matchesAny(label, tokens);
    }));
  }

  function hasRtgsDownSignal(trace = [], timeline = [], currentState = null) {
    if (matchesAny(currentState?.stateId, ['deferred_rtgs_closed', 'rtgs_closed'])) {
      return true;
    }
    return Boolean(findFirstTimestampByPredicate(trace, timeline, (item) => {
      const eventKind = item.eventKind || '';
      const eventName = item.eventName || item.transition?.eventName || '';
      const toState = item.toState || item.transition?.toState || '';
      const queueName = item.queueName || item.transition?.queueName || '';
      return matchesAny(eventKind, ['rtgs_down', 'rtgs-window-closed', 'rtgs-unavailable'])
        || matchesAny(eventName, ['rtgs_window_closed', 'rtgs_unavailable'])
        || matchesAny(toState, ['deferred_rtgs_closed'])
        || matchesAny(queueName, ['deferred.rtgs.closed']);
    }));
  }

  function hasSwiftCompletion(trace = [], timeline = [], currentState = null) {
    if (Boolean(currentState?.isTerminal) && matchesAny(currentState?.stateId, ['completed', 'reconciled'])) {
      return true;
    }
    return Boolean(findLastTimestampByPredicate(trace, timeline, (item) => {
      const eventKind = item.eventKind || '';
      const eventName = item.eventName || item.transition?.eventName || '';
      const toState = item.toState || item.transition?.toState || '';
      return matchesAny(eventKind, ['swift_send_succeeded', 'transaction_completed'])
        || matchesAny(eventName, ['swift_send_succeeded', 'transaction_completed'])
        || matchesAny(toState, ['completed', 'reconciled']);
    }));
  }

  function extractScheduledAt(trace = [], timeline = []) {
    const candidates = [];
    for (const item of trace || []) {
      candidates.push(item?.details?.scheduledAt);
      candidates.push(item?.details?.wakeAt);
      candidates.push(item?.message?.schedule?.wakeAt);
      candidates.push(item?.message?.wakeAt);
      candidates.push(item?.coordination?.scheduledAt);
    }
    for (const item of timeline || []) {
      candidates.push(item?.scheduledAt);
      candidates.push(item?.wakeAt);
    }
    for (const candidate of candidates) {
      const iso = maybeIsoTimestamp(candidate);
      if (iso) return iso;
    }
    return null;
  }

  function hasTimeoutSignal(trace = [], timeline = [], currentState = null) {
    if (matchesAny(currentState?.stateId, ['timeout', 'timed_out', 'ontimeout'])) {
      return true;
    }
    return Boolean(findLastTimestampByPredicate(trace, timeline, (item) => {
      const eventKind = item.eventKind || '';
      const eventName = item.eventName || item.transition?.eventName || '';
      const toState = item.toState || item.transition?.toState || '';
      const queueName = item.queueName || item.transition?.queueName || '';
      return matchesAny(eventKind, ['lifecycle-ontimeout', 'timeout', 'stage_timeout'])
        || matchesAny(eventName, ['stage_timeout', 'onTimeout'])
        || matchesAny(toState, ['timeout'])
        || matchesAny(queueName, ['tx.lifecycle.ontimeout']);
    }));
  }

  function extractLatestTimeoutDetails(trace = [], timeline = []) {
    const reversedTrace = [...(trace || [])].reverse();
    const timeoutTrace = reversedTrace.find((item) => {
      const eventKind = item?.eventKind || '';
      const eventName = item?.eventName || item?.transition?.eventName || '';
      const toState = item?.transition?.toState || '';
      return matchesAny(eventKind, ['lifecycle-ontimeout', 'timeout', 'stage_timeout'])
        || matchesAny(eventName, ['stage_timeout', 'onTimeout'])
        || matchesAny(toState, ['timeout']);
    });

    if (timeoutTrace) {
      return {
        occurredAt: firstTruthyTimestamp([timeoutTrace.occurredAt, timeoutTrace.timestamp]),
        timeoutMs: Number(timeoutTrace?.details?.timeoutMs || timeoutTrace?.message?.timeoutMs || 0) || null,
        sourceQueue: timeoutTrace?.details?.sourceQueue || timeoutTrace?.transition?.queueName || timeoutTrace?.coordination?.queueName || null,
        stage: timeoutTrace?.details?.transitionToState || timeoutTrace?.transition?.toState || timeoutTrace?.transition?.fromState || null,
        workerId: timeoutTrace?.worker?.workerId || timeoutTrace?.details?.workerId || null
      };
    }

    const reversedTimeline = [...(timeline || [])].reverse();
    const timeoutTimeline = reversedTimeline.find((item) => {
      const eventKind = item?.eventKind || '';
      const eventName = item?.eventName || '';
      const toState = item?.toState || '';
      return matchesAny(eventKind, ['lifecycle-ontimeout', 'timeout', 'stage_timeout'])
        || matchesAny(eventName, ['stage_timeout', 'onTimeout'])
        || matchesAny(toState, ['timeout']);
    });

    if (!timeoutTimeline) return null;
    return {
      occurredAt: firstTruthyTimestamp([timeoutTimeline.timestamp]),
      timeoutMs: null,
      sourceQueue: timeoutTimeline.queueName || null,
      stage: timeoutTimeline.toState || timeoutTimeline.fromState || null,
      workerId: timeoutTimeline.workerId || null
    };
  }

  function resolveRequiredGatewayId(currentState = null, timeline = []) {
    const stateId = normalizedText(currentState?.stateId);
    if (stateId.includes('swift')) return 'swift';
    if (stateId.includes('rtgs') || stateId.includes('lynx') || stateId.includes('boc')) return 'boc';
    if (stateId.includes('fed')) return 'fed';

    const recent = [...(timeline || [])].reverse();
    for (const item of recent) {
      const queueName = normalizedText(item?.queueName || '');
      const stage = normalizedText(item?.toState || item?.fromState || '');
      if (queueName.includes('swift') || stage.includes('swift')) return 'swift';
      if (queueName.includes('rtgs') || queueName.includes('lynx') || stage.includes('rtgs') || stage.includes('lynx')) return 'boc';
      if (queueName.includes('fed') || stage.includes('fed')) return 'fed';
    }
    return null;
  }

  function resolveGatewaySnapshot(gatewayId) {
    if (!gatewayId || typeof getGatewayStatusPayload !== 'function') return null;
    try {
      const payload = getGatewayStatusPayload();
      if (!payload || typeof payload !== 'object') return null;
      const gateway = payload[gatewayId];
      if (!gateway || typeof gateway !== 'object') return null;
      return {
        id: gatewayId,
        running: Boolean(gateway.running),
        quiesced: Boolean(gateway.quiesced),
        mode: gateway.mode || null,
        control: gateway.control || null
      };
    } catch {
      return null;
    }
  }

  function buildSupportNarrative({
    entityId,
    receivedAt,
    replySentAt,
    stageSummary,
    gatewayDown,
    requiredGatewayId,
    rtgsDown,
    scheduledAt,
    swiftCompleted,
    currentState
  }) {
    const stageText = `Fraud approved: ${stageSummary.fraudApproved ? 'yes' : 'no'}, balance OK: ${stageSummary.balanceApproved ? 'yes' : 'no'}, additional checks approved: ${stageSummary.additionalApproved ? 'yes' : 'no'}.`;

    if (replySentAt || swiftCompleted) {
      return `Payment ${entityId} was received at ${receivedAt || 'unknown time'}. ${stageText} RTGS processing reached SWIFT dispatch and the transaction is complete. Reply sent at ${replySentAt || 'unknown time'}.`;
    }

    if (gatewayDown) {
      return `Payment ${entityId} was received at ${receivedAt || 'unknown time'}. ${stageText} Processing is currently blocked because gateway ${requiredGatewayId || 'required'} is down, so messages cannot be sent to or received from that service path.`;
    }

    if (rtgsDown) {
      const scheduleText = scheduledAt
        ? ` It is scheduled for requeue at ${scheduledAt}, where decision checks will run again before RTGS retry.`
        : ' It is queued for business-window reprocessing, where decision checks will run again before RTGS retry.';
      return `Payment ${entityId} was received at ${receivedAt || 'unknown time'}. ${stageText} It reached RTGS submission, but RTGS is unavailable for the current business window.${scheduleText}`;
    }

    return `Payment ${entityId} was received at ${receivedAt || 'unknown time'}. ${stageText} Current state is ${currentState?.stateLabel || currentState?.stateId || 'unknown'}. Reply has not been sent yet.`;
  }

  function deriveStateFromTrace(entityId, trace) {
    const lastTransition = [...(trace || [])]
      .reverse()
      .find(item => String(item?.transition?.toState || '').trim());
    if (!lastTransition) return null;

    const history = (trace || [])
      .filter(item => String(item?.transition?.toState || '').trim())
      .map((item, index) => ({
        id: index + 1,
        fromState: item.transition?.fromState || null,
        toState: item.transition?.toState || null,
        toStateLabel: item.transition?.toStateLabel || null,
        eventName: item.transition?.eventName || null,
        queueName: item.transition?.queueName || null,
        isTerminal: Boolean(item.transition?.isTerminal),
        updatedAt: item.occurredAt || null
      }));

    return {
      entityId,
      machineId: lastTransition.machineId || null,
      currentState: {
        stateId: lastTransition.transition?.toState || null,
        stateLabel: lastTransition.transition?.toStateLabel || null,
        queueName: lastTransition.transition?.queueName || null,
        lastEventId: lastTransition.transition?.eventName || null,
        isTerminal: Boolean(lastTransition.transition?.isTerminal),
        payloadType: lastTransition.payloadType || null,
        updatedAt: lastTransition.occurredAt || null
      },
      history
    };
  }

  async function buildEntityTraceResponse(entityId, historyLimit, traceLimit) {
    const compiled = readTransactionLifecycleCompiled();
    if (!compiled) {
      return {
        status: 404,
        body: { error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' }
      };
    }

    const trace = typeof getTransactionTrace === 'function'
      ? getTransactionTrace(entityId, { limit: traceLimit })
      : [];

    let state = null;
    try {
      state = await getFsmEntityStateFromSql(entityId, { historyLimit });
    } catch {
      state = null;
    }
    if (!state) {
      state = deriveStateFromTrace(entityId, trace);
    }
    if (!state) {
      return {
        status: 404,
        body: { error: `Entity ${entityId} not found in FSM state store or trace journal` }
      };
    }

    const currentStateId = String(state.current?.state_id || '').trim();
    const derivedStateId = String(state.current?.stateId || '').trim();
    const options = getLifecycleTransitionOptions(compiled, currentStateId || derivedStateId);
    const normalizedHistory = (state.history || []).map(item => ({
      id: item.id,
      fromState: item.from_state ?? item.fromState ?? null,
      toState: item.to_state ?? item.toState ?? null,
      toStateLabel: item.to_state_label ?? item.toStateLabel ?? null,
      eventName: item.event_name ?? item.eventName ?? null,
      queueName: item.queue_name ?? item.queueName ?? null,
      isTerminal: Boolean(item.is_terminal ?? item.isTerminal),
      updatedAt: item.updated_at ?? item.updatedAt ?? null
    }));
    const timeline = buildMergedTimeline(normalizedHistory, trace);

    return {
      status: 200,
      body: {
        entityId,
        machineId: state.current?.machine_id ?? state.machineId ?? null,
        currentState: {
          stateId: state.current?.state_id ?? state.current?.stateId ?? null,
          stateLabel: state.current?.state_label ?? state.current?.stateLabel ?? null,
          queueName: state.current?.queue_name ?? state.current?.queueName ?? null,
          lastEventId: state.current?.last_event_id ?? state.current?.lastEventId ?? null,
          isTerminal: Boolean(state.current?.is_terminal ?? state.current?.isTerminal),
          payloadType: state.current?.payload_type ?? state.current?.payloadType ?? null,
          updatedAt: state.current?.updated_at ?? state.current?.updatedAt ?? null
        },
        options,
        history: normalizedHistory,
        trace,
        timeline
      }
    };
  }

  app.get('/api/fsm/entities/:entityId', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.entityId || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'entityId is required' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const traceLimit = Number(req.query.traceLimit || 200);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      return res.status(response.status).json(response.body);
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/transactions/:reference/state', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.reference || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'reference is required' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const traceLimit = Number(req.query.traceLimit || 200);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      return res.status(response.status).json(response.body);
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/transactions/:reference/trace', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.reference || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'reference is required' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const traceLimit = Number(req.query.traceLimit || 200);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      return res.status(response.status).json(response.body);
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/transactions/:reference/timeline', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.reference || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'reference is required' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const traceLimit = Number(req.query.traceLimit || 200);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      return res.status(response.status).json({
        entityId,
        machineId: response.body.machineId || null,
        currentState: response.body.currentState || null,
        timeline: response.body.timeline || []
      });
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/fsm/inquiry', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const queryText = String(req.query.q || '').trim();
      if (!queryText) {
        return res.status(400).json({ error: 'q query parameter is required' });
      }

      const entityId = extractEntityIdFromInquiry(queryText);
      if (!entityId) {
        return res.status(400).json({
          error: 'Could not determine entity ID from inquiry text',
          hint: 'Include transaction/reference/entity ID in the question, e.g. "where is transaction ABC123"'
        });
      }

      const historyLimit = Number(req.query.limit || 50);
      const traceLimit = Number(req.query.traceLimit || 200);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      return res.status(response.status).json({ inquiry: queryText, ...response.body });
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.post('/api/fsm/inquiry', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const queryText = String(req.body?.query || req.body?.q || '').trim();
      if (!queryText) {
        return res.status(400).json({ error: 'query (or q) in request body is required' });
      }

      const entityId = extractEntityIdFromInquiry(queryText);
      if (!entityId) {
        return res.status(400).json({
          error: 'Could not determine entity ID from inquiry text',
          hint: 'Include transaction/reference/entity ID in the question, e.g. "where is transaction ABC123"'
        });
      }

      const historyLimit = Number(req.body?.limit || 50);
      const traceLimit = Number(req.body?.traceLimit || 200);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      return res.status(response.status).json({ inquiry: queryText, ...response.body });
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/fsm/summary', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const metric = extractVolumeMetric(req.query.metric || req.query.q || 'processed');
      const windowMinutes = extractTimeWindowMinutes(req.query.q || req.query.window || `${req.query.minutes || 60} minutes`);
      const summary = await getFsmTransactionSummaryFromSql({ windowMinutes });
      return res.json({
        ok: true,
        metric,
        summary,
        reply: buildVolumeReply(metric, summary)
      });
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/support/payments/:reference', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.reference || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'reference is required' });
      }

      const historyLimit = Number(req.query.limit || 200);
      const traceLimit = Number(req.query.traceLimit || 500);
      const response = await buildEntityTraceResponse(entityId, historyLimit, traceLimit);
      if (response.status !== 200) {
        return res.status(response.status).json(response.body);
      }

      const trace = Array.isArray(response.body.trace) ? response.body.trace : [];
      const timeline = Array.isArray(response.body.timeline) ? response.body.timeline : [];
      const currentState = response.body.currentState || null;

      const receivedAt = findFirstTimestampByPredicate(trace, timeline, (item) => {
        const eventKind = item.eventKind || '';
        const eventName = item.eventName || item.transition?.eventName || '';
        const fromState = item.fromState || item.transition?.fromState || '';
        const toState = item.toState || item.transition?.toState || '';
        const queueName = item.queueName || item.transition?.queueName || '';
        return matchesAny(eventKind, ['payment_received', 'queue-enqueue'])
          || matchesAny(eventName, ['payment_received'])
          || matchesAny(fromState, ['received_payment', 'received_mt103'])
          || matchesAny(toState, ['received_payment', 'received_mt103'])
          || matchesAny(queueName, ['payments.inbound', 'swift.mt103.inbound', 'swift.mt103.parsed']);
      });

      const replySentAt = findLastTimestampByPredicate(trace, timeline, (item) => {
        const eventKind = item.eventKind || '';
        const eventName = item.eventName || item.transition?.eventName || '';
        return matchesAny(eventKind, ['reply_sent']) || matchesAny(eventName, ['reply_sent']);
      });

      const stageSummary = {
        fraudApproved: hasStageApproval(trace, timeline, ['fraud_approved', 'decision_fraud', 'fraud approved']),
        balanceApproved: hasStageApproval(trace, timeline, ['balance_ok', 'decision_balance', 'balance ok']),
        additionalApproved: hasStageApproval(trace, timeline, ['additional_checks_ok', 'decision_additional', 'additional approved'])
      };

      const rtgsDown = hasRtgsDownSignal(trace, timeline, currentState);
      const timeoutDetected = hasTimeoutSignal(trace, timeline, currentState);
      const timeoutDetails = extractLatestTimeoutDetails(trace, timeline);
      const swiftCompleted = hasSwiftCompletion(trace, timeline, currentState);
      const scheduledAt = extractScheduledAt(trace, timeline);
      const requiredGatewayId = resolveRequiredGatewayId(currentState, timeline);
      const gateway = resolveGatewaySnapshot(requiredGatewayId);
      const gatewayDown = Boolean(gateway && (!gateway.running || gateway.quiesced));

      let blockingReason = null;
      let nextAction = null;
      if (!replySentAt && !swiftCompleted) {
        if (gatewayDown) {
          blockingReason = `Gateway ${requiredGatewayId} is down`;
          nextAction = `Messages cannot be sent or received for this service path until gateway ${requiredGatewayId} is up.`;
        } else if (timeoutDetected) {
          const timeoutLabel = timeoutDetails?.timeoutMs ? ` after ${timeoutDetails.timeoutMs}ms` : '';
          const timeoutAt = timeoutDetails?.occurredAt ? ` at ${timeoutDetails.occurredAt}` : '';
          blockingReason = `Lifecycle processing timed out${timeoutLabel}${timeoutAt}`;
          const queueHint = timeoutDetails?.sourceQueue ? ` Queue: ${timeoutDetails.sourceQueue}.` : '';
          const stageHint = timeoutDetails?.stage ? ` Stage: ${timeoutDetails.stage}.` : '';
          nextAction = `Route to timeout handling policy and retry from the last safe stage with backoff.${stageHint}${queueHint}`.trim();
        } else if (rtgsDown) {
          blockingReason = 'RTGS unavailable in current business window';
          nextAction = scheduledAt
            ? `Requeue scheduled at ${scheduledAt}; decision chain will rerun before RTGS retry.`
            : 'Requeue pending next business window; decision chain will rerun before RTGS retry.';
        } else {
          blockingReason = currentState?.stateLabel || currentState?.stateId || 'Processing not completed';
          nextAction = 'Continue processing according to lifecycle transitions.';
        }
      }

      const narrative = buildSupportNarrative({
        entityId,
        receivedAt,
        replySentAt,
        stageSummary,
        gatewayDown,
        requiredGatewayId,
        rtgsDown,
        scheduledAt,
        swiftCompleted,
        currentState
      });

      return res.json({
        paymentReference: entityId,
        transactionId: response.body.entityId || entityId,
        receivedAt: receivedAt || null,
        replySentAt: replySentAt || null,
        currentStatus: replySentAt || swiftCompleted ? 'completed' : (rtgsDown ? 'deferred' : 'in-progress'),
        blockingReason,
        nextAction,
        scheduledAt,
        timeoutDetected,
        timeoutDetails,
        gateway,
        gatewayDown,
        stageSummary,
        currentState,
        narrative,
        machineId: response.body.machineId || null,
        timeline: timeline
      });
    } catch (e) {
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });
}
