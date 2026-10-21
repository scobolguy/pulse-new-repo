import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PMachineMemory, PMachineMemoryError, managedStorage } from '../../pmachines/javascript/src/memory.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';

test('VM memory enforces exact budgets and failed growth preserves the old allocation', () => {
  const memory = new PMachineMemory({ limitBytes: 8 });
  const scope = memory.createScope();
  const handle = memory.allocate(scope, 8);
  memory.write(handle, 0, Uint8Array.of(1, 2, 3));
  assert.throws(() => memory.resize(handle, 9), PMachineMemoryError);
  assert.deepEqual([...memory.read(handle, 0, 3)], [1, 2, 3]);
  assert.equal(memory.diagnostics().usedBytes, 8);
  assert.equal(memory.diagnostics().allocationFailures, 1);
  memory.resize(handle, 4);
  assert.equal(memory.diagnostics().usedBytes, 4);
  memory.release(handle);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.throws(() => memory.read(handle, 0, 1), /invalid or has been released/);
});

test('lazy blocks consume budget on first access and release with their owning scope', () => {
  const memory = new PMachineMemory({ limitBytes: 16 });
  const program = memory.createScope('program');
  const invocation = memory.createScope('invocation', program);
  const procedure = memory.createScope('procedure', invocation);
  const lazy = memory.allocate(procedure, 16, { lazy: true });
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(memory.diagnostics().deferredBytes, 16);
  memory.write(lazy, 15, Uint8Array.of(42));
  assert.equal(memory.diagnostics().usedBytes, 16);
  memory.transfer(lazy, program);
  memory.closeScope(invocation);
  assert.deepEqual([...memory.read(lazy, 15, 1)], [42]);
  assert.equal(memory.diagnostics().byLifetime.program, 16);
  memory.closeScope(program);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(memory.diagnostics().liveScopes, 0);
});

test('invalid sizes, owners and accesses fail without consuming budget', () => {
  const memory = new PMachineMemory({ limitBytes: 0 });
  const scope = memory.createScope();
  assert.throws(() => memory.allocate(scope, -1), /nonnegative/);
  assert.throws(() => memory.allocate({}, 0), /another machine/);
  assert.throws(() => memory.allocate(scope, 1), PMachineMemoryError);
  const lazy = memory.allocate(scope, 2, { lazy: true });
  assert.throws(() => memory.read(lazy, 1, 2), RangeError);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.throws(() => memory.materialize(lazy), PMachineMemoryError);
  memory.closeScope(scope);
  assert.throws(() => memory.allocate(scope, 0), /closed/);
  assert.throws(() => new PMachineMemory({ limitBytes: Infinity }), TypeError);
});

test('managed slots charge UTF-8 payloads and retain values when growth is denied', () => {
  const memory = new PMachineMemory({ limitBytes: 20 });
  const scope = memory.createScope();
  const slots = managedStorage(memory, scope);
  slots.text = '\u00e9';
  assert.equal(memory.diagnostics().usedBytes, 18);
  assert.throws(() => { slots.text = '12345'; }, PMachineMemoryError);
  assert.equal(slots.text, '\u00e9');
  delete slots.text;
  const stack = managedStorage(memory, scope, []);
  stack.push(42);
  assert.equal(stack.pop(), 42);
  assert.equal(memory.diagnostics().usedBytes, 0);
  stack.push('a');
  stack.length = 0;
  assert.equal(memory.diagnostics().usedBytes, 0);
  memory.closeScope(scope);
  assert.throws(() => stack[0], /closed/);
});

const run = (pcode, memory, programMap = {}) => executeProgram({
  instructions: parsePcode(pcode),
  opcodeMap: new Map(),
  programMap,
  runtimeContext: { memoryManager: memory },
  debugLogger() {},
});

test('JS execution releases procedure and invocation storage on success', async () => {
  const memory = new PMachineMemory({ limitBytes: 128 });
  const result = await run(`
JMP MAIN
PROC:
PUSH_STR "local"
STORE text
PUSH_INT 1
RET
MAIN:
CALL PROC 0
STORE answer
HALT
`, memory, { globals: ['answer'], procedures: { PROC: { params: [], locals: ['text'] } } });
  assert.equal(result.globals.answer, 1);
  assert.equal(result.memory.byLifetime.procedure, 0);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(memory.diagnostics().liveBlocks, 0);
  assert.equal(memory.diagnostics().liveScopes, 0);
});

test('budget errors and host exceptions unwind all invocation scopes', async () => {
  const memory = new PMachineMemory({ limitBytes: 16 });
  await assert.rejects(run('PUSH_STR "too large"\nHALT', memory), PMachineMemoryError);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(memory.diagnostics().liveScopes, 0);
  await assert.rejects(run('CALL_EXT host.clock 0\nHALT', memory), /Host binding unavailable/);
  assert.equal(memory.diagnostics().liveScopes, 0);
});

test('failed managed-storage initialization rolls back all acquired blocks', () => {
  const memory = new PMachineMemory({ limitBytes: 16 });
  const scope = memory.createScope();
  assert.throws(() => managedStorage(memory, scope, { a: 1, b: 2 }), PMachineMemoryError);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(memory.diagnostics().liveBlocks, 0);
  memory.closeScope(scope);
});

test('budget reservations do not expose byte buffers and share the allocation limit', () => {
  const memory = new PMachineMemory({ limitBytes: 32 });
  const scope = memory.createScope();
  const reserved = memory.reserve(scope, 24);
  const buffer = memory.allocate(scope, 8);
  assert.throws(() => memory.resize(reserved, 25), PMachineMemoryError);
  assert.throws(() => memory.read(reserved, 0, 1), /do not expose/);
  assert.throws(() => memory.write(reserved, 0, Uint8Array.of(1)), /do not expose/);
  memory.release(buffer);
  memory.resize(reserved, 32);
  assert.equal(memory.diagnostics().usedBytes, 32);
  memory.closeScope(scope);
  assert.equal(memory.diagnostics().usedBytes, 0);
});

test('repeated calls reclaim local storage instead of accumulating it', async () => {
  const memory = new PMachineMemory({ limitBytes: 96 });
  const result = await run(`
JMP MAIN
PROC:
PUSH_STR "temporary"
STORE text
RET
MAIN:
CALL PROC 0
CALL PROC 0
CALL PROC 0
HALT
`, memory, { procedures: { PROC: { params: [], locals: ['text'] } } });
  assert.equal(result.memory.byLifetime.procedure, 0);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(memory.diagnostics().allocationFailures, 0);
});
