import fs from 'fs/promises';
import path from 'path';
import { createServiceLifecyclePolicy } from './serviceLifecyclePolicy.mjs';
import { getServiceEntry } from './serviceRegistry.mjs';

function nowIso() {
  return new Date().toISOString();
}

function normalizeId(value) {
  return String(value || '').trim();
}

function resolveCommand(command) {
  const value = String(command || '').trim();
  if (value === 'node') return process.execPath;
  if (process.platform === 'win32' && value === 'npm') return 'npm.cmd';
  return value;
}

function trimLogs(logs, maxLines) {
  if (logs.length > maxLines) logs.splice(0, logs.length - maxLines);
}

export async function createServiceProcessManager(options = {}) {
  const {
    manifestPath,
    appRoot = process.cwd(),
    spawn,
    logger = console,
    healthTimeoutMs = 2000,
    startupTimeoutMs = 20000,
    logLineLimit = 200,
    fetchImpl = fetch,
    ownerAggregatorId = process.env.PULSE_AGGREGATOR_ID || 'local-workspace',
    aggregatorUrls = [],
    statePath = null,
    serviceOverrides = {},
    infrastructureConfig = null,
    checkIntervalMs = 5000,
    onObservation = () => {}
  } = options;

  if (!manifestPath) throw new Error('manifestPath is required');
  if (typeof spawn !== 'function') throw new Error('spawn is required');

  const raw = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);
  const services = new Map();
  const processes = new Map();
  const pendingStarts = new Map();
  const desired = new Set();
  const policy = await createServiceLifecyclePolicy({ logger });
  let timer = null;
  let stopped = false;
  let reconciling = null;
  const epoch = Date.now();
  let persistence = Promise.resolve();
  let controls = Promise.resolve();
  function control(operation) {
    const result = controls.then(operation);
    controls = result.catch(error => logger.warn('[SERVICE] Control request failed:', error.message));
    return result;
  }

  for (const service of manifest.services || []) {
    const id = normalizeId(service.id);
    if (!id) continue;
    let configuration = {};
    if (service.registryKey) {
      const entry = getServiceEntry(service.registryKey);
      const rawPort = entry.portEnvVar ? process.env[entry.portEnvVar] : undefined;
      const port = rawPort === undefined || rawPort === '' ? entry.port : Number(rawPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid configured port for ${id}`);
      }
      const host = entry.host === '0.0.0.0' ? '127.0.0.1' : entry.host;
      const origin = `http://${host}:${port}`;
      configuration = {
        port, endpoint: origin,
        healthUrl: new URL(new URL(service.healthUrl).pathname, origin).href,
        ...(service.readinessUrl ? { readinessUrl: new URL(new URL(service.readinessUrl).pathname, origin).href } : {}),
        env: { ...service.env, ...(entry.portEnvVar ? { [entry.portEnvVar]: String(port) } : {}) },
      };
    }
    services.set(id, {
      startPolicy: 'on-demand',
      dependencies: [],
      args: [],
      env: {},
      ...service,
      ...configuration,
      ...(serviceOverrides[id] || {}),
      management: service.management || 'managed',
      ownerAggregatorId: service.ownerAggregatorId || '',
      id
    });
  }
  if (infrastructureConfig) {
    const decisions = await policy.dispatch('/infrastructure-dependencies', infrastructureConfig);
    for (const [id, dependencies] of Object.entries(decisions.dependencies)) {
      if (!services.has(id)) continue;
      const service = services.get(id);
      service.dependencies = [...new Set([...service.dependencies, ...dependencies])];
    }
  }
  const graph = () => Object.fromEntries(services);
  async function orderFor(roots) {
    return (await policy.dispatch('/start-order', {
      services: graph(), ids: [...services.keys()], roots,
    })).order;
  }
  // Reject malformed manifests before any process is launched.
  await orderFor([...services.keys()]);
  if (statePath) {
    try {
      const saved = JSON.parse(await fs.readFile(statePath, 'utf8'));
      if (saved.version !== 1 || saved.ownerAggregatorId !== ownerAggregatorId || !Array.isArray(saved.desired)) {
        throw new Error('Invalid desired-state ownership or version');
      }
      for (const id of saved.desired) {
        if (!services.has(id)) throw new Error(`Persisted desired service ${id} is not configured`);
        desired.add(id);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  function persistDesired() {
    if (!statePath) return Promise.resolve();
    const snapshot = JSON.stringify({ version: 1, ownerAggregatorId, desired: [...desired] });
    const operation = persistence.then(async () => {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      const temporary = `${statePath}.tmp`;
      const file = await fs.open(temporary, 'w');
      try { await file.writeFile(`${snapshot}\n`); await file.sync(); }
      finally { await file.close(); }
      await fs.rename(temporary, statePath);
    });
    persistence = operation.catch(error => logger.error('[SERVICE] Desired-state persistence failed:', error.message));
    return operation;
  }

  async function probe(url, readiness = false) {
    if (!url) return { ok: false, reason: 'No probe URL configured' };
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(healthTimeoutMs) });
      if (!response.ok) return { ok: false, reason: `HTTP ${response.status} at ${url}` };
      if (readiness && (await response.json()).ready !== true) {
        return { ok: false, reason: `Instance is not ready at ${url}` };
      }
      return { ok: true, reason: '' };
    } catch (error) {
      return { ok: false, reason: `${url}: ${error.message}` };
    }
  }
  async function isHealthy(service) {
    return (await probe(service?.readinessUrl || service?.healthUrl, !!service?.readinessUrl)).ok;
  }
  async function observe() {
    const observations = {};
    for (const id of await orderFor([...services.keys()])) {
      const service = services.get(id);
      const alive = await probe(service.healthUrl);
      const readiness = service.readinessUrl
        ? await probe(service.readinessUrl, true) : alive;
      observations[id] = { alive: alive.ok, ready: readiness.ok, reason: readiness.reason };
      const decision = await policy.dispatch('/evaluate', {
        services: graph(), observations, id, owner: ownerAggregatorId,
      });
      observations[id] = { ...observations[id], ...decision };
      const entry = processes.get(id) || { logs: [] };
      entry.readiness = decision;
      entry.lastError = readiness.reason || null;
      entry.lastHealthAt = alive.ok ? nowIso() : entry.lastHealthAt;
      entry.status = alive.ok ? (entry.child ? 'running' : 'external')
        : entry.child ? 'starting' : entry.status === 'failed' ? 'failed' : 'stopped';
      processes.set(id, entry);
      onObservation(getState(id));
    }
    return observations;
  }

  function getState(id) {
    const service = services.get(id);
    if (!service) return null;
    const entry = processes.get(id) || {};
    return {
      id,
      name: service.name || id,
      startPolicy: service.startPolicy || 'on-demand',
      dependencies: service.dependencies || [],
      port: service.port || null,
      healthUrl: service.healthUrl || null,
      readinessUrl: service.readinessUrl || null,
      readiness: entry.readiness || { ready: false, state: 'unknown', blockedBy: [] },
      ownerAggregatorId: service.ownerAggregatorId || ownerAggregatorId,
      management: service.management,
      desiredState: desired.has(id) ? 'running' : 'stopped',
      status: entry.status || 'stopped',
      pid: entry.child?.pid || null,
      managed: !!entry.child,
      startedAt: entry.startedAt || null,
      stoppedAt: entry.stoppedAt || null,
      exitCode: entry.exitCode ?? null,
      signal: entry.signal || null,
      lastError: entry.lastError || null,
      lastHealthAt: entry.lastHealthAt || null,
      logs: entry.logs || []
    };
  }

  async function refreshService(id) {
    const service = services.get(id);
    if (!service) throw new Error(`Unknown service ${id}`);
    const entry = processes.get(id) || { logs: [] };
    const healthy = await isHealthy(service);
    if (healthy) {
      entry.status = entry.child ? 'running' : 'external';
      entry.lastHealthAt = nowIso();
    } else if (!entry.child) {
      entry.status = entry.status === 'failed' ? 'failed' : 'stopped';
    }
    processes.set(id, entry);
    return getState(id);
  }

  async function waitForHealthy(id, timeoutMs) {
    const started = Date.now();
    const service = services.get(id);
    if (timeoutMs === undefined) {
      const settings = await policy.dispatch('/startup-policy', {
        serviceId: service.serviceId || id, defaultTimeoutMs: startupTimeoutMs,
      });
      timeoutMs = settings.timeoutMs;
    }
    while (Date.now() - started < timeoutMs) {
      const current = processes.get(id);
      if (current?.child && current.child.exitCode !== null) {
        current.status = current.child.exitCode === 0 ? 'stopped' : 'failed';
        current.exitCode = current.child.exitCode;
        processes.set(id, current);
        const recentLogs = (current.logs || []).slice(-10).join('').trim();
        throw new Error(`Service ${id} exited before becoming healthy (code=${current.exitCode}).${recentLogs ? ` Recent logs: ${recentLogs}` : ''}`);
      }
      if (await isHealthy(service)) {
        const entry = processes.get(id) || { logs: [] };
        entry.status = entry.child ? 'running' : 'external';
        entry.lastHealthAt = nowIso();
        processes.set(id, entry);
        return getState(id);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const entry = processes.get(id);
    const recentLogs = (entry?.logs || []).slice(-10).join('').trim();
    if (entry?.child && entry.child.exitCode === null) {
      const alive = await probe(service.healthUrl);
      const decision = await policy.dispatch('/startup-timeout', { alive: alive.ok });
      entry.status = decision.action === 'keep' ? 'running' : 'failed';
      entry.lastError = `Timed out waiting for ${id} readiness at ${service.readinessUrl || service.healthUrl}`;
      if (decision.action === 'terminate') entry.child.kill();
      processes.set(id, entry);
    }
    throw new Error(`Timed out waiting for ${id} readiness at ${service.readinessUrl || service.healthUrl}.${recentLogs ? ` Recent logs: ${recentLogs}` : ''}`);
  }

  async function startOneService(id, options = {}) {
    const serviceId = normalizeId(id);
    const service = services.get(serviceId);
    if (!service) throw new Error(`Unknown service ${serviceId}`);

    if (await isHealthy(service)) {
      const entry = processes.get(serviceId) || { logs: [] };
      entry.status = entry.child ? 'running' : 'external';
      entry.lastHealthAt = nowIso();
      processes.set(serviceId, entry);
      return getState(serviceId);
    }

    const existing = processes.get(serviceId);
    if (existing?.child && existing.child.exitCode === null) {
      existing.status = 'starting';
      processes.set(serviceId, existing);
      return options.waitForHealthy === false ? getState(serviceId) : waitForHealthy(serviceId, options.timeoutMs);
    }

    const command = resolveCommand(service.command);
    if (!command) throw new Error(`Service ${serviceId} has no command`);
    const recovery = await policy.dispatch('/recovery', {
      attempts: existing?.restartAttempts || 0,
      now: Math.floor((Date.now() - epoch) / 1000),
      lastAttempt: existing?.lastAttemptTick || 0,
    });
    if (recovery.action !== 'start') throw new Error(`Service ${serviceId} is in recovery backoff (${recovery.delaySeconds}s)`);
    const cwd = path.resolve(appRoot, service.cwd || '.');
    const entry = {
      child: null,
      status: 'starting',
      startedAt: nowIso(),
      stoppedAt: null,
      exitCode: null,
      signal: null,
      lastError: null,
      restartAttempts: existing?.restartAttempts || 0,
      lastAttemptTick: Math.floor((Date.now() - epoch) / 1000),
      logs: []
    };

    logger.log(`[SERVICE] Starting ${serviceId}: ${command} ${(service.args || []).join(' ')}`);
    const bindings = Object.fromEntries((service.dependencies || []).map(dependencyId => {
      const dependency = services.get(dependencyId);
      return [dependency.serviceId || dependency.id, {
        instanceId: dependency.instanceId || `${dependency.id}:${ownerAggregatorId}`,
        endpoint: dependency.endpoint || new URL(dependency.healthUrl).origin,
        readinessUrl: dependency.readinessUrl || dependency.healthUrl,
      }];
    }));
    const child = spawn(command, service.args || [], {
      cwd,
      env: {
        ...process.env, ...(service.env || {}),
        PULSE_SERVICE_BINDINGS: JSON.stringify(bindings),
        PULSE_SERVICE_INSTANCE_ID: service.instanceId || `${serviceId}:${ownerAggregatorId}`,
        PULSE_OWNER_AGGREGATOR_ID: service.ownerAggregatorId || ownerAggregatorId,
        PULSE_AGGREGATOR_URLS: JSON.stringify(aggregatorUrls),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    entry.child = child;
    processes.set(serviceId, entry);

    child.stdout.on('data', chunk => {
      entry.logs.push(String(chunk));
      trimLogs(entry.logs, logLineLimit);
    });
    child.stderr.on('data', chunk => {
      const text = String(chunk);
      entry.lastError = text;
      entry.logs.push(text);
      trimLogs(entry.logs, logLineLimit);
    });
    child.on('error', error => {
      entry.status = 'failed';
      entry.restartAttempts++;
      entry.lastError = error.message;
      entry.logs.push(error.message);
      trimLogs(entry.logs, logLineLimit);
    });
    child.on('exit', (code, signal) => {
      const operatorStop = entry.status === 'stopping';
      entry.status = operatorStop || code === 0 ? 'stopped' : 'failed';
      if (!operatorStop) entry.restartAttempts++;
      entry.exitCode = code;
      entry.signal = signal;
      entry.stoppedAt = nowIso();
      entry.child = null;
    });

    return options.waitForHealthy === false ? getState(serviceId) : waitForHealthy(serviceId, options.timeoutMs);
  }

  async function startServiceInternal(id, options = {}) {
    if (stopped) throw new Error('Service supervisor is shut down');
    const serviceId = normalizeId(id);
    const order = await orderFor([serviceId]);
    for (const target of order) desired.add(target);
    await persistDesired();
    if (!timer) schedule();
    for (const target of order) {
      const observations = await observe();
      const decision = observations[target];
      if (decision.ready) continue;
      if (decision.action !== 'start' && !processes.get(target)?.child) {
        throw new Error(`Service ${target} is ${decision.state}: ${JSON.stringify(decision.blockedBy)}`);
      }
      if (decision.blockedBy.length) {
        throw new Error(`Service ${target} is blocked: ${JSON.stringify(decision.blockedBy)}`);
      }
      if (!pendingStarts.has(target)) {
        const pending = startOneService(target, {
          ...options, waitForHealthy: target === serviceId ? options.waitForHealthy : true,
        }).finally(() => pendingStarts.delete(target));
        pendingStarts.set(target, pending);
      }
      await pendingStarts.get(target);
    }
    await observe();
    return getState(serviceId);
  }

  async function stopServiceInternal(id, options = {}) {
    const serviceId = normalizeId(id);
    if (!services.has(serviceId)) throw new Error(`Unknown service ${serviceId}`);
    const result = await policy.dispatch('/stop-order', {
      services: graph(), ids: [...services.keys()], order: await orderFor([...services.keys()]),
      desired: Object.fromEntries([...services.keys()].map(key => [key, desired.has(key)])),
      id: serviceId, cascade: options.cascade === true, owner: ownerAggregatorId,
    });
    for (const target of result.order) desired.delete(target);
    await persistDesired();
    for (const target of result.order) {
      await pendingStarts.get(target)?.catch(error => logger.warn('[SERVICE] Start interrupted before stop:', error.message));
      const entry = processes.get(target);
      if (!entry?.child || entry.child.exitCode !== null) continue;
      const child = entry.child;
      entry.status = 'stopping';
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.removeListener('exit', onExit);
          reject(new Error(`Service ${target} did not exit after stop request`));
        }, 10000);
        function onExit() { clearTimeout(timeout); resolve(); }
        child.once('exit', onExit);
        if (child.kill() === false) {
          clearTimeout(timeout); child.removeListener('exit', onExit);
          reject(new Error(`Service ${target} rejected stop request`));
        }
      });
    }
    return refreshService(serviceId);
  }

  async function restartService(id, options = {}) {
    return control(async () => {
      await stopServiceInternal(id, options);
      return startServiceInternal(id, options);
    });
  }

  const startService = (id, options) => control(() => startServiceInternal(id, options));
  const stopService = (id, options) => control(() => stopServiceInternal(id, options));

  async function ensureServiceRunning(id, options = {}) {
    return startService(id, options);
  }

  async function listServices() {
    await observe();
    const output = [...services.keys()].map(getState);
    return output.sort((a, b) => a.id.localeCompare(b.id));
  }
  async function reconcile() {
    for (const id of [...desired]) {
      if (stopped || !desired.has(id)) continue;
      try { await control(() => desired.has(id) ? startServiceInternal(id) : undefined); }
      catch (error) {
        const entry = processes.get(id) || { logs: [] };
        if (entry.lastReconcileError !== error.message) logger.warn(`[SERVICE] ${id}: ${error.message}`);
        entry.lastReconcileError = error.message;
        entry.lastError = error.message;
        processes.set(id, entry);
      }
    }
  }
  function schedule() {
    if (stopped) return;
    timer = setTimeout(async () => {
      reconciling = reconcile();
      try { await reconciling; }
      catch (error) { logger.error('[SERVICE] Reconciliation failed:', error.message); }
      finally { reconciling = null; }
      schedule();
    }, checkIntervalMs);
    timer.unref?.();
  }
  async function supervise(ids) {
    for (const id of ids) desired.add(id);
    await persistDesired();
    await reconcile();
    if (!timer) schedule();
  }
  async function shutdown() {
    stopped = true;
    clearTimeout(timer);
    await reconciling;
    await controls;
    await Promise.allSettled([...pendingStarts.values()]);
    await persistence;
    for (const id of (await orderFor([...services.keys()])).reverse()) {
      const child = processes.get(id)?.child;
      if (child && child.exitCode === null) child.kill();
    }
    await policy.stop();
  }

  if (desired.size > 0) schedule();
  return {
    manifest: { version: manifest.version || 1, path: manifestPath },
    listServices,
    getService: async (id) => refreshService(normalizeId(id)),
    startService,
    stopService,
    restartService,
    ensureServiceRunning,
    supervise,
    shutdown
  };
}

export function registerServiceProcessRoutes(app, options = {}) {
  const { serviceProcessManager, serviceInstanceReports, serviceInstanceRegistry, serviceTransactions, requirePermission, runtimeMachineAuth } = options;
  if (!serviceProcessManager) return;

  const localBypassEnabled = !['0', 'false', 'no'].includes(String(process.env.PULSE_SERVICE_CONTROL_LOCAL_BYPASS || '1').trim().toLowerCase());
  const isLoopbackRequest = (req) => {
    const candidates = [
      req.ip,
      req.socket?.remoteAddress,
      req.connection?.remoteAddress
    ].map(value => String(value || '').trim()).filter(Boolean);
    return candidates.some(value => value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1');
  };
  const guard = (permission) => {
    const permissionGuard = typeof requirePermission === 'function'
      ? requirePermission(permission)
      : (_req, _res, next) => next();
    return (req, res, next) => {
      if (localBypassEnabled && isLoopbackRequest(req)) return next();
      return permissionGuard(req, res, next);
    };
  };

  const readGuard = guard('topology.read');
  const manageGuard = guard('topology.manage');
  const reportGuard = runtimeMachineAuth ? runtimeMachineAuth.guard('report', manageGuard) : manageGuard;
  const transactionGuard = runtimeMachineAuth ? runtimeMachineAuth.guard('transaction', manageGuard) : manageGuard;
  if (serviceTransactions) {
    app.post('/api/runtime/services/:serviceId/transactions', transactionGuard, async (req, res) => {
      try {
        const transaction = await serviceTransactions.submit(req.params.serviceId, req.body, {
          parentTransactionId: req.get('x-pulse-parent-transaction-id'),
          parentInstanceId: req.runtimeMachineInstanceId,
        });
        res.status(202).json({
          transactionId: transaction.transactionId, status: transaction.status,
          statusUrl: `/api/runtime/transactions/${transaction.transactionId}`,
        });
      } catch (error) {
        res.status(error.status || 503).json({ error: error.message });
      }
    });
    app.get('/api/runtime/transactions/:transactionId', readGuard, async (req, res) => {
      try {
        const transaction = await serviceTransactions.get(req.params.transactionId);
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        const { request, ...status } = transaction;
        if (req.query.elapsedMs !== undefined) {
          const elapsedMs = Number(req.query.elapsedMs);
          if (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 2147483647) {
            return res.status(400).json({ error: 'Invalid transaction elapsed time' });
          }
          status.clientDecision = await serviceTransactions.clientDecision({ status: transaction.status }, elapsedMs);
        }
        res.json(status);
      } catch (error) {
        res.status(503).json({ error: error.message });
      }
    });
  }
  app.get('/api/runtime/lifecycle', readGuard, async (_req, res) => {
    try {
      await serviceInstanceReports?.expire();
      res.json({
        version: 1, observedAt: nowIso(),
        processes: await serviceProcessManager.listServices(),
        instances: serviceTransactions
          ? await serviceTransactions.snapshot() : [...(serviceInstanceRegistry?.values() || [])],
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  if (serviceInstanceReports) {
    app.post('/api/runtime/instances/report', reportGuard, async (req, res) => {
      try {
        const instance = await serviceInstanceReports.report(req.body);
        const observed = serviceTransactions
          ? (await serviceTransactions.snapshot()).find(record => record.instanceId === instance.instanceId)
          : instance;
        res.json({
          status: 'ok', instanceId: instance.instanceId,
          readiness: serviceTransactions
            ? { ...instance.readiness, ready: observed.dependencyChainReady }
            : instance.readiness,
        });
      } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
      }
    });
  }

  app.get('/api/runtime/services', readGuard, async (_req, res) => {
    try {
      res.json({ status: 'ok', services: await serviceProcessManager.listServices() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/runtime/services/:serviceId', readGuard, async (req, res) => {
    try {
      const service = await serviceProcessManager.getService(req.params.serviceId);
      if (!service) return res.status(404).json({ error: 'Service not found' });
      res.json({ status: 'ok', service });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/runtime/services/:serviceId/start', manageGuard, async (req, res) => {
    try {
      const service = await serviceProcessManager.startService(req.params.serviceId, { waitForHealthy: req.body?.waitForHealthy !== false });
      res.json({ status: 'ok', service });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/runtime/services/:serviceId/stop', manageGuard, async (req, res) => {
    try {
      const service = await serviceProcessManager.stopService(req.params.serviceId, { cascade: req.body?.cascade === true });
      res.json({ status: 'ok', service });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/runtime/services/:serviceId/restart', manageGuard, async (req, res) => {
    try {
      const service = await serviceProcessManager.restartService(req.params.serviceId, {
        waitForHealthy: req.body?.waitForHealthy !== false, cascade: req.body?.cascade === true,
      });
      res.json({ status: 'ok', service });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}