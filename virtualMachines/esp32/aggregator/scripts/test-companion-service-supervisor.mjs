import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startCompanionServiceSupervisor } from '../src/backend/modules/companionServiceSupervisor.mjs';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-companion-test-'));
const childScriptPath = path.join(temporaryDirectory, 'health-child.mjs');

const reservation = http.createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));

fs.writeFileSync(childScriptPath, `
import http from 'node:http';
const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true}');
    return;
  }
  response.writeHead(404);
  response.end();
});
server.listen(Number(process.env.TEST_COMPANION_PORT), '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
`, 'utf8');

async function waitFor(predicate, message, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

let supervisor;
try {
  supervisor = await startCompanionServiceSupervisor({
    name: 'TEST-COMPANION',
    scriptPath: childScriptPath,
    healthUrl: `http://127.0.0.1:${port}/health`,
    spawn,
    checkIntervalMs: 100,
    restartDelayMs: 100,
    healthTimeoutMs: 100,
    unhealthyCheckLimit: 2,
    startupGraceMs: 2000,
    env: { ...process.env, TEST_COMPANION_PORT: String(port) },
    stdio: 'ignore',
  });

  await waitFor(() => supervisor.isHealthy(), 'companion did not become healthy');
  const firstPid = supervisor.getChildPid();
  assert.ok(firstPid, 'supervisor did not own the initial companion process');

  process.kill(firstPid);
  await waitFor(
    async () => supervisor.getChildPid() && supervisor.getChildPid() !== firstPid && await supervisor.isHealthy(),
    'supervisor did not restart the terminated companion',
  );

  assert.notEqual(supervisor.getChildPid(), firstPid);
  console.log('[companion-supervisor] PASS: terminated child restarted and health recovered');
} finally {
  supervisor?.stop();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}