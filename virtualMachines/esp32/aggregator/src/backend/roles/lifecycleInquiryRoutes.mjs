export function registerLifecycleInquiryRoutes(app, deps) {
  const {
    requirePermission,
    readTransactionLifecycleCompiled,
    getFsmEntityStateFromSql,
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

  app.get('/api/fsm/entities/:entityId', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.entityId || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'entityId is required' });
      }

      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const state = await getFsmEntityStateFromSql(entityId, { historyLimit });
      if (!state) {
        return res.status(404).json({ error: `Entity ${entityId} not found in FSM state store` });
      }

      const currentStateId = String(state.current.state_id || '').trim();
      const options = getLifecycleTransitionOptions(compiled, currentStateId);

      return res.json({
        entityId,
        machineId: state.current.machine_id,
        currentState: {
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
      return res.status(500).json({ error: formatErrorDetails(e) });
    }
  });

  app.get('/api/transactions/:reference/state', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const entityId = String(req.params.reference || '').trim();
      if (!entityId) {
        return res.status(400).json({ error: 'reference is required' });
      }

      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const state = await getFsmEntityStateFromSql(entityId, { historyLimit });
      if (!state) {
        return res.status(404).json({ error: `Entity ${entityId} not found in FSM state store` });
      }

      const currentStateId = String(state.current.state_id || '').trim();
      const options = getLifecycleTransitionOptions(compiled, currentStateId);

      return res.json({
        entityId,
        machineId: state.current.machine_id,
        currentState: {
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

      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const historyLimit = Number(req.query.limit || 50);
      const state = await getFsmEntityStateFromSql(entityId, { historyLimit });
      if (!state) {
        return res.status(404).json({ error: `Entity ${entityId} not found in FSM state store` });
      }

      const currentStateId = String(state.current.state_id || '').trim();
      const options = getLifecycleTransitionOptions(compiled, currentStateId);

      return res.json({
        inquiry: queryText,
        entityId,
        machineId: state.current.machine_id,
        currentState: {
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

      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const historyLimit = Number(req.body?.limit || 50);
      const state = await getFsmEntityStateFromSql(entityId, { historyLimit });
      if (!state) {
        return res.status(404).json({ error: `Entity ${entityId} not found in FSM state store` });
      }

      const currentStateId = String(state.current.state_id || '').trim();
      const options = getLifecycleTransitionOptions(compiled, currentStateId);

      return res.json({
        inquiry: queryText,
        entityId,
        machineId: state.current.machine_id,
        currentState: {
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
