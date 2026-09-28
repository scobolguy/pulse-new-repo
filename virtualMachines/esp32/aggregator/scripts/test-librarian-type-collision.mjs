import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(() => resolve(value));
  });
});

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-type-collision-'));
const librarianRoot = path.join(runtimeRoot, 'services', 'librarian');
fs.mkdirSync(librarianRoot, { recursive: true });
fs.writeFileSync(path.join(librarianRoot, 'data-types.json'), JSON.stringify([
  { id: 'foo bar', label: 'Foo Bar' },
  { id: 'foo-bar', label: 'Foo-Bar' }
], null, 2));

const server = spawn(process.execPath, ['data-librarian.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: { ...process.env, LIBRARIAN_PORT: String(port), PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });

try {
  let payload;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/librarian/data-types`);
      if (response.ok) {
        payload = await response.json();
        break;
      }
    } catch {
      // Service is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(payload, `Data Librarian did not start: ${output}`);
  assert.equal(payload.types.length, 2);
  assert.notEqual(payload.types[0].canonicalId, payload.types[1].canonicalId);
  assert.match(payload.types[0].canonicalId, /^type:foo-bar-[0-9a-f]{10}$/);
  assert.match(payload.types[1].canonicalId, /^type:foo-bar-[0-9a-f]{10}$/);
  console.log('[librarian-type-collision] PASS: colliding logical names receive stable unique canonical IDs');
} finally {
  server.kill();
  await new Promise(resolve => {
    if (server.exitCode != null) return resolve();
    server.once('exit', resolve);
  });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}
