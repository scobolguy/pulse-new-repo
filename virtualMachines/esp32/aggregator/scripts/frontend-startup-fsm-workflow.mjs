#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const BACKEND_URL = process.env.FRONTEND_FSM_BACKEND_URL || 'http://127.0.0.1:4000/api/authz/me?userId=system-admin';
const MCP_URL = process.env.FRONTEND_FSM_MCP_URL || 'http://127.0.0.1:4011/health';
const MCP_CMD = process.env.FRONTEND_FSM_MCP_CMD || 'node --env-file=.env.local src/mcp/pulseMcpServer.mjs';
const FRONTEND_URL = process.env.FRONTEND_FSM_FRONTEND_URL || 'http://127.0.0.1:5173/';
const FRONTEND_CMD = process.env.FRONTEND_FSM_FRONTEND_CMD || 'node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --strictPort --force';
const FRONTEND_PORT = Number(process.env.FRONTEND_FSM_FRONTEND_PORT || new URL(FRONTEND_URL).port || 5173);
const POLL_MS = Number(process.env.FRONTEND_FSM_POLL_MS || 1200);
const FRONTEND_WAIT_TIMEOUT_MS = Number(process.env.FRONTEND_FSM_FRONTEND_WAIT_TIMEOUT_MS || 30000);
const FRONTEND_RETRY_COUNT = Math.max(0, Number(process.env.FRONTEND_FSM_FRONTEND_RETRY_COUNT || 2));
const RETRY_BACKOFF_MS = Math.max(500, Number(process.env.FRONTEND_FSM_RETRY_BACKOFF_MS || 2500));
const REQUEST_TIMEOUT_MS = Number(process.env.FRONTEND_FSM_REQUEST_TIMEOUT_MS || 5000);
const STATUS_PATH = path.resolve(process.env.FRONTEND_FSM_STATUS_PATH || './data/frontend-startup-fsm-status.json');
const NOTES_PATH = path.resolve(process.env.FRONTEND_FSM_NOTES_PATH || './data/frontend-startup-fsm-notes.jsonl');
const FSM_ID = String(process.env.FSM_ID || 'frontend-startup-fsm');

const STATES = {
  INIT: 'INIT',
  KILL_VITE_PROCESSES: 'KILL_VITE_PROCESSES',
  CHECK_BACKEND: 'CHECK_BACKEND',
  CHECK_MCP: 'CHECK_MCP',
  START_MCP: 'START_MCP',
  WAIT_MCP: 'WAIT_MCP',
  START_FRONTEND: 'START_FRONTEND',
  WAIT_FRONTEND: 'WAIT_FRONTEND',
  READY: 'READY',
  FAILED: 'FAILED'
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readStatus() {
  try {
    const raw = await fs.readFile(STATUS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // no-op
  }

  return {
    ok: false,
    service: 'frontend',
    state: 'IDLE',
    dependencies: {
      backend: {
        required: true,
        url: BACKEND_URL,
        ok: false,
        checkedAt: null
      }
    },
    workflow: [],
    logs: [],
    updatedAt: nowIso()
  };
}

async function writeStatus(patch) {
  await ensureParentDir(STATUS_PATH);
  const current = await readStatus();
  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  };
  await fs.writeFile(STATUS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

async function appendLog(event, data = null) {
  const current = await readStatus();
  const logs = Array.isArray(current.logs) ? current.logs : [];
  logs.push({ at: nowIso(), event, data: data || null });
  await writeStatus({ logs: logs.slice(-200) });
}

async function appendFailureNote(note) {
  await ensureParentDir(NOTES_PATH);
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
    return parseNetstatForPort(output, port).filter((pid) => pid !== process.pid);
  } catch {
    return [];
  }
}

function parsePowerShellJson(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') return [parsed];
  return [];
}

function findVitePids() {
  const script = [
    `$matches = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |`,
    `  Where-Object {`,
    `    $line = [string]$_.CommandLine;`,
    `    $line -match 'vite(\\.js)?(\\s|$)' -or $line -match 'npm(\\.cmd)?\\s+run\\s+dev(\\s|$)'`,
    `  } |`,
    `  Select-Object ProcessId, CommandLine;`,
    `if ($matches) { $matches | ConvertTo-Json -Compress }`
  ].join(' ');

  try {
    const raw = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', stdio: 'pipe' });
    const rows = parsePowerShellJson(raw);
    const pids = [];
    for (const row of rows) {
      const pid = Number(row?.ProcessId);
      if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
        pids.push(pid);
      }
    }
    return [...new Set(pids)];
  } catch {
    return [];
  }
}

function killPidForce(pid) {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], { encoding: 'utf8', stdio: 'pipe' });
    return { pid, killed: true };
  } catch (error) {
    return { pid, killed: false, error: error?.message || String(error) };
  }
}

async function runKillViteSubflow() {
  const pids = findVitePids();
  const results = pids.map((pid) => killPidForce(pid));
  return {
    pids,
    results,
    killedCount: results.filter((item) => item.killed).length
  };
}

async function waitUntilHealthy(url, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(url)) return true;
    await sleep(pollMs);
  }
  return false;
}

async function run() {
  const workflow = [];
  let state = STATES.INIT;
  let frontendStartAttempt = 0;

  try {
    await writeStatus({
      ok: false,
      service: 'frontend',
      state: STATES.INIT,
      dependencies: {
        backend: {
          required: true,
          url: BACKEND_URL,
          ok: false,
          checkedAt: null
        },
        mcp: {
          required: true,
          url: MCP_URL,
          ok: false,
          checkedAt: null
        }
      },
      workflow: [],
      logs: [],
      error: null
    });
    await appendLog('workflow-start', {
      fsmId: FSM_ID,
      backendUrl: BACKEND_URL,
      mcpUrl: MCP_URL,
      frontendUrl: FRONTEND_URL,
      statusPath: STATUS_PATH
    });

    while (state !== STATES.READY && state !== STATES.FAILED) {
      workflow.push(state);
      await writeStatus({ ok: false, state, workflow: [...workflow], error: null });

      if (state === STATES.INIT) {
        await appendLog('state', { state });
        state = STATES.KILL_VITE_PROCESSES;
        continue;
      }

      if (state === STATES.KILL_VITE_PROCESSES) {
        const outcome = await runKillViteSubflow();
        await appendLog('subflow-complete', { state, subflow: 'kill-all-vite-processes', ...outcome });
        state = STATES.CHECK_BACKEND;
        continue;
      }

      if (state === STATES.CHECK_BACKEND) {
        const backendOk = await isHealthy(BACKEND_URL);
        await writeStatus({
          dependencies: {
            backend: {
              required: true,
              url: BACKEND_URL,
              ok: backendOk,
              checkedAt: nowIso()
            }
          }
        });
        await appendLog('state', { state, backendUrl: BACKEND_URL, backendOk });
        if (!backendOk) {
          await appendFailureNote({
            type: 'dependency-not-ready',
            state,
            dependency: 'backend',
            backendUrl: BACKEND_URL
          });
          throw new Error(`Backend dependency is not ready at ${BACKEND_URL}. Start backend FSM first.`);
        }
        state = STATES.CHECK_MCP;
        continue;
      }

      if (state === STATES.CHECK_MCP) {
        const mcpOk = await isHealthy(MCP_URL);
        await writeStatus({
          dependencies: {
            backend: {
              required: true,
              url: BACKEND_URL,
              ok: true,
              checkedAt: nowIso()
            },
            mcp: {
              required: true,
              url: MCP_URL,
              ok: mcpOk,
              checkedAt: nowIso()
            }
          }
        });
        await appendLog('state', { state, mcpUrl: MCP_URL, mcpOk });
        state = mcpOk ? STATES.START_FRONTEND : STATES.START_MCP;
        continue;
      }

      if (state === STATES.START_MCP) {
        const pid = spawnDetached(MCP_CMD, process.cwd());
        await appendLog('mcp-started', { command: MCP_CMD, pid });
        state = STATES.WAIT_MCP;
        continue;
      }

      if (state === STATES.WAIT_MCP) {
        const mcpOk = await waitUntilHealthy(MCP_URL, FRONTEND_WAIT_TIMEOUT_MS, POLL_MS);
        await writeStatus({
          dependencies: {
            backend: {
              required: true,
              url: BACKEND_URL,
              ok: true,
              checkedAt: nowIso()
            },
            mcp: {
              required: true,
              url: MCP_URL,
              ok: mcpOk,
              checkedAt: nowIso()
            }
          }
        });
        await appendLog(mcpOk ? 'mcp-ready' : 'mcp-timeout', {
          mcpUrl: MCP_URL,
          timeoutMs: FRONTEND_WAIT_TIMEOUT_MS
        });
        if (!mcpOk) {
          await appendFailureNote({
            type: 'timeout',
            state,
            dependency: 'mcp',
            mcpUrl: MCP_URL,
            command: MCP_CMD
          });
          throw new Error(`MCP dependency did not become ready at ${MCP_URL}`);
        }
        state = STATES.START_FRONTEND;
        continue;
      }

      if (state === STATES.START_FRONTEND) {
        const occupiedBy = findPidsUsingPort(FRONTEND_PORT);
        if (occupiedBy.length) {
          const alreadyReady = await isHealthy(FRONTEND_URL);
          await appendLog('port-occupied', { state, port: FRONTEND_PORT, occupiedBy, command: FRONTEND_CMD, alreadyReady });
          if (alreadyReady) {
            await appendLog('frontend-already-running', { state, frontendUrl: FRONTEND_URL, occupiedBy });
            state = STATES.READY;
            continue;
          }
          await appendFailureNote({ type: 'port-occupied', state, port: FRONTEND_PORT, occupiedBy, command: FRONTEND_CMD });
          throw new Error(`Port ${FRONTEND_PORT} is already occupied before frontend launch`);
        }
        frontendStartAttempt += 1;
        const pid = spawnDetached(FRONTEND_CMD, process.cwd());
        await appendLog('frontend-started', { command: FRONTEND_CMD, pid, attempt: frontendStartAttempt });
        state = STATES.WAIT_FRONTEND;
        continue;
      }

      if (state === STATES.WAIT_FRONTEND) {
        const ok = await waitUntilHealthy(FRONTEND_URL, FRONTEND_WAIT_TIMEOUT_MS, POLL_MS);
        await appendLog(ok ? 'frontend-ready' : 'frontend-timeout', {
          frontendUrl: FRONTEND_URL,
          timeoutMs: FRONTEND_WAIT_TIMEOUT_MS,
          attempt: frontendStartAttempt
        });
        if (!ok) {
          if (frontendStartAttempt <= FRONTEND_RETRY_COUNT) {
            await appendLog('retry-scheduled', {
              state,
              nextState: STATES.START_FRONTEND,
              reason: 'frontend wait timeout',
              currentAttempt: frontendStartAttempt,
              maxRetries: FRONTEND_RETRY_COUNT,
              retryBackoffMs: RETRY_BACKOFF_MS
            });
            await sleep(RETRY_BACKOFF_MS);
            state = STATES.START_FRONTEND;
            continue;
          }

          await appendFailureNote({
            type: 'timeout',
            state,
            subflow: 'frontend-wait-ready',
            frontendUrl: FRONTEND_URL,
            timeoutMs: FRONTEND_WAIT_TIMEOUT_MS,
            attempts: frontendStartAttempt
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
        service: 'frontend',
        state,
        workflow,
        backendUrl: BACKEND_URL,
        mcpUrl: MCP_URL,
        frontendUrl: FRONTEND_URL,
        fsmId: FSM_ID
      };
      await appendLog('complete', result);
      await writeStatus(result);
      return;
    }

    throw new Error('Frontend startup FSM failed to reach READY state');
  } catch (error) {
    const result = {
      ok: false,
      service: 'frontend',
      state: STATES.FAILED,
      workflow,
      error: error?.message || String(error),
      fsmId: FSM_ID
    };
    await appendLog('failed', result);
    await appendFailureNote({ type: 'exception', state: STATES.FAILED, subflow: 'error-handler', error: result.error });
    await writeStatus(result);
    process.exitCode = 1;
  }
}

run();