#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BACKEND_STATUS_PATH = path.resolve('./data/startup-fsm-status.json');
const FRONTEND_STATUS_PATH = path.resolve('./data/frontend-startup-fsm-status.json');

function runNpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', scriptName], {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ${scriptName}: ${error?.message || String(error)}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptName} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function assertReady(status, expectedService, statusPath) {
  const service = String(status?.service || '').toLowerCase();
  const state = String(status?.state || '');
  const ok = Boolean(status?.ok);

  if (!ok || state !== 'READY' || service !== expectedService) {
    throw new Error(
      `FSM status check failed for ${expectedService}. ` +
      `Expected { ok: true, service: "${expectedService}", state: "READY" } in ${statusPath}. ` +
      `Actual: ${JSON.stringify({ ok: status?.ok, service: status?.service, state: status?.state })}`
    );
  }
}

async function main() {
  process.stdout.write('[startup-ordered] Starting backend FSM first...\n');
  await runNpmScript('startup:fsm:backend');

  const backendStatus = await readJson(BACKEND_STATUS_PATH);
  assertReady(backendStatus, 'backend', BACKEND_STATUS_PATH);
  process.stdout.write('[startup-ordered] Backend FSM is READY.\n');

  process.stdout.write('[startup-ordered] Starting frontend FSM second...\n');
  await runNpmScript('startup:fsm:frontend');

  const frontendStatus = await readJson(FRONTEND_STATUS_PATH);
  assertReady(frontendStatus, 'frontend', FRONTEND_STATUS_PATH);
  process.stdout.write('[startup-ordered] Frontend FSM is READY.\n');

  process.stdout.write('[startup-ordered] Success: backend and frontend are both READY.\n');
}

main().catch((error) => {
  process.stderr.write(`[startup-ordered] ${error?.message || String(error)}\n`);
  process.exit(1);
});
