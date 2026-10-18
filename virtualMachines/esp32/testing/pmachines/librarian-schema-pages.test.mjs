import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createSchemaPageStore, SCHEMA_PAGE_BYTES } from '../../aggregator/src/librarian/schema-page-store.mjs';
import { createFilesystemService } from '../../aggregator/filesystem-service.mjs';
import { createFilesystemServiceClient } from '../../aggregator/src/librarian/filesystem-service-client.mjs';

const logger = { log() {}, warn() {}, error() {} };

test('disk-backed branch pages are complete, byte-bounded, revision-checked and served without a parser', async t => {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-schema-pages-'));
  t.after(() => fs.rm(dataRoot, { recursive: true, force: true }));
  const service = await createFilesystemService({ dataRoot, httpPort: 0, logger });
  t.after(() => service.stop());
  const catalogRoot = path.join(dataRoot, 'services', 'librarian');
  const schemaFile = path.join(catalogRoot, 'schemas', 'wide.json');
  await fs.writeFile(schemaFile, '{"published":true}');
  const stat = await fs.stat(schemaFile);
  const files = [{ root: 'schemas', path: 'wide.json', size: stat.size, modifiedAt: stat.mtime.toISOString() }];
  const tree = {
    name: 'root', valueType: 'object', children: Array.from({ length: 300 }, (_, index) => ({
      name: `Branch${index}`, valueType: 'object',
      children: [{ name: 'Value', valueType: 'string', enumValues: ['日本語', `value${index}`] }],
    })),
  };
  const store = createSchemaPageStore(path.join(catalogRoot, 'schema-pages'));
  const manifest = await store.publish('wide.json', tree, files);
  assert.equal(manifest.nodeCount, 601);
  const client = createFilesystemServiceClient(`http://127.0.0.1:${service.getStatus().httpPort}`, { env: {} });
  let cursor = '0';
  const children = [];
  do {
    const page = await client.schemaTreePage({ schemaKey: manifest.schemaKey, revision: manifest.revision, cursor });
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= SCHEMA_PAGE_BYTES);
    assert.equal(page.node.childCount, 300);
    assert.equal(Object.hasOwn(page.node, 'children'), false);
    assert.ok(page.items.every(node => !Object.hasOwn(node, 'children')));
    children.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  assert.deepEqual(children.map(node => node.name), tree.children.map(node => node.name));
  assert.equal(new Set(children.map(node => node.nodeId)).size, 300);
  const child = await client.schemaTreePage({
    schemaKey: manifest.schemaKey, revision: manifest.revision, nodeId: children[0].nodeId,
  });
  assert.deepEqual(child.items[0].enumValues, ['日本語', 'value0']);
  await store.publish('wide.json', tree, files);
  assert.equal((await store.manifest('wide.json')).revision, manifest.revision);
  await assert.rejects(client.schemaTreePage({ schemaKey: manifest.schemaKey, revision: '0'.repeat(64) }), { status: 409 });
  await assert.rejects(client.schemaTreePage({ schemaKey: '../', nodeId: 'n0' }), { status: 400 });
  await assert.rejects(client.schemaTreePage({ schemaKey: manifest.schemaKey, nodeId: 'n0../secret' }), { status: 400 });
  await assert.rejects(client.schemaTreePage({ schemaKey: manifest.schemaKey, cursor: '99999999' }), { status: 404 });
  await fs.writeFile(schemaFile, '{"source":"changed"}');
  await assert.rejects(client.schemaTreePage({ schemaKey: manifest.schemaKey }), { status: 409 });
});

test('oversized single-node metadata fails explicitly without replacing the published revision', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-schema-page-capacity-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createSchemaPageStore(root);
  const first = await store.publish('schema.json', { name: 'root', children: [] }, []);
  await assert.rejects(store.publish('schema.json', {
    name: 'root', children: [{ name: 'Huge', enumValues: ['x'.repeat(2000)] }],
  }, []), error => error.status === 413 && /metadata/.test(error.message));
  assert.equal((await store.manifest('schema.json')).revision, first.revision);
  assert.ok((await fs.readdir(path.join(root, first.schemaKey))).every(name => !name.startsWith('.')));
});

test('publication is deduplicated and dependency invalidation creates a new revision', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-schema-page-revision-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createSchemaPageStore(root);
  let builds = 0;
  let generation = 1;
  const ensure = () => store.ensure('schema.json', async files => files[0].generation === generation, async () => {
    builds++;
    return { tree: { name: 'root', children: [] }, files: [{ generation }] };
  });
  const [first, duplicate] = await Promise.all([ensure(), ensure()]);
  assert.deepEqual(first, duplicate);
  await ensure();
  assert.equal(builds, 1);
  generation++;
  const updated = await ensure();
  assert.notEqual(updated.revision, first.revision);
  assert.equal(builds, 2);
});
