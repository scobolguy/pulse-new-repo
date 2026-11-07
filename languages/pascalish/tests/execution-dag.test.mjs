import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compilePascalishProgramWithAntlr } from '../src/compile-pascalish-program-antlr-to-pcode.mjs';
import {
  createExecutionDagWorkerPool,
  executeExecutionDag,
  executeExecutionDagOrFallback
} from '../src/execution-dag.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/aggregator/scripts/run-js-pmachine.mjs';
import { loadOpcodeMap } from '../../../virtualMachines/esp32/aggregator/scripts/pmachine-js-opcodes.mjs';

const source = `
program DagGate;
var
  x, y, a, b, total: integer;
begin
  a := x + 1;
  b := y + 2;
  total := a + b;
  x := 9;
  writeln(total);
end.
`;

test('emits conservative dependency metadata without changing sequential output', async () => {
  const baseline = compilePascalishProgramWithAntlr(source);
  const analyzed = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true });

  assert.equal(analyzed.pcodeText, baseline.pcodeText);
  assert.equal(baseline.executionDag, undefined);
  const baselineMap = { ...baseline.programMap };
  const analyzedMap = { ...analyzed.programMap };
  delete baselineMap.generatedAt;
  delete analyzedMap.generatedAt;
  assert.deepEqual(analyzedMap, baselineMap);

  const dag = analyzed.executionDag;
  assert.equal(dag.version, 1);
  assert.equal(dag.scope, 'main-block');
  assert.equal(dag.scheduling, 'dependency-graph');
  assert.deepEqual(dag.effectAnalysis, {
    version: 1,
    mode: 'conservative',
    unknownCallsAreBarriers: true,
    inferredRoutineEffects: false
  });
  assert.deepEqual(dag.nodes.slice(0, 4).map(({ reads, writes, eligible }) => ({
    reads, writes, eligible
  })), [
    { reads: ['x'], writes: ['a'], eligible: true },
    { reads: ['y'], writes: ['b'], eligible: true },
    { reads: ['a', 'b'], writes: ['total'], eligible: true },
    { reads: [], writes: ['x'], eligible: true }
  ]);
  assert.deepEqual(dag.edges, [
    { from: 'statement-1', to: 'statement-3', reason: 'read-after-write' },
    { from: 'statement-2', to: 'statement-3', reason: 'read-after-write' },
    { from: 'statement-1', to: 'statement-4', reason: 'write-after-read' },
    { from: 'statement-1', to: 'statement-5', reason: 'ordering-barrier' },
    { from: 'statement-2', to: 'statement-5', reason: 'ordering-barrier' },
    { from: 'statement-3', to: 'statement-5', reason: 'ordering-barrier' },
    { from: 'statement-4', to: 'statement-5', reason: 'ordering-barrier' }
  ]);

  const opcodeMap = await loadOpcodeMap();
  const execute = compiled => executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    opcodeMap,
    mappingsById: new Map(),
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'execution-dag.test',
    sourceMessage: '',
    runtimeContext: {}
  });
  const [before, after] = await Promise.all([execute(baseline), execute(analyzed)]);
  assert.deepEqual(after.stdout, before.stdout);
  assert.deepEqual(after.stdout.map(line => line.trim()), ['3']);
});

test('executes independent pure assignments concurrently and matches sequential P-Code', async () => {
  const localSource = `
program DagLocalExecution;
var x, y, a, b, total: integer;
begin
  x := 4;
  y := 7;
  a := x + 1;
  b := y + 2;
  total := a + b;
  writeln(total);
end.
`;
  const compiled = compilePascalishProgramWithAntlr(localSource, { includeExecutionDag: true });
  const opcodeMap = await loadOpcodeMap();
  const sequential = await executeProgram({
    instructions: parsePcode(compilePascalishProgramWithAntlr(localSource).pcodeText),
    opcodeMap,
    mappingsById: new Map(),
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'execution-dag.local',
    sourceMessage: '',
    runtimeContext: {}
  });
  const pool = await createExecutionDagWorkerPool({ concurrency: 2 });
  try {
    const local = await executeExecutionDag(compiled.executionDag, {}, {
      concurrency: 2,
      workerPool: pool
    });
    const repeated = await executeExecutionDag(compiled.executionDag, {}, {
      concurrency: 2,
      workerPool: pool
    });

    assert.equal(local.state.total, Number(sequential.stdout[0]));
    assert.deepEqual(local.executionBatches, [
      ['statement-1', 'statement-2'],
      ['statement-3', 'statement-4'],
      ['statement-5']
    ]);
    assert.equal(local.stoppedAtBarrier, 'statement-6');
    assert.deepEqual(repeated.state, local.state);
    assert.equal(pool.workerCount, 2);
  } finally {
    await pool.close();
  }
});

test('uses sequential execution for the whole program when any statement is unsupported', async () => {
  const localSource = `
program DagSequentialFallback;
var x, y: integer;
begin
  x := 3;
  y := x + 2;
  writeln(y);
end.
`;
  const compiled = compilePascalishProgramWithAntlr(localSource, { includeExecutionDag: true });
  const opcodeMap = await loadOpcodeMap();
  const expected = await executeProgram({
    instructions: parsePcode(compilePascalishProgramWithAntlr(localSource).pcodeText),
    opcodeMap,
    mappingsById: new Map(),
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'execution-dag.fallback',
    sourceMessage: '',
    runtimeContext: {}
  });
  let sequentialCalls = 0;
  const dispatched = await executeExecutionDagOrFallback(compiled.executionDag, {}, {
    concurrency: 2,
    executeSequential: async () => {
      sequentialCalls += 1;
      return executeProgram({
        instructions: parsePcode(compiled.pcodeText),
        opcodeMap,
        mappingsById: new Map(),
        queueTypesByName: new Map(),
        isoTypeIds: new Set(),
        inputQueue: 'execution-dag.fallback',
        sourceMessage: '',
        runtimeContext: {}
      });
    }
  });

  assert.equal(dispatched.mode, 'sequential');
  assert.match(dispatched.reason, /I\/O calls/);
  assert.equal(sequentialCalls, 1);
  assert.deepEqual(dispatched.result.stdout, expected.stdout);
  assert.deepEqual(dispatched.result.globals, expected.globals);
});

test('treats calls and control flow as barriers', () => {
  const compiled = compilePascalishProgramWithAntlr(`
program DagBarriers;
var a, b: integer;
begin
  a := 1;
  writeln(a);
  if a > 0 then b := a;
end.
`, { includeExecutionDag: true });
  const [, call, branch] = compiled.executionDag.nodes;

  assert.equal(call.eligible, false);
  assert.equal(call.effect, 'impure');
  assert.deepEqual(call.effects, ['io']);
  assert.equal(call.reason, 'I/O calls are ordering barriers');
  assert.equal(branch.eligible, false);
  assert.deepEqual(compiled.executionDag.edges, [
    { from: 'statement-1', to: 'statement-2', reason: 'ordering-barrier' },
    { from: 'statement-1', to: 'statement-3', reason: 'ordering-barrier' },
    { from: 'statement-2', to: 'statement-3', reason: 'ordering-barrier' }
  ]);
});

test('marks unclassified routine calls as unknown effects and enforces effect safety', async () => {
  const compiled = compilePascalishProgramWithAntlr(`
program DagUnknownCall;
var a: integer;
procedure Calculate;
begin
end;
begin
  Calculate;
end.
`, { includeExecutionDag: true });
  const call = compiled.executionDag.nodes[0];

  assert.equal(call.effect, 'unknown');
  assert.deepEqual(call.effects, ['unknown-call']);
  assert.equal(call.parallelSafe, false);

  const alteredDag = structuredClone(compiled.executionDag);
  alteredDag.nodes[0].eligible = true;
  alteredDag.nodes[0].parallelSafe = true;
  await assert.rejects(
    executeExecutionDag(alteredDag),
    /effect-safety contract/
  );
});

test('does not mark non-integer variables as executable work units', () => {
  const compiled = compilePascalishProgramWithAntlr(`
program DagTypedBarriers;
var r: real; s: string;
begin
  r := 2.5;
  s := 'text';
end.
`, { includeExecutionDag: true });

  assert.deepEqual(compiled.executionDag.nodes.map(node => node.eligible), [false, false]);
});

test('initializes declared integer variables to the PMachine default of zero', async () => {
  const compiled = compilePascalishProgramWithAntlr(`
program DagDefaultValues;
var x: integer;
begin
  x := x + 1;
end.
`, { includeExecutionDag: true });

  const local = await executeExecutionDag(compiled.executionDag);
  assert.equal(local.state.x, 1);
});

test('writes the DAG as an opt-in compiler CLI artifact', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pascalish-dag-'));
  const sourcePath = path.join(directory, 'program.pas');
  const pcodePath = path.join(directory, 'program.pcode');
  const dagPath = path.join(directory, 'program.execution-dag.json');
  const cliPath = fileURLToPath(new URL('../src/pascalishc-antlr-gateway.mjs', import.meta.url));

  try {
    await fs.writeFile(sourcePath, source, 'utf8');
    execFileSync(process.execPath, [
      cliPath,
      sourcePath,
      '-o', pcodePath,
      '--execution-dag-out', dagPath
    ]);

    const dag = JSON.parse(await fs.readFile(dagPath, 'utf8'));
    assert.equal(dag.scheduling, 'dependency-graph');
    assert.equal(dag.nodes.length, 5);
    assert.equal(await fs.readFile(pcodePath, 'utf8'), compilePascalishProgramWithAntlr(source).pcodeText);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
