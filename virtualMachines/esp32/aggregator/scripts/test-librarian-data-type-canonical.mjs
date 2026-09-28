import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function getFreePort() {
  const server = await import('node:net');
  const net = server.default || server;
  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

async function waitForLibrarian(baseUrl, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Data Librarian exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/librarian/data-types`);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for Data Librarian');
}

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-data-type-canonical-'));
const librarianRoot = path.join(runtimeRoot, 'services', 'librarian');
fs.mkdirSync(librarianRoot, { recursive: true });
fs.writeFileSync(path.join(librarianRoot, 'data-types.json'), JSON.stringify([
  { id: 'mt103', label: 'MT103' },
], null, 2));

const librarianPort = await getFreePort();
const librarianBaseUrl = `http://127.0.0.1:${librarianPort}`;
const librarian = spawn(process.execPath, ['data-librarian.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    LIBRARIAN_PORT: String(librarianPort),
    PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let librarianError = '';
librarian.stderr.on('data', chunk => { librarianError += chunk; });

try {
  await waitForLibrarian(librarianBaseUrl, librarian);
  const response = await fetch(`${librarianBaseUrl}/api/librarian/data-types`);
  const responseText = await response.text();
  assert.equal(response.status, 200, responseText);
  const payload = JSON.parse(responseText);
  assert.equal(payload.types.length, 1, 'Expected exactly one type after backfill');
  assert.equal(payload.types[0].logicalId, 'mt103');
  assert.equal(payload.types[0].canonicalId, 'type:mt103');

  const persisted = JSON.parse(fs.readFileSync(path.join(librarianRoot, 'data-types.json'), 'utf-8'));
  assert.equal(persisted[0].canonicalId, 'type:mt103');
  assert.equal(persisted[0].logicalId, 'mt103');

  console.log('[data-type-canonical] PASS: existing data librarian records are upgraded with canonical IDs once at import');
} finally {
  librarian.kill();
  await new Promise(resolve => {
    if (librarian.exitCode != null) return resolve();
    librarian.once('exit', resolve);
  });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  if (librarianError.trim()) process.stderr.write(librarianError);
}
