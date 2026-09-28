import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { resolveQueueTypeIds } from '../src/backend/queueDslCompiler.mjs';
import QueueManager from '../src/broker/QueueManager.mjs';

async function getFreePort() {
  const net = await import('node:net');
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function readTypesFromLibrarian(runtimeRoot) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const librarian = spawn(process.execPath, ['data-librarian.mjs'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      LIBRARIAN_PORT: String(port),
      PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errorText = '';
  librarian.stderr.on('data', chunk => { errorText += chunk; });

  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (librarian.exitCode != null) throw new Error(`Data Librarian exited with code ${librarian.exitCode}`);
      try {
        const response = await fetch(`${baseUrl}/api/librarian/data-types`);
        if (response.ok) return (await response.json()).types;
      } catch {
        // Service is still starting.
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for Data Librarian${errorText ? `: ${errorText}` : ''}`);
  } finally {
    librarian.kill();
    await new Promise(resolve => {
      if (librarian.exitCode != null) return resolve();
      librarian.once('exit', resolve);
    });
  }
}

const source = `
daemon importProof on local
  refresh 500 ms;
begin
end.
`;
const canonicalId = 'type:swift-mt103-v4';
const roots = [
  fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-librarian-compiler-a-')),
  fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-librarian-compiler-b-'))
];

try {
  for (const runtimeRoot of roots) {
    const librarianRoot = path.join(runtimeRoot, 'services', 'librarian');
    fs.mkdirSync(librarianRoot, { recursive: true });
    fs.writeFileSync(path.join(librarianRoot, 'data-types.json'), JSON.stringify([
      { id: 'mt103', label: 'MT103', canonicalId },
    ], null, 2));
  }

  const typePayloads = await Promise.all(roots.map(readTypesFromLibrarian));
  assert.equal(typePayloads[0][0].canonicalId, canonicalId);
  assert.equal(typePayloads[1][0].canonicalId, canonicalId);

  const compiled = typePayloads.map(types => compilePascalishProgramWithAntlr(source, { typeRegistry: types }));
  const canonicalIds = compiled.map(result => result.programMap.typeRegistry.mt103.canonicalId);
  assert.deepEqual(canonicalIds, [canonicalId, canonicalId]);
  assert.deepEqual(
    resolveQueueTypeIds(['mt103'], compiled[0].programMap.typeRegistry),
    [canonicalId]
  );

  const queueManager = new QueueManager('canonical-id-proof');
  queueManager.createQueue('swift.mt103.integration', {
    dataTypeId: canonicalId,
    dataTypeIds: [canonicalId]
  });
  queueManager.enqueue(
    'swift.mt103.integration',
    'MT103\\n:20:INTEGRATION-1',
    'canonical-id-test',
    'canonical-id-message-1',
    { dataTypeId: canonicalId }
  );
  const claim = queueManager.claim('swift.mt103.integration', 'canonical-id-worker');
  assert.equal(claim.message.messageEnvelope.dataTypeId, canonicalId);
  assert.equal(queueManager.getConfig('swift.mt103.integration').dataTypeId, canonicalId);

  console.log('[librarian-compiler-integration] PASS: canonical IDs remain stable across Librarian instances, compiler resolution, and queue claim');
} finally {
  for (const runtimeRoot of roots) fs.rmSync(runtimeRoot, { recursive: true, force: true });
}
