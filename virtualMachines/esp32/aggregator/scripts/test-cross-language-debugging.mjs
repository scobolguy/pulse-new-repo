import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishToPcode } from './compile-cobolish-to-pcode.mjs';
import { compileVbishToPcode } from '../../../../languages/vbish/src/compile-vbish-to-pcode.mjs';
import { compileWorkflowDSLWithAntlr } from '../../../../languages/wfl/src/workflow-antlr-compiler.mjs';
import { compileWorkflowToPcode } from '../../../../languages/wfl/src/compile-workflow-to-pcode.mjs';
import {
  continueJavaScriptPmachineDebugSession,
  createJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  inspectJavaScriptPmachineVariable,
  setJavaScriptPmachineDebugBreakpoints,
  setJavaScriptPmachineSourceBreakpoints,
  stepJavaScriptPmachineDebugSession,
  stepOverJavaScriptPmachineDebugSession
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

async function waitFor(id, predicate, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = getJavaScriptPmachineDebugState(id);
    if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const state = getJavaScriptPmachineDebugState(id);
  throw new Error(`Timed out waiting for debug session ${id}: ${JSON.stringify({
    status: state?.status, pc: state?.pc, sourceLocation: state?.sourceLocation,
    breakpoints: state?.breakpoints, error: state?.error,
  })}`);
}

const pascalSource = 'program DebugPas; var value: integer; begin value := 11 end.';
const cobolSource = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. DEBUGCOB.',
  'DATA DIVISION.',
  'WORKING-STORAGE SECTION.',
  '01 VALUE-OUT PIC 9(3).',
  'PROCEDURE DIVISION.',
  'MOVE 12 TO VALUE-OUT.',
  'STOP RUN.'
].join('\n');
const vbSource = [
  'Program "DebugVb"',
  'Sub Main()',
  '  Dim ValueOut As Integer = 13',
  'End Sub'
].join('\n');
const wflSource = [
  'WORKFLOW "DebugWfl" BEGIN',
  '  STEP "set-value" SET STATE "value" = "14";',
  'END;'
].join('\n');
const wflCompiled = compileWorkflowDSLWithAntlr(wflSource);

const artifacts = [
  { language: 'pascalish', variable: 'value', expected: 11, artifact: compilePascalishProgramWithAntlr(pascalSource, { fileName: 'debug.pas' }) },
  { language: 'cobolish', variable: 'VALUE_OUT', expected: { unscaled: 12n, scale: 0 }, artifact: compileCobolishToPcode(cobolSource, { fileName: 'debug.cob' }) },
  { language: 'vbish', variable: 'VALUEOUT', expected: 13, artifact: compileVbishToPcode(vbSource, { fileName: 'debug.vbs' }) },
  { language: 'wfl', variable: 'value', expected: '14', artifact: compileWorkflowToPcode(wflCompiled, 'DebugWfl', { sourceText: wflSource, fileName: 'debug.wfl' }) }
];

for (const { language, variable, expected, artifact } of artifacts) {
  const sourceMap = artifact.programMap.sourceMap || artifact.sourceMap;
  assert.ok(Object.keys(sourceMap).length > 0, `${language} source map missing`);
  assert.ok(Object.values(sourceMap).every(location => location.sourceLanguage === language));
  const session = createJavaScriptPmachineDebugSession({ pcodeText: artifact.pcodeText, programMap: artifact.programMap, sourceMap });
  const locations = Object.values(sourceMap);
  const location = locations.find(item => item.sourceLine > 1) || locations.find(item => item.sourceLine > 0);
  assert.ok(location, `${language} source map has no executable source location`);
  const breakpointState = setJavaScriptPmachineSourceBreakpoints(session.id, [{
    sourceFile: location.sourceFile,
    sourceLanguage: language,
    sourceLine: location.sourceLine
  }]);
  assert.ok(breakpointState.breakpoints.length > 0, `${language} source breakpoint did not resolve`);
  if (language === 'pascalish') {
    assert.equal(sourceMap['0'], undefined, 'Pascal bootstrap jump must not need a source location');
    assert.equal(location.sourceLine, 1, 'single-line programs must support source breakpoints');
  }
  if (language === 'cobolish') {
    assert.equal(breakpointState.breakpoints.length, 2, 'COBOL statement must resolve in both routine and main code');
    assert.deepEqual(breakpointState.resolvedSourceBreakpoints[0].pcs, breakpointState.breakpoints);
    for (const pc of breakpointState.breakpoints) {
      assert.equal(sourceMap[String(pc)].sourceLine, location.sourceLine);
      assert.notEqual(sourceMap[String(pc - 1)]?.sourceLine, location.sourceLine,
        'source breakpoints must stop at block entry, not every instruction');
    }
  }
  const targetPc = Math.max(...breakpointState.breakpoints);
  let paused = await waitFor(session.id, state => state.ready && state.status === 'paused');
  if (paused.pc !== targetPc) {
    continueJavaScriptPmachineDebugSession(session.id);
    paused = await waitFor(session.id, state => state.status === 'paused' && state.pc === targetPc);
  }
  assert.equal(paused.sourceLocation.sourceLanguage, language);
  setJavaScriptPmachineDebugBreakpoints(session.id, []);
  stepJavaScriptPmachineDebugSession(session.id);
  const stepped = await waitFor(session.id, state => state.status === 'completed'
    || state.status === 'paused' && state.pc !== paused.pc);
  assert.notEqual(stepped.status, 'error', `${language} source step failed`);
  if (stepped.status !== 'completed') continueJavaScriptPmachineDebugSession(session.id);
  await waitFor(session.id, state => state.status === 'completed');
  const inspected = inspectJavaScriptPmachineVariable(session.id, variable);
  assert.deepEqual(inspected.value, expected, `${language} variable inspection mismatch`);
  assert.equal(inspected.serialized, JSON.stringify(expected, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
}

const callPcode = [
  'JMP MAIN',
  'PROC_WORK:',
  'PUSH_INT 9',
  'STORE inner',
  'RET',
  'MAIN:',
  'CALL PROC_WORK 0',
  'PUSH_INT 1',
  'STORE outer',
  'HALT'
].join('\n');
const callMap = {
  globals: ['inner', 'outer'],
  procedures: { PROC_WORK: { name: 'work', params: [], locals: [] } },
  sourceMap: Object.fromEntries(Array.from({ length: 7 }, (_, pc) => [String(pc), {
    sourceFile: pc < 4 ? 'worker.cob' : 'caller.pas',
    sourceLanguage: pc < 4 ? 'cobolish' : 'pascalish',
    sourceLine: pc + 1,
    sourceText: `instruction ${pc}`
  }]))
};
const callSession = createJavaScriptPmachineDebugSession({ pcodeText: callPcode, programMap: callMap });
await waitFor(callSession.id, state => state.ready && state.status === 'paused');
stepJavaScriptPmachineDebugSession(callSession.id);
await waitFor(callSession.id, state => state.status === 'paused' && state.pc === 4);
stepOverJavaScriptPmachineDebugSession(callSession.id);
const afterCall = await waitFor(callSession.id, state => state.status === 'paused' && state.pc === 5);
assert.equal(afterCall.sourceLocation.sourceLanguage, 'pascalish');
assert.equal(inspectJavaScriptPmachineVariable(callSession.id, 'inner').value, 9);

console.log('[cross-language-debugging] PASS: source breakpoints, step-in, step-over, language locations, and serialized variables');
