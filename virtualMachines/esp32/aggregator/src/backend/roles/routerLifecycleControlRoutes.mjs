export function registerRouterLifecycleControlRoutes(app, deps) {
  const {
    messageRouter,
    parseBooleanLike,
    ingestWithEdgeFallback,
    getRouterWorkersPayload,
    readTransactionLifecycleCompiled,
    buildTransactionLifecycleDashboardPayload,
    requirePermission,
    enableLifecyclePathTesters,
    deriveLifecycleHappyPath,
    deriveLifecycleSadPath,
    runLifecycleHappyPath,
    runLifecycleSadPath,
    recordLifecycleTesterRun,
    getLifecycleHeartbeatPayload,
    enqueueLifecycleHeartbeat,
    lifecycleHeartbeat,
    lifecycleHarnessStartTransaction,
    lifecycleHarnessAdvance,
    lifecycleActionPolicy,
    getLatencyPolicyThresholds,
    workerConfigRef,
    validateLatencyPolicyTargetsUpdate,
    applyLatencyPolicyTargetsUpdate,
    persistWorkerConfig,
    workerConfigPath,
    getTxStatePersistenceSummary,
    shipQueuedTransactionStateLogs,
    txStateLogShippingBatchSize,
    getWorkerDefaults,
    validateWorkerConfigUpdate,
    applyWorkerConfigUpdate,
    routerWorkers
  } = deps;

  app.post('/api/router/rules', async (req, res) => {
    try {
      const rule = await messageRouter.upsertRule(req.body || {});
      res.json({ status: 'upserted', rule });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/router/rules/:ruleId', async (req, res) => {
    try {
      const removed = await messageRouter.deleteRule(req.params.ruleId);
      if (!removed) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      res.json({ status: 'deleted', ruleId: req.params.ruleId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/router/ingest', async (req, res) => {
    try {
      const { inputQueue, message, sourceService, useEdge, edgeRole } = req.body || {};
      if (!inputQueue) {
        return res.status(400).json({ error: 'inputQueue is required' });
      }
      const shouldForceEdge = parseBooleanLike(useEdge, false);
      const routed = await ingestWithEdgeFallback({
        inputQueue,
        message,
        sourceService: sourceService || 'webapi',
        forceEdge: shouldForceEdge,
        preferredEdgeRole: edgeRole
      });
      res.json({ status: 'routed', mode: routed.mode, edge: routed.edge, result: routed.result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/edge/ingest', async (req, res) => {
    try {
      const { inputQueue, message, sourceService, useEdge, convertMtToXml, edgeRole } = req.body || {};
      if (!inputQueue) return res.status(400).json({ error: 'inputQueue is required' });
      const convertRequested = parseBooleanLike(convertMtToXml, false);
      const routed = await ingestWithEdgeFallback({
        inputQueue,
        message,
        sourceService: sourceService || 'edge-api',
        forceEdge: parseBooleanLike(useEdge, true),
        convertMtToXml: convertRequested,
        preferredEdgeRole: edgeRole
      });
      return res.json({
        status: 'ok',
        mode: routed.mode,
        edge: routed.edge,
        conversion: {
          requested: convertRequested,
          location: 'esp32-edge'
        },
        result: routed.result
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/router/process/:inputQueue', async (req, res) => {
    try {
      const { inputQueue } = req.params;
      const { maxMessages, consumerService } = req.body || {};
      const result = await messageRouter.processFromQueue(inputQueue, {
        maxMessages: maxMessages || 1,
        consumerService: consumerService || 'router-worker'
      });
      res.json({ status: 'processed', mode: 'queue', result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/router/workers', (req, res) => {
    res.json({ workers: getRouterWorkersPayload() });
  });

  app.get('/api/lifecycle/dashboard', (req, res) => {
    const compiled = readTransactionLifecycleCompiled();
    if (!compiled) {
      return res.status(404).json({
        error: 'Lifecycle compiled artifact not found',
        hint: 'Run: npm run compile:lifecycle'
      });
    }

    const payload = buildTransactionLifecycleDashboardPayload(compiled);
    if (!payload) {
      return res.status(500).json({ error: 'Lifecycle artifact is invalid' });
    }

    return res.json(payload);
  });

  app.get('/api/lifecycle/happy-path', requirePermission('lifecycle.read'), (req, res) => {
    if (!enableLifecyclePathTesters) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }
      const happyPath = deriveLifecycleHappyPath(compiled);
      return res.json({ status: 'ok', happyPath });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/sad-path', requirePermission('lifecycle.read'), (req, res) => {
    if (!enableLifecyclePathTesters) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }
      const sadPath = deriveLifecycleSadPath(compiled);
      return res.json({ status: 'ok', sadPath });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/happy-path/run', requirePermission('lifecycle.manage'), async (req, res) => {
    if (!enableLifecyclePathTesters) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { txId, message } = req.body || {};
      const result = await runLifecycleHappyPath(compiled, { txId, message });
      recordLifecycleTesterRun('happy', {
        status: 'completed',
        transitionCount: result.transitionCount,
        transactionId: result.transactionId
      });
      return res.json({ status: 'completed', result });
    } catch (e) {
      recordLifecycleTesterRun('happy', {
        status: 'failed',
        error: e.message
      });
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/sad-path/run', requirePermission('lifecycle.manage'), async (req, res) => {
    if (!enableLifecyclePathTesters) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { txId, message } = req.body || {};
      const result = await runLifecycleSadPath(compiled, { txId, message });
      recordLifecycleTesterRun('sad', {
        status: 'completed',
        transitionCount: result.transitionCount,
        transactionId: result.transactionId
      });
      return res.json({ status: 'completed', result });
    } catch (e) {
      recordLifecycleTesterRun('sad', {
        status: 'failed',
        error: e.message
      });
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/heartbeat', requirePermission('lifecycle.read'), (req, res) => {
    res.json({ heartbeat: getLifecycleHeartbeatPayload() });
  });

  app.post('/api/lifecycle/heartbeat/trigger', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { reason } = req.body || {};
      const heartbeat = await enqueueLifecycleHeartbeat(compiled, {
        reason: reason || 'manual-trigger',
        sourceService: 'lifecycle-heartbeat:manual'
      });
      lifecycleHeartbeat.manualRuns += 1;
      return res.json({ status: 'queued', heartbeat, monitor: getLifecycleHeartbeatPayload() });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/test/start', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { txId, message } = req.body || {};
      const active = await lifecycleHarnessStartTransaction(compiled, { txId, message });
      return res.json({ status: 'started', active });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/test/step', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { eventName, status, statementMatch, replacementMessage } = req.body || {};
      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: eventName || null,
        context: { status, statementMatch },
        replacementMessage: replacementMessage || null
      });
      return res.json({ status: 'advanced', ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/simulators/bank-of-canada/approve', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: 'lynx_approved',
        context: { status: 'approved' }
      });
      return res.json({ status: 'simulated', simulator: 'bank-of-canada-approve', ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/simulators/bank-of-canada/reject', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: 'lynx_rejected',
        context: { status: 'rejected' }
      });
      return res.json({ status: 'simulated', simulator: 'bank-of-canada-reject', ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/simulators/correspondent/send-mt940', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { statementRef } = req.body || {};
      const ref = String(statementRef || lifecycleHeartbeat.active?.transactionId || 'UNKNOWN');
      const mt940 = `:20:${ref}\n:25:CORR-ACCOUNT-001\n:61:260514C12500,NTRFNONREF//${ref}\n:86:Settlement confirmed`;

      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: 'statement_matched',
        context: { statementMatch: true },
        replacementMessage: mt940
      });
      return res.json({ status: 'simulated', simulator: 'correspondent-mt940', mt940, ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/policy', requirePermission('lifecycle.policy.read'), (req, res) => {
    res.json({
      policy: {
        allowDbSync: Boolean(lifecycleActionPolicy.allowDbSync),
        allowDbAsync: Boolean(lifecycleActionPolicy.allowDbAsync)
      }
    });
  });

  app.post('/api/lifecycle/policy', requirePermission('lifecycle.policy.manage'), (req, res) => {
    const { allowDbSync, allowDbAsync } = req.body || {};
    if (typeof allowDbSync !== 'undefined') {
      lifecycleActionPolicy.allowDbSync = Boolean(allowDbSync);
    }
    if (typeof allowDbAsync !== 'undefined') {
      lifecycleActionPolicy.allowDbAsync = Boolean(allowDbAsync);
    }

    res.json({
      status: 'updated',
      policy: {
        allowDbSync: Boolean(lifecycleActionPolicy.allowDbSync),
        allowDbAsync: Boolean(lifecycleActionPolicy.allowDbAsync)
      }
    });
  });

  app.get('/api/lifecycle/policy/flow-targets', requirePermission('lifecycle.policy.read'), (req, res) => {
    res.json({
      status: 'ok',
      configSource: 'worker-config.json',
      flowTargets: getLatencyPolicyThresholds(workerConfigRef.current)
    });
  });

  app.post('/api/lifecycle/policy/flow-targets', requirePermission('lifecycle.policy.manage'), (req, res) => {
    try {
      const payload = req.body || {};
      const errors = validateLatencyPolicyTargetsUpdate(payload);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      workerConfigRef.current = applyLatencyPolicyTargetsUpdate(workerConfigRef.current, payload, req.actor?.userId || 'unknown');

      try {
        persistWorkerConfig(workerConfigRef.current, workerConfigPath);
      } catch (e) {
        console.warn(`[CONFIG] Failed to persist flow targets: ${e.message}`);
      }

      res.json({
        status: 'updated',
        message: 'Flow targets saved to worker-config.json.',
        flowTargets: getLatencyPolicyThresholds(workerConfigRef.current)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/tx-state-persistence', requirePermission('lifecycle.read'), (req, res) => {
    res.json({
      status: 'ok',
      persistence: getTxStatePersistenceSummary()
    });
  });

  app.post('/api/lifecycle/tx-state-log-shipping/run', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const maxEntries = Math.max(1, Number(req.body?.maxEntries || txStateLogShippingBatchSize));
      const result = await shipQueuedTransactionStateLogs({ maxEntries });
      res.json({
        status: 'ok',
        run: result,
        persistence: getTxStatePersistenceSummary()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/workers/config', (req, res) => {
    const defaults = getWorkerDefaults();
    res.json({
      status: 'ok',
      configSource: 'worker-config.json',
      current: {
        intervalMs: defaults.intervalMs,
        batchSize: defaults.batchSize,
        numWorkersPerQueue: defaults.numWorkers,
        priorityQueues: defaults.priorityQueues
      },
      latencyPolicies: getLatencyPolicyThresholds(workerConfigRef.current),
      raw: workerConfigRef.current.workers?.router || {},
      limits: workerConfigRef.current.workers?.router?.limits || {},
      recommendations: {
        note: 'Adjust these values based on queue depth and system resources',
        factors: [
          'High queue depth: increase batchSize or numWorkers',
          'CPU >80%: decrease batchSize or increase intervalMs',
          'Memory pressure: decrease numWorkers or batchSize',
          'Compute nodes joined: can safely increase numWorkers',
          'Compute nodes removed: reduce numWorkers gracefully'
        ]
      }
    });
  });

  app.post('/api/workers/config', requirePermission('workers.configure'), (req, res) => {
    try {
      const { intervalMs, batchSize, numWorkersPerQueue } = req.body || {};

      const errors = validateWorkerConfigUpdate(workerConfigRef.current, {
        intervalMs,
        batchSize,
        numWorkersPerQueue
      });

      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      workerConfigRef.current = applyWorkerConfigUpdate(
        workerConfigRef.current,
        { intervalMs, batchSize, numWorkersPerQueue },
        req.actor?.userId || 'unknown'
      );

      try {
        persistWorkerConfig(workerConfigRef.current, workerConfigPath);
        console.log(`[CONFIG] Worker configuration updated: interval=${intervalMs} batch=${batchSize} workers=${numWorkersPerQueue}`);
      } catch (e) {
        console.warn(`[CONFIG] Failed to persist config: ${e.message}`);
      }

      res.json({
        status: 'updated',
        message: 'Worker configuration updated. Restart backend or redeploy workers to apply changes.',
        updated: {
          intervalMs,
          batchSize,
          numWorkersPerQueue
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/workers/recommendations', (req, res) => {
    const defaults = getWorkerDefaults();
    const recommendations = [];
    const latencyPolicySummary = evaluateLatencyPolicies(metricsCollector.getCurrentMetrics(), workerConfigRef.current);

    const totalWorkers = routerWorkers.size;

    if (totalWorkers < 10) {
      recommendations.push({
        type: 'info',
        message: 'Current system has few workers - consider scaling up if experiencing queue backlog'
      });
    }

    if (defaults.batchSize < 50) {
      recommendations.push({
        type: 'warning',
        message: 'Batch size is low - consider increasing to 50-100 for better throughput'
      });
    }

    if (defaults.intervalMs > 500) {
      recommendations.push({
        type: 'warning',
        message: 'Processing interval is high - consider reducing to 200-300ms for better responsiveness'
      });
    }

    for (const [targetId, result] of Object.entries(latencyPolicySummary.evaluations || {})) {
      if (result.status === 'critical') {
        recommendations.push({
          type: 'critical',
          message: `${targetId} p95 ${result.p95Ms}ms exceeds target ${result.targetP95Ms}ms - scale up workers or reduce interval`
        });
      } else if (result.status === 'warning') {
        recommendations.push({
          type: 'warning',
          message: `${targetId} p95 ${result.p95Ms}ms is approaching target ${result.targetP95Ms}ms`
        });
      } else if (result.status === 'no-data') {
        recommendations.push({
          type: 'info',
          message: `${targetId} has no latency samples yet - ensure recordCompletion is emitted for tracked queues`
        });
      }
    }

    res.json({
      status: 'ok',
      currentConfig: {
        totalWorkers: totalWorkers,
        intervalMs: defaults.intervalMs,
        batchSize: defaults.batchSize,
        workersPerQueue: defaults.numWorkers
      },
      latencyPolicies: latencyPolicySummary,
      recommendations: recommendations.length > 0 ? recommendations : [
        { type: 'ok', message: 'Current configuration looks good' }
      ]
    });
  });
}
