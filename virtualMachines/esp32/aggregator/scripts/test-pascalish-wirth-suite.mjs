// Validation suite for the Wirth-structured Pascalish pipeline.
// Expected output is pinned from the retired StandardPascal compiler.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const CASES = [
  { name: 'towers-of-hanoi', lines: 64, first: 'Towers of Hanoi for 6 disks:', last: 'Move disk 1 from 2 to 3' },
  { name: 'factorial-0-10-recursive', lines: 11, first: 'fact(0)=1', last: 'fact(10)=3628800' },
  { name: 'fibonacci-12-recursive', lines: 12, first: 'fib(0)=0', last: 'fib(11)=89' },
  { name: 'evenodd-12-mutual-recursive', lines: 24, first: 'even(0)=1', last: 'odd(11)=1' }
];

async function compileAndRun(name) {
  const pcode = `../pcode/wirth-suite-${name}.pcode`;
  const map = `../pcode/wirth-suite-${name}.program.json`;
  await run('node', [
    'scripts/compile-pascalish-program-antlr-to-pcode.mjs',
    '--in', `./data/${name}.pas`, '--out', pcode, '--map-out', map
  ]);
  const { stdout } = await run('node', [
    'scripts/run-js-pmachine.mjs',
    '--pcode', pcode, '--program-map', map,
    '--input-queue', 'proof', '--message', ''
  ]);
  return JSON.parse(stdout).stdout || [];
}

async function main() {
  for (const testCase of CASES) {
    const out = await compileAndRun(testCase.name);
    assert.equal(out.length, testCase.lines, `${testCase.name}: expected ${testCase.lines} lines, got ${out.length}`);
    assert.equal(out[0], testCase.first, `${testCase.name}: unexpected first line`);
    assert.equal(out[out.length - 1], testCase.last, `${testCase.name}: unexpected last line`);
    console.log(`[wirth-suite] PASS ${testCase.name} (${out.length} lines)`);
  }

  await assertOrchestrationLowering();
  console.log('[wirth-suite] PASS: all Wirth programs produce expected output');
}

// Orchestration lowers to ORCH_* opcodes; the runtime result depends on live
// child nodes, so only the emitted pcode is asserted here.
async function assertOrchestrationLowering() {
  const { compilePascalishProgramWithAntlr } = await import('./compile-pascalish-program-antlr-to-pcode.mjs');
  const source = await fs.readFile('./data/parent-child-orchestration.pas', 'utf-8');
  const { pcodeText } = compilePascalishProgramWithAntlr(source);

  const spawns = pcodeText.split('\n').filter(line => line.startsWith('ORCH_SPAWN'));
  assert.equal(spawns.length, 2, 'expected two spawned subflows');
  assert.ok(spawns[0].includes('risk_check'), 'first spawn should target risk_check');
  assert.ok(spawns[1].includes('limits_check'), 'second spawn should target limits_check');
  assert.ok(spawns[0].includes('\\"timeoutMs\\":5000'), 'spawn should carry its timeout');
  assert.ok(spawns[0].includes('\\"handleRef\\":\\"h_node1\\"'), 'spawn should carry its handle');
  assert.ok(/ORCH_WAIT_ALL .*\\"timeoutMs\\":8000/.test(pcodeText), 'wait all should carry its timeout');
  assert.ok(pcodeText.includes('ORCH_FAIL_TXN "subtasks timeout or transport error"'), 'error clause should lower to ORCH_FAIL_TXN');
  assert.ok(pcodeText.includes('ORCH_RETURN_SUCCESS "merged_reply"'), 'return success should lower to ORCH_RETURN_SUCCESS');
  console.log('[wirth-suite] PASS parent-child-orchestration (ORCH lowering)');
}

main().catch((error) => {
  console.error('[wirth-suite] FAIL:', error.message);
  process.exitCode = 1;
});
