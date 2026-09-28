import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url, child, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`${label} exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function stop(child) {
  if (child.exitCode != null) return;
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-live-canonical-type-'));
const librarianRoot = path.join(runtimeRoot, 'services', 'librarian');
const queueRoot = path.join(runtimeRoot, 'queues');
fs.mkdirSync(librarianRoot, { recursive: true });
fs.mkdirSync(queueRoot, { recursive: true });
fs.writeFileSync(path.join(librarianRoot, 'data-types.json'), JSON.stringify([
  { id: 'mt103', label: 'MT103', canonicalId: 'type:swift-mt103-v4' }
], null, 2));

const librarianPort = await getFreePort();
const backendPort = await getFreePort();
const cwd = path.resolve(import.meta.dirname, '..');
const librarian = spawn(process.execPath, ['data-librarian.mjs'], {
  cwd,
  env: { ...process.env, LIBRARIAN_PORT: String(librarianPort), PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot },
  stdio: ['ignore', 'pipe', 'pipe']
});
const backend = spawn(process.execPath, ['backend.mjs'], {
  cwd,
  env: {
    ...process.env,
    HTTP_PORT: String(backendPort),
    LIBRARIAN_URL: `http://127.0.0.1:${librarianPort}`,
    PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot,
    PULSE_QUEUE_PERSISTENCE: '1',
    PULSE_QUEUE_DATA_ROOT: queueRoot,
    PULSE_RUNTIME_DATA_ROOT: path.join(runtimeRoot, 'runtime'),
    QUEUE_MANAGER_PRIMARY_PROVIDER: 'legacy',
    QUEUE_MANAGER_SECONDARY_PROVIDER: 'legacy'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

try {
  await waitFor(`http://127.0.0.1:${librarianPort}/api/librarian/data-types`, librarian, 'Data Librarian');
  await waitFor(`http://127.0.0.1:${backendPort}/status`, backend, 'backend');

  const headers = { 'content-type': 'application/json', 'x-user-id': 'system-admin' };
  const queueName = 'swift.mt103.live-smoke';
  const createResponse = await fetch(`http://127.0.0.1:${backendPort}/api/queues/qm-primary/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ queueName, config: { dataTypeId: 'mt103' } })
  });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 200, JSON.stringify(created));
  assert.equal(created.config.dataTypeId, 'type:swift-mt103-v4');

  const enqueueResponse = await fetch(`http://127.0.0.1:${backendPort}/api/queue/${encodeURIComponent(queueName)}/enqueue`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: 'MT103\\n:20:LIVE-SMOKE-1',
      sourceService: 'live-smoke',
      messageEnvelope: { dataTypeId: created.config.dataTypeId }
    })
  });
  const enqueued = await enqueueResponse.json();
  assert.equal(enqueueResponse.status, 200, JSON.stringify(enqueued));

  const claimResponse = await fetch(`http://127.0.0.1:${backendPort}/api/queue/${encodeURIComponent(queueName)}/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workerId: 'live-smoke-worker' })
  });
  const claimed = await claimResponse.json();
  assert.equal(claimResponse.status, 200, JSON.stringify(claimed));
  assert.equal(claimed.claim.message.messageEnvelope.dataTypeId, 'type:swift-mt103-v4');

  console.log('[live-canonical-type-stack] PASS: startup migration and HTTP queue flow preserve the Librarian canonical ID');
} finally {
  await stop(backend);
  await stop(librarian);
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}
