import assert from 'node:assert/strict';
import {
  createJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  stepJavaScriptPmachineDebugSession,
  continueJavaScriptPmachineDebugSession,
  setJavaScriptPmachineDebugBreakpoints,
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

async function waitForState(sessionId, predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  let state = getJavaScriptPmachineDebugState(sessionId);
  while (!predicate(state) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
    state = getJavaScriptPmachineDebugState(sessionId);
  }
  assert.ok(predicate(state), `Debugger did not reach the expected state within ${timeoutMs}ms`);
  return state;
}

const session = createJavaScriptPmachineDebugSession({
  pcodeText: 'PUSH_INT 7\nSTORE result\nHALT',
  programMap: { __globals: ['result'] },
  sourceMap: {
    '0': { sourceFile: 'debug-demo.pas', sourceLine: 2, sourceText: 'result := 7;' },
    '1': { sourceFile: 'debug-demo.pas', sourceLine: 2, sourceText: 'result := 7;' },
    '2': { sourceFile: 'debug-demo.pas', sourceLine: 3, sourceText: 'end.' },
  },
});

let state = await waitForState(session.id, current => current.ready && current.status === 'paused' && current.sourceLocation?.sourceLine === 2);
assert.equal(state.runtime, 'js-pmachine');
assert.equal(state.sourceLocation.sourceLine, 2);
assert.equal(state.status, 'paused');

setJavaScriptPmachineDebugBreakpoints(session.id, [1]);
stepJavaScriptPmachineDebugSession(session.id);
state = await waitForState(session.id, current => current.pc === 1 && current.status === 'paused');
assert.equal(state.pc, 1);
assert.equal(state.sourceLocation.sourceText, 'result := 7;');
assert.deepEqual(state.operandStack, [7]);

stepJavaScriptPmachineDebugSession(session.id);
state = await waitForState(session.id, current => current.pc === 2 && current.status === 'paused');
assert.equal(state.pc, 2);
assert.deepEqual(state.operandStack, []);
assert.equal(state.globals.result, 7);

continueJavaScriptPmachineDebugSession(session.id);
state = await waitForState(session.id, current => current.status === 'completed');
assert.equal(state.status, 'completed');
assert.equal(state.result.globals.result, 7);
console.log('[js-pmachine-debugger] PASS: source locations, stepping, breakpoints, and completion');
