import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createJavaScriptPmachineDebugSession,
  setJavaScriptPmachineSourceBreakpoints,
  continueJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  stopJavaScriptPmachineDebugSession
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

async function waitForState(sessionId, predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let state = getJavaScriptPmachineDebugState(sessionId);
  while (!predicate(state) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
    state = getJavaScriptPmachineDebugState(sessionId);
  }
  assert.ok(predicate(state), `Debugger did not reach expected state within ${timeoutMs}ms; last=${JSON.stringify({ status: state?.status, pc: state?.pc, sourceLocation: state?.sourceLocation, breakpoints: state?.breakpoints })}`);
  return state;
}

const sourceFileName = 'towers-of-hanoi-program.pas';
const source = await fs.readFile(new URL(`../../src/${sourceFileName}`, import.meta.url), 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, { fileName: sourceFileName });
const sourceMap = compiled.programMap?.sourceMap || {};
assert.ok(Object.keys(sourceMap).length > 0, 'compiled program should include source map entries');

const initial = createJavaScriptPmachineDebugSession({
  pcodeText: compiled.pcodeText,
  programMap: compiled.programMap,
  sourceMap
});
const sessionId = initial.id;
await waitForState(sessionId, state => state?.ready && state.status === 'paused');

const withBreakpoint = setJavaScriptPmachineSourceBreakpoints(sessionId, [{
  sourceFile: sourceFileName,
  sourceLanguage: 'pascalish',
  sourceLine: 21
}]);
assert.ok(withBreakpoint.breakpoints.length > 0, 'source breakpoint should resolve to at least one PC');

try {
  continueJavaScriptPmachineDebugSession(sessionId);
  const paused = await waitForState(sessionId, state => state?.status === 'paused' && state.sourceLocation?.sourceFile === sourceFileName && state.breakpoints?.length > 0, 3000);
  assert.equal(paused.sourceLocation.sourceFile, sourceFileName);
  assert.equal(paused.sourceLocation.sourceLine, 21);
  assert.equal(paused.callStack.length, 0, 'source call breakpoint stops before entering the procedure');
  assert.ok(paused.breakpoints.includes(paused.pc));
  assert.equal(paused.globals.diskCount, 5);
  console.log('[js-pmachine-debugger-hanoi] PASS: source breakpoint pauses before the Hanoi call');
} finally {
  stopJavaScriptPmachineDebugSession(sessionId);
}