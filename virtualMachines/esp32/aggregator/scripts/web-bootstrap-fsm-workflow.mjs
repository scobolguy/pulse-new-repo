#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const FRONTEND_URL = process.env.WEB_BOOTSTRAP_FRONTEND_URL || 'http://127.0.0.1:5173/';
const FRONTEND_CMD = process.env.WEB_BOOTSTRAP_FRONTEND_CMD || 'npm run dev -- --host 0.0.0.0 --port 5173 --strictPort';
const POLL_MS = Number(process.env.WEB_BOOTSTRAP_POLL_MS || 1200);
const STEP_TIMEOUT_MS = Number(process.env.WEB_BOOTSTRAP_STEP_TIMEOUT_MS || 25000);
const REQUEST_TIMEOUT_MS = Number(process.env.WEB_BOOTSTRAP_REQUEST_TIMEOUT_MS || 4000);
const STATUS_PATH = path.resolve(process.env.STARTUP_FSM_STATUS_PATH || './data/web-bootstrap-fsm-status.json');
const NOTES_PATH = path.resolve(process.env.FSM_NOTES_PATH || './data/web-bootstrap-fsm-notes.jsonl');
const FSM_ID = String(process.env.FSM_ID || 'web-bootstrap-fsm');

const STATES = {
  INIT: 'INIT',
  CHECK_FRONTEND: 'CHECK_FRONTEND',
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
    state: 'IDLE',
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

  try {
    await writeStatus({ ok: false, state: STATES.INIT, workflow: [], logs: [] });
    await appendLog('workflow-start', { fsmId: FSM_ID, frontendUrl: FRONTEND_URL, statusPath: STATUS_PATH });

    while (state !== STATES.READY && state !== STATES.FAILED) {
      workflow.push(state);
      await writeStatus({ ok: false, state, workflow: [...workflow] });

      if (state === STATES.INIT) {
        await appendLog('subflow-enter', { subflow: 'web-bootstrap-init' });
        state = STATES.CHECK_FRONTEND;
        continue;
      }

      if (state === STATES.CHECK_FRONTEND) {
        await appendLog('state', { state, subflow: 'frontend-health-check', url: FRONTEND_URL });
        state = (await isHealthy(FRONTEND_URL)) ? STATES.READY : STATES.START_FRONTEND;
        continue;
      }

      if (state === STATES.START_FRONTEND) {
        const pid = spawnDetached(FRONTEND_CMD, process.cwd());
        await appendLog('frontend-started', { command: FRONTEND_CMD, pid, subflow: 'frontend-launch' });
        state = STATES.WAIT_FRONTEND;
        continue;
      }

      if (state === STATES.WAIT_FRONTEND) {
        await appendLog('state', { state, subflow: 'frontend-wait-ready', url: FRONTEND_URL, timeoutMs: STEP_TIMEOUT_MS });
        const ok = await waitUntilHealthy(FRONTEND_URL, STEP_TIMEOUT_MS, POLL_MS);
        if (!ok) {
          const reason = 'Frontend did not become healthy before timeout';
          await appendLog('timeout', { state, url: FRONTEND_URL, timeoutMs: STEP_TIMEOUT_MS, reason });
          await appendFailureNote({ type: 'timeout', state, reason, subflow: 'frontend-wait-ready' });
        }
        state = ok ? STATES.READY : STATES.FAILED;
        continue;
      }
    }

    if (state === STATES.READY) {
      workflow.push(STATES.READY);
      const result = { ok: true, state, workflow, frontendUrl: FRONTEND_URL, fsmId: FSM_ID };
      await appendLog('complete', result);
      await writeStatus(result);
      return;
    }

    throw new Error('Web bootstrap FSM failed to reach READY state');
  } catch (error) {
    const result = {
      ok: false,
      state: STATES.FAILED,
      workflow,
      error: error?.message || String(error),
      fsmId: FSM_ID
    };
    await appendLog('failed', result);
    await appendFailureNote({ type: 'exception', state: STATES.FAILED, error: result.error, subflow: 'error-handler' });
    await writeStatus(result);
    process.exitCode = 1;
  }
}

run();
