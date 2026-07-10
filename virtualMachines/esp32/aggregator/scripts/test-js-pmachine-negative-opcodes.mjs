import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function expectEqual(label, actual, expected) {
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
}

function runNode(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, '..');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-pmachine-neg-'));
  const pcodePath = path.join(tmpDir, 'negative-opcodes.pcode');
  const mapPath = path.join(tmpDir, 'negative-opcodes.program.json');

  const pcodeText = [
    'START:',
    'BQ_NEW_DYNAMIC qneg',
    'BQ_DEQ qneg, qOut',
    'STK_NEW_DYNAMIC sneg',
    'STK_POP sneg, sOut',
    'PQ_NEW_DYNAMIC pneg',
    'PQ_DEQ pneg, pOut',
    'FILE_READ 999, badRead',
    'FILE_CLOSE 999',
    'HALT'
  ].join('\n');

  const programMap = {
    runtimeUnit: { kind: 'program', id: 'NegativeOpcodes' },
    globals: ['qOut', 'sOut', 'pOut', 'badRead'],
    entries: [],
    procedures: {}
  };

  await fs.writeFile(pcodePath, pcodeText, 'utf-8');
  await fs.writeFile(mapPath, JSON.stringify(programMap, null, 2), 'utf-8');

  const run = await runNode(
    [
      'scripts/run-js-pmachine.mjs',
      '--pcode', pcodePath,
      '--program-map', mapPath,
      '--input-queue', 'spec.negative',
      '--message', '{}'
    ],
    root
  );

  if (run.code !== 0) {
    throw new Error(`run-js-pmachine failed (${run.code}): ${run.stderr || run.stdout}`);
  }

  let output;
  try {
    output = JSON.parse(run.stdout);
  } catch (error) {
    throw new Error(`Unable to parse JS PMachine output JSON: ${error.message}\n${run.stdout}`);
  }

  expectEqual('runtime', output.runtime, 'js-pmachine');
  expectEqual('queue underflow marker', output.state.__queue_underflow, 'queue:qneg');
  expectEqual('stack underflow marker', output.state.__stack_underflow, 'stack:sneg');
  expectEqual('priority queue underflow marker', output.state.__pqueue_underflow, 'pqueue:pneg');

  expectEqual('dequeue fallback value', output.globals.qOut, 0);
  expectEqual('stack pop fallback value', output.globals.sOut, 0);
  expectEqual('pqueue dequeue fallback value', output.globals.pOut, 0);
  expectEqual('invalid file handle read fallback', output.globals.badRead, '');

  console.log('[js-pmachine-negative] PASS: underflow and invalid-handle behavior verified');
}

main().catch((error) => {
  console.error('[js-pmachine-negative] FAIL:', error.message);
  process.exitCode = 1;
});
