import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SwarmCheckpointPair, SwarmCheckpointStore } from '../src/backend/swarmCheckpointStore.mjs';
import { SwarmLeadershipWitness } from '../src/backend/swarmLeadershipWitness.mjs';
import { SwarmTaskJournal } from '../src/backend/swarmTaskCoordinator.mjs';
import { WitnessedTaskAdmission } from '../src/backend/witnessedTaskAdmission.mjs';
import { SwarmResourceRegistry } from '../src/backend/swarmResourceRegistry.mjs';

const codeId = 'a'.repeat(64);
function fixture(t, useResources = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-admission-'));
  const stores = [];
  let witness, journal;
  t.after(() => {
    witness?.close();
    journal?.close();
    stores.forEach(store => store.close());
    fs.rmSync(directory, { recursive: true });
  });
  for (const id of ['active', 'standby'])
    stores.push(new SwarmCheckpointStore({ id, filePath: path.join(directory, `${id}.bin`) }));
  let timestamp = 1000;
  const now = () => timestamp;
  const resources = useResources ? new SwarmResourceRegistry({ clusterId: 'swarm-a', now }) : undefined;
  const witnessOptions = {
    filePath: path.join(directory, 'witness.jsonl'), clusterId: 'swarm-a',
    managerIds: ['active', 'standby'], pair: new SwarmCheckpointPair(stores), now, leaseMs: 100,
  };
  witness = new SwarmLeadershipWitness({ ...witnessOptions, initialize: true });
  const taskPath = path.join(directory, 'tasks.jsonl');
  journal = new SwarmTaskJournal(taskPath);
  let admission = new WitnessedTaskAdmission({ witness, journal, resources, now, leaseMs: 200 });
  return {
    get witness() { return witness; },
    get admission() { return admission; },
    get journal() { return journal; },
    resources,
    advance(ms) { timestamp += ms; },
    node(id = 'board-a') {
      return {
        nodeId: id, clusterId: 'swarm-a', status: 'online', codeIds: [codeId],
        capabilities: ['pmachine'], estimatedFreeSlots: 1, freeMemoryBytes: 4096, observedAt: timestamp,
      };
    },
    submit(leader, changes = {}) {
      return admission.submit(leader, {
        clusterId: 'swarm-a', codeId, memoryBytes: 1024, state: { counter: 0 }, ...changes,
      });
    },
    restart() {
      journal.close();
      witness.close();
      witness = new SwarmLeadershipWitness(witnessOptions);
      journal = new SwarmTaskJournal(taskPath);
      admission = new WitnessedTaskAdmission({ witness, journal, resources, now, leaseMs: 200 });
    },
  };
}

test('admission requires live witness authority and scopes tasks to its swarm', t => {
  const f = fixture(t);
  assert.throws(() => f.submit(null), /Stale/);
  const leader = f.witness.grant('active');
  assert.throws(() => f.submit(leader, { clusterId: 'other' }), /different witnessed swarm/);
  const task = f.submit(leader);
  assert.equal(task.leadershipEpoch, leader.epoch);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  assert.equal(owner.leadershipEpoch, leader.epoch);
  f.witness.close();
  assert.throws(() => f.admission.renew(leader, owner), /unavailable/);
  assert.throws(() => f.admission.complete(leader, owner, 42), /unavailable/);
  assert.throws(() => f.admission.cancel(leader, owner.id), /unavailable/);
  assert.throws(() => f.submit(leader), /unavailable/);
});

test('registered resource admission rejects overrides and reserves measured node capacity', t => {
  const f = fixture(t, true);
  const leader = f.witness.grant('active');
  const first = f.submit(leader);
  const second = f.submit(leader);
  f.resources.enroll({ nodeId: 'board-a', capabilities: ['pmachine'] });
  f.resources.report('board-a', { sequence: 1, status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 4096 });
  assert.throws(() => f.admission.claim(leader, first.id), /available capacity/);
  f.resources.verifyBundle('board-a', codeId);
  assert.throws(() => f.admission.claim(leader, first.id, [f.node()]), /overrides/);
  const owner = f.admission.claim(leader, first.id);
  assert.equal(owner.owner, 'board-a');
  assert.throws(() => f.admission.claim(leader, second.id), /available capacity/);
  f.admission.complete(leader, owner, 42);
  f.resources.report('board-a', { sequence: 2, status: 'degraded', estimatedFreeSlots: 1, freeMemoryBytes: 4096 });
  assert.throws(() => f.admission.claim(leader, second.id), /available capacity/);
  f.resources.report('board-a', { sequence: 3, status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 4096 });
  f.admission.claim(leader, second.id);
});

test('takeover fences old manager and old worker tokens, retaining reservations until task lease expiry', t => {
  const f = fixture(t);
  const old = f.witness.grant('active');
  const task = f.submit(old);
  const owner = f.admission.claim(old, task.id, [f.node()]);
  f.advance(100);
  const next = f.witness.grant('standby');
  assert.throws(() => f.admission.renew(old, owner), /Stale/);
  assert.throws(() => f.admission.renew(next, owner), /superseded swarm leader/);
  assert.throws(() => f.admission.complete(next, owner, 42), /superseded swarm leader/);
  const other = f.submit(next);
  assert.throws(() => f.admission.claim(next, other.id, [f.node()]), /available capacity/);
  f.advance(99);
  const renewed = f.witness.renew(next, 1);
  assert.throws(() => f.admission.claim(renewed, task.id, [f.node('board-b')]), /not ready/);
  f.advance(1);
  const replacement = f.admission.claim(renewed, task.id, [f.node(), f.node('board-b')]);
  assert.equal(replacement.owner, 'board-b');
  assert.equal(replacement.epoch, owner.epoch + 1);
  assert.equal(replacement.leadershipEpoch, renewed.epoch);
  f.admission.complete(renewed, replacement, 42);
  f.admission.claim(renewed, other.id, [f.node()]);
});

test('restart preserves fenced admission history and terminal lifecycle decisions', t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  f.restart();
  const renewed = f.admission.renew(leader, owner);
  f.admission.fail(leader, renewed, { kind: 'application-fault', reason: 'Invalid operation' });
  f.restart();
  assert.equal(f.admission.get(task.id).status, 'failed');
  assert.throws(() => f.admission.claim(leader, task.id, [f.node()]), /not ready/);
});

test('admission journal durability failure is explicit and never releases a successful completion', t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  const original = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === f.journal.fd) throw new Error('Admission disk failure');
    return original(fd);
  });
  assert.throws(() => f.admission.complete(leader, owner, 42), /Admission disk failure/);
  assert.equal(f.admission.get(task.id).status, 'running');
  assert.throws(() => f.admission.cancel(leader, task.id), /unavailable/);
});

test('expired witness blocks every mutation without silently reaping worker reservations', t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  f.advance(200);
  for (const action of [
    () => f.submit(leader),
    () => f.admission.claim(leader, task.id, [f.node('board-b')]),
    () => f.admission.renew(leader, owner),
    () => f.admission.complete(leader, owner, 42),
    () => f.admission.fail(leader, owner, { kind: 'runtime-crash', reason: 'Worker lost' }),
    () => f.admission.cancel(leader, task.id),
    () => f.admission.expireLeases(leader),
  ]) assert.throws(action, /Stale/);
  assert.equal(f.admission.get(task.id).status, 'running');
  const next = f.witness.grant('standby');
  f.admission.expireLeases(next);
  assert.equal(f.admission.get(task.id).status, 'ready');
  assert.equal(f.admission.get(task.id).leadershipEpoch, next.epoch);
});

test('worker-fenced publication is idempotent and recovery reads authoritative state after restart', async t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  const commit = await f.admission.publish(leader, owner, 0, { counter: 7 });
  assert.deepEqual(await f.admission.publish(leader, owner, 0, { counter: 7 }), commit);
  f.restart();
  assert.deepEqual((await f.admission.restore(leader, owner)).state, { counter: 7 });
  f.admission.cancel(leader, task.id);
  await assert.rejects(f.admission.publish(leader, owner, 0, { counter: 7 }), /Stale task ownership/);
  await assert.rejects(f.admission.restore(leader, owner), /Stale task ownership/);
});

test('cancellation during replication prevents publication and retains the prior committed checkpoint', async t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  await f.admission.publish(leader, owner, 0, 7);
  const original = f.witness.pair.replicate.bind(f.witness.pair);
  t.mock.method(f.witness.pair, 'replicate', async bytes => {
    const result = await original(bytes);
    f.admission.cancel(leader, task.id);
    return result;
  });
  await assert.rejects(f.admission.publish(leader, owner, 1, 99), /Stale task ownership/);
  assert.equal((await f.witness.readCommitted(leader, task.id, codeId)).state, 7);
});

test('expired worker cannot publish even when manager leadership is renewed during replication', async t => {
  const f = fixture(t);
  let leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  const original = f.witness.pair.replicate.bind(f.witness.pair);
  t.mock.method(f.witness.pair, 'replicate', async bytes => {
    const result = await original(bytes);
    for (let index = 0; index < 4; index += 1) {
      f.advance(50);
      leader = f.witness.renew(leader, leader.keepAliveSequence + 1);
    }
    return result;
  });
  await assert.rejects(f.admission.publish(leader, owner, 0, 99), /Stale task ownership/);
  await assert.rejects(f.witness.readCommitted(leader, task.id, codeId), /No witnessed checkpoint/);
});

test('takeover during replication fences snapshotted manager and worker tokens', async t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  const original = f.witness.pair.replicate.bind(f.witness.pair);
  t.mock.method(f.witness.pair, 'replicate', async bytes => {
    const result = await original(bytes);
    f.advance(200);
    const next = f.witness.grant('standby');
    const replacement = f.admission.claim(next, task.id, [f.node('board-b')]);
    Object.assign(leader, next);
    Object.assign(owner, replacement);
    return result;
  });
  await assert.rejects(f.admission.publish(leader, owner, 0, 99), /Stale/);
  await assert.rejects(f.admission.restore(leader, owner), /No witnessed checkpoint/);
});

test('completion during restore and failed admission storage reject delayed results', async t => {
  const f = fixture(t);
  const leader = f.witness.grant('active');
  const task = f.submit(leader);
  const owner = f.admission.claim(leader, task.id, [f.node()]);
  await f.admission.publish(leader, owner, 0, 7);
  const original = f.witness.pair.read.bind(f.witness.pair);
  t.mock.method(f.witness.pair, 'read', async digest => {
    const result = await original(digest);
    f.admission.complete(leader, owner, 7);
    return result;
  });
  await assert.rejects(f.admission.restore(leader, owner), /Stale task ownership/);
  t.mock.restoreAll();
  const other = f.submit(leader);
  const worker = f.admission.claim(leader, other.id, [f.node()]);
  const sync = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === f.journal.fd) throw new Error('Admission disk failed');
    return sync(fd);
  });
  assert.throws(() => f.admission.renew(leader, worker), /Admission disk failed/);
  await assert.rejects(f.admission.publish(leader, worker, 0, 42), /unavailable/);
});
