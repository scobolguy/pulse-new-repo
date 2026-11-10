import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { SwarmTaskCoordinator, SwarmTaskJournal } from '../src/backend/swarmTaskCoordinator.mjs';
import { PMachineScheduler, parsePcode, loadOpcodeMap } from '../../pmachines/javascript/index.mjs';
import { compileKotlinToPcode } from '../../../../languages/kotlin/src/compile-kotlin-to-pcode.mjs';
import { compileCsharpToPcode } from '../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import { compileVb11ToPcode } from '../../../../languages/vbish/src/compile-vb11.mjs';

const codeId = 'a'.repeat(64);
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-swarm-recovery-'));
  const filePath = path.join(directory, 'tasks.jsonl');
  let journal;
  t.after(() => {
    journal?.close();
    fs.rmSync(directory, { recursive: true });
  });
  journal = new SwarmTaskJournal(filePath);
  let timestamp = 1000;
  let coordinator = new SwarmTaskCoordinator({ journal, now: () => timestamp, leaseMs: 100, ...options });
  const node = (nodeId, changes = {}) => ({
    nodeId, clusterId: 'swarm-a', status: 'online', codeIds: [codeId],
    capabilities: ['pmachine'], estimatedFreeSlots: 1, freeMemoryBytes: 4096,
    observedAt: timestamp, executionMs: nodeId === 'board-a' ? 1 : 10,
    ...changes,
  });
  return {
    get coordinator() { return coordinator; },
    get journal() { return journal; },
    filePath, node,
    advance(ms) { timestamp += ms; },
    submit(changes = {}) {
      return coordinator.submit({
        clusterId: 'swarm-a', codeId, memoryBytes: 1024, state: { counter: 0 }, ...changes,
      });
    },
    restart() {
      journal.close();
      journal = new SwarmTaskJournal(filePath);
      coordinator = new SwarmTaskCoordinator({ journal, now: () => timestamp, leaseMs: 100, ...options });
    },
  };
}

test('committed state survives restart and board takeover rejects stale owners and sequences', t => {
  const f = fixture(t);
  const task = f.submit();
  const old = f.coordinator.claim(task.id, [f.node('board-a'), f.node('board-b')]);
  const checkpoint = f.coordinator.commit(old, 0, { counter: 7 });
  assert.equal(checkpoint.checkpoint.sequence, 1);
  assert.throws(() => f.coordinator.commit(old, 0, { counter: 8 }), /Stale checkpoint sequence/);
  f.restart();
  assert.throws(() => f.coordinator.claim(task.id, [f.node('board-b')]), /not ready/);
  f.advance(100);
  const replacement = f.coordinator.claim(task.id, [f.node('board-a'), f.node('board-b')]);
  assert.equal(replacement.owner, 'board-b');
  assert.equal(replacement.epoch, old.epoch + 1);
  assert.deepEqual(replacement.checkpoint, { sequence: 1, state: { counter: 7 } });
  for (const operation of [
    () => f.coordinator.renew(old),
    () => f.coordinator.commit(old, 1, { counter: 999 }),
    () => f.coordinator.complete(old, 999),
    () => f.coordinator.fail(old, { kind: 'runtime-crash', reason: 'late crash' }),
  ]) assert.throws(operation, /Stale task ownership/);
  f.coordinator.complete(replacement, 8);
  f.restart();
  assert.equal(f.coordinator.get(task.id).result, 8);
  assert.throws(() => f.coordinator.claim(task.id, [f.node('board-a')]), /completed/);
});

test('runtime crash permits recovery but application faults do not retry', t => {
  const f = fixture(t);
  const task = f.submit();
  const old = f.coordinator.claim(task.id, [f.node('board-a')]);
  f.coordinator.commit(old, 0, { counter: 42 });
  f.coordinator.fail(old, { kind: 'runtime-crash', reason: 'Interpreter worker crashed' });
  const replacement = f.coordinator.claim(task.id, [f.node('board-a'), f.node('board-b')]);
  assert.equal(replacement.owner, 'board-b');
  assert.equal(replacement.checkpoint.state.counter, 42);
  f.coordinator.fail(replacement, { kind: 'application-fault', reason: 'Division by zero' });
  f.restart();
  assert.equal(f.coordinator.get(task.id).failure.kind, 'application-fault');
  assert.throws(() => f.coordinator.claim(task.id, [f.node('board-a')]), /failed/);
});

test('admission reserves slots and memory and releases them on completion, cancellation and expiry', t => {
  const f = fixture(t);
  const first = f.submit();
  const second = f.submit();
  const node = () => f.node('board-a', { estimatedFreeSlots: 2, freeMemoryBytes: 1536 });
  const owner = f.coordinator.claim(first.id, [node()]);
  assert.throws(() => f.coordinator.claim(second.id, [node()]), /available capacity/);
  f.coordinator.complete(owner, null);
  f.coordinator.claim(second.id, [node()]);
  f.coordinator.cancel(second.id);
  const third = f.submit();
  const thirdOwner = f.coordinator.claim(third.id, [f.node('board-a')]);
  const fourth = f.submit();
  assert.throws(() => f.coordinator.claim(fourth.id, [f.node('board-a')]), /available capacity/);
  f.advance(100);
  f.coordinator.claim(fourth.id, [f.node('board-a')]);
  assert.throws(() => f.coordinator.renew(thirdOwner), /Stale task ownership/);
  assert.equal(f.coordinator.get(third.id).status, 'ready');
});

test('stale, offline, wrong-swarm, incompatible and insufficient-capability nodes are excluded', t => {
  const f = fixture(t);
  const task = f.submit();
  const invalid = [
    { status: 'offline' }, { clusterId: 'swarm-b' }, { codeIds: ['b'.repeat(64)] },
    { capabilities: [] }, { observedAt: 1001 }, { estimatedFreeSlots: 0 }, { freeMemoryBytes: 512 },
  ];
  for (const changes of invalid)
    assert.throws(() => f.coordinator.claim(task.id, [f.node('board-a', changes)]), /available capacity/);
  f.advance(30001);
  assert.throws(() => f.coordinator.claim(task.id, [f.node('board-a', { observedAt: 1000 })]), /available capacity/);
  assert.throws(() => f.coordinator.claim(task.id, [f.node('board-a'), f.node('board-a')]), /Duplicate/);
  f.coordinator.claim(task.id, [f.node('board-a')]);
});

test('expired leases cannot be renewed and cancellation fences all later replies', t => {
  const f = fixture(t);
  const task = f.submit();
  const owner = f.coordinator.claim(task.id, [f.node('board-a')]);
  f.advance(50);
  assert.equal(f.coordinator.renew(owner).leaseExpiresAt, 1150);
  f.advance(100);
  assert.throws(() => f.coordinator.renew(owner), /Stale task ownership/);
  f.coordinator.cancel(task.id);
  assert.throws(() => f.coordinator.complete(owner, 42), /Stale task ownership/);
  f.restart();
  assert.equal(f.coordinator.get(task.id).status, 'cancelled');
});

test('invalid data and exhausted task capacity are explicit and snapshots cannot mutate stored state', t => {
  const f = fixture(t, { maxTasks: 1 });
  for (const state of [undefined, NaN, Infinity, new Map(), [undefined], Array(1), { counter: 2 ** 60 }])
    assert.throws(() => f.submit({ state }), /portable JSON|dense/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => f.submit({ state: cyclic }), /portable JSON/);
  assert.throws(() => f.submit({ state: 'x'.repeat(65537) }), /capacity/);
  const task = f.submit();
  task.checkpoint.state.counter = 999;
  assert.equal(f.coordinator.get(task.id).checkpoint.state.counter, 0);
  assert.throws(() => f.submit(), /Task capacity/);
  assert.throws(() => new SwarmTaskCoordinator({ journal: f.journal }), /authoritative coordinator/);
  assert.throws(() => new SwarmTaskJournal(f.filePath), /EEXIST/);
});

test('an interrupted final append is removed; complete corrupt records fail closed', t => {
  const f = fixture(t);
  const task = f.submit();
  f.journal.close();
  fs.appendFileSync(f.filePath, '{"version":1,"task":');
  f.restart();
  assert.equal(f.coordinator.get(task.id).status, 'ready');
  const owner = f.coordinator.claim(task.id, [f.node('board-a')]);
  f.coordinator.commit(owner, 0, { counter: 11 });
  f.restart();
  assert.equal(f.coordinator.get(task.id).checkpoint.state.counter, 11);
  f.journal.close();
  fs.appendFileSync(f.filePath, 'corrupt-complete-record\n');
  assert.throws(() => f.restart(), /JSON|Unexpected token/);
});

test('a durability failure is reported, not acknowledged, and the writer fails closed', t => {
  const f = fixture(t);
  const task = f.submit();
  const owner = f.coordinator.claim(task.id, [f.node('board-a')]);
  const originalSync = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === f.journal.fd) throw new Error('Injected storage sync failure');
    return originalSync(fd);
  });
  assert.throws(() => f.coordinator.commit(owner, 0, { counter: 99 }), /storage sync failure/);
  assert.equal(f.coordinator.get(task.id).checkpoint.sequence, 0);
  assert.throws(() => f.coordinator.complete(owner, 99), /journal is unavailable/);
});

test('compiled Kotlin, C# and VB computation resumes from application commit points on a different worker', async t => {
  const opcodeMap = await loadOpcodeMap();
  const compilers = [
    ['kotlin', counter => compileKotlinToPcode(`fun main() { println(${counter} + 1) }`)],
    ['csharp', counter => compileCsharpToPcode(`using System;
class Program { static void Main() { Console.WriteLine(${counter} + 1); } }`)],
    ['vb', counter => compileVb11ToPcode(`Imports System
Module Program
Sub Main()
Console.WriteLine(${counter} + 1)
End Sub
End Module`)],
  ];
  for (const [language, compile] of compilers) {
    const f = fixture(t);
    const phases = [compile(0), compile(1)];
    const bundleId = createHash('sha256').update(JSON.stringify({ language, phases })).digest('hex');
    const task = f.submit({ codeId: bundleId });
    const nodes = () => ['board-a', 'board-b'].map(id => f.node(id, { codeIds: [bundleId] }));
    const workers = new Map(nodes().map(node => [node.nodeId, new PMachineScheduler({ slots: 1, quantum: 8 })]));
    async function compute(owner) {
      const artifact = phases[owner.checkpoint.state.counter];
      assert.ok(artifact, 'The committed application state selects a bundled phase');
      const mappingsById = new Map();
      mappingsById.__globals = artifact.programMap.globals;
      mappingsById.__proceduresByLabel = artifact.programMap.procedures;
      const result = await workers.get(owner.owner).execute({
        instructions: parsePcode(artifact.pcodeText), opcodeMap, mappingsById,
        programMap: artifact.programMap, runtimeContext: { maxSteps: 1000 }, debugLogger() {},
      });
      assert.equal(result.error ?? null, null, language);
      assert.equal(result.stepLimitHit, false, language);
      assert.equal(result.stdout.length, 1);
      return Number(result.stdout[0]);
    }
    const owner = f.coordinator.claim(task.id, nodes());
    const committed = f.coordinator.commit(owner, 0, { counter: await compute(owner) });
    assert.equal(committed.checkpoint.state.counter, 1);
    // Compute another phase but lose the worker before its commit.
    assert.equal(await compute(committed), 2);
    f.advance(100);
    const replacement = f.coordinator.claim(task.id, nodes());
    assert.equal(replacement.owner, 'board-b');
    assert.equal(replacement.checkpoint.state.counter, 1);
    assert.equal(await compute(replacement), 2);
    f.coordinator.complete(replacement, 2);
    assert.equal(f.coordinator.get(task.id).result, 2);
    assert.equal(workers.get('board-a').getStatus().completed, 2);
    assert.equal(workers.get('board-b').getStatus().completed, 1);
  }
});
