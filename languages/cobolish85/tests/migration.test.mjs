import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck } from './support/trace.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compileCobolishToPcode } from '../src/compile-cobolish-to-pcode.mjs';
import { compileCobolishToPcode as legacy } from '../../../virtualMachines/esp32/aggregator/scripts/compile-cobolish-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';

const source = `IDENTIFICATION DIVISION.
PROGRAM-ID. WORKING.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 RESULT PIC 9(3).
PROCEDURE DIVISION.
MOVE 42 TO RESULT.
DISPLAY RESULT.
STOP RUN.`;

async function verify(pcodeText, label) {
  const executed = await executeProgram({ instructions: parsePcode(pcodeText), inputQueue: '', sourceMessage: '' });
  traceCheck(import.meta.url, {
    description: `${label}: DISPLAY output`,
    expected: 'Output contains 42, no runtime error',
    actual: executed.error ? `Runtime error: ${executed.error}` : executed.stdout,
    matched: executed.error === null && /42/.test(executed.stdout.join('\n'))
  });
  assert.equal(executed.error, null);
  assert.equal(executed.stepLimitHit, false);
  assert.match(executed.stdout.join('\n'), /42/);
}

test('legacy and relocated APIs produce working programs and source maps', async () => {
  assert.equal(legacy, compileCobolishToPcode);
  traceProgram(import.meta.url, source);
  const compiled = compileCobolishToPcode(source, { fileName: 'working.cob' });
  await verify(compiled.pcodeText, 'Relocated API');
  assert.ok(Object.keys(compiled.programMap.sourceMap).length > 0);
  assert.ok(Object.values(compiled.programMap.sourceMap).every(location => location.sourceFile === 'working.cob'));
});

test('new and legacy CLIs emit executable P-code and program maps', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cobolish-migration-'));
  traceProgram(import.meta.url, source);
  try {
    const input = path.join(root, 'working.cob');
    await fs.writeFile(input, source);
    for (const [index, entry] of [
      new URL('../src/compile-tandem-cobol85-to-pcode.mjs', import.meta.url),
      new URL('../../../virtualMachines/esp32/aggregator/scripts/compile-tandem-cobol85-to-pcode.mjs', import.meta.url)
    ].entries()) {
      const output = path.join(root, `${index}.pcode`);
      const map = path.join(root, `${index}.json`);
      await promisify(execFile)(process.execPath, [fileURLToPath(entry), '--in', input, '--out', output, '--map-out', map]);
      assert.equal(JSON.parse(await fs.readFile(map, 'utf8')).sourceLanguage, 'tandem-cobol85');
      await verify(await fs.readFile(output, 'utf8'), index === 0 ? 'New CLI' : 'Legacy CLI');
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
