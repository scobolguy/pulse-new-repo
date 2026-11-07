import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as nextTurn, setTimeout as delay } from 'node:timers/promises';
import { PMachineScheduler, PMachineMemory, parsePcode } from '../../pmachines/javascript/index.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const options = (pcode, runtimeContext = {}, programMap = {}) => ({
  instructions: parsePcode(pcode), opcodeMap: new Map(), programMap, runtimeContext, debugLogger() {},
});
const waitingProgram = `
JMP MAIN
QUERY:
PUSH_INT 23
STORE local
PUSH_INT 17
PUSH_STR "query"
CALL_EXT screen.accept 1
STORE reply
STORE operand
LOAD local
LOAD operand
ADD
LOAD reply
STORE replyCopy
RET
MAIN:
PUSH_INT 41
STORE saved
CALL QUERY 0
STORE returned
HALT`;

test('one physical slot retains procedure state while waiting and runs a different program', async () => {
  const scheduler = new PMachineScheduler({ slots: 1 });
  const reply = deferred();
  const memory = new PMachineMemory({ limitBytes: 4096 });
  let calls = 0;
  const first = scheduler.execute(options(waitingProgram, {
    memoryManager: memory, callHost: () => { calls += 1; return reply.promise; },
  }, { globals: ['saved', 'returned', 'replyCopy'],
    procedures: { QUERY: { params: [], locals: ['reply', 'local', 'operand'] } } }), { name: 'query' });
  await nextTurn();
  const parked = scheduler.getStatus();
  assert.equal(parked.active, 0);
  assert.equal(parked.available, 1);
  assert.equal(parked.waiting, 1);
  assert.equal(parked.contexts[0].waitReason, 'screen.accept');
  assert.equal(parked.contexts[0].pc, parsePcode(waitingProgram).findIndex(instruction => instruction.mnemonic === 'CALL_EXT'));
  assert.ok(memory.diagnostics().usedBytes > 0);
  const second = await scheduler.execute(options('PUSH_INT 99\nSTORE saved\nHALT'), { name: 'other' });
  assert.equal(second.globals.saved, 99);
  assert.equal(scheduler.getStatus().waiting, 1);
  reply.resolve('answer');
  const result = await first;
  assert.equal(result.globals.saved, 41);
  assert.equal(result.globals.returned, 40);
  assert.equal(result.globals.replyCopy, 'answer');
  assert.equal(calls, 1);
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(scheduler.getStatus().resumptions, 1);
  assert.equal(scheduler.getStatus().completed, 2);
  assert.deepEqual(scheduler.getStatus().contexts, []);
});

test('correlated out-of-order replies resume only their owning program', async () => {
  const scheduler = new PMachineScheduler();
  const a = deferred(), b = deferred();
  const query = `PUSH_STR "q"\nCALL_EXT screen.accept 1\nSTORE reply\nHALT`;
  const first = scheduler.execute(options(query, { callHost: () => a.promise }));
  const second = scheduler.execute(options(query, { callHost: () => b.promise }));
  await nextTurn();
  assert.equal(scheduler.getStatus().waiting, 2);
  b.resolve('B');
  assert.equal((await second).globals.reply, 'B');
  assert.equal(scheduler.getStatus().waiting, 1);
  a.resolve('A');
  assert.equal((await first).globals.reply, 'A');
});

test('rejected host calls release retained memory and do not poison the slot', async () => {
  const scheduler = new PMachineScheduler();
  const reply = deferred();
  const memory = new PMachineMemory({ limitBytes: 4096 });
  const work = scheduler.execute(options(waitingProgram, { memoryManager: memory, callHost: () => reply.promise }));
  const rejected = assert.rejects(work, /broker unavailable/);
  await nextTurn();
  reply.reject(new Error('broker unavailable'));
  await rejected;
  assert.equal(memory.diagnostics().liveScopes, 0);
  assert.equal(scheduler.getStatus().failed, 1);
  assert.equal((await scheduler.execute(options('PUSH_INT 1\nSTORE ok\nHALT'))).globals.ok, 1);
});

test('abort cancels a waiting program even when the host promise never settles', async () => {
  const scheduler = new PMachineScheduler({ maxContexts: 1 });
  const controller = new AbortController();
  const reply = deferred();
  const memory = new PMachineMemory({ limitBytes: 4096 });
  const work = scheduler.execute(options(waitingProgram, {
    memoryManager: memory, signal: controller.signal, callHost: () => reply.promise,
  }));
  const cancelled = assert.rejects(work, /cancel query/);
  await nextTurn();
  await assert.rejects(scheduler.execute(options('HALT')), /context capacity/);
  controller.abort(new Error('cancel query'));
  await cancelled;
  assert.equal(memory.diagnostics().usedBytes, 0);
  assert.equal(scheduler.getStatus().available, 1);
  assert.deepEqual(scheduler.getStatus().contexts, []);
  reply.reject(new Error('late reply failure'));
  await nextTurn();
  await scheduler.execute(options('HALT'));
});

test('queued cancellation never acquires or leaks a slot', async () => {
  const scheduler = new PMachineScheduler({ quantum: 1 });
  const controller = new AbortController();
  const first = scheduler.execute(options('NOP\nHALT'));
  const queued = scheduler.execute(options('HALT', { signal: controller.signal }));
  const cancelled = assert.rejects(queued, /cancel queued/);
  controller.abort(new Error('cancel queued'));
  await Promise.all([first, cancelled]);
  assert.equal(scheduler.getStatus().active, 0);
  assert.deepEqual(scheduler.getStatus().contexts, []);
});

test('instruction quanta allow another ready program to finish before a CPU-bound one', async () => {
  const scheduler = new PMachineScheduler({ quantum: 8 });
  const order = [];
  const first = scheduler.execute(options(`${'NOP\n'.repeat(1000)}HALT`)).then(() => order.push('long'));
  const second = scheduler.execute(options('HALT')).then(() => order.push('short'));
  await Promise.all([first, second]);
  assert.deepEqual(order, ['short', 'long']);
  assert.ok(scheduler.getStatus().yields > 0);
});

test('active execution budgets exclude waits but still reject excessive active work', async () => {
  const scheduler = new PMachineScheduler();
  const work = scheduler.execute(options('PUSH_STR "q"\nCALL_EXT screen.accept 1\nSTORE reply\nHALT', {
    maxExecutionMs: 100, callHost: async () => { await delay(150); return 'late'; },
  }));
  assert.equal((await work).globals.reply, 'late');
  await assert.rejects(scheduler.execute(options('PUSH_STR "q"\nCALL_EXT screen.accept 1\nHALT', {
    maxExecutionMs: 10,
    callHost: () => { const until = performance.now() + 30; while (performance.now() < until) {} return 'slow'; },
  })), /active execution timeout/);
});

test('hosted COBOL invocations release a shared slot and stop cancels all suspended events', async t => {
  const compiled = compileCobolishToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. VIRTUAL-HOST.
PULSE SERVICE virtual-host.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 INPUT-TEXT PIC X(40).
01 REPLY-TEXT PIC X(40).
PROCEDURE DIVISION.
PULSE RECEIVE INTO INPUT-TEXT
CALL "host.announcement" USING INPUT-TEXT "query" RETURNING REPLY-TEXT
PULSE SEND REPLY-TEXT.`, { hostServices: true, nativeTarget: true });
  const scheduler = new PMachineScheduler();
  const reply = deferred();
  let pendingReply = reply.promise;
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'virtual-host', httpPort: null, udpPort: null, scheduler,
    maxExecutionMs: 100, logger: { warn() {}, error() {} },
    bindings: { 'host.announcement': name => name === 'slow' ? pendingReply : 'fast' },
  });
  t.after(() => host.stop());
  await host.start();
  const dispatch = value => host.dispatch({
    method: 'POST', path: '/api/pathway/virtual-host', body: JSON.stringify({ data: value }),
  });
  const slow = dispatch('slow');
  await nextTurn();
  assert.equal(scheduler.getStatus().waiting, 1);
  assert.equal((await dispatch('fast')).body.data, 'fast'.padEnd(40));
  await delay(150);
  reply.resolve('late');
  assert.equal((await slow).body.data, 'late'.padEnd(40));
  const stalled = deferred();
  pendingReply = stalled.promise;
  const one = dispatch('slow'), two = dispatch('slow');
  const cancelled = Promise.all([
    assert.rejects(one, /cancelled/), assert.rejects(two, /cancelled/),
  ]);
  await nextTurn();
  assert.equal(scheduler.getStatus().waiting, 2);
  await host.stop();
  await cancelled;
  assert.equal(host.getStatus().pending, 0);
  assert.deepEqual(scheduler.getStatus().contexts, []);
});

test('scheduler configuration rejects invalid capacities and budgets', async () => {
  for (const config of [{ slots: 0 }, { quantum: 0 }, { maxContexts: -1 }, { slots: 2, maxContexts: 1 }]) {
    assert.throws(() => new PMachineScheduler(config));
  }
  const scheduler = new PMachineScheduler();
  await assert.rejects(scheduler.execute(options('HALT', { maxExecutionMs: 0 })), /positive integer/);
  const controller = new AbortController();
  controller.abort(new Error('already cancelled'));
  await assert.rejects(scheduler.execute(options('HALT', { signal: controller.signal })), /already cancelled/);
  assert.deepEqual(scheduler.getStatus().contexts, []);
});

test('JS node file execution uses the same configured scheduler as hosted services', async t => {
  const scheduler = new PMachineScheduler();
  const server = createJsPmachineNodeServer({
    name: 'virtual-file-node', port: 0, scheduler, logger: { log() {}, warn() {}, error() {} },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [file, body] of [['/other.pcode', 'PUSH_INT 42\nSTORE answer\nHALT'], ['/other.map', '{}']]) {
    const response = await fetch(`${origin}/ffs/upload`, {
      method: 'POST', body: new URLSearchParams({ file, body }), signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
  }
  const response = await fetch(`${origin}/pmachine/execute_file`, {
    method: 'POST', body: new URLSearchParams({ file: '/other.pcode', programMap: '/other.map' }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.globals.answer, 42);
  assert.equal(scheduler.getStatus().completed, 1);
  assert.deepEqual(scheduler.getStatus().contexts, []);
});
