import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SwarmCheckpointPair, SwarmCheckpointStore } from '../src/backend/swarmCheckpointStore.mjs';
import { SwarmLeadershipWitness } from '../src/backend/swarmLeadershipWitness.mjs';

const codeId = 'a'.repeat(64);
const checkpoint = (changes = {}) => ({
  taskId: 'task-1', codeId, expectedSequence: 0, state: { counter: 42 }, ...changes,
});

function fixture(t, wrapStandby = store => store) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-witness-'));
  let witness;
  const stores = [];
  t.after(() => {
    witness?.close();
    stores.forEach(store => store.close());
    fs.rmSync(directory, { recursive: true });
  });
  const active = new SwarmCheckpointStore({ id: 'active', filePath: path.join(directory, 'active.bin') });
  stores.push(active);
  const standby = new SwarmCheckpointStore({ id: 'standby', filePath: path.join(directory, 'standby.bin') });
  stores.push(standby);
  const pair = new SwarmCheckpointPair([active, wrapStandby(standby)]);
  let timestamp = 1000;
  const options = {
    filePath: path.join(directory, 'witness.jsonl'), clusterId: 'swarm-a',
    managerIds: ['active', 'standby'], pair, now: () => timestamp, leaseMs: 100,
  };
  witness = new SwarmLeadershipWitness({ ...options, initialize: true });
  return {
    get witness() { return witness; }, active, standby, options,
    advance(ms) { timestamp += ms; },
    restart() {
      witness.close();
      witness = new SwarmLeadershipWitness(options);
    },
  };
}

test('only enrolled managers receive durable leadership and restart never permits premature takeover', t => {
  const f = fixture(t);
  assert.throws(() => f.witness.grant('outsider'), /not enrolled/);
  const owner = f.witness.grant('active');
  assert.equal(owner.epoch, 1);
  assert.throws(() => f.witness.grant('standby'), /still active/);
  f.restart();
  assert.throws(() => f.witness.grant('standby'), /still active/);
  f.advance(100);
  const replacement = f.witness.grant('standby');
  assert.equal(replacement.epoch, 2);
  assert.deepEqual(replacement.poisonNotice, {
    managerId: 'active', epoch: 1, replacementManagerId: 'standby',
    replacementEpoch: 2, issuedAt: 1100,
  });
  assert.deepEqual(f.witness.getPoisonNotice('active', 1), replacement.poisonNotice);
  assert.throws(() => f.witness.renew(owner), /Stale/);
  f.restart();
  assert.equal(f.witness.token().managerId, 'standby');
  assert.equal(f.witness.token().epoch, 2);
  assert.deepEqual(f.witness.getPoisonNotice('active', 1), replacement.poisonNotice);
});

test('renewal uses witness time and ignores forged expiration, cluster and epoch claims', t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  f.advance(50);
  const renewed = f.witness.renew(owner, 1);
  assert.equal(renewed.expiresAt, 1150);
  assert.equal(renewed.epoch, owner.epoch);
  assert.equal(renewed.keepAliveSequence, 1);
  assert.deepEqual(f.witness.renew(owner, 1), renewed);
  assert.equal(f.witness.token().expiresAt, renewed.expiresAt);
  assert.throws(() => f.witness.renew(owner, 3), /out-of-order/);
  assert.throws(() => f.witness.renew(owner), /Invalid keep-alive sequence/);
  const secondKeepAlive = f.witness.renew(renewed, 2);
  assert.equal(secondKeepAlive.keepAliveSequence, 2);
  assert.throws(() => f.witness.renew({ ...owner, epoch: 999 }), /Stale/);
  assert.throws(() => f.witness.renew({ ...owner, clusterId: 'other' }), /Stale/);
  f.advance(100);
  assert.throws(() => f.witness.renew({ ...owner, expiresAt: Number.MAX_SAFE_INTEGER }), /Stale/);
});

test('witness publishes only replicated checkpoints and restores their committed state after takeover', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  const commit = await f.witness.publish(owner, checkpoint());
  assert.equal(commit.sequence, 1);
  assert.equal(commit.epoch, 1);
  assert.deepEqual(f.active.get(commit.digest), f.standby.get(commit.digest));
  assert.deepEqual(await f.witness.publish(owner, checkpoint()), commit);
  await assert.rejects(f.witness.publish(owner, checkpoint({ state: { counter: 99 } })), /Stale witnessed/);
  f.restart();
  f.advance(100);
  const replacement = f.witness.grant('standby');
  const restored = await f.witness.readCommitted(replacement, 'task-1', codeId);
  assert.deepEqual(restored.state, { counter: 42 });
  assert.equal(restored.degraded, false);
  assert.equal(restored.commit.epoch, 1);
  await assert.rejects(f.witness.publish(owner, checkpoint({ expectedSequence: 1 })), /Stale/);
  await f.witness.publish(replacement, checkpoint({ expectedSequence: 1, state: { counter: 43 } }));
  f.restart();
  assert.equal((await f.witness.readCommitted(replacement, 'task-1', codeId)).state.counter, 43);
});

test('late replication from an old leader cannot publish after takeover even if caller mutates its token', async t => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(t, store => ({
    id: store.id,
    async put(...args) { await pending; return store.put(...args); },
    get: store.get.bind(store),
  }));
  const owner = f.witness.grant('active');
  const publishing = f.witness.publish(owner, checkpoint());
  const rejected = assert.rejects(publishing, /Stale/);
  f.advance(100);
  const replacement = f.witness.grant('standby');
  Object.assign(owner, replacement);
  release();
  await rejected;
  await assert.rejects(f.witness.readCommitted(replacement, 'task-1', codeId), /No witnessed checkpoint/);
  await f.witness.publish(replacement, checkpoint());
});

test('replication failure and witness unavailability never produce an authoritative checkpoint', async t => {
  const f = fixture(t, store => ({
    id: store.id, put() { throw new Error('Standby unreachable'); }, get: store.get.bind(store),
  }));
  const owner = f.witness.grant('active');
  await assert.rejects(f.witness.publish(owner, checkpoint()), /requires both managers/);
  await assert.rejects(f.witness.readCommitted(owner, 'task-1', codeId), /No witnessed checkpoint/);
  f.witness.close();
  assert.throws(() => f.witness.grant('standby'), /unavailable/);
  await assert.rejects(f.witness.publish(owner, checkpoint()), /unavailable/);
});

test('concurrent publication is idempotent for matching state but rejects conflicting checkpoints', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  const results = await Promise.all([
    f.witness.publish(owner, checkpoint()), f.witness.publish(owner, checkpoint()),
  ]);
  assert.deepEqual(results[0], results[1]);
  const settled = await Promise.allSettled([
    f.witness.publish(owner, checkpoint({ expectedSequence: 1, state: 100 })),
    f.witness.publish(owner, checkpoint({ expectedSequence: 1, state: 200 })),
  ]);
  assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(settled.find(result => result.status === 'rejected').reason.message, /Stale witnessed/);
  f.restart();
  assert.equal((await f.witness.readCommitted(owner, 'task-1', codeId)).commit.sequence, 2);
});

test('restore requires a live leader and compatible code and exposes degraded replica status', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  await f.witness.publish(owner, checkpoint());
  await assert.rejects(f.witness.readCommitted(owner, 'task-1', 'b'.repeat(64)), /incompatible/);
  await assert.rejects(f.witness.publish(owner, checkpoint({ codeId: 'b'.repeat(64), expectedSequence: 1 })), /identity changed/);
  f.active.close();
  const restored = await f.witness.readCommitted(owner, 'task-1', codeId);
  assert.equal(restored.degraded, true);
  assert.equal(restored.failures[0].replicaId, 'active');
  f.advance(100);
  await assert.rejects(f.witness.readCommitted(owner, 'task-1', codeId), /Stale/);
});

test('lease expiration during restore rejects results from a stale leadership attempt', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  await f.witness.publish(owner, checkpoint());
  const original = f.witness.pair.read.bind(f.witness.pair);
  t.mock.method(f.witness.pair, 'read', async digest => {
    const result = await original(digest);
    f.advance(100);
    f.witness.grant('standby');
    return result;
  });
  await assert.rejects(f.witness.readCommitted(owner, 'task-1', codeId), /Stale/);
});

test('clock rollback, corrupt history and mismatched witness identity fail closed', t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  f.advance(-1);
  assert.throws(() => f.witness.renew(owner), /clock moved backwards/);
  f.restart();
  assert.throws(() => f.witness.grant('standby'), /clock moved backwards/);
  f.witness.close();
  assert.throws(() => new SwarmLeadershipWitness({ ...f.options, clusterId: 'other' }), /different swarm/);
  fs.appendFileSync(f.options.filePath, `${JSON.stringify({
    version: 1, witness: { kind: 'leader', managerId: 'standby', epoch: 2, expiresAt: 1200, at: 1001 },
  })}\n`);
  assert.throws(() => f.restart(), /Invalid witness leadership history/);
});

test('torn witness append preserves the prior commit; complete invalid records are not ignored', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  await f.witness.publish(owner, checkpoint());
  f.witness.close();
  fs.appendFileSync(f.options.filePath, '{"version":1,"witness":');
  f.restart();
  assert.equal((await f.witness.readCommitted(owner, 'task-1', codeId)).state.counter, 42);
  f.witness.close();
  fs.appendFileSync(f.options.filePath, '{"version":1,"witness":{"kind":"unknown","at":1000}}\n');
  assert.throws(() => f.restart(), /record kind/);
});

test('witness durability failure fences subsequent operations and reports an uncertain publication', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  const original = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === f.witness.journal.fd) throw new Error('Witness disk sync failed');
    return original(fd);
  });
  await assert.rejects(f.witness.publish(owner, checkpoint()), /Witness disk sync failed/);
  assert.equal(f.witness.commits.size, 0);
  assert.throws(() => f.witness.renew(owner), /unavailable/);
  assert.throws(() => f.witness.grant('standby'), /unavailable/);
  await assert.rejects(f.witness.readCommitted(owner, 'task-1', codeId), /unavailable/);
  // The write may have reached disk despite failed acknowledgement.
  t.mock.restoreAll();
  f.restart();
  assert.equal((await f.witness.readCommitted(owner, 'task-1', codeId)).state.counter, 42);
});

test('failed leadership sync never returns a takeover grant and requires restart reconciliation', t => {
  const f = fixture(t);
  f.witness.grant('active');
  f.advance(100);
  const original = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === f.witness.journal.fd) throw new Error('Takeover sync failed');
    return original(fd);
  });
  assert.throws(() => f.witness.grant('standby'), /Takeover sync failed/);
  assert.equal(f.witness.leader.managerId, 'active');
  assert.throws(() => f.witness.grant('standby'), /unavailable/);
  t.mock.restoreAll();
  f.restart();
  assert.equal(f.witness.leader.managerId, 'standby');
  assert.equal(f.witness.leader.epoch, 2);
  assert.throws(() => f.witness.grant('active'), /still active/);
});

test('invalid checkpoint inputs and the complete envelope size are rejected before publication', async t => {
  const f = fixture(t);
  const owner = f.witness.grant('active');
  for (const invalid of [
    { taskId: '../other' }, { codeId: 'not a digest' }, { expectedSequence: -1 },
    { expectedSequence: Number.MAX_SAFE_INTEGER }, { state: undefined }, { state: Infinity },
  ]) await assert.rejects(f.witness.publish(owner, checkpoint(invalid)), /Invalid|portable/);
  await assert.rejects(f.witness.publish(owner, checkpoint({ state: 'x'.repeat(65534) })), /1..65536 bytes/);
  assert.equal(f.witness.commits.size, 0);
});

test('a lost witness journal is not silently re-enrolled with reset leadership epochs', t => {
  const f = fixture(t);
  f.witness.grant('active');
  f.witness.close();
  fs.unlinkSync(f.options.filePath);
  assert.throws(() => f.restart(), /explicit initialization/);
});
