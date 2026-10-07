// Validation suite for the Wirth-structured Pascalish pipeline.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
await fs.mkdir(path.resolve('../object/pcode'), { recursive: true });
const outputDir = await fs.mkdtemp(path.resolve('../object/pcode/wirth-suite-'));

const CASES = [
  { name: 'towers-of-hanoi', lines: 64, first: 'Towers of Hanoi for 6 disks:', last: 'Move disk 1 from 2 to 3' }
];

async function compileAndRun(name) {
  const pcode = path.join(outputDir, `${name}.pcode`);
  const map = path.join(outputDir, `${name}.program.json`);
  await run('node', [
    'scripts/compile-pascalish-program-antlr-to-pcode.mjs',
    '--in', `../src/${name}.pas`, '--out', pcode, '--map-out', map
  ]);
  const { stdout } = await run('node', [
    'scripts/run-js-pmachine.mjs',
    '--pcode', pcode, '--program-map', map,
    '--input-queue', 'proof', '--message', ''
  ]);
  return JSON.parse(stdout).stdout || [];
}

async function main() {
  try {
    for (const testCase of CASES) {
      const out = await compileAndRun(testCase.name);
      assert.equal(out.length, testCase.lines, `${testCase.name}: expected ${testCase.lines} lines, got ${out.length}`);
      assert.equal(out[0], testCase.first, `${testCase.name}: unexpected first line`);
      assert.equal(out[out.length - 1], testCase.last, `${testCase.name}: unexpected last line`);
      console.log(`[wirth-suite] PASS ${testCase.name} (${out.length} lines)`);
    }

    console.log('[wirth-suite] PASS: all Wirth programs produce expected output');
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[wirth-suite] FAIL:', error.message);
  process.exitCode = 1;
});
