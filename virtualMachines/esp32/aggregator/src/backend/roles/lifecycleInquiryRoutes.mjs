export function registerLifecycleInquiryRoutes(app, deps) {
  const {
    requirePermission,
    readTransactionLifecycleCompiled,
    getFsmEntityStateFromSql,
    getTransactionTrace,
    getFsmTransactionSummaryFromSql,
    getLifecycleTransitionOptions,
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
}
