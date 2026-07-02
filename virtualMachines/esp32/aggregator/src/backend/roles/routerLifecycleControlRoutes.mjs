import fs from 'node:fs/promises';
import path from 'node:path';

const ALLOCATOR_DECISIONS_PATH = path.resolve(process.cwd(), 'data', 'allocator-decisions.jsonl');
const SERVICE_ROUND_ROBIN_CURSOR = new Map();

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
    routerWorkers,
    serviceInstanceRegistry
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

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function listActiveServiceInstances(targetServiceId) {
    const wanted = normalizeServiceName(targetServiceId);
    if (!wanted || !serviceInstanceRegistry?.values) return [];
    return Array.from(serviceInstanceRegistry.values()).filter((instance) => {
      if (normalizeServiceName(instance?.serviceName) !== wanted) return false;
      const status = String(instance?.status || '').trim().toLowerCase();
      return status === 'up' || status === 'degraded' || status === 'available';
    });
  }

  function pickRoundRobinInstance(targetServiceId, instances) {
    const list = Array.isArray(instances) ? instances : [];
    if (list.length === 0) return null;

    const weightedPool = [];
    for (const instance of list) {
      const hardware = String(instance?.metadata?.hardware || '').trim().toLowerCase();
      let weight = 3;
      if (hardware.includes('esp32')) {
        weight = 9;
      } else if (hardware.includes('esp8266') || hardware.includes('esp-12')) {
        weight = 1;
      }

      const safeWeight = Math.max(1, Math.min(20, toNumber(instance?.metadata?.weight, weight)));
      for (let i = 0; i < safeWeight; i += 1) {
        weightedPool.push(instance);
      }
    }

    const pool = weightedPool.length > 0 ? weightedPool : list;
    const key = normalizeServiceName(targetServiceId) || 'default';
    const nextIndex = SERVICE_ROUND_ROBIN_CURSOR.get(key) || 0;
    const selected = pool[nextIndex % pool.length] || pool[0] || null;
    SERVICE_ROUND_ROBIN_CURSOR.set(key, (nextIndex + 1) % pool.length);
    return selected;
  }

  async function proxyHttpServiceInvocation(instance, req, { timeoutMs = 5000 } = {}) {
    if (!instance?.ip || !instance?.port) {
      throw new Error('Selected service instance has no reachable ip/port');
    }

    const serviceId = String(req.params?.serviceId || '').trim();
    const routeFromMetadata = String(instance?.metadata?.route || '').trim();
    const targetPath = routeFromMetadata || `/api/services/${encodeURIComponent(serviceId)}`;

    const normalizedPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    const queryEntries = Object.entries(req.query || {});
    const queryText = queryEntries.length > 0
      ? `?${new URLSearchParams(queryEntries.map(([k, v]) => [k, String(v)])).toString()}`
      : '';

    const url = `http://${instance.ip}:${instance.port}${normalizedPath}${queryText}`;
    const method = String(req.method || 'GET').trim().toUpperCase();
    const shouldSendBody = !['GET', 'HEAD'].includes(method);

    const forwardHeaders = {
      'content-type': 'application/json',
      'x-pulse-forwarded-by': 'aggregator-router-fast-path'
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 5000));
    try {
      const response = await fetch(url, {
        method,
        headers: forwardHeaders,
        body: shouldSendBody ? JSON.stringify(req.body ?? null) : undefined,
        signal: controller.signal
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      return {
        ok: response.ok,
        status: response.status,
        contentType,
        payload,
        instance
      };
    } finally {
      clearTimeout(timer);
    }
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
      const preferredNodeId = String(req.query?.nodeId || '').trim();
      const payload = Object.prototype.hasOwnProperty.call(req, 'body') ? req.body : null;

      const activeInstances = listActiveServiceInstances(serviceId);
      const invokeTimeoutMs = Math.max(200, toNumber(req.query?.timeoutMs, 5000));
      const selectedInstance = preferredNodeId
        ? (activeInstances.find(instance => String(instance?.nodeId || '').trim() === preferredNodeId) || null)
        : pickRoundRobinInstance(serviceId, activeInstances);

      const decisionLogBase = {
        ts: new Date().toISOString(),
        route: '/api/services/:serviceId',
        mode: 'http-round-robin',
        serviceName: serviceId,
        method,
        inputQueue,
        scheduler: 'round-robin-async',
        selected: {
          source: null,
          instance: null
        },
        preferredNodeId: preferredNodeId || null,
        allocator: null
      };

      // Async weighted round-robin remote dispatch with no fallback/retry.
      if (selectedInstance) {
        try {
          const remote = await proxyHttpServiceInvocation(selectedInstance, req, { timeoutMs: invokeTimeoutMs });

          if (remote.ok) {
            void appendAllocatorDecisionLog({
              ...decisionLogBase,
              selected: {
                source: 'round-robin',
                instance: summarizeInstance(selectedInstance)
              },
              result: {
                status: remote.status,
                matched: true
              }
            }).catch(() => {});

            res.setHeader('x-pulse-router-mode', 'http-round-robin-proxy-async');
            res.setHeader('x-pulse-router-target-node', String(selectedInstance.nodeId || selectedInstance.ip || 'unknown'));

            if (remote.contentType.includes('application/json') && remote.payload && typeof remote.payload === 'object') {
              return res.status(remote.status).json({
                ...remote.payload,
                allocator: {
                  scheduler: 'round-robin-async',
                  selectedInstance: {
                    instanceId: selectedInstance.instanceId,
                    nodeId: selectedInstance.nodeId,
                    ip: selectedInstance.ip,
                    port: selectedInstance.port
                  }
                }
              });
            }
            return res.status(remote.status).send(remote.payload == null ? '' : String(remote.payload));
          }

          throw new Error(`Round-robin remote returned status ${remote.status}`);
        } catch (roundRobinError) {
          void appendAllocatorDecisionLog({
            ...decisionLogBase,
            selected: {
              source: 'round-robin-error',
              instance: summarizeInstance(selectedInstance)
            },
            error: roundRobinError?.message || 'round-robin-remote-failed'
          }).catch(() => {});

          return res.status(502).json({
            error: 'Remote service invocation failed',
            serviceId,
            nodeId: selectedInstance?.nodeId || null,
            message: roundRobinError?.message || 'round-robin-remote-failed'
          });
        }
      }

      const result = await messageRouter.invokeHttpService({
        serviceId,
        httpVerb: method,
        inputQueue,
        message: payload,
        sourceService: 'http-fast-path',
        requestContext: {
          path: req.path,
          query: req.query || {},
          headers: req.headers || {},
          body: payload
        }
      });

      if (result?.orchestration && result.orchestration.success === false) {
        return res.status(502).json({
          error: 'Orchestrated transaction failed',
          serviceId,
          method,
          inputQueue,
          orchestration: result.orchestration
        });
      }

      if (result?.orchestration && result.orchestration.success === true) {
        return res.json({
          mode: 'program-orchestration',
          serviceId,
          method,
          inputQueue,
          orchestration: result.orchestration,
          response: result.response
        });
      }

      if (!result || result.matchedOutputCount === 0) {
        void appendAllocatorDecisionLog({
          ...decisionLogBase,
          selected: {
            source: 'local-fast-path-no-match',
              instance: summarizeInstance(selectedInstance)
          },
          result: {
            status: 404,
            matched: false
          }
        }).catch(() => {});

        return res.status(404).json({
          error: 'No matching service handler',
          serviceId,
          method,
          inputQueue
        });
      }

      const responseValue = result.response;
      const metadata = {
        mode: 'http-fast-path',
        serviceId,
        method,
        inputQueue,
        matchedRuleCount: result.matchedRuleCount,
        matchedOutputCount: result.matchedOutputCount,
        allocator: null
      };

      void appendAllocatorDecisionLog({
        ...decisionLogBase,
        selected: {
          source: 'local-fast-path',
          instance: summarizeInstance(selectedInstance)
        },
        result: {
          status: 200,
          matched: true,
          matchedRuleCount: result.matchedRuleCount,
          matchedOutputCount: result.matchedOutputCount
        }
      }).catch(() => {});

      if (typeof responseValue === 'string') {
        res.setHeader('x-pulse-router-mode', 'http-fast-path');
        res.setHeader('x-pulse-service-id', serviceId);
        return res.send(responseValue);
      }

      if (responseValue == null) {
        return res.status(204).end();
      }

      if (typeof responseValue === 'object') {
        return res.json({ ...metadata, response: responseValue });
      }

      return res.send(String(responseValue));
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
