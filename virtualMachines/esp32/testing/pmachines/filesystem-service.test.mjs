import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFilesystemService } from '../../aggregator/filesystem-service.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createFilesystemServiceClient } from '../../aggregator/src/librarian/filesystem-service-client.mjs';
import { createPascalishCatalogStore } from '../../aggregator/src/librarian/catalog-store.mjs';
import { createPascalishXsdParser } from '../../aggregator/src/librarian/xsd-parser.mjs';

async function post(origin, route, payload = {}) {
  const response = await fetch(`${origin}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000)
  });
  return { status: response.status, body: await response.json() };
}

test('PMachine filesystem service is root-confined and the Librarian targets logical transactions', async t => {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-filesystem-service-'));
  let catalogStore;
  let xsdParser;
  const catalogRoot = path.join(dataRoot, 'services', 'librarian');
  const schemaRoot = path.join(catalogRoot, 'schemas');
  await fs.mkdir(schemaRoot, { recursive: true });
  await fs.mkdir(path.join(schemaRoot, 'types'));
  await fs.writeFile(path.join(schemaRoot, 'types', 'base.xsd'), '<base/>', 'utf8');
  await fs.writeFile(path.join(dataRoot, 'data-types.json'), '[{"id":"legacy"}]', 'utf8');
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('<schema>psram</schema>', 'utf16le')
  ]);
  await fs.writeFile(path.join(schemaRoot, 'sample.xsd'), utf16);
  await fs.writeFile(path.join(schemaRoot, 'types', 'base.xsd'),
    '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="base" type="xs:string"/></xs:schema>', 'utf8');
  await fs.writeFile(path.join(schemaRoot, 'main.xsd'),
    '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:include schemaLocation="types/base.xsd"/></xs:schema>', 'utf8');

  const service = await createFilesystemService({ dataRoot, httpPort: 0, logger: { log() {}, warn() {}, error() {} } });
  t.after(async () => {
    await xsdParser?.stop();
    await catalogStore?.stop();
    await service.stop();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${service.getStatus().httpPort}`;
  const client = createFilesystemServiceClient(origin);
  catalogStore = await createPascalishCatalogStore({
    root: catalogRoot, legacyRoot: dataRoot, filesystemServiceUrl: origin,
    logger: { log() {}, warn() {}, error() {} }
  });
  xsdParser = await createPascalishXsdParser({
    schemaRoot, filesystemServiceUrl: origin,
    logger: { log() {}, warn() {}, error() {} }
  });

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'filesystem' });

  assert.deepEqual(await post(origin, '/write', {
    root: 'catalog', path: 'data-types.json', content: '[{"id":"catalog"}]'
  }), { status: 200, body: { stored: true } });
  assert.equal(await client.readText('catalog', 'data-types.json'), '[{"id":"catalog"}]');
  assert.equal(await client.exists('catalog', 'data-types.json'), 1);
  assert.equal(await client.exists('catalog', 'absent.json'), 0);
  assert.equal(await client.readText('legacy', 'data-types.json'), '[{"id":"legacy"}]');
  assert.equal(await client.readTextAuto('schemas', 'sample.xsd'), '<schema>psram</schema>');
  assert.equal(await client.resolveRelative('schemas', 'main.xsd', 'types/base.xsd'), 'types/base.xsd');
  await catalogStore.write('data-types', [{ id: 'remote-catalog' }]);
  assert.deepEqual(await catalogStore.read('data-types'), [{ id: 'remote-catalog' }]);
  assert.deepEqual(await catalogStore.readLegacyDataTypes(), [{ id: 'legacy' }]);
  const xsd = await xsdParser.parseFileDetailed('main.xsd');
  assert.ok(xsd.dependencies.includes('main.xsd'));
  assert.ok(xsd.dependencies.includes('types/base.xsd'));

  assert.equal((await post(origin, '/write', {
    root: 'schemas', path: 'sample.xsd', content: 'not allowed'
  })).status, 403);
  assert.equal((await post(origin, '/read', {
    root: 'legacy', path: 'data-types.json'
  })).status, 403);
  assert.equal((await post(origin, '/read', {
    root: 'catalog', path: '../data-types.json'
  })).status, 400);
  assert.equal((await post(origin, '/write', {
    root: 'catalog', path: 'schemas/sample.xsd', content: 'not allowed'
  })).status, 403);
  await assert.rejects(client.readText('catalog', 'absent.json'), error => error.code === 'ENOENT');
  assert.throws(
    () =>     client.writeText('schemas', 'sample.xsd', 'blocked'),
    error => error.status === 403 && error.code === 'EACCES'
  );
  await assert.rejects(client.readText('legacy', 'secrets.json'), { status: 403 });

  await fs.writeFile(path.join(catalogRoot, 'data-types.json'),
    JSON.stringify(Array.from({ length: 9 }, (_, id) => ({ id: `type-${id}` }))), 'utf8');
  await fs.writeFile(path.join(catalogRoot, 'schema-lifecycle.json'),
    JSON.stringify({ active: { id: 'active-schema' }, retired: { id: 'old-schema' } }), 'utf8');
  const firstCatalogPage = await post(origin, '/catalog/page', {
    catalog: 'data-types', offset: 0, limit: 2
  });
  assert.deepEqual(firstCatalogPage, {
    status: 200,
    body: {
      catalog: 'data-types', offset: 0, limit: 2, total: 9, hasMore: true,
      items: [{ id: 'type-0' }, { id: 'type-1' }]
    }
  });
  const finalCatalogPage = await post(origin, '/catalog/page', {
    catalog: 'data-types', offset: 8, limit: 4
  });
  assert.deepEqual(finalCatalogPage.body.items, [{ id: 'type-8' }]);
  assert.equal(finalCatalogPage.body.hasMore, false);
  const objectCatalogPage = await post(origin, '/catalog/page', {
    catalog: 'schema-lifecycle', offset: 0, limit: 1
  });
  assert.deepEqual(objectCatalogPage.body.items, [{ key: 'active', value: { id: 'active-schema' } }]);
  const schemaPage = await post(origin, '/schemas/page', { path: 'types', cursor: '', limit: 4 });
  assert.equal(schemaPage.status, 200);
  assert.deepEqual(schemaPage.body.entries.map(entry => entry.name), ['base.xsd']);
  assert.equal((await post(origin, '/schemas/page', { path: '../', cursor: '', limit: 4 })).status, 400);
  assert.equal((await post(origin, '/catalog/page', {
    catalog: 'data-types', offset: 0, limit: 0
  })).status, 400);

  const profilePath = fileURLToPath(new URL('../../src/librarian/s3-readonly.pas', import.meta.url));
  const profileSource = await fs.readFile(profilePath, 'utf8');
  const profile = compilePascalishProgramWithAntlr(
    profileSource, { fileName: profilePath, hostServices: true }
  );
  assert.deepEqual(profile.programMap.targets, ['esp32']);
  assert.deepEqual(profile.programMap.requiredHostCapabilities, ['service.transaction']);
  assert.match(profileSource,
    /host\.service_submit\('pulse-filesystem', '\/catalog\/page', host\.event_body\(\)\)/);
  assert.match(profileSource,
    /host\.http_status\(202\);\s+return host\.service_submit\(/);
});

test('Filesystem Service rejects HTTP clients outside its configured IPv4 allowlist', async t => {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-filesystem-acl-'));
  const service = await createFilesystemService({
    dataRoot, host: '127.0.0.1', httpPort: 0, httpAllowedPeers: ['192.0.2.9'],
    logger: { log() {}, warn() {}, error() {} }
  });
  t.after(async () => {
    await service.stop();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${service.getStatus().httpPort}/health`);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'HTTP peer is not allowed' });
});
