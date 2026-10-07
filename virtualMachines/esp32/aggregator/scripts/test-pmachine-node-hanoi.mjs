// Runs and debugs the Towers of Hanoi program against a device-contract pmachine
// (ESP32 or standalone JS node). Usage: node scripts/test-pmachine-node-hanoi.mjs --host 127.0.0.1:4111
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { runPcodeOnEsp32 } from './run-pascal-on-esp32-node.mjs';
import {
  controlEsp32DebugSession,
  readEsp32DebugSession,
  setEsp32SourceBreakpoints,
  startEsp32DebugSession,
  stopEsp32DebugSession,
  waitForEsp32DebugStop
} from '../src/backend/modules/esp32PmachineDebugBridge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const hostIndex = process.argv.indexOf('--host');
const host = hostIndex > 0 ? process.argv[hostIndex + 1] : '127.0.0.1:4111';

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
}

function validateMoves(lines) {
  const pegs = { 1: [5, 4, 3, 2, 1], 2: [], 3: [] };
  const moves = lines.filter((line) => line.startsWith('Move disk'));
  for (const line of moves) {
    const [, disk, from, to] = line.match(/Move disk (\d+) from (\d+) to (\d+)/).map(Number);
    if (pegs[from].at(-1) !== disk) throw new Error(`illegal move: ${line}`);
    if (pegs[to].length && pegs[to].at(-1) < disk) throw new Error(`larger on smaller: ${line}`);
    pegs[to].push(pegs[from].pop());
  }
  return { count: moves.length, solved: pegs[3].join(',') === '5,4,3,2,1' };
}

const source = await fs.readFile(path.resolve(here, '../../src/towers-of-hanoi-program.pas'), 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, { fileName: 'towers-of-hanoi-program.pas' });
const programMap = { ...compiled.programMap };
delete programMap.sourceMap;

console.log(`# host ${host}`);
const run = await runPcodeOnEsp32({ pcodeText: compiled.pcodeText, programMap, node: host, inputQueue: 'x', message: '' });
const runLines = run.result?.stdout || [];
const runCheck = validateMoves(runLines);
assert(runCheck.count === 31 && runCheck.solved, `run produced 31 legal moves solving the puzzle (${runCheck.count})`);

const session = await startEsp32DebugSession({
  host,
  pcode: compiled.pcodeText,
  programMap: compiled.programMap,
  sourceBreakpoints: [13]
});
const sessionId = session.sessionId;
try {
  let state = await waitForEsp32DebugStop({ host, sessionId });
  assert(state.status === 'paused', `debug session paused at start (pc ${state.pc})`);

  state = await controlEsp32DebugSession({ host, sessionId, action: 'line-step-in' });
  assert(state.sourceLocation?.sourceLine >= 18, `line-step-in reaches main program (line ${state.sourceLocation?.sourceLine})`);

  await controlEsp32DebugSession({ host, sessionId, action: 'continue' });
  state = await waitForEsp32DebugStop({ host, sessionId });
  assert(state.sourceLocation?.sourceLine === 13, `continue stops on breakpoint line 13 (got ${state.sourceLocation?.sourceLine})`);
  assert(Number(state.locals.n) === 2, `locals.n is 2 at first line-13 stop (got ${state.locals.n})`);
  assert(state.stdout.length === 2, `stdout has header + 1 move before first line-13 (got ${state.stdout.length}, source ${state.stdoutSource || 'device'})`);
  assert(Array.isArray(state.callStack) && state.callStack.length > 0, `call stack available (${state.callStack?.length})`);

  state = await controlEsp32DebugSession({ host, sessionId, action: 'line-step-over' });
  assert(state.sourceLocation?.sourceLine === 14, `line-step-over goes to line 14 (got ${state.sourceLocation?.sourceLine})`);
  assert(state.stdout.length === 3, `writeln output appears after step-over (got ${state.stdout.length})`);

  state = await controlEsp32DebugSession({ host, sessionId, action: 'line-step-over' });
  assert(state.callDepth >= 1, `line-step-over of recursive call returns to caller depth (${state.callDepth}, line ${state.sourceLocation?.sourceLine})`);

  await setEsp32SourceBreakpoints({ host, sessionId, lines: [] });
  await controlEsp32DebugSession({ host, sessionId, action: 'continue' });
  state = await waitForEsp32DebugStop({ host, sessionId });
  const debugCheck = validateMoves(state.stdout);
  assert(state.status === 'stopped', `program runs to completion after clearing breakpoints (${state.status})`);
  assert(debugCheck.count === 31 && debugCheck.solved, `debug stdout has all 31 moves (${debugCheck.count})`);
} finally {
  await stopEsp32DebugSession({ host, sessionId }).catch(() => {});
}
console.log('# all passed');
