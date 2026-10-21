import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ManagedObjects, ObjectRef } from '../../pmachines/javascript/src/managed-objects.mjs';
import { PMachineMemory, managedStorage } from '../../pmachines/javascript/src/memory.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';

const run = (pcode, programMap = {}, runtimeContext = {}) => executeProgram({
  instructions: parsePcode(pcode), opcodeMap: new Map(), programMap, runtimeContext, debugLogger() {},
});

test('object roots and owned edges are counted and reclaimed transitively', () => {
  const heap = new ManagedObjects();
  const parent = heap.create(3), child = heap.create(0);
  heap.set(parent, 0, child);
  heap.set(parent, 1, 'retained string');
  heap.set(parent, 2, 42);
  heap.reconcile([parent, parent, child]);
  assert.equal(heap.references(parent), 2);
  assert.equal(heap.references(child), 2);
  assert.equal(heap.get(parent, 1), 'retained string');
  heap.reconcile([parent]);
  assert.equal(heap.references(child), 1);
  heap.reconcile([]);
  assert.equal(heap.stats.liveHandles, 0);
  assert.equal(heap.stats.liveBytes, 0);
  assert.throws(() => heap.get(parent, 0), /invalid object/);
});

test('handles are branded, identity safe through managedStorage and do not collide with integers', () => {
  const memory = new PMachineMemory({ limitBytes: 32 });
  const scope = memory.createScope();
  const slots = managedStorage(memory, scope);
  const heap = new ManagedObjects();
  const ref = heap.create(1);
  slots.ref = ref;
  assert.equal(slots.ref, ref);
  assert.ok(slots.ref instanceof ObjectRef);
  assert.throws(() => heap.get(1, 0), /reference required/);
  assert.throws(() => heap.get(new ObjectRef(), 0), /invalid object/);
  assert.throws(() => heap.get({}, 0), /reference required/);
  assert.throws(() => heap.get(0, 0), /nil/);
  assert.throws(() => heap.get(ref, 1), /index out of range/);
  assert.throws(() => heap.get(ref, 0.5), /integer/);
  memory.closeScope(scope);
});

test('cycles are explicitly rejected, shared acyclic children are allowed', () => {
  const heap = new ManagedObjects();
  const a = heap.create(2), b = heap.create(1), c = heap.create(1);
  assert.throws(() => heap.set(a, 0, a), /cycle/);
  heap.set(a, 0, b);
  heap.set(b, 0, c);
  assert.throws(() => heap.set(c, 0, a), /cycle/);
  assert.equal(heap.get(c, 0), 0);
  heap.set(a, 1, c);
  heap.reconcile([a]);
  assert.equal(heap.references(c), 2);
  heap.reconcile([]);
  assert.equal(heap.stats.liveHandles, 0);
});

test('resize copies a prefix with child and string references, preserves aliases, and validates bounds', () => {
  const heap = new ManagedObjects();
  assert.equal(heap.length(0), 0);
  const old = heap.resize(0, 2), child = heap.create(1);
  heap.set(old, 0, child);
  heap.set(old, 1, 'text');
  const grown = heap.resize(old, 4);
  assert.notEqual(grown, old);
  assert.equal(heap.get(grown, 0), child);
  assert.equal(heap.get(grown, 1), 'text');
  assert.equal(heap.get(grown, 3), 0);
  const shrunk = heap.resize(grown, 1);
  heap.reconcile([old, shrunk]);
  assert.equal(heap.stats.liveHandles, 3);
  assert.equal(heap.references(child), 2);
  const empty = heap.resize(shrunk, 0);
  heap.reconcile([empty]);
  assert.equal(heap.length(empty), 0);
  assert.equal(heap.stats.liveHandles, 1);
  for (const count of [-1, 65, 1.1, '2']) assert.throws(() => heap.resize(empty, count), /integer|capacity/);
  assert.equal(heap.length(empty), 0);
});

test('exact handle and arena capacities, allocation pressure compaction preserves field bytes', () => {
  let heap = new ManagedObjects();
  const handles = Array.from({ length: 128 }, () => heap.create(0));
  assert.equal(heap.stats.compactions, 0);
  assert.throws(() => heap.create(0), /handle capacity/);
  heap.reconcile(handles);
  assert.equal(heap.stats.liveHandles, 128);
  heap.reset();
  assert.equal(heap.stats.liveHandles, 0);
  heap = new ManagedObjects();
  const blocks = Array.from({ length: 16 }, (_, index) => {
    const ref = heap.create(64);
    heap.set(ref, 63, index + 100);
    return ref;
  });
  assert.equal(heap.stats.liveBytes, 8192);
  assert.throws(() => heap.resize(blocks[0], 1), /arena exhausted/);
  assert.equal(heap.stats.compactions, 0);
  const retained = blocks.filter((_, index) => index % 2);
  heap.reconcile(retained);
  heap.create(64);
  assert.equal(heap.stats.compactions, 1);
  retained.forEach((ref, index) => assert.equal(heap.get(ref, 63), index * 2 + 101));
});

test('periodic compaction only runs after 64 allocation attempts and only with holes', () => {
  const heap = new ManagedObjects();
  heap.create(1);
  const live = heap.create(1);
  heap.reconcile([live]);
  for (let attempt = 2; attempt < 63; ++attempt) heap.create(0);
  assert.equal(heap.stats.compactions, 0);
  heap.create(0);
  assert.equal(heap.stats.compactions, 1);
});

test('bytecode aliases, calls, returned refs, local shadowing, and legacy record roots survive boundaries', async () => {
  const result = await run(`
JMP MAIN
PROC:
PUSH_INT 1
CALL_EXT object.new 1
STORE alias
LOAD item
RET
MAIN:
PUSH_INT 1
CALL_EXT object.new 1
STORE original
LOAD original
CALL PROC 1
STORE alias
LOAD alias
PUSH_INT 0
PUSH_STR "kept"
CALL_EXT object.set 3
STORE ignored
LOAD original
PUSH_INT 0
CALL_EXT object.get 2
STORE answer
RECORD_NEW legacy
LOAD alias
RECORD_SET legacy,field
PUSH_INT 0
STORE original
PUSH_INT 0
STORE alias
RECORD_GET legacy,field
PUSH_INT 0
CALL_EXT object.get 2
STORE retained
RECORD_NEW legacy
HALT
`, { globals: ['original', 'alias', 'answer', 'retained'],
    procedures: { PROC: { params: ['item'], locals: ['alias'] } } });
  assert.equal(result.globals.answer, 'kept');
  assert.equal(result.globals.retained, 'kept');
  assert.equal(result.managedObjects.liveHandles, 0);
  assert.equal(result.managedObjects.allocations, 2);
});

test('bytecode resize nil, length, aliases, and copied child reference survive collection', async () => {
  const result = await run(`
PUSH_INT 0
CALL_EXT object.length 1
STORE nilLength
PUSH_INT 0
PUSH_INT 1
CALL_EXT object.resize 2
STORE array
PUSH_INT 1
CALL_EXT object.new 1
STORE child
LOAD array
PUSH_INT 0
LOAD child
CALL_EXT object.set 3
STORE ignored
LOAD array
PUSH_INT 3
CALL_EXT object.resize 2
STORE grown
PUSH_INT 0
STORE array
PUSH_INT 0
STORE child
LOAD grown
CALL_EXT object.length 1
STORE size
LOAD grown
PUSH_INT 0
CALL_EXT object.get 2
PUSH_INT 0
PUSH_INT 77
CALL_EXT object.set 3
STORE ignored
LOAD grown
PUSH_INT 0
CALL_EXT object.get 2
PUSH_INT 0
CALL_EXT object.get 2
STORE answer
PUSH_INT 0
STORE grown
HALT`);
  assert.equal(result.globals.nilLength, 0);
  assert.equal(result.globals.size, 3);
  assert.equal(result.globals.answer, 77);
  assert.equal(result.managedObjects.liveHandles, 0);
});

test('bytecode failures release object and invocation reservations', async () => {
  for (const [pcode, error] of [
    ['PUSH_INT 0\nPUSH_INT 0\nCALL_EXT object.get 2', /nil/],
    ['PUSH_INT 1\nCALL_EXT object.new 1\nSTORE a\nLOAD a\nPUSH_INT 0\nLOAD a\nCALL_EXT object.set 3', /cycle/],
    ['PUSH_INT 1\nCALL_EXT object.new 1\nPUSH_INT -1\nCALL_EXT object.resize 2', /capacity/],
    ['PUSH_INT 1\nCALL_EXT object.new 1\nPUSH_INT 1\nCALL_EXT object.get 2', /out of range/],
    ['PUSH_INT 1\nCALL_EXT object.new 1\nCALL_EXT object.unknown 1', /Invalid object/],
    ['CALL_EXT object.new 1', /underflow/],
  ]) {
    const memory = new PMachineMemory({ limitBytes: 4096 });
    await assert.rejects(run(pcode, {}, { memoryManager: memory }), error);
    assert.equal(memory.diagnostics().usedBytes, 0);
    assert.equal(memory.diagnostics().liveScopes, 0);
  }
});

test('successful and instruction-limited runs free the entire invocation heap', async () => {
  const memory = new PMachineMemory({ limitBytes: 4096 });
  for (const context of [{}, { maxSteps: 4 }]) {
    const result = await run(`
PUSH_INT 2
CALL_EXT object.new 1
STORE retained
LOOP:
JMP LOOP`, {}, { memoryManager: memory, maxSteps: 5, ...context });
    assert.equal(result.managedObjects.liveHandles, 1);
    assert.equal(memory.diagnostics().usedBytes, 0);
    assert.equal(memory.diagnostics().liveScopes, 0);
  }
  const result = await run('PUSH_INT 2\nCALL_EXT object.new 1\nSTORE retained\nHALT',
    {}, { memoryManager: memory });
  assert.equal(result.managedObjects.liveHandles, 1);
  assert.equal(memory.diagnostics().usedBytes, 0);
});
