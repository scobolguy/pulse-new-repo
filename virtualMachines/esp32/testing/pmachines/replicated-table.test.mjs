import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr as compile } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { assertHostCapabilities } from '../../pmachines/shared/contracts/host-capabilities.mjs';
import { parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createFileDatastoreAdapter, createDistributedTableAuthority, serveDistributedTableAuthority, tableSchema }
  from '../../pmachines/javascript/src/distributed-datastore.mjs';
import { createReplicatedCache } from '../../pmachines/javascript/src/replicated-cache.mjs';
import { deployReplicatedCache } from '../../pmachines/javascript/deploy-replicated-cache.mjs';

const token = 'test-only-deployment-token-not-a-real-secret';
const logger = { log() {}, warn() {}, error() {} };
const fields = [{ name: 'name', type: 'string' }, { name: 'count', type: 'integer' }];
const table = tableSchema({ name: 'directory', fields });
const definition = { name: 'items', capacity: 50, fields, backingTable: 'directory' };
const source = `
type Item = record name: string; count: integer; end;
distributed table Directory: map<string, Item>;
service 'replicated-example';
var items: cache<string, Item> backed by Directory;
    item: Item;
get '/item';
begin
  item := items.get(host.event_query('key'));
  return item.name
end
post '/item';
begin
  item.name := host.json_text(host.event_body(), 'name');
  item.count := host.json_integer(host.event_body(), 'count');
  items.put(host.event_query('key'), item);
  return '{"saved":true}'
end
delete '/item';
begin
  items.remove(host.event_query('key'));
  return '{"removed":true}'
end
get '/contains';
begin
  return items.contains(host.event_query('key'))
end
post '/clear';
begin
  return items.clearLocal()
end
get '/count';
begin
  return items.count()
end
end.`;

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-table-'));
  const file = path.join(root, 'directory.json');
  let authority, service;
  async function open() {
    authority = await createDistributedTableAuthority({
      adapter: await createFileDatastoreAdapter(file), tables: [table], ttlMs: 10000, ...options
    });
    service = await serveDistributedTableAuthority(authority, { token });
    return service.origin;
  }
  await open();
  t.after(async () => {
    if (service) await service.close();
    if (authority) await authority.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  return {
    file, get authority() { return authority; }, get origin() { return service.origin; },
    async restart() {
      await service.close(); service = null;
      await authority.close(); authority = null;
      return open();
    }
  };
}

async function replica(t, f, id, options = {}) {
  const cache = await createReplicatedCache({
    definition, binding: { origin: f.origin, token, replicaId: id },
    pollMs: 60000, logger, ...options
  });
  t.after(() => cache.stop());
  return cache;
}

test('top-level tables and generic caches compile typed methods and preserve compact signed metadata', () => {
  const result = compile(source, { hostServices: true });
  assert.deepEqual(result.programMap.distributedTables, [{ name: 'directory', keyType: 'string', fields }]);
  assert.equal(result.programMap.hostCaches[0].backingTable, 'directory');
  assert.deepEqual(result.programMap.targets, ['js']);
  assert.ok(result.programMap.requiredHostCapabilities.includes('distributed-cache'));
  assert.match(result.pcodeText, /CALL_EXT host\.replica_get 2/);
  assert.match(result.pcodeText, /CALL_EXT host\.replica_put 3/);
  const signed = attachPcodeSignature(result.programMap, result.pcodeText);
  assert.deepEqual(compactServiceHostProgramMap(signed).distributedTables, result.programMap.distributedTables);
  assert.throws(() => assertHostCapabilities(signed, parsePcode(result.pcodeText), []), /distributed-cache/);
  for (const invalid of [
    source.replace('map<string, Item>', 'map<integer, Item>'),
    source.replace('cache<string, Item>', 'cache<integer, Item>'),
    source.replace(' backed by Directory', ''),
    source.replace('backed by Directory', 'backed by Missing'),
    source.replace('map<string, Item>', 'map<string, string>'),
    source.replace('var items:', 'distributed table Inner: map<string, Item>; var items:'),
    source.replace('cache<string, Item>', 'cache of Item')
  ]) assert.throws(() => compile(invalid, { hostServices: true }));
  assert.throws(() => compile(source), /hosted/);
  const unused = compile(`distributed table Directory: map<string, string>;
    service 'unused'; get '/ok'; begin return 'ok' end end.`, { hostServices: true });
  assert.deepEqual(unused.programMap.requiredHostCapabilities, ['distributed-cache']);
  assert.deepEqual(unused.programMap.targets, ['js']);
});

test('authority persists values, versions, tombstones and replica acknowledgments across restart', async t => {
  const f = await fixture(t);
  const written = await f.authority.write('directory', table.schemaId, 'a', { name: 'Alpha', count: 1 });
  await f.authority.synchronize('directory', table.schemaId, 'one', written.generation, written.delivery);
  await f.restart();
  const read = await f.authority.read('directory', table.schemaId, 'a');
  assert.equal(read.version, written.version);
  assert.equal(read.generation, written.generation);
  assert.ok(read.delivery > written.delivery);
  assert.equal(f.authority.status().tables[0].replicas[0].ack, written.delivery);
  await f.authority.write('directory', table.schemaId, 'a', null, true);
  await f.restart();
  await assert.rejects(f.authority.read('directory', table.schemaId, 'a'), error => error.code === 'KeyNotFound');
  assert.equal(f.authority.status().tables[0].liveKeys, 0);
  await assert.rejects(createFileDatastoreAdapter(f.file), error => error.code === 'EEXIST');
});

test('read-through fills other replicas, concurrent misses deduplicate and duplicate sync does not renew TTL', async t => {
  let wall = 1000, mono = 0, reads = 0;
  const f = await fixture(t, { clock: () => wall, ttlMs: 100 });
  await f.authority.write('directory', table.schemaId, 'a', { name: 'Alpha', count: 1 });
  const a = await replica(t, f, 'one', { clock: () => mono, fetchImpl: async (url, options) => {
    if (JSON.parse(options.body).operation === 'get') reads++;
    return fetch(url, options);
  } });
  const b = await replica(t, f, 'two', { clock: () => mono });
  mono = 100; wall = 1100;
  assert.equal(a.count(), 0);
  const values = await Promise.all(Array.from({ length: 8 }, () => a.get('a')));
  assert.ok(values.every(value => JSON.parse(value).name === 'Alpha'));
  assert.equal(reads, 1);
  await b.synchronize();
  assert.equal(JSON.parse(await b.get('a')).name, 'Alpha');
  mono = 150; wall = 1150;
  await a.synchronize();
  mono = 200; wall = 1200;
  assert.equal(a.count(), 0, 'Duplicate snapshot did not extend residency');
  assert.equal(b.count(), 0);
  assert.equal(await a.contains('absent'), 0);
  await assert.rejects(a.get('absent'), error => error.code === 'KeyNotFound');
});

test('offline replica catches up after writes/deletion without blocking the authority or resurrecting a delayed fill', async t => {
  const f = await fixture(t);
  const a = await replica(t, f, 'one');
  let offline = false, hold = false, release, captured;
  const b = await replica(t, f, 'two', { fetchImpl: async (url, options) => {
    if (offline) throw new Error('Replica transport offline');
    const response = await fetch(url, options);
    if (hold && JSON.parse(options.body).operation === 'get') {
      const body = await response.json();
      captured();
      await new Promise(resolve => { release = resolve; });
      return Response.json(body);
    }
    return response;
  } });
  offline = true;
  await a.put('a', JSON.stringify({ name: 'First', count: 1 }));
  await assert.rejects(b.synchronize(), /offline/);
  assert.equal(b.status().synchronized, false);
  await a.put('a', JSON.stringify({ name: 'Second', count: 2 }));
  offline = false;
  await b.synchronize();
  assert.equal(JSON.parse(await b.get('a')).name, 'Second');
  b.clearLocal();
  hold = true;
  const observed = new Promise(resolve => { captured = resolve; });
  const delayed = b.get('a');
  await observed;
  await a.remove('a');
  await b.synchronize();
  release();
  await assert.rejects(delayed, error => error.code === 'KeyNotFound');
  assert.equal(b.count(), 0);
  const status = f.authority.status().tables[0];
  assert.ok(status.replicas.some(replica => replica.lag > 0), 'Delivery is not falsely acknowledged before replica sync');
});

test('failed durable commits never publish updates; capacity, schema and authorization errors are explicit', async t => {
  let saved = null, fail = false;
  const authority = await createDistributedTableAuthority({
    tables: [table], maxKeys: 1,
    adapter: { load: async () => saved, close: async () => {},
      commit: async value => { if (fail) throw new Error('disk failed'); saved = structuredClone(value); } }
  });
  t.after(() => authority.close());
  fail = true;
  await assert.rejects(authority.write('directory', table.schemaId, 'a', { name: 'A', count: 1 }), /disk failed/);
  assert.equal(authority.status().tables[0].revision, 0);
  fail = false;
  await authority.write('directory', table.schemaId, 'a', { name: 'A', count: 1 });
  await assert.rejects(authority.write('directory', table.schemaId, 'b', { name: 'B', count: 2 }), /capacity/);
  await assert.rejects(authority.write('directory', table.schemaId, 'a', { name: 7, count: 1 }), /value/);
  await assert.rejects(authority.read('directory', 'wrong-schema', 'a'), /schema/);
  const service = await serveDistributedTableAuthority(authority, { token });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.origin}/status`)).status, 401);
});

test('two real JS PMachines install signed backed-cache services and replicate writes, misses and removals', async t => {
  const f = await fixture(t);
  const compiled = compile(source, { hostServices: true });
  const map = attachPcodeSignature(compactServiceHostProgramMap(compiled.programMap), compiled.pcodeText);
  const origins = [];
  for (const id of ['reader-one', 'reader-two']) {
    const machine = createJsPmachineNodeServer({ name: id, logger,
      distributedGrants: { [id]: { directory: { origin: f.origin, token, replicaId: id } } } });
    await new Promise(resolve => machine.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${machine.address().port}`;
    origins.push(origin);
    t.after(async () => {
      await fetch(`${origin}/pmachine/service_host/stop`, { method: 'POST' });
      machine.closeAllConnections();
      await new Promise(resolve => machine.close(resolve));
    });
    for (const [file, body] of [['/reader.pcode', compiled.pcodeText], ['/reader.map.json', JSON.stringify(map)]]) {
      assert.equal((await fetch(`${origin}/ffs/upload`, { method: 'POST', body: new URLSearchParams({ file, body }) })).status, 200);
    }
    const installed = await fetch(`${origin}/pmachine/service_host/install`, { method: 'POST',
      body: new URLSearchParams({ collectorId: id, serviceFile: '/reader.pcode', serviceMap: '/reader.map.json', udpPort: '0' }) });
    assert.equal(installed.status, 200, await installed.text());
  }
  const put = await fetch(`${origins[0]}/item?key=a`, { method: 'POST', body: JSON.stringify({ name: 'Live value', count: 42 }) });
  assert.equal(put.status, 200, await put.text());
  let count = 0;
  for (let attempt = 0; attempt < 100 && count !== 1; attempt++) {
    count = await (await fetch(`${origins[1]}/count`)).json();
    if (count !== 1) await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(count, 1, 'Second PMachine receives replication before a get');
  assert.equal(await (await fetch(`${origins[1]}/item?key=a`)).json(), 'Live value');
  await fetch(`${origins[1]}/clear`, { method: 'POST' });
  assert.equal(await (await fetch(`${origins[1]}/count`)).json(), 0);
  assert.equal(await (await fetch(`${origins[1]}/item?key=a`)).json(), 'Live value', 'Eviction reads through to backing file authority');
  await fetch(`${origins[0]}/item?key=a`, { method: 'DELETE' });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal((await fetch(`${origins[1]}/item?key=a`)).status, 404);
  assert.equal(f.authority.status().tables[0].liveKeys, 0);
});

test('unbound resources fail before service installation instead of degrading to local caches', async () => {
  const compiled = compile(source, { hostServices: true });
  await assert.rejects(createPascalishServiceHost({
    compiled, collectorId: 'unbound', httpPort: null, udpPort: null
  }), /deployment binding|Host capabilities unavailable/);
});

test('failed snapshot application preserves prior residency and guards and retries without falsely acknowledging', async t => {
  const f = await fixture(t);
  await f.authority.write('directory', table.schemaId, 'a', { name: 'Old', count: 1 });
  const a = await replica(t, f, 'one', { maxStorageBytes: 60 });
  const initialRevision = a.status().revision;
  await f.authority.write('directory', table.schemaId, 'a', { name: 'New', count: 2 });
  await f.authority.write('directory', table.schemaId, 'b', { name: 'Large value exceeds remaining cache storage', count: 3 });
  await assert.rejects(a.synchronize(), /capacity/);
  assert.equal(a.status().revision, initialRevision);
  assert.equal(JSON.parse(await a.get('a')).name, 'Old');
  assert.equal(a.status().synchronized, false);
  await f.authority.write('directory', table.schemaId, 'b', null, true);
  await a.synchronize();
  assert.equal(JSON.parse(await a.get('a')).name, 'New');
});

test('deployable example runs in two separate processes and recovers the same durable directory after restart', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-deployment-'));
  let deployment;
  t.after(async () => {
    if (deployment) await deployment.stop();
    await fs.rm(root, { recursive: true, force: true });
  });
  const options = { file: path.join(root, 'directory.json'), authorityPort: 0, machinePorts: [0, 0], logger };
  deployment = await deployReplicatedCache(options);
  assert.equal(new Set(deployment.pids).size, 2);
  assert.ok(deployment.pids.every(pid => pid !== process.pid));
  const device = { name: 'Durable demonstration', protocol: 'example', address: '127.0.0.1' };
  const response = await fetch(`${deployment.origins[0]}/directory/device?key=proof`, {
    method: 'POST', body: JSON.stringify(device)
  });
  assert.equal(response.status, 200, await response.text());
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.deepEqual(await (await fetch(`${deployment.origins[1]}/directory/device?key=proof`)).json(), device);
  const generation = deployment.status().generation;
  await deployment.stop();
  deployment = null;
  deployment = await deployReplicatedCache(options);
  assert.equal(deployment.status().generation, generation);
  assert.deepEqual(await (await fetch(`${deployment.origins[1]}/directory/device?key=proof`)).json(), device);
  await fetch(`${deployment.origins[1]}/directory/clear-local`, { method: 'POST' });
  assert.equal(await (await fetch(`${deployment.origins[1]}/directory/count`)).json(), 0);
  assert.deepEqual(await (await fetch(`${deployment.origins[1]}/directory/device?key=proof`)).json(), device);
});
