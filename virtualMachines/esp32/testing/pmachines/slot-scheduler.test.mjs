import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSlotScheduler } from '../../../../languages/kotlin/scripts/build-slot-scheduler.mjs';
import { createSlotScheduler } from '../../pmachines/shared/slot-scheduler/runtime.mjs';

function createHost() {
  const slots = new Map();
  const files = new Map();
  const calls = [];
  let saved = '{"version":1,"slots":[]}';
  const faults = {};
  function fail(operation) {
    if (faults[operation]) throw Object.assign(new Error(`${operation} failed`), { status: 409 });
  }
  const runtime = createSlotScheduler({
    read(path) {
      if (!files.has(path)) throw Object.assign(new Error('Manifest not found'), { status: 404 });
      return files.get(path);
    },
    describe: slot => slots.get(slot) || '{}',
    stage(slot, descriptor) {
      fail('stage');
      assert.ok(slot >= 1 && slot <= 16);
      assert.equal(slots.has(slot), false);
      slots.set(slot, descriptor);
      calls.push(['stage', slot]);
    },
    activate(slot) { fail('activate'); calls.push(['activate', slot]); },
    remove(slot) { fail('remove'); slots.delete(slot); calls.push(['remove', slot]); },
    readState: () => saved,
    writeState(text) { fail('write'); saved = text; calls.push(['write', text]); },
  });
  return {
    slots, files, faults, calls,
    get saved() { return JSON.parse(saved); },
    set saved(value) { saved = JSON.stringify(value); },
    async run(operation, body = {}) { return runtime.dispatch(operation, JSON.stringify(body)); },
    load(id, kind = 'service', slot) {
      const manifestPath = `/pmachine/programs/${id}/manifest.json`;
      files.set(manifestPath, JSON.stringify({ type: kind }));
      return this.run('load', { manifestPath, ...(slot === undefined ? {} : { slot }) });
    },
  };
}

test('scheduler ships the exact Kotlin compilation and metadata', async () => {
  await buildSlotScheduler({ check: true });
});

test('all sixteen slots accept services, daemons and automatically released transients', async () => {
  for (const kind of ['service', 'daemon', 'transient']) {
    const host = createHost();
    for (let slot = 1; slot <= 16; slot++) {
      const response = await host.load(`${kind}-${slot}`, kind, slot);
      assert.equal(response.status, 201);
      assert.equal(response.body.slot, slot);
      assert.equal(response.body.state, kind === 'transient' ? 'completed' : 'running');
    }
    assert.equal(host.slots.size, kind === 'transient' ? 0 : 16);
    assert.equal(host.saved.slots.length, kind === 'transient' ? 0 : 16);
  }
});

test('automatic selection, duplicates, occupied slots and full capacity are policy errors', async () => {
  const host = createHost();
  assert.equal((await host.load('first')).body.slot, 1);
  assert.equal((await host.load('first', 'service', 2)).status, 409);
  assert.equal((await host.load('second', 'daemon', 1)).status, 409);
  for (let slot = 2; slot <= 16; slot++) assert.equal((await host.load(`p${slot}`)).body.slot, slot);
  assert.equal((await host.load('overflow')).status, 409);
  assert.equal((await host.run('unload', { slot: 8 })).status, 200);
  assert.equal((await host.load('replacement', 'daemon')).body.slot, 8);
});

test('slot zero is protected, explicit slots are strict integers, and empty slots return 404', async () => {
  const host = createHost();
  for (const operation of ['load', 'unload']) {
    assert.equal((await host.run(operation, { slot: 0 })).status, 403);
    for (const slot of [-1, 17]) assert.equal((await host.run(operation, { slot })).status, 400);
    await assert.rejects(() => host.run(operation, { slot: '2' }), /integer/i);
  }
  assert.equal((await host.run('unload', { slot: 1 })).status, 404);
  assert.equal((await host.run('load', [])).status, 400);
});

test('persistence precedes activation and a failed write releases staging without executing', async () => {
  const host = createHost();
  assert.equal((await host.load('good')).status, 201);
  assert.deepEqual(host.calls.map(call => call[0]), ['stage', 'write', 'activate']);
  const saved = host.saved;
  host.faults.write = true;
  assert.equal((await host.load('write-failure')).status, 503);
  assert.equal(host.slots.size, 1);
  assert.deepEqual(host.saved, saved);
  assert.equal(host.calls.at(-1)[0], 'remove');
});

test('failed staging or activation never leaves a new persistent slot behind', async () => {
  const host = createHost();
  host.faults.stage = true;
  assert.equal((await host.load('stage-failure')).status, 409);
  assert.equal(host.slots.size, 0);
  host.faults.stage = false;
  host.faults.activate = true;
  assert.equal((await host.load('start-failure')).status, 409);
  assert.equal(host.slots.size, 0);
  assert.equal(host.saved.slots.length, 0);
});

test('failed unload preserves runtime ownership and restores durable intent', async () => {
  const host = createHost();
  await host.load('keep');
  const saved = host.saved;
  host.faults.remove = true;
  assert.equal((await host.run('unload', { slot: 1 })).status, 409);
  assert.equal(host.slots.size, 1);
  assert.deepEqual(host.saved, saved);
  host.faults.remove = false;
  host.faults.write = true;
  assert.equal((await host.run('unload', { slot: 1 })).status, 503);
  assert.equal(host.slots.size, 1);
});

test('recovery uses saved manifest identities, excludes transients and is idempotent', async () => {
  const before = createHost();
  await before.load('service', 'service', 5);
  await before.load('daemon', 'daemon', 12);
  await before.load('once', 'transient', 16);
  const rebooted = createHost();
  rebooted.saved = before.saved;
  assert.equal((await rebooted.run('restore')).status, 200);
  assert.deepEqual([...rebooted.slots.keys()], [5, 12]);
  const callCount = rebooted.calls.length;
  assert.equal((await rebooted.run('restore')).status, 200);
  assert.equal(rebooted.calls.length, callCount);
  const status = (await rebooted.run('status')).body;
  assert.equal(status.slots.length, 17);
  assert.deepEqual(status.slots[0], {
    slot: 0, id: 'pulse-slot-scheduler', kind: 'daemon', protected: true, state: 'running',
  });
});

test('invalid recovery snapshots are rejected before any program starts', async () => {
  const before = createHost();
  await before.load('service');
  const valid = before.saved.slots[0];
  for (const invalid of [
    { version: 2, slots: [] },
    { version: 1, slots: [valid, valid] },
    { version: 1, slots: [valid, { ...valid, slot: 0 }] },
    { version: 1, slots: [{ ...valid, kind: 'transient' }] },
    { version: 1, slots: [{ ...valid, manifest: { type: 'daemon' } }] },
  ]) {
    const host = createHost();
    host.saved = invalid;
    assert.equal((await host.run('restore')).status, 503);
    assert.equal(host.slots.size, 0);
  }
});
