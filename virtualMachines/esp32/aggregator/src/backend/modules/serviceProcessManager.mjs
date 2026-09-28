import fs from 'fs/promises';
import path from 'path';

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
    logLineLimit = 200
  } = options;

  if (!manifestPath) throw new Error('manifestPath is required');
  if (typeof spawn !== 'function') throw new Error('spawn is required');

  const raw = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);
  const services = new Map();
  const processes = new Map();

  for (const service of manifest.services || []) {
    const id = normalizeId(service.id);
    if (!id) continue;
    services.set(id, {
      startPolicy: 'on-demand',
      dependencies: [],
      args: [],
      env: {},
      ...service,
      id
    });
  }

  async function isHealthy(service) {
    if (!service?.healthUrl) return false;
    try {
      const response = await fetch(service.healthUrl, { signal: AbortSignal.timeout(healthTimeoutMs) });
      return response.ok;
    } catch {
      return false;
    }
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

  async function waitForHealthy(id, timeoutMs = startupTimeoutMs) {
    const started = Date.now();
    const service = services.get(id);
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
      entry.status = 'failed';
      entry.lastError = `Timed out waiting for ${id} health at ${service.healthUrl}`;
      entry.child.kill();
      processes.set(id, entry);
    }
    throw new Error(`Timed out waiting for ${id} health at ${service.healthUrl}.${recentLogs ? ` Recent logs: ${recentLogs}` : ''}`);
  }

  async function startService(id, options = {}) {
    const serviceId = normalizeId(id);
    const service = services.get(serviceId);
    if (!service) throw new Error(`Unknown service ${serviceId}`);

    for (const dependencyId of service.dependencies || []) {
      await startService(dependencyId, options);
    }

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
    const cwd = path.resolve(appRoot, service.cwd || '.');
    const entry = {
      child: null,
      status: 'starting',
      startedAt: nowIso(),
      stoppedAt: null,
      exitCode: null,
      signal: null,
      lastError: null,
      logs: []
    };

    logger.log(`[SERVICE] Starting ${serviceId}: ${command} ${(service.args || []).join(' ')}`);
    const child = spawn(command, service.args || [], {
      cwd,
      env: { ...process.env, ...(service.env || {}) },
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
      entry.lastError = error.message;
      entry.logs.push(error.message);
      trimLogs(entry.logs, logLineLimit);
    });
    child.on('exit', (code, signal) => {
      entry.status = code === 0 ? 'stopped' : 'failed';
      entry.exitCode = code;
      entry.signal = signal;
      entry.stoppedAt = nowIso();
      entry.child = null;
    });

    return options.waitForHealthy === false ? getState(serviceId) : waitForHealthy(serviceId, options.timeoutMs);
  }

  async function stopService(id) {
    const serviceId = normalizeId(id);
    if (!services.has(serviceId)) throw new Error(`Unknown service ${serviceId}`);
    const entry = processes.get(serviceId);
    if (!entry?.child || entry.child.exitCode !== null) {
      return refreshService(serviceId);
    }
    entry.status = 'stopping';
    entry.child.kill();
    return getState(serviceId);
  }

  async function restartService(id, options = {}) {
    await stopService(id);
    await new Promise(resolve => setTimeout(resolve, 500));
    return startService(id, options);
  }

  async function ensureServiceRunning(id, options = {}) {
    return startService(id, options);
  }

  async function listServices() {
    const output = [];
    for (const id of services.keys()) output.push(await refreshService(id));
    return output.sort((a, b) => a.id.localeCompare(b.id));
  }

  return {
    manifest: { version: manifest.version || 1, path: manifestPath },
    listServices,
    getService: async (id) => refreshService(normalizeId(id)),
    startService,
    stopService,
    restartService,
    ensureServiceRunning
  };
}

export function registerServiceProcessRoutes(app, options = {}) {
  const { serviceProcessManager, requirePermission } = options;
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
      const service = await serviceProcessManager.stopService(req.params.serviceId);
      res.json({ status: 'ok', service });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/runtime/services/:serviceId/restart', manageGuard, async (req, res) => {
    try {
      const service = await serviceProcessManager.restartService(req.params.serviceId, { waitForHealthy: req.body?.waitForHealthy !== false });
      res.json({ status: 'ok', service });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}