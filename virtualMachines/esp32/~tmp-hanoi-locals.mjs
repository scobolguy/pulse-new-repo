import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from './aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import {
  createJavaScriptPmachineDebugSession,
  setJavaScriptPmachineSourceBreakpoints,
  continueJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  stepJavaScriptPmachineDebugSession
} from './aggregator/src/backend/modules/javascriptPmachineDebugger.mjs';

const source = await fs.readFile('./artifactPrograms/towers-of-hanoi-program.pas', 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, { fileName: 'towers-of-hanoi-program.pas' });
const session = createJavaScriptPmachineDebugSession({
  pcodeText: compiled.pcodeText,
  programMap: compiled.programMap,
  sourceMap: compiled.programMap?.sourceMap || {}
});
console.log('INIT', JSON.stringify({ id: session.id, ready: session.ready, status: session.status, sourceLocation: session.sourceLocation }, null, 2));
setJavaScriptPmachineSourceBreakpoints(session.id, [{ sourceFile: 'towers-of-hanoi-program.pas', sourceLanguage: 'pascalish', sourceLine: 21 }]);
continueJavaScriptPmachineDebugSession(session.id);

function wait(predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const state = getJavaScriptPmachineDebugState(session.id);
      if (predicate(state)) return resolve(state);
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout: ' + JSON.stringify(state)));
      setTimeout(tick, 25);
    };
    tick();
  });
}

const hit = await wait(state => state?.status === 'paused' && Number(state?.sourceLocation?.sourceLine) === 21 && state?.locals && Object.keys(state.locals).length > 0);
console.log('AT_LINE_21', JSON.stringify({ sourceFile: hit.sourceLocation?.sourceFile, sourceLine: hit.sourceLocation?.sourceLine, locals: hit.locals, globals: hit.globals }, null, 2));
stepJavaScriptPmachineDebugSession(session.id);
const afterStep = await wait(state => state?.status === 'paused' && (state.callStack?.length || 0) > 0, 3000);
console.log('AFTER_STEP_INTO', JSON.stringify({ pc: afterStep.pc, callStack: afterStep.callStack, locals: afterStep.locals, globals: afterStep.globals }, null, 2));
