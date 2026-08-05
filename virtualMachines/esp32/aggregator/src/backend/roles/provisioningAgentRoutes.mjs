import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const defaultRuntimeRoot = path.resolve(
  process.env.PULSE_OPERATIONAL_DATA_ROOT
  || (process.platform === 'win32' ? 'c:/dev/pulse-operational-data' : '/opt/pulse/operational-data')
);

const runtimeRoot = path.resolve(
  process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);

const provisioningRuntimeRoot = path.join(runtimeRoot, 'provisioning-agent');
const orchestrationLedgerPath = path.join(provisioningRuntimeRoot, 'orchestration-runs.jsonl');
const agentLedgerPath = path.join(provisioningRuntimeRoot, 'agent-runs.jsonl');
const agentScriptPath = path.resolve(process.cwd(), 'scripts', 'provisioning-lan-agent.mjs');

const activeRuns = new Map();
const completedRuns = new Map();
const maxCompletedCacheSize = 200;

async function appendJsonl(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

async function readLatestJsonl(filePath, limit = 50) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return entries.slice(Math.max(0, entries.length - safeLimit)).reverse();
  } catch {
    return [];
  }
}

function updateCompletedCache(record) {
  completedRuns.set(record.runId, record);
  if (completedRuns.size <= maxCompletedCacheSize) return;

  const keys = Array.from(completedRuns.keys());
  while (completedRuns.size > maxCompletedCacheSize && keys.length > 0) {
    const oldest = keys.shift();
    if (oldest) completedRuns.delete(oldest);
  }
}

function parseJsonSafely(text) {
  if (!text || !String(text).trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeMode(value) {
  const mode = String(value || 'inventory').trim().toLowerCase();
  if (mode === 'inventory' || mode === 'ap-batch' || mode === 'aggregator-batch') return mode;
  return '';
}

function buildAgentArgs(body = {}) {
  const mode = normalizeMode(body.mode);
  if (!mode) {
    throw new Error('mode must be one of inventory, ap-batch, aggregator-batch');
  }

  const args = [agentScriptPath, '--mode', mode, '--ledger-path', agentLedgerPath];

  const configPath = String(body.configPath || '').trim();
  if (configPath) args.push('--config', path.resolve(process.cwd(), configPath));

  if (body.dryRun === true) args.push('--dry-run');

  if (Object.prototype.hasOwnProperty.call(body, 'pattern')) {
    args.push('--pattern', String(body.pattern || '^Pulse-.*-Provision$'));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'timeoutMs')) {
    args.push('--timeout-ms', String(Number(body.timeoutMs) || 15000));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'settleMs')) {
    args.push('--settle-ms', String(Number(body.settleMs) || 4000));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'retries')) {
    args.push('--retries', String(Math.max(0, Number(body.retries) || 0)));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'backoffMs')) {
    args.push('--backoff-ms', String(Math.max(0, Number(body.backoffMs) || 0)));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'backoffMultiplier')) {
    const multiplier = Number(body.backoffMultiplier);
    args.push('--backoff-multiplier', String(Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1));
  }

  return { mode, args };
}

function toPublicRun(record) {
  return {
    runId: record.runId,
    mode: record.mode,
    status: record.status,
    dryRun: record.dryRun,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt || null,
    durationMs: record.durationMs ?? null,
    exitCode: record.exitCode ?? null,
    success: record.success ?? null,
    error: record.error || null,
    pid: record.pid || null,
    result: record.result || null,
  };
}

export function registerProvisioningAgentRoutes(app, deps = {}) {
  const requirePermission = typeof deps.requirePermission === 'function'
    ? deps.requirePermission('topology.manage')
    : ((_req, _res, next) => next());

  app.get('/api/provisioning-agent/runs', requirePermission, async (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 30)));
    const active = Array.from(activeRuns.values()).map(toPublicRun);
    const history = await readLatestJsonl(orchestrationLedgerPath, limit);
    res.json({
      status: 'ok',
      active,
      history: history.map(toPublicRun),
      orchestrationLedgerPath,
      agentLedgerPath,
    });
  });

  app.get('/api/provisioning-agent/runs/:runId', requirePermission, async (req, res) => {
    const runId = String(req.params?.runId || '').trim();
    if (!runId) return res.status(400).json({ error: 'runId is required' });

    const active = activeRuns.get(runId);
    if (active) return res.json({ status: 'ok', run: toPublicRun(active), source: 'active' });

    const completed = completedRuns.get(runId);
    if (completed) return res.json({ status: 'ok', run: toPublicRun(completed), source: 'cache' });

    const diskEntries = await readLatestJsonl(orchestrationLedgerPath, 500);
    const fromDisk = diskEntries.find((entry) => String(entry?.runId || '') === runId) || null;
    if (fromDisk) return res.json({ status: 'ok', run: toPublicRun(fromDisk), source: 'disk' });

    return res.status(404).json({ error: 'run not found' });
  });

  app.post('/api/provisioning-agent/runs', requirePermission, async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { mode, args } = buildAgentArgs(body);

      const runId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const startedMs = Date.now();

      const runRecord = {
        runId,
        mode,
        dryRun: body.dryRun === true,
        status: 'running',
        startedAt,
        finishedAt: null,
        durationMs: null,
        exitCode: null,
        success: null,
        error: null,
        pid: null,
        result: null,
        args,
      };

      const child = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      runRecord.pid = child.pid || null;
      activeRuns.set(runId, runRecord);

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk || '');
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      child.on('close', async (exitCode) => {
        const finishedAt = new Date().toISOString();
        const resultPayload = parseJsonSafely(stdout);
        const success = Number(exitCode) === 0;

        const completed = {
          ...runRecord,
          status: success ? 'completed' : 'failed',
          finishedAt,
          durationMs: Date.now() - startedMs,
          exitCode: Number.isFinite(exitCode) ? Number(exitCode) : null,
          success,
          error: success ? null : (String(stderr || '').trim() || 'Provisioning agent failed'),
          result: resultPayload,
          stderr: stderr || '',
        };

        activeRuns.delete(runId);
        updateCompletedCache(completed);
        await appendJsonl(orchestrationLedgerPath, completed).catch(() => {});
      });

      child.on('error', async (error) => {
        const failed = {
          ...runRecord,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedMs,
          exitCode: null,
          success: false,
          error: String(error?.message || error || 'failed to start provisioning agent'),
        };

        activeRuns.delete(runId);
        updateCompletedCache(failed);
        await appendJsonl(orchestrationLedgerPath, failed).catch(() => {});
      });

      return res.status(202).json({ status: 'accepted', run: toPublicRun(runRecord) });
    } catch (error) {
      return res.status(400).json({ error: String(error?.message || error) });
    }
  });

  app.post('/api/provisioning-agent/runs/:runId/cancel', requirePermission, async (req, res) => {
    const runId = String(req.params?.runId || '').trim();
    if (!runId) return res.status(400).json({ error: 'runId is required' });

    const record = activeRuns.get(runId);
    if (!record || !record.pid) return res.status(404).json({ error: 'active run not found' });

    try {
      process.kill(record.pid);
      return res.json({ status: 'ok', runId, cancelled: true });
    } catch (error) {
      return res.status(500).json({ error: String(error?.message || error), runId, cancelled: false });
    }
  });
}
