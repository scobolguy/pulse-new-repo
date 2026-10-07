import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-librarian-http-catalog-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const legacy = [{ id: 'legacy-type', label: 'Legacy', builtin: false, isIso: false }];
  await fs.writeFile(path.join(root, 'data-types.json'), JSON.stringify(legacy));
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });

  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const entry = fileURLToPath(new URL('../../aggregator/data-librarian.mjs', import.meta.url));
  const child = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: { ...process.env, LIBRARIAN_DATA_ROOT: root, LIBRARIAN_PORT: String(port), LIBRARIAN_CATALOG_MAX_BYTES: '262144' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  t.after(() => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  }));
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Librarian startup failed: ${errors}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return { root, origin, catalogRoot: path.join(root, 'services', 'librarian'), legacy };
    } catch {
      // Retry connection failures only during child startup.
    }
    await delay(50);
  }
  throw new Error(`Librarian startup timeout: ${errors}`);
}

test('HTTP catalog errors never silently reset persisted data; valid raw imports use Pascalish storage', async t => {
  const { origin, root, catalogRoot, legacy } = await fixture(t);
  const get = endpoint => fetch(`${origin}${endpoint}`);
  const migrated = await get('/api/librarian/data-types');
  assert.equal(migrated.status, 200);
  const normalized = [{
    ...legacy[0], logicalId: 'legacy-type', canonicalId: 'type:legacy-type',
    aliases: ['legacy-type', 'type:legacy-type']
  }];
  assert.deepEqual((await migrated.json()).types, normalized);
  await assert.rejects(fs.stat(path.join(root, 'data-types.json')), error => error.code === 'ENOENT');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(catalogRoot, 'data-types.json'), 'utf8')), normalized);

  for (const [name, endpoint, valid, invalid] of [
    ['subschemas', '/api/librarian/subschemas', [], {}],
    ['data-types', '/api/librarian/data-types', legacy, {}],
    ['mapper-rulesets', '/api/librarian/mapper-rulesets', [], {}],
    ['schema-lifecycle', '/api/librarian/schemas', {}, []]
  ]) {
    const file = path.join(catalogRoot, `${name}.json`);
    for (const bad of ['not JSON', 'null', JSON.stringify(invalid)]) {
      await fs.writeFile(file, bad);
      const response = await get(endpoint);
      assert.equal(response.status, 500, `${name}: corrupt catalog must not become empty`);
      assert.equal(typeof (await response.json()).error, 'string');
      assert.equal(await fs.readFile(file, 'utf8'), bad);
    }
    await fs.writeFile(file, JSON.stringify(valid));
    assert.equal((await get(endpoint)).status, 200);
  }
  const file = path.join(catalogRoot, 'data-types.json');
  await fs.writeFile(file, 'broken');
  const update = await fetch(`${origin}/api/librarian/data-types`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'new-type', label: 'New' })
  });
  assert.equal(update.status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), 'broken');

  const upload = text => fetch(`${origin}/api/librarian/upload/data`, {
    method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': 'data-types.json' },
    body: text
  });
  const content = '[\n\t{"id":"imported","label":"Imported","builtin":false,"isIso":false}\n]\n';
  assert.equal((await upload(content)).status, 200);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.equal((await upload('not JSON')).status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.equal((await upload(Buffer.from([0xff]))).status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.equal((await upload(JSON.stringify(['x'.repeat(262145)]))).status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.deepEqual((await fs.readdir(catalogRoot)).filter(name => name.startsWith('.pulse-')), []);
});

test('concurrent HTTP subschema mutations preserve every success and enforce uniqueness', async t => {
  const { origin, catalogRoot } = await fixture(t);
  await fs.writeFile(path.join(catalogRoot, 'schemas', 'parent.json-schema'), JSON.stringify({
    type: 'object', properties: { Document: { type: 'object', properties: {
      Id: { type: 'string' }, Other: { type: 'string' }
    } } }
  }));
  const call = async (method, endpoint, body) => {
    const response = await fetch(`${origin}${endpoint}`, {
      method, headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000)
    });
    return { status: response.status, body: await response.json() };
  };
  const definition = id => ({ id, label: id, parentSchemaPath: 'parent.json-schema', accessibleFields: ['Document.Id'] });
  const results = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    call('POST', '/api/librarian/subschemas', definition(`concurrent-${index}`))));
  for (const result of results) assert.equal(result.status, 201, JSON.stringify(result.body));
  const target = path.join(catalogRoot, 'subschemas.json');
  const created = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(created.length, 24);
  assert.equal(new Set(created.map(item => item.id)).size, 24);
  const duplicates = await Promise.all(Array.from({ length: 2 }, () =>
    call('POST', '/api/librarian/subschemas', definition('duplicate'))));
  assert.deepEqual(duplicates.map(result => result.status).sort(), [201, 409]);
  assert.equal(JSON.parse(await fs.readFile(target, 'utf8')).filter(item => item.id === 'duplicate').length, 1);
  const updates = await Promise.all([
    call('PUT', '/api/librarian/subschemas/concurrent-0', { label: 'Updated label' }),
    call('PUT', '/api/librarian/subschemas/concurrent-0', { accessibleFields: ['Document.Other'] })
  ]);
  for (const result of updates) assert.equal(result.status, 200, JSON.stringify(result.body));
  const updated = JSON.parse(await fs.readFile(target, 'utf8')).find(item => item.id === 'concurrent-0');
  assert.equal(updated.label, 'Updated label');
  assert.deepEqual(updated.accessibleFields, ['Document.Other']);
  const deletes = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    call('DELETE', `/api/librarian/subschemas/concurrent-${index + 1}`)));
  for (const result of deletes) assert.equal(result.status, 200, JSON.stringify(result.body));
  const remaining = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(remaining.length, 13);
  assert.ok(remaining.some(item => item.id === 'concurrent-0' && item.label === 'Updated label'));
  for (let index = 1; index <= 12; index++) assert.ok(!remaining.some(item => item.id === `concurrent-${index}`));
  const missing = await call('PUT', '/api/librarian/subschemas/missing', { label: 'Missing' });
  assert.equal(missing.status, 404);
  const conflict = await call('PUT', '/api/librarian/subschemas/concurrent-0', { id: 'duplicate' });
  assert.equal(conflict.status, 409);
  const renamed = await call('POST', '/api/librarian/schemas/rename', {
    path: 'parent.json-schema', newName: 'renamed'
  });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  const afterRename = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(afterRename.length, 13);
  assert.ok(afterRename.every(item => item.parentSchemaPath === 'renamed.json-schema'));
  assert.equal((await call('GET', '/api/librarian/subschemas')).body.subschemas.length, 13);
});
