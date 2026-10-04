import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode, parseProgramMapMappings } from '../../../pmachines/javascript/index.mjs';
import { startEsp32DebugSession, controlEsp32DebugSession } from '../../../aggregator/src/backend/modules/esp32PmachineDebugBridge.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const program = fileURLToPath(new URL('../../../artifactPrograms/towers-of-hanoi-program.pas', import.meta.url));
const source = await readFile(program, 'utf8');
const artifact = compilePascalishProgramWithAntlr(source, { fileName: 'towers-of-hanoi-program.pas' });

const vscodeMock = `
  export class EventEmitter {
    listeners = [];
    event = listener => { this.listeners.push(listener); return { dispose() {} }; };
    fire(message) { for (const listener of this.listeners) listener(message); }
    dispose() {}
  }
  export const Uri = { file: fsPath => ({ fsPath }) };
  export const workspace = { getWorkspaceFolder: () => ({ uri: { fsPath: ${JSON.stringify(root)} } }) };
  export class DebugAdapterInlineImplementation { constructor(adapter) { this.implementation = adapter; } }
  export const debug = { registerDebugAdapterDescriptorFactory: (_, factory) => { globalThis.pulseTestFactory = factory; return {}; } };
  export const window = { createOutputChannel: () => ({ dispose() {} }) };
  export const commands = { registerCommand: () => ({}) };
  export const languages = { registerCodeLensProvider: () => ({}) };
`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'vscode') return { url: `data:text/javascript,${encodeURIComponent(vscodeMock)}`, shortCircuit: true };
    return next(specifier, context);
  },
});
const { activate } = await import('../out/extension.js');
activate({ subscriptions: [], extensionUri: {} });
hooks.deregister();

function adapter(configuration = {}) {
  const value = globalThis.pulseTestFactory.createDebugAdapterDescriptor({
    configuration: { program, ...configuration },
  }).implementation;
  const events = [];
  value.onDidSendMessage(message => events.push(message));
  return { value, events };
}

async function wait(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(predicate(), 'debug operation timed out');
}

function validateMoves(stdout) {
  const pegs = { 1: [5, 4, 3, 2, 1], 2: [], 3: [] };
  const moves = stdout.filter(line => line.startsWith('Move disk'));
  assert.equal(moves.length, 31);
  for (const line of moves) {
    const [, disk, from, to] = line.match(/^Move disk (\d+) from (\d+) to (\d+)$/);
    assert.equal(pegs[from].pop(), Number(disk));
    assert.ok(!pegs[to].length || pegs[to].at(-1) > Number(disk), 'illegal Hanoi move');
    pegs[to].push(Number(disk));
  }
  assert.deepEqual(pegs[3], [5, 4, 3, 2, 1]);
}

test('Hanoi compilation and three JS executions preserve all 31 legal moves', async () => {
  const procedures = Object.values(artifact.programMap.procedures);
  assert.deepEqual(procedures[0].params, ['n', 'fromPeg', 'toPeg', 'auxPeg']);
  for (let index = 0; index < 3; index += 1) {
    const result = await executeProgram({
      instructions: parsePcode(artifact.pcodeText),
      opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(artifact.programMap),
    });
    assert.equal(result.stepCount, 802);
    assert.equal(result.stepLimitHit, false);
    assert.equal(result.error, null);
    validateMoves(result.stdout);
  }
});

test('native DAP adapter debugs JS Hanoi entry, recursion, variables, step-out and completion', async () => {
  const { value, events } = adapter();
  try {
    await value.launch({ program });
    await value.stopAtProgramEntry();
    assert.equal(value.state.sourceLocation.sourceLine, 18);
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 8 }] });
    await value.resumeUntilPause('continue');
    assert.equal(value.state.sourceLocation.sourceLine, 8);
    assert.deepEqual(value.state.locals, { n: 5, fromPeg: 1, toPeg: 3, auxPeg: 2 });
    const depth = value.state.callStack.length;
    await value.stepToNextSource('step-in');
    assert.ok(value.state.callStack.length >= depth);
    await value.stepToNextSource('step-out');
    assert.ok(value.state.callStack.length < depth);
    await value.setBreakpoints({ seq: 2, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [] });
    await value.resumeUntilPause('continue');
    assert.equal(value.state.status, 'completed');
    validateMoves(value.state.result.stdout);
    assert.equal(events.filter(event => event.event === 'terminated').length, 1);
    assert.equal(events.filter(event => event.event === 'output' && event.body.output.startsWith('Move disk')).length, 31);
  } finally {
    value.dispose();
  }
});

test('JS source step-over executes a full call without entering recursive frames', async () => {
  const { value } = adapter();
  try {
    await value.launch({ program });
    await value.stopAtProgramEntry();
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 21 }] });
    await value.resumeUntilPause('continue');
    assert.equal(value.state.sourceLocation.sourceLine, 21);
    await value.stepToNextSource('step-over');
    assert.equal(value.state.callStack.length, 0);
    assert.equal(value.state.sourceLocation.sourceLine, 22);
    validateMoves(value.state.stdout);
  } finally {
    value.dispose();
  }
});

test('bridge uploads signed map and transports dynamic breakpoint PCs', async () => {
  const savedFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return Response.json({ sessionId: 'test-session', status: 'paused', pc: 0 });
  };
  try {
    const session = await startEsp32DebugSession({ host: '192.168.2.115', pcode: artifact.pcodeText, programMap: artifact.programMap });
    assert.equal(calls.length, 3);
    const map = JSON.parse(calls[1].init.body.get('body'));
    assert.ok(map.signing.signature);
    assert.equal(map.sourceMap, undefined);
    assert.equal(calls[2].url.searchParams.get('programMap'), session.programMapFile);
    await controlEsp32DebugSession({ host: session.host, sessionId: session.sessionId, action: 'breakpoint-set', pc: 12 });
    assert.equal(calls[3].url.pathname, '/pmachine/debug/session/breakpoint/set');
    assert.equal(calls[3].url.searchParams.get('pc'), '12');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('remote DAP breakpoint edits preserve action and PC through backend API', async () => {
  const { value } = adapter({ runtime: 'esp32' });
  const savedFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json({ state: { status: 'paused' } });
  };
  try {
    await value.launch({ program, runtime: 'esp32' });
    value.debugApiUrl = 'http://127.0.0.1:4000';
    value.debugApiHost = '192.168.2.115';
    value.remoteSessionId = value.sessionId = 'test-session';
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 8 }] });
    assert.equal(calls[0].url, 'http://127.0.0.1:4000/api/pmachine/debug/esp32/session/breakpoint-set');
    assert.equal(calls[0].body.pc, value.remoteBreakpointAddresses()[0]);
    await value.setBreakpoints({ seq: 2, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [] });
    assert.ok(calls[1].url.endsWith('/breakpoint-clear'));
    assert.equal(calls[1].body.pc, calls[0].body.pc);
  } finally {
    value.remoteSessionId = '';
    value.sessionId = '';
    value.dispose();
    globalThis.fetch = savedFetch;
  }
});

test('remote source stepping respects depth and emits exactly one stop', async () => {
  for (const mode of ['step-in', 'step-over', 'step-out']) {
    const { value, events } = adapter();
    value.state = { pc: 0, callDepth: 1, sourceLocation: { sourceLine: 12 } };
    const states = [
      { callDepth: 1, sourceLocation: { sourceLine: 12 } },
      { callDepth: 2, sourceLocation: { sourceLine: 8 } },
      { callDepth: 1, sourceLocation: { sourceLine: 13 } },
      { callDepth: 0, sourceLocation: { sourceLine: 22 } },
    ];
    value.advanceEsp32Instruction = async () => { value.state = states.shift(); };
    value.remoteRequest = async () => ({});
    value.waitForEsp32Stop = async () => { value.state = states.at(-1); };
    await value.stepEsp32(mode);
    assert.equal(value.state.callDepth, mode === 'step-in' ? 2 : mode === 'step-over' ? 1 : 0);
    assert.equal(events.filter(event => event.event === 'stopped').length, 1);
    value.dispose();
  }
});

test('DAP async failure does not send a second response for an acknowledged request', async () => {
  const { value, events } = adapter();
  value.remoteEsp32 = true;
  value.continueEsp32 = async () => { throw new Error('device unavailable'); };
  value.handleMessage({ type: 'request', seq: 20, command: 'continue' });
  await wait(() => events.some(event => event.event === 'output'));
  assert.equal(events.filter(event => event.type === 'response' && event.request_seq === 20).length, 1);
  assert.match(events.find(event => event.event === 'output').body.output, /device unavailable/);
  value.dispose();
});

test('live ESP32 Hanoi debugger via backend API', {
  skip: !process.env.PMACHINE_TEST_HOST,
  timeout: 180000,
}, async () => {
  const { value, events } = adapter({
    runtime: 'esp32',
    debugSession: true,
    targetHost: process.env.PMACHINE_TEST_HOST,
    debugApiUrl: 'http://127.0.0.1:4000',
  });
  let failed = false;
  try {
    await value.launch({ program, runtime: 'esp32' });
    await value.stopAtProgramEntry();
    assert.equal(value.state.status, 'paused');
    assert.equal(value.state.sourceLocation.sourceLine, 18);
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 8 }] });
    await value.continueEsp32();
    assert.deepEqual(value.state.locals, { n: 5, fromPeg: 1, toPeg: 3, auxPeg: 2 });
    await value.setBreakpoints({ seq: 2, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [] });
    await value.stepEsp32('step-in');
    assert.equal(value.state.sourceLocation.sourceLine, 12);
    await value.stepEsp32('step-in');
    assert.equal(value.state.callDepth, 2);
    assert.deepEqual(value.state.locals, { n: 4, fromPeg: 1, toPeg: 2, auxPeg: 3 });
    await value.stepEsp32('step-over');
    assert.equal(value.state.callDepth, 2);
    await value.stepEsp32('step-out');
    assert.equal(value.state.callDepth, 1);
    await value.continueEsp32();
    assert.equal(value.state.status, 'stopped');
    validateMoves(value.state.stdout);
    assert.equal(events.filter(event => event.event === 'terminated').length, 1);
    assert.equal(events.filter(event => event.event === 'output' && event.body.output.startsWith('Move disk')).length, 31);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (value.remoteSessionId) {
      try {
        await value.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(value.remoteSessionId)}`, { method: 'DELETE' });
      } catch (error) {
        if (!failed) throw error;
        console.error(`Live test session cleanup also failed: ${error.message}`);
      }
      value.remoteSessionId = value.sessionId = '';
    }
    value.dispose();
  }
});
