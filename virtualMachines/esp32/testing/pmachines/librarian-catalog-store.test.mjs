import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPascalishCatalogStore } from '../../aggregator/src/librarian/catalog-store.mjs';

async function fixture(t, options = {}) {
  const legacyRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-catalog-store-'));
  t.after(() => fs.rm(legacyRoot, { recursive: true, force: true }));
  const root = path.join(legacyRoot, 'catalog');
  await fs.mkdir(root);
  const store = await createPascalishCatalogStore({
    root, legacyRoot, logger: { warn() {}, error() {} }, ...options
  });
  t.after(() => store.stop());
  return { store, root, legacyRoot };
}

test('Pascalish persists all four catalogs with unchanged JSON formatting and restart recovery', async t => {
  const { store, root, legacyRoot } = await fixture(t);
  const catalogs = {
    subschemas: [{ id: 'payment', accessibleFields: ['Document.\u540d', 'Document.\ud800'] }],
    'schema-lifecycle': { 'payment.xsd': { effectiveFrom: '2026-01-01T00:00:00.000Z' } },
    'data-types': [{ id: 'payment', label: '\u540d\ud83d\ude00', fields: [] }],
    'mapper-rulesets': [{ id: 'mapping', description: 'quotes " and \\ and \n', recommended: true }]
  };
  for (const [name, value] of Object.entries(catalogs)) {
    assert.equal(await store.read(name), undefined);
    await store.write(name, value);
    assert.deepEqual(await store.read(name), value);
    assert.equal(await fs.readFile(path.join(root, `${name}.json`), 'utf8'), JSON.stringify(value, null, 2));
  }
  await store.stop();
  const restarted = await createPascalishCatalogStore({
    root, legacyRoot, logger: { warn() {}, error() {} }
  });
  t.after(() => restarted.stop());
  for (const [name, value] of Object.entries(catalogs)) assert.deepEqual(await restarted.read(name), value);
  assert.deepEqual((await fs.readdir(root)).sort(), Object.keys(catalogs).map(name => `${name}.json`).sort());
  assert.equal(restarted.getStatus().capabilities.profile, 'desktop');
});

test('legacy data types are read through a read-only grant', async t => {
  const { store, legacyRoot } = await fixture(t);
  assert.equal(await store.readLegacyDataTypes(), undefined);
  const types = [{ id: 'legacy', label: 'legacy' }];
  await fs.writeFile(path.join(legacyRoot, 'data-types.json'), JSON.stringify(types));
  assert.deepEqual(await store.readLegacyDataTypes(), types);
  assert.deepEqual(store.getStatus().capabilities.filesystem, [
    { name: 'catalog', readOnly: false }, { name: 'legacy', readOnly: true }
  ]);
});

test('Pascalish rejects unknown catalog names rather than accepting caller paths', async t => {
  const { store, root, legacyRoot } = await fixture(t);
  for (const name of ['../secret', 'subschemas.json', 'schemas', 'catalog', '']) {
    await assert.rejects(store.read(name), /Unknown Librarian catalog/);
    await assert.rejects(store.write(name, []), /Unknown Librarian catalog/);
  }
  assert.deepEqual(await fs.readdir(root), []);
  assert.deepEqual(await fs.readdir(legacyRoot), ['catalog']);
});

test('corrupt, invalid UTF-8, oversized and linked catalogs fail explicitly and are not overwritten', async t => {
  const { store, root, legacyRoot } = await fixture(t, { maxFileBytes: 64 });
  const target = path.join(root, 'subschemas.json');
  await fs.writeFile(target, 'not JSON');
  await assert.rejects(store.read('subschemas'), /Invalid embedded JSON/);
  await fs.writeFile(target, Buffer.from([0xff]));
  await assert.rejects(store.read('subschemas'), /failed/);
  await fs.writeFile(target, JSON.stringify(['x'.repeat(65)]));
  await assert.rejects(store.read('subschemas'), error => error.code === 'EFBIG');
  await fs.writeFile(target, '[]');
  await assert.rejects(store.write('subschemas', ['x'.repeat(65)]), error => error.code === 'EFBIG');
  assert.equal(await fs.readFile(target, 'utf8'), '[]');
  await assert.rejects(store.write('subschemas', undefined), /JSON serializable/);
  const outside = path.join(legacyRoot, 'outside.json');
  await fs.writeFile(outside, '[]');
  await fs.rm(target);
  await fs.link(outside, target);
  await assert.rejects(store.read('subschemas'), /hard links/);
  await assert.rejects(store.write('subschemas', [{ id: 'bad' }]), /hard links/);
  assert.equal(await fs.readFile(outside, 'utf8'), '[]');
  assert.deepEqual((await fs.readdir(root)).filter(name => name.startsWith('.pulse-')), []);
});

test('null is a stored JSON value, not a missing-file sentinel', async t => {
  const { store } = await fixture(t);
  await store.write('subschemas', null);
  assert.equal(await store.read('subschemas'), null);
  await store.write('subschemas', []);
  assert.deepEqual(await store.read('subschemas'), []);
});

test('raw catalog imports keep formatting and reject malformed JSON before replacing a file', async t => {
  const { store, root } = await fixture(t);
  const content = '[\n\t{"id":"imported"}\n]\n';
  await store.writeText('subschemas', content);
  assert.equal(await fs.readFile(path.join(root, 'subschemas.json'), 'utf8'), content);
  assert.deepEqual(await store.read('subschemas'), [{ id: 'imported' }]);
  await assert.rejects(store.writeText('subschemas', 'not JSON'), /Invalid embedded JSON/);
  assert.equal(await fs.readFile(path.join(root, 'subschemas.json'), 'utf8'), content);
});

test('concurrent catalog reads fit the Librarian workload without unbounded queues', async t => {
  const { store } = await fixture(t);
  await store.write('subschemas', [{ id: 'test' }]);
  const results = await Promise.all(Array.from({ length: 24 }, () => store.read('subschemas')));
  for (const result of results) assert.deepEqual(result, [{ id: 'test' }]);
  const overflow = await Promise.allSettled(Array.from({ length: 65 }, () => store.read('subschemas')));
  assert.ok(overflow.some(result => result.status === 'rejected' && /queue full/.test(result.reason.message)));
  assert.deepEqual(await store.read('subschemas'), [{ id: 'test' }]);
});

test('a removed storage root is not treated as a missing catalog', async t => {
  const { store, root } = await fixture(t);
  await fs.rmdir(root);
  await assert.rejects(store.read('subschemas'), error => error.code === 'ESTORAGE');
});

const subschema = id => ({
  id, label: id, parentSchemaPath: 'parent.json-schema', accessibleFields: ['Document.Id'], parentTypeId: 'parent'
});

async function mutation(store, operation, id, definition) {
  const expected = await store.read('subschemas') ?? [];
  return store.mutateSubschemas({ operation, id, definition, expected, entries: expected });
}

test('Pascalish subschema CRUD makes duplicate, rename and not-found decisions and preserves formatting', async t => {
  const { store, root } = await fixture(t);
  const first = subschema('first');
  assert.deepEqual((await mutation(store, 'create', first.id, first)).definition, first);
  const second = subschema('second');
  await mutation(store, 'create', second.id, second);
  await assert.rejects(mutation(store, 'create', 'first', first), error => error.status === 409 && /already exists/.test(error.message));
  await assert.rejects(mutation(store, 'update', 'first', second), error => error.status === 409);
  await assert.rejects(mutation(store, 'update', 'missing', first), error => error.status === 404);
  const renamed = { ...first, id: 'renamed', label: 'Updated' };
  assert.deepEqual((await mutation(store, 'update', 'first', renamed)).definition, renamed);
  assert.deepEqual(await store.read('subschemas'), [renamed, second]);
  assert.equal(await fs.readFile(path.join(root, 'subschemas.json'), 'utf8'), JSON.stringify([renamed, second], null, 2));
  await mutation(store, 'delete', 'renamed');
  await assert.rejects(mutation(store, 'delete', 'renamed'), error => error.status === 404);
  assert.deepEqual(await store.read('subschemas'), [second]);
});

test('stale snapshots cannot overwrite concurrent CRUD or catalog imports', async t => {
  const { store, root } = await fixture(t);
  const expected = [];
  await mutation(store, 'create', 'first', subschema('first'));
  const before = await fs.readFile(path.join(root, 'subschemas.json'), 'utf8');
  await assert.rejects(store.mutateSubschemas({
    operation: 'create', id: 'second', definition: subschema('second'), expected, entries: expected
  }), error => error.status === 409 && error.retry === true);
  assert.equal(await fs.readFile(path.join(root, 'subschemas.json'), 'utf8'), before);
  const stale = await store.read('subschemas');
  await store.write('subschemas', [subschema('imported')]);
  await assert.rejects(store.mutateSubschemas({
    operation: 'delete', id: 'first', expected: stale, entries: stale
  }), error => error.retry === true);
  assert.deepEqual(await store.read('subschemas'), [subschema('imported')]);
});

test('Pascalish parent-path rename updates matching entries without replacing unrelated subschemas', async t => {
  const { store } = await fixture(t);
  const expected = [subschema('first'), { ...subschema('second'), parentSchemaPath: 'other.xsd' }];
  await store.write('subschemas', expected);
  await store.mutateSubschemas({
    operation: 'rename-parent', expected, entries: expected,
    previousPath: 'parent.json-schema', nextPath: 'renamed.json-schema'
  });
  assert.deepEqual(await store.read('subschemas'), [
    { ...expected[0], parentSchemaPath: 'renamed.json-schema' }, expected[1]
  ]);
});

test('normalized snapshots preserve legacy records while Pascalish owns the mutation', async t => {
  const { store } = await fixture(t);
  const raw = [{ ...subschema('FIRST'), extra: 'ignored by existing normalization' }];
  await store.write('subschemas', raw);
  await store.mutateSubschemas({
    operation: 'create', id: 'second', definition: subschema('second'),
    expected: raw, entries: [subschema('first')]
  });
  assert.deepEqual(await store.read('subschemas'), [subschema('first'), subschema('second')]);
});

test('failed Pascalish mutation never replaces corrupt catalogs or exceeds file budgets', async t => {
  const { store, root } = await fixture(t, { maxFileBytes: 64 });
  const target = path.join(root, 'subschemas.json');
  await fs.writeFile(target, 'null');
  await assert.rejects(store.mutateSubschemas({
    operation: 'create', id: 'first', definition: subschema('first'), expected: [], entries: []
  }), /Expected a JSON array/);
  assert.equal(await fs.readFile(target, 'utf8'), 'null');
  await fs.writeFile(target, '[]');
  await assert.rejects(mutation(store, 'create', 'first', subschema('first')), error => error.code === 'EFBIG');
  assert.equal(await fs.readFile(target, 'utf8'), '[]');
  assert.deepEqual(await fs.readdir(root), ['subschemas.json']);
});
