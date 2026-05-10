import express from 'express';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  if (!arg) return fallback;
  return arg.slice(prefix.length);
}

function normalizeIp(ip) {
  return String(ip || '').replace('::ffff:', '').trim();
}

const host = getArg('host', '0.0.0.0');
const port = Number(getArg('port', '4310'));
const token = getArg('token', 'change-me');
const allowIpArg = getArg('allow-ip', '');
const allowedIps = new Set(
  allowIpArg
    .split(',')
    .map(v => normalizeIp(v))
    .filter(Boolean)
);

const queueManagerScriptPath = fileURLToPath(new URL('./queue-manager-node.mjs', import.meta.url));
const processes = new Map();

const app = express();
app.use(express.json());

function authMiddleware(req, res, next) {
  const provided = String(req.header('x-qm-agent-token') || '');
  if (!provided || provided !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (allowedIps.size > 0) {
    const clientIp = normalizeIp(req.ip);
    if (!allowedIps.has(clientIp)) {
      return res.status(403).json({ error: `Forbidden for IP ${clientIp}` });
    }
  }

  next();
}

app.use('/agent', authMiddleware);

app.get('/agent/health', (req, res) => {
  res.json({
    status: 'ok',
    host,
    port,
    hostname: os.hostname(),
    queueManagerScriptPath,
    allowedIps: Array.from(allowedIps.values()),
    runningManagers: Array.from(processes.values()).filter(x => x.status === 'running').map(x => x.managerId),
  });
});

app.get('/agent/qm', (req, res) => {
  const launchers = Array.from(processes.values()).map(entry => ({
    managerId: entry.managerId,
    nodeId: entry.nodeId,
    port: entry.port,
    advertiseIp: entry.advertiseIp,
    aggregatorUrl: entry.aggregatorUrl,
    pid: entry.child?.pid || null,
    status: entry.status,
    startedAt: entry.startedAt,
    stoppedAt: entry.stoppedAt || null,
    exitCode: entry.exitCode ?? null,
    signal: entry.signal ?? null,
    lastError: entry.lastError || null,
  }));
  res.json({ launchers });
});

app.post('/agent/qm/start', (req, res) => {
  try {
    const {
      managerId,
      nodeId,
      port: managerPort,
      advertiseIp,
      aggregatorUrl,
    } = req.body || {};

    if (!managerId || !managerPort || !advertiseIp || !aggregatorUrl) {
      return res.status(400).json({ error: 'managerId, port, advertiseIp, and aggregatorUrl are required' });
    }

    const existing = processes.get(managerId);
    if (existing && existing.status === 'running') {
      return res.json({ status: 'already-running', managerId, pid: existing.child?.pid || null });
    }

    const args = [
      queueManagerScriptPath,
      `--aggregator=${aggregatorUrl}`,
      `--port=${Number(managerPort)}`,
      `--manager-id=${managerId}`,
      `--name=${managerId}`,
      `--node-id=${nodeId || os.hostname()}`,
      `--advertise-ip=${advertiseIp}`,
    ];

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const entry = {
      managerId,
      nodeId: nodeId || os.hostname(),
      port: Number(managerPort),
      advertiseIp,
      aggregatorUrl,
      child,
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: [],
      lastError: null,
    };

    child.stdout.on('data', chunk => {
      entry.logs.push(chunk.toString());
      entry.logs = entry.logs.slice(-80);
    });

    child.stderr.on('data', chunk => {
      entry.lastError = chunk.toString();
      entry.logs.push(chunk.toString());
      entry.logs = entry.logs.slice(-80);
    });

    child.on('exit', (code, signal) => {
      entry.status = 'stopped';
      entry.exitCode = code;
      entry.signal = signal;
      entry.stoppedAt = new Date().toISOString();
    });

    processes.set(managerId, entry);

    res.json({
      status: 'started',
      managerId,
      pid: child.pid,
      port: Number(managerPort),
      advertiseIp,
      nodeId: entry.nodeId,
      aggregatorUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/agent/qm/:managerId/stop', (req, res) => {
  const { managerId } = req.params;
  const entry = processes.get(managerId);
  if (!entry) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  if (entry.status === 'running') {
    entry.child.kill();
    entry.status = 'stopping';
  }

  res.json({
    status: 'stopping',
    managerId,
    pid: entry.child?.pid || null,
  });
});

app.get('/agent/qm/:managerId/status', (req, res) => {
  const { managerId } = req.params;
  const entry = processes.get(managerId);
  if (!entry) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  res.json({
    managerId,
    nodeId: entry.nodeId,
    port: entry.port,
    advertiseIp: entry.advertiseIp,
    aggregatorUrl: entry.aggregatorUrl,
    pid: entry.child?.pid || null,
    status: entry.status,
    startedAt: entry.startedAt,
    stoppedAt: entry.stoppedAt || null,
    exitCode: entry.exitCode ?? null,
    signal: entry.signal ?? null,
    lastError: entry.lastError || null,
  });
});

app.listen(port, host, () => {
  console.log(`[AGENT] Remote QM agent listening on http://${host}:${port}`);
  console.log(`[AGENT] allowed IPs: ${Array.from(allowedIps.values()).join(', ') || 'any'}`);
  console.log('[AGENT] token is configured');
});
