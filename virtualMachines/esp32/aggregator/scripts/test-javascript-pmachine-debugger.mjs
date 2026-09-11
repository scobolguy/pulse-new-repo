import assert from 'node:assert/strict';
import {
  createJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  stepJavaScriptPmachineDebugSession,
  continueJavaScriptPmachineDebugSession,
  setJavaScriptPmachineDebugBreakpoints,
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

const session = createJavaScriptPmachineDebugSession({
  pcodeText: 'PUSH_INT 7\nSTORE result\nHALT',
  programMap: { __globals: ['result'] },
  sourceMap: {
    '0': { sourceFile: 'debug-demo.pas', sourceLine: 2, sourceText: 'result := 7;' },
    '1': { sourceFile: 'debug-demo.pas', sourceLine: 2, sourceText: 'result := 7;' },
    '2': { sourceFile: 'debug-demo.pas', sourceLine: 3, sourceText: 'end.' },
  },
});

await new Promise(resolve => setTimeout(resolve, 50));
let state = getJavaScriptPmachineDebugState(session.id);
assert.equal(state.runtime, 'js-pmachine');
assert.equal(state.sourceLocation.sourceLine, 2);
assert.equal(state.status, 'paused');

setJavaScriptPmachineDebugBreakpoints(session.id, [1]);
stepJavaScriptPmachineDebugSession(session.id);
await new Promise(resolve => setTimeout(resolve, 50));
state = getJavaScriptPmachineDebugState(session.id);
assert.equal(state.pc, 1);
assert.equal(state.sourceLocation.sourceText, 'result := 7;');
assert.deepEqual(state.operandStack, [7]);

continueJavaScriptPmachineDebugSession(session.id);
await new Promise(resolve => setTimeout(resolve, 100));
state = getJavaScriptPmachineDebugState(session.id);
assert.equal(state.status, 'completed');
assert.equal(state.result.globals.result, 7);
console.log('[js-pmachine-debugger] PASS: source locations, stepping, breakpoints, and completion');
