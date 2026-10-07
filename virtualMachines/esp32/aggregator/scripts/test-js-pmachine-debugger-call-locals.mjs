import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import {
  continueJavaScriptPmachineDebugSession,
  createJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  setJavaScriptPmachineSourceBreakpoints,
  stopJavaScriptPmachineDebugSession
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

const source = await fs.readFile(new URL('../../src/towers-of-hanoi-program.pas', import.meta.url), 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, {
  fileName: 'towers-of-hanoi-program.pas'
});
const session = createJavaScriptPmachineDebugSession({
  pcodeText: compiled.pcodeText,
  programMap: compiled.programMap,
  sourceMap: compiled.programMap.sourceMap
});

setJavaScriptPmachineSourceBreakpoints(session.id, [{
  sourceFile: 'towers-of-hanoi-program.pas',
  sourceLanguage: 'pascalish',
  sourceLine: 10
}]);
continueJavaScriptPmachineDebugSession(session.id);

const deadline = Date.now() + 5000;
let state = getJavaScriptPmachineDebugState(session.id);
while (Date.now() < deadline) {
  state = getJavaScriptPmachineDebugState(session.id);
  if (state?.status === 'paused' && state.callStack.length > 0) break;
  await new Promise(resolve => setTimeout(resolve, 10));
}

try {
  assert.equal(state.status, 'paused');
  assert.ok(state.callStack.length > 0, 'source breakpoint should pause after entering Hanoi');
  assert.equal(state.sourceLocation.sourceLine, 12, 'else keyword relocates to the next executable statement');
  assert.deepEqual(state.locals, {
    n: 5,
    fromPeg: 1,
    toPeg: 3,
    auxPeg: 2
  });
  console.log('PASS: source CALL breakpoint exposes Hanoi procedure locals');
} finally {
  stopJavaScriptPmachineDebugSession(session.id);
}

const lineEightSession = createJavaScriptPmachineDebugSession({
  pcodeText: compiled.pcodeText,
  programMap: compiled.programMap,
  sourceMap: compiled.programMap.sourceMap
});

setJavaScriptPmachineSourceBreakpoints(lineEightSession.id, [{
  sourceFile: 'towers-of-hanoi-program.pas',
  sourceLanguage: 'pascalish',
  sourceLine: 8
}]);
continueJavaScriptPmachineDebugSession(lineEightSession.id);

const lineEightDeadline = Date.now() + 5000;
let lineEightState = getJavaScriptPmachineDebugState(lineEightSession.id);
while (Date.now() < lineEightDeadline) {
  lineEightState = getJavaScriptPmachineDebugState(lineEightSession.id);
  if (lineEightState?.status === 'paused' && lineEightState.callStack.length > 0) break;
  await new Promise(resolve => setTimeout(resolve, 10));
}

try {
  assert.equal(lineEightState.status, 'paused');
  assert.equal(lineEightState.sourceLocation?.sourceLine, 8);
  assert.equal(typeof lineEightState.locals.n, 'number');
  assert.equal(typeof lineEightState.locals.fromPeg, 'number');
  assert.equal(typeof lineEightState.locals.toPeg, 'number');
  assert.equal(typeof lineEightState.locals.auxPeg, 'number');
  console.log('PASS: line 8 source breakpoint exposes Hanoi locals');
} finally {
  stopJavaScriptPmachineDebugSession(lineEightSession.id);
}
