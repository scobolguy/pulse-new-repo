#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BACKEND_URL = process.env.STARTUP_BACKEND_URL || 'http://127.0.0.1:4000/api/develop/files';
const BACKEND_CMD = process.env.STARTUP_BACKEND_CMD || 'npm run dev:backend';
const POLL_MS = Number(process.env.STARTUP_POLL_MS || 1500);
const STEP_TIMEOUT_MS = Number(process.env.STARTUP_STEP_TIMEOUT_MS || 30000);
const STARTUP_BACKEND_WAIT_RETRY_COUNT = Math.max(0, Number(process.env.STARTUP_BACKEND_WAIT_RETRY_COUNT || 2));
const STARTUP_BACKEND_WAIT_RETRY_BACKOFF_MS = Math.max(500, Number(process.env.STARTUP_BACKEND_WAIT_RETRY_BACKOFF_MS || 2000));
const STARTUP_BACKEND_WAIT_MAX_TIMEOUT_MS = Math.max(STEP_TIMEOUT_MS, Number(process.env.STARTUP_BACKEND_WAIT_MAX_TIMEOUT_MS || 150000));
const REQUEST_TIMEOUT_MS = Number(process.env.STARTUP_REQUEST_TIMEOUT_MS || 5000);
const SANITIZE_MAX_MESSAGE_FILES_PER_QUEUE = Math.max(50, Number(process.env.STARTUP_SANITIZE_MAX_MESSAGE_FILES_PER_QUEUE || 500));
const SANITIZE_MAX_TOTAL_MESSAGE_FILES = Math.max(200, Number(process.env.STARTUP_SANITIZE_MAX_TOTAL_MESSAGE_FILES || 5000));
const SANITIZE_TIME_BUDGET_MS = Math.max(2000, Number(process.env.STARTUP_SANITIZE_TIME_BUDGET_MS || 20000));
const SANITIZE_MAX_OPERATIONS_FILE_BYTES = Math.max(1024 * 1024, Number(process.env.STARTUP_SANITIZE_MAX_OPERATIONS_FILE_BYTES || 20 * 1024 * 1024));
const STATUS_PATH = path.resolve(process.env.STARTUP_FSM_STATUS_PATH || './data/startup-fsm-status.json');
const NOTES_PATH = path.resolve(process.env.FSM_NOTES_PATH || './data/startup-fsm-notes.jsonl');
const FSM_ID = String(process.env.FSM_ID || 'startup-fsm');
const BACKEND_PORT = Number(process.env.STARTUP_BACKEND_PORT || new URL(BACKEND_URL).port || 4000);

const STATES = {
  INIT: 'INIT',
  KILL_BACKEND_PROCESSES: 'KILL_BACKEND_PROCESSES',
  SANITIZE_QUEUE_PERSISTENCE: 'SANITIZE_QUEUE_PERSISTENCE',
  CHECK_BACKEND: 'CHECK_BACKEND',
  START_BACKEND: 'START_BACKEND',
  WAIT_BACKEND: 'WAIT_BACKEND',
  READY: 'READY',
  FAILED: 'FAILED'
};

function nowIso() {
  return new Date().toISOString();
}

function logState(message, data = null) {
  if (data) {
    process.stdout.write(`[startup-fsm] ${nowIso()} ${message} ${JSON.stringify(data)}\n`);
    return;
  }
  process.stdout.write(`[startup-fsm] ${nowIso()} ${message}\n`);
}

async function ensureStatusFileDir() {
  await fs.mkdir(path.dirname(STATUS_PATH), { recursive: true });
}

async function writeStatus(patch) {
  await ensureStatusFileDir();
  const base = {
    ok: false,
    state: 'IDLE',
    workflow: [],
    logs: [],
    updatedAt: nowIso()
  };

  let current = base;
  try {
    const raw = await fs.readFile(STATUS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      current = { ...base, ...parsed };
    }
  } catch {
    current = base;
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  };

  await fs.writeFile(STATUS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

async function appendLog(event, data = null) {
  const timestamp = nowIso();
  const entry = { at: timestamp, event, data: data || null };

  const base = {
    ok: false,
    state: 'IDLE',
    workflow: [],
    logs: [],
    updatedAt: timestamp
  };

  let current = base;
  try {
    const raw = await fs.readFile(STATUS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      current = { ...base, ...parsed };
    }
  } catch {
    current = base;
  }

  const logs = Array.isArray(current.logs) ? current.logs : [];
  logs.push(entry);
  const trimmedLogs = logs.slice(-200);

  await fs.writeFile(
    STATUS_PATH,
    `${JSON.stringify({ ...current, logs: trimmedLogs, updatedAt: timestamp }, null, 2)}\n`,
    'utf8'
  );
}

async function appendFailureNote(note) {
  await fs.mkdir(path.dirname(NOTES_PATH), { recursive: true });
  const entry = {
    at: nowIso(),
    fsmId: FSM_ID,
    ...note
  };
  await fs.appendFile(NOTES_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isJsonFile(name) {
  return String(name || '').toLowerCase().endsWith('.json');
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function quarantineFile(filePath, quarantineRoot, reason) {
  const reasonDir = path.join(quarantineRoot, reason);
  await fs.mkdir(reasonDir, { recursive: true });
  const baseName = path.basename(filePath);
  const quarantinedPath = path.join(reasonDir, `${Date.now()}-${process.pid}-${baseName}`);
  await fs.rename(filePath, quarantinedPath);
  return quarantinedPath;
}

async function listDirectories(parentPath) {
  try {
    const entries = await fs.readdir(parentPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(parentPath, entry.name));
  } catch {
    return [];
  }
}

async function sanitizeOperationsLog(operationsPath, quarantineRoot) {
  if (!(await pathExists(operationsPath))) {
    return { sanitized: false, droppedLineCount: 0 };
  }

  const stat = await fs.stat(operationsPath).catch(() => null);
  if (stat && Number(stat.size || 0) > SANITIZE_MAX_OPERATIONS_FILE_BYTES) {
    return {
      sanitized: false,
      droppedLineCount: 0,
      skipped: true,
      sizeBytes: Number(stat.size || 0)
    };
  }

  const raw = await fs.readFile(operationsPath, 'utf8');
  const lines = String(raw || '').split(/\r?\n/);
  const valid = [];
  const invalid = [];

  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed) continue;
    try {
      JSON.parse(trimmed);
      valid.push(trimmed);
    } catch {
      invalid.push(trimmed);
    }
  }

  if (!invalid.length) {
    return { sanitized: false, droppedLineCount: 0 };
  }

  const invalidPath = path.join(quarantineRoot, 'operations-invalid-lines', `${Date.now()}-${path.basename(path.dirname(operationsPath))}-operations.bad.jsonl`);
  await fs.mkdir(path.dirname(invalidPath), { recursive: true });
  await fs.writeFile(invalidPath, `${invalid.join('\n')}\n`, 'utf8');
  await fs.writeFile(operationsPath, valid.length ? `${valid.join('\n')}\n` : '', 'utf8');
  return { sanitized: true, droppedLineCount: invalid.length, invalidPath };
}

async function sanitizeQueuePersistenceSubflow() {
  const dataRoot = path.resolve('./data');
  const quarantineRoot = path.join(dataRoot, 'startup-quarantine');
  const qmDirs = (await listDirectories(dataRoot)).filter((dirPath) => path.basename(dirPath).startsWith('qm-'));
  const startedAt = Date.now();

  const summary = {
    queueManagers: qmDirs.length,
    quarantinedMessageFiles: 0,
    quarantinedCounterFiles: 0,
    sanitizedOperationLogs: 0,
    skippedOperationLogs: 0,
    droppedOperationLines: 0,
    scannedMessageFiles: 0,
    capped: false,
    details: []
  };

  for (const qmDir of qmDirs) {
    const qmName = path.basename(qmDir);
    const qmDetail = {
      queueManager: qmName,
      quarantinedMessageFiles: 0,
      quarantinedCounterFiles: 0,
      sanitizedOperationLogs: 0,
      droppedOperationLines: 0
    };

    const operationsPath = path.join(qmDir, 'operations.jsonl');
    const operationResult = await sanitizeOperationsLog(operationsPath, quarantineRoot);
    if (operationResult.sanitized) {
      qmDetail.sanitizedOperationLogs += 1;
      qmDetail.droppedOperationLines += Number(operationResult.droppedLineCount || 0);
      summary.sanitizedOperationLogs += 1;
      summary.droppedOperationLines += Number(operationResult.droppedLineCount || 0);
    } else if (operationResult.skipped) {
      qmDetail.skippedOperationLogs = 1;
      summary.skippedOperationLogs += 1;
    }

    const messagesRoot = path.join(qmDir, 'messages');
    const queueDirs = await listDirectories(messagesRoot);
    for (const queueDir of queueDirs) {
      if (Date.now() - startedAt > SANITIZE_TIME_BUDGET_MS) {
        summary.capped = true;
        break;
      }
      if (summary.scannedMessageFiles >= SANITIZE_MAX_TOTAL_MESSAGE_FILES) {
        summary.capped = true;
        break;
      }

      const queueName = path.basename(queueDir);
      const entries = await fs.readdir(queueDir, { withFileTypes: true });
      let scannedInQueue = 0;
      for (const entry of entries) {
        if (Date.now() - startedAt > SANITIZE_TIME_BUDGET_MS) {
          summary.capped = true;
          break;
        }
        if (summary.scannedMessageFiles >= SANITIZE_MAX_TOTAL_MESSAGE_FILES) {
          summary.capped = true;
          break;
        }
        if (!entry.isFile()) continue;
        if (!isJsonFile(entry.name)) continue;
        const filePath = path.join(queueDir, entry.name);
        if (entry.name === 'order-counter.json') {
          try {
            const raw = await fs.readFile(filePath, 'utf8');
            JSON.parse(raw);
          } catch {
            await quarantineFile(filePath, quarantineRoot, 'order-counter-invalid-json');
            qmDetail.quarantinedCounterFiles += 1;
            summary.quarantinedCounterFiles += 1;
          }
          continue;
        }

        if (scannedInQueue >= SANITIZE_MAX_MESSAGE_FILES_PER_QUEUE) {
          summary.capped = true;
          break;
        }

        try {
          const raw = await fs.readFile(filePath, 'utf8');
          JSON.parse(raw);
        } catch {
          await quarantineFile(filePath, quarantineRoot, `message-invalid-json-${queueName}`);
          qmDetail.quarantinedMessageFiles += 1;
          summary.quarantinedMessageFiles += 1;
        }
        scannedInQueue += 1;
        summary.scannedMessageFiles += 1;
      }

      if (summary.capped) break;
    }

    summary.details.push(qmDetail);
    if (summary.capped) break;
  }

  return summary;
}

async function isHealthy(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnDetached(command, cwd) {
  const child = spawn(command, {
    cwd,
    shell: true,
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  child.unref();
  return child.pid;
}

function parseNetstatForPort(raw, port) {
  const lines = String(raw || '').split(/\r?\n/);
  const pids = new Set();
  const needle = `:${port}`;

  for (const line of lines) {
    const text = line.trim();
    if (!text || !text.includes(needle)) continue;
    if (!/LISTENING/i.test(text) && !/ESTABLISHED/i.test(text)) continue;
    const parts = text.split(/\s+/);
    const pidToken = parts[parts.length - 1];
    const pid = Number(pidToken);
    if (Number.isFinite(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function findPidsUsingPort(port) {
  try {
    const output = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    return parseNetstatForPort(output, port);
  } catch {
    return [];
  }
}

function killPidForce(pid) {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], { encoding: 'utf8', stdio: 'pipe' });
    return { pid, killed: true };
  } catch (e) {
    return { pid, killed: false, error: e?.message || String(e) };
  }
}

async function runKillAllBackEndProcessesSubflow(port) {
  const pids = findPidsUsingPort(port).filter((pid) => pid !== process.pid);
  const results = pids.map((pid) => killPidForce(pid));
  return {
    port,
    pids,
    results,
    killedCount: results.filter((item) => item.killed).length
  };
}

async function waitUntilHealthy(url, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(url)) {
      return true;
    }
    await sleep(pollMs);
  }
  return false;
}

function computeAdaptiveBackendWaitTimeoutMs(summary, attemptIndex = 0) {
  const base = Math.max(1000, Number(STEP_TIMEOUT_MS) || 30000);
  const safeAttempt = Math.max(0, Number(attemptIndex) || 0);
  const details = summary && typeof summary === 'object' ? summary : {};
  const scanned = Number(details.scannedMessageFiles || 0);
  const quarantined = Number(details.quarantinedMessageFiles || 0) + Number(details.quarantinedCounterFiles || 0);
  const droppedLines = Number(details.droppedOperationLines || 0);

  // Heavier persistence scans and cleanup imply longer cold-start paths.
  const scanPenaltyMs = Math.min(scanned * 12, 45000);
  const quarantinePenaltyMs = Math.min(quarantined * 250, 15000);
  const operationPenaltyMs = Math.min(droppedLines * 20, 10000);
  const attemptBackoffMs = safeAttempt * STARTUP_BACKEND_WAIT_RETRY_BACKOFF_MS;

  const computed = base + scanPenaltyMs + quarantinePenaltyMs + operationPenaltyMs + attemptBackoffMs;
  return Math.min(computed, STARTUP_BACKEND_WAIT_MAX_TIMEOUT_MS);
}

async function run() {
  const workflow = [];
  let state = STATES.INIT;
  let backendStartAttempt = 0;
  let sanitizeSummary = null;

  try {
    await writeStatus({ ok: false, state: STATES.INIT, workflow: [], logs: [], error: null });
    await appendLog('workflow-start', { backendUrl: BACKEND_URL, statusPath: STATUS_PATH });

    while (state !== STATES.READY && state !== STATES.FAILED) {
      workflow.push(state);
      await writeStatus({ ok: false, state, workflow: [...workflow], error: null });

      if (state === STATES.INIT) {
        logState('state', { state });
        await appendLog('state', { state });
        state = STATES.KILL_BACKEND_PROCESSES;
        continue;
      }

      if (state === STATES.KILL_BACKEND_PROCESSES) {
        logState('state', { state, subflow: 'Kill all back end processes', backendPort: BACKEND_PORT });
        await appendLog('state', { state, subflow: 'Kill all back end processes', backendPort: BACKEND_PORT });
        const outcome = await runKillAllBackEndProcessesSubflow(BACKEND_PORT);
        await appendLog('subflow-complete', { subflow: 'Kill all back end processes', ...outcome });
        state = STATES.SANITIZE_QUEUE_PERSISTENCE;
        continue;
      }

      if (state === STATES.SANITIZE_QUEUE_PERSISTENCE) {
        logState('state', { state, subflow: 'Sanitize queue persistence files' });
        await appendLog('state', { state, subflow: 'Sanitize queue persistence files' });
        const summary = await sanitizeQueuePersistenceSubflow();
        sanitizeSummary = summary;
        await appendLog('subflow-complete', { subflow: 'Sanitize queue persistence files', ...summary });
        if (summary.quarantinedMessageFiles > 0 || summary.quarantinedCounterFiles > 0 || summary.droppedOperationLines > 0) {
          await appendFailureNote({
            type: 'data-sanitized',
            state,
            subflow: 'sanitize-queue-persistence',
            ...summary
          });
        }
        state = STATES.CHECK_BACKEND;
        continue;
      }

      if (state === STATES.CHECK_BACKEND) {
        logState('state', { state, url: BACKEND_URL });
        await appendLog('state', { state, url: BACKEND_URL });
        state = (await isHealthy(BACKEND_URL)) ? STATES.READY : STATES.START_BACKEND;
        continue;
      }

      if (state === STATES.START_BACKEND) {
        const occupiedBy = findPidsUsingPort(BACKEND_PORT).filter((pid) => pid !== process.pid);
        if (occupiedBy.length) {
          await appendLog('port-occupied', { state, port: BACKEND_PORT, occupiedBy, command: BACKEND_CMD });
          await appendFailureNote({ type: 'port-occupied', state, port: BACKEND_PORT, occupiedBy, command: BACKEND_CMD });
          throw new Error(`Port ${BACKEND_PORT} is already occupied before backend launch`);
        }
        backendStartAttempt += 1;
        const pid = spawnDetached(BACKEND_CMD, process.cwd());
        logState('backend-started', { command: BACKEND_CMD, pid, attempt: backendStartAttempt });
        await appendLog('backend-started', { command: BACKEND_CMD, pid, attempt: backendStartAttempt });
        state = STATES.WAIT_BACKEND;
        continue;
      }

      if (state === STATES.WAIT_BACKEND) {
        const timeoutMs = computeAdaptiveBackendWaitTimeoutMs(sanitizeSummary, backendStartAttempt - 1);
        logState('state', { state, url: BACKEND_URL, timeoutMs, attempt: backendStartAttempt });
        await appendLog('state', { state, url: BACKEND_URL, timeoutMs, attempt: backendStartAttempt });
        const ok = await waitUntilHealthy(BACKEND_URL, timeoutMs, POLL_MS);
        if (!ok) {
          await appendLog('timeout', {
            state,
            url: BACKEND_URL,
            timeoutMs,
            attempt: backendStartAttempt,
            error: 'Not responding in reasonable amount of time'
          });

          if (backendStartAttempt <= STARTUP_BACKEND_WAIT_RETRY_COUNT) {
            await appendLog('retry-scheduled', {
              state,
              nextState: STATES.START_BACKEND,
              reason: 'backend wait timeout',
              currentAttempt: backendStartAttempt,
              maxRetries: STARTUP_BACKEND_WAIT_RETRY_COUNT,
              retryBackoffMs: STARTUP_BACKEND_WAIT_RETRY_BACKOFF_MS
            });
            await sleep(STARTUP_BACKEND_WAIT_RETRY_BACKOFF_MS);
            state = STATES.START_BACKEND;
            continue;
          }

          await appendFailureNote({
            type: 'timeout',
            state,
            subflow: 'backend-wait-ready',
            url: BACKEND_URL,
            timeoutMs,
            attempts: backendStartAttempt
          });
        }
        state = ok ? STATES.READY : STATES.FAILED;
        continue;
      }
    }

    if (state === STATES.READY) {
      workflow.push(STATES.READY);
      const result = {
        ok: true,
        state,
        workflow,
        backendUrl: BACKEND_URL
      };
      logState('complete', result);
      await appendLog('complete', result);
      await writeStatus(result);
      return;
    }

    throw new Error('Startup workflow failed to reach READY state.');
  } catch (error) {
    const result = {
      ok: false,
      state: STATES.FAILED,
      workflow,
      error: error?.message || String(error)
    };
    logState('failed', result);
    await appendLog('failed', result);
    await appendFailureNote({ type: 'exception', state: STATES.FAILED, subflow: 'error-handler', error: result.error });
    await writeStatus(result);
    process.exitCode = 1;
  }
}

run();
