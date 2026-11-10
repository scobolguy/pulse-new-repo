import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { SwarmCheckpointPair, SwarmCheckpointStore } from '../src/backend/swarmCheckpointStore.mjs';

const digestOf = data => createHash('sha256').update(data).digest('hex');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-checkpoint-pair-'));
  const stores = [];
  t.after(() => {
    for (const store of stores) store.close();
    fs.rmSync(directory, { recursive: true });
  });
  function open(id) {
    const store = new SwarmCheckpointStore({ id, filePath: path.join(directory, `${id}.bin`) });
    stores.push(store);
    return store;
  }
  return { open };
}

test('both independent stores durably retain identical data across reopening', async t => {
  const f = fixture(t);
  let active = f.open('active');
  let standby = f.open('standby');
  const data = Buffer.from('{"task":"task-1","sequence":7,"counter":42}');
  const receipt = await new SwarmCheckpointPair([active, standby]).replicate(data);
  assert.deepEqual(receipt, { digest: digestOf(data), bytes: data.length, replicas: ['active', 'standby'] });
  active.close();
  standby.close();
  active = f.open('active');
  standby = f.open('standby');
  assert.deepEqual(active.get(receipt.digest), data);
  assert.deepEqual(standby.get(receipt.digest), data);
  const result = await new SwarmCheckpointPair([active, standby]).read(receipt.digest);
  assert.deepEqual(result, { data, degraded: false, failures: [] });
});

test('duplicate replication is idempotent and different state never replaces old bytes', async t => {
  const f = fixture(t);
  const stores = [f.open('active'), f.open('standby')];
  const pair = new SwarmCheckpointPair(stores);
  const data = Buffer.from('committed');
  const receipt = await pair.replicate(data);
  const sizes = stores.map(store => fs.statSync(store.filePath).size);
  assert.deepEqual(await pair.replicate(data), receipt);
  assert.deepEqual(stores.map(store => fs.statSync(store.filePath).size), sizes);
  const next = await pair.replicate(Buffer.from('next'));
  assert.notEqual(next.digest, receipt.digest);
  assert.deepEqual((await pair.read(receipt.digest)).data, data);
  assert.throws(() => stores[0].put(receipt.digest, Buffer.from('changed')), /does not match/);
});

test('a failed standby produces no replication success; safe partial storage can be retried', async t => {
  const f = fixture(t);
  const active = f.open('active');
  const standby = f.open('standby');
  let unavailable = true;
  const adapter = {
    id: standby.id,
    put(...args) {
      if (unavailable) throw new Error('Standby disconnected');
      return standby.put(...args);
    },
    get: standby.get.bind(standby),
  };
  const pair = new SwarmCheckpointPair([active, adapter]);
  const data = Buffer.from('pending checkpoint');
  await assert.rejects(pair.replicate(data), error => {
    assert.equal(error.message, 'Checkpoint replication requires both managers');
    assert.equal(error.errors[0].cause.message, 'Standby disconnected');
    return true;
  });
  assert.deepEqual(active.get(digestOf(data)), data);
  unavailable = false;
  const receipt = await pair.replicate(data);
  assert.deepEqual(standby.get(receipt.digest), data);
});

test('replication waits for both managers and snapshots caller-owned bytes', async t => {
  const f = fixture(t);
  const active = f.open('active');
  const standby = f.open('standby');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const pair = new SwarmCheckpointPair([active, {
    id: standby.id,
    async put(digest, bytes) {
      await pending;
      return standby.put(digest, bytes);
    },
    get: standby.get.bind(standby),
  }]);
  const bytes = Buffer.from('snapshot');
  const expected = Buffer.from(bytes);
  let acknowledged = false;
  const operation = pair.replicate(bytes).then(receipt => {
    acknowledged = true;
    return receipt;
  });
  bytes.fill(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledged, false);
  assert.deepEqual(active.get(digestOf(expected)), expected);
  release();
  const receipt = await operation;
  assert.equal(acknowledged, true);
  assert.deepEqual(standby.get(receipt.digest), expected);
});

test('degraded reads expose the failed manager and reject data when neither replica verifies', async t => {
  const f = fixture(t);
  const active = f.open('active');
  const standby = f.open('standby');
  const pair = new SwarmCheckpointPair([active, standby]);
  const receipt = await pair.replicate(Buffer.from('good bytes'));
  active.close();
  const result = await pair.read(receipt.digest);
  assert.equal(result.data.toString(), 'good bytes');
  assert.equal(result.degraded, true);
  assert.equal(result.failures[0].replicaId, 'active');
  assert.match(result.failures[0].error.message, /unavailable/);
  standby.close();
  await assert.rejects(pair.read(receipt.digest), /Both checkpoint replicas failed/);
});

test('read-back rejects a lying receipt or corrupted remote data', async t => {
  const f = fixture(t);
  const active = f.open('active');
  const bad = {
    id: 'standby',
    put(digest, data) { return { replicaId: 'standby', digest, bytes: data.length }; },
    get() { return Buffer.from('corrupt'); },
  };
  const pair = new SwarmCheckpointPair([active, bad]);
  const data = Buffer.from('authentic');
  await assert.rejects(pair.replicate(data), error => {
    assert.match(error.errors[0].cause.message, /read-back differs/);
    return true;
  });
  const result = await pair.read(digestOf(data));
  assert.equal(result.degraded, true);
  assert.match(result.failures[0].error.message, /integrity/);
  const lying = { ...bad, put() { return { replicaId: 'other' }; } };
  await assert.rejects(new SwarmCheckpointPair([active, lying]).replicate(data), error => {
    assert.match(error.errors[0].cause.message, /Invalid.*receipt/);
    return true;
  });
});

test('incomplete append is discarded but complete corrupt data fails closed', async t => {
  const f = fixture(t);
  let store = f.open('active');
  const data = Buffer.from('preserved');
  store.put(digestOf(data), data);
  const committedBytes = store.bytes;
  store.close();
  const header = Buffer.alloc(36);
  header.writeUInt32BE(10);
  fs.appendFileSync(store.filePath, Buffer.concat([header, Buffer.from('torn')]));
  store = f.open('active');
  assert.equal(store.bytes, committedBytes);
  assert.deepEqual(store.get(digestOf(data)), data);
  store.close();
  fs.appendFileSync(store.filePath, Buffer.concat([header, Buffer.alloc(10)]));
  assert.throws(() => f.open('active'), /integrity check failed/);
});

test('local data corruption is detected on reads and cannot be overwritten by retry', t => {
  const f = fixture(t);
  const store = f.open('active');
  const bytes = Buffer.from('authentic');
  const digest = digestOf(bytes);
  store.put(digest, bytes);
  fs.writeSync(store.fd, Buffer.from('X'), 0, 1, 36);
  fs.fsyncSync(store.fd);
  assert.throws(() => store.get(digest), /integrity/);
  assert.throws(() => store.put(digest, bytes), /integrity/);
  store.close();
  assert.throws(() => f.open('active'), /integrity/);
});

test('sync failure is not acknowledged and disables further use until reconciliation', t => {
  const f = fixture(t);
  const store = f.open('active');
  const original = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === store.fd) throw new Error('Injected checkpoint sync failure');
    return original(fd);
  });
  const data = Buffer.from('uncertain');
  assert.throws(() => store.put(digestOf(data), data), /sync failure/);
  assert.throws(() => store.put(digestOf(data), data), /unavailable/);
  assert.throws(() => store.get(digestOf(data)), /unavailable/);
});

test('bounds, independence and exclusive store ownership are enforced', async t => {
  const f = fixture(t);
  const active = f.open('active');
  const standby = f.open('standby');
  const pair = new SwarmCheckpointPair([active, standby]);
  for (const data of [Buffer.alloc(0), Buffer.alloc(65537), 'not bytes'])
    await assert.rejects(pair.replicate(data), /1..65536 bytes/);
  const boundary = Buffer.alloc(65536, 7);
  const receipt = await pair.replicate(boundary);
  assert.equal(receipt.bytes, 65536);
  await assert.rejects(pair.read('../other'), /Invalid checkpoint SHA/);
  assert.throws(() => new SwarmCheckpointPair([active]), /Exactly two/);
  assert.throws(() => new SwarmCheckpointPair([active, active]), /independent/);
  assert.throws(() => new SwarmCheckpointPair([
    active, { id: 'different', filePath: active.filePath, put() {}, get() {} },
  ]), /independent/);
  assert.throws(() => f.open('active'), /EEXIST/);
  assert.throws(() => new SwarmCheckpointStore({ id: '../bad', filePath: active.filePath }), /replica id/);
});

test('bounded store capacity rejects new blobs but allows existing checkpoints', t => {
  const f = fixture(t);
  let store = f.open('active');
  for (let index = 0; index < 256; index += 1) {
    const data = Buffer.from(String(index));
    store.put(digestOf(data), data);
  }
  store.close();
  store = f.open('active');
  const existing = Buffer.from('0');
  assert.equal(store.put(digestOf(existing), existing).bytes, 1);
  const extra = Buffer.from('257');
  assert.throws(() => store.put(digestOf(extra), extra), /capacity exhausted/);
});
