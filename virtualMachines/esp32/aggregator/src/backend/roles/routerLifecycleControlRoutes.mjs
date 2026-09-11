import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ALLOCATOR_DECISIONS_PATH = path.resolve(process.cwd(), 'data', 'allocator-decisions.jsonl');

export function registerRouterLifecycleControlRoutes(app, deps) {
  const {
    messageRouter,
    ensureRoute,
    enqueueViaRoute,
    startServiceRequestWorker,
    queueManagerRegistry,
    queueManagers,
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

  function normalizeServiceName(value) {
    return String(value || '').trim().toLowerCase();
  }

  async function appendAllocatorDecisionLog(entry) {
    const line = `${JSON.stringify(entry)}\n`;
    await fs.mkdir(path.dirname(ALLOCATOR_DECISIONS_PATH), { recursive: true });
    await fs.appendFile(ALLOCATOR_DECISIONS_PATH, line, 'utf8');
  }

  function summarizeInstance(instance) {
    if (!instance) return null;
    return {
      instanceId: instance.instanceId,
      serviceName: instance.serviceName,
      nodeId: instance.nodeId,
      ip: instance.ip,
      port: instance.port,
      failureDomain: instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default'
    };
  }

  async function handleHttpServiceInvoke(req, res) {
    try {
      const serviceId = String(
        req.params?.serviceId
        || req.params?.[0]
        || ''
      ).trim();
      if (!serviceId) {
        return res.status(400).json({ error: 'serviceId is required' });
      }

      const method = String(req.method || 'GET').trim().toUpperCase();
      const inputQueue = String(req.query?.inputQueue || '').trim() || `${serviceId}.in`;
      const payload = Object.prototype.hasOwnProperty.call(req, 'body') ? req.body : null;
      const jobId = `job-${randomUUID()}`;
      const requestQueue = `service.${normalizeServiceName(serviceId)}.requests`;
      const runtimeRoot = path.resolve(
        process.env.PULSE_RUNTIME_DATA_ROOT
          || process.env.PULSE_OPERATIONAL_DATA_ROOT
          || path.resolve(process.cwd(), 'runtime')
      );
      const jobRoot = path.join(runtimeRoot, 'service-jobs', jobId);
      const inputFile = path.join(jobRoot, 'input.json');
      const replyRoot = path.join(jobRoot, 'reply');
      await fs.mkdir(jobRoot, { recursive: true });
      await fs.writeFile(inputFile, `${JSON.stringify({ method, inputQueue, query: req.query || {}, body: payload })}\n`, 'utf8');

      const route = ensureRoute(requestQueue);
      if (!route) {
        return res.status(503).json({ error: 'No queue manager available', serviceId, requestQueue });
      }

      const manager = queueManagerRegistry?.get(route.managerId);
      if (manager?.local && queueManagers?.[manager.localIndex]?.updateQueueConfig) {
        queueManagers[manager.localIndex].updateQueueConfig(requestQueue, {
          dataTypeId: 'text-string',
          dataTypeIds: ['text-string'],
          queueClass: 'permanent',
          persistMessages: true,
          createdByUser: false
        });
      }

      const envelope = {
        jobId,
        serviceId,
        endpoint: String(req.path || `/api/services/${serviceId}`),
        method,
        inputFile,
        replyRoot,
        inputQueue
      };
      await enqueueViaRoute(route, requestQueue, envelope, 'http-service-request', null, ['text-string']);
      if (process.env.SERVICE_REQUEST_WORKER_AUTOSTART !== 'false') {
        startServiceRequestWorker(serviceId);
      }

      const decisionLogBase = {
        ts: new Date().toISOString(),
        route: '/api/services/:serviceId',
        mode: 'async-service-queue',
        serviceName: serviceId,
        method,
        inputQueue,
        scheduler: 'queue-claim-first-free',
        selected: {
          source: null,
          instance: null
        },
        allocator: null
      };

      void appendAllocatorDecisionLog({
        ...decisionLogBase,
        result: { status: 202, matched: true, jobId, requestQueue }
      }).catch(() => {});

      res.setHeader('x-pulse-router-mode', 'async-service-queue');
      return res.status(202).json({
        jobId,
        state: 'queued',
        serviceId,
        statusUrl: `/api/service-jobs/${jobId}`,
        requestQueue,
        inputFile,
        jsonFile: `${replyRoot}.json`,
        xmlFile: `${replyRoot}.xml`
      });

    } catch (e) {
      void appendAllocatorDecisionLog({
        ts: new Date().toISOString(),
        route: '/api/services/:serviceId',
        mode: 'http-fast-path',
        serviceName: String(req?.params?.serviceId || '').trim() || null,
        method: String(req?.method || 'GET').trim().toUpperCase(),
        selected: {
          source: 'error',
          instance: null
        },
        error: e?.message || String(e)
      }).catch(() => {});

      return res.status(500).json({ error: e.message });
    }
  }

  app.all('/api/services/:serviceId', handleHttpServiceInvoke);

  app.get('/api/service-jobs/:jobId', async (req, res) => {
    const jobId = String(req.params?.jobId || '').trim();
    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    const runtimeRoot = path.resolve(
      process.env.PULSE_RUNTIME_DATA_ROOT
        || process.env.PULSE_OPERATIONAL_DATA_ROOT
        || path.resolve(process.cwd(), 'runtime')
    );
    const jobRoot = path.join(runtimeRoot, 'service-jobs', jobId);
    const jsonFile = path.join(jobRoot, 'reply.json');
    const xmlFile = path.join(jobRoot, 'reply.xml');
    const errorFile = path.join(jobRoot, 'error.json');

    try {
      await fs.access(jsonFile);
      let result = null;
      try {
        result = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
      } catch {
        result = null;
      }
      return res.json({
        jobId,
        state: 'completed',
        jsonFile,
        xmlFile,
        errorFile: null,
        result
      });
    } catch {
      try {
        const error = JSON.parse(await fs.readFile(errorFile, 'utf8'));
        return res.json({ jobId, state: 'failed', jsonFile: null, xmlFile: null, errorFile, error });
      } catch {
        return res.status(202).json({ jobId, state: 'queued', jsonFile, xmlFile, errorFile });
      }
    }
  });

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
      const { inputQueue, message, sourceService, useEdge, edgeRole, mapKey, sourceType, destinationType } = req.body || {};
      if (!inputQueue) {
        return res.status(400).json({ error: 'inputQueue is required' });
      }
      const shouldForceEdge = parseBooleanLike(useEdge, false);
      const routed = await ingestWithEdgeFallback({
        inputQueue,
        message,
        sourceService: sourceService || 'webapi',
        forceEdge: shouldForceEdge,
        preferredEdgeRole: edgeRole,
        mapKey,
        sourceType,
        destinationType
      });
      res.json({ status: 'routed', mode: routed.mode, edge: routed.edge, result: routed.result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/edge/ingest', async (req, res) => {
    try {
      const { inputQueue, message, sourceService, useEdge, convertMtToXml, edgeRole, mapKey, sourceType, destinationType } = req.body || {};
      if (!inputQueue) return res.status(400).json({ error: 'inputQueue is required' });
      const convertRequested = parseBooleanLike(convertMtToXml, false);
      const routed = await ingestWithEdgeFallback({
        inputQueue,
        message,
        sourceService: sourceService || 'edge-api',
        forceEdge: parseBooleanLike(useEdge, true),
        convertMtToXml: convertRequested,
        preferredEdgeRole: edgeRole,
        mapKey,
        sourceType,
        destinationType
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
