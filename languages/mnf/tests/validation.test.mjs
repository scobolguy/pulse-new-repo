import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('../validation/run.mjs', import.meta.url));

test('corpus runner records exact passes, unsupported programs, mismatches and timeouts', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-fortran-validation-'));
  const report = path.join(directory, 'report.json');
  try {
    for (const [file, status, extra] of [
      ['FM002', 'passed', []],
      ['FM900', 'passed', []],
      ['FM905', 'passed', []],
      ['FM002', 'timeout', ['--timeout', '1']],
    ]) {
      const command = exec(process.execPath, [runner, '--filter', file, '--report', report, ...extra], { timeout: 30000 });
      if (status === 'passed') await command;
      else await assert.rejects(command, error => error.code === 1);
      const result = JSON.parse(await fs.readFile(report, 'utf8'));
      assert.equal(result.total, 1);
      assert.deepEqual(result.counts, { [status]: 1 });
      assert.equal(result.results[0].status, status);
      if (status === 'output_mismatch') assert.ok(result.results[0].difference.line > 0);
    }
    const file = path.join(directory, 'fixture.f');
    for (const [source, expected] of [
      ['      THIS IS NOT A PROGRAM\n', 'compile_error'],
      ['      READ(*,*) I\n      END\n', 'runtime_error'],
      ['      WRITE(*,*) 42\n      END\n', 'output_mismatch'],
    ]) {
      await fs.writeFile(file, source);
      await fs.writeFile(file.replace('.f', '.reference_output'), 'not the output\n');
      const { stdout } = await exec(process.execPath, [runner, '--worker', file], { timeout: 30000 });
      assert.equal(JSON.parse(stdout).status, expected);
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
