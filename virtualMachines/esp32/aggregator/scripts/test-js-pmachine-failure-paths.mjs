import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

async function testMissingMap(root, tmpDir) {
  const pcodePath = path.join(tmpDir, 'missing-map.pcode');
  const mapPath = path.join(tmpDir, 'missing-map.program.json');

  const pcodeText = [
    'START:',
    'OP_MAP SRC, "missing-map", outPayload',
    'HALT'
  ].join('\n');

  const programMap = {
    runtimeUnit: { kind: 'program', id: 'MissingMapTest' },
    globals: ['outPayload'],
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
      '--input-queue', 'spec.failure',
      '--message', '{"foo":"bar"}'
    ],
    root
  );

  assert.notEqual(run.code, 0, 'missing map should fail with non-zero exit');
  assert.match(`${run.stdout}\n${run.stderr}`, /Mapping not found/i, 'missing map should mention Mapping not found');
}

async function testServiceFailure(root, tmpDir) {
  const pcodePath = path.join(tmpDir, 'service-failure.pcode');
  const mapPath = path.join(tmpDir, 'service-failure.program.json');

  const pcodeText = [
    'START:',
    'SRV_CALL "svc-fail", "http://127.0.0.1:1/unreachable", SRC',
    'STORE callOk',
    'HALT'
  ].join('\n');

  const programMap = {
    runtimeUnit: { kind: 'program', id: 'ServiceFailureTest' },
    globals: ['callOk'],
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
      '--input-queue', 'spec.failure',
      '--message', '{"foo":"bar"}'
    ],
    root
  );

  if (run.code !== 0) {
    throw new Error(`service failure run should complete, got exit ${run.code}: ${run.stderr || run.stdout}`);
  }

  const out = JSON.parse(run.stdout);
  assert.equal(out.globals.callOk, 0, 'service failure should push/store 0');
  assert.equal(out.state.__last_service_call?.success, false, 'service failure should be recorded as unsuccessful');
  assert.equal(out.state.__last_service_call?.serviceId, 'svc-fail', 'service id should be preserved in failure record');
  assert.equal(out.state.__last_service_call?.endpoint, 'http://127.0.0.1:1/unreachable', 'endpoint should be preserved in failure record');
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, '..');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-pmachine-failure-'));

  await testMissingMap(root, tmpDir);
  await testServiceFailure(root, tmpDir);

  console.log('[js-pmachine-failure] PASS: missing-map and service-failure behavior verified');
}

main().catch((error) => {
  console.error('[js-pmachine-failure] FAIL:', error.message);
  process.exitCode = 1;
});
