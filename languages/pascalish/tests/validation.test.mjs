import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOutput, checkNegative } from '../validation/evaluate.mjs';
import { compilePascalishProgramWithAntlr } from '../src/compile-pascalish-program-antlr-to-pcode.mjs';
import { compilePascalishProgramWithAntlr as legacy } from '../../../virtualMachines/esp32/aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { resolveLibrary } from '../src/pascalish-library-registry.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { onDevice } from '../validation/run.mjs';

test('device validation uses distinct filenames within the LittleFS name limit', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pascalish-device-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const prefix = path.join(dir, 'sample');
  await fs.writeFile(prefix + '.pcode', 'HALT\n');
  await fs.writeFile(prefix + '.program.json', '{}');
  const uploads = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/ffs/upload_stream') {
      const file = parsed.searchParams.get('file');
      assert.ok(Buffer.byteLength(file.slice(1)) <= 32, file);
      uploads.push(file);
      return new Response('File uploaded');
    }
    assert.equal(parsed.pathname, '/pmachine/execute_file');
    assert.deepEqual(uploads.slice(-2), [options.body.get('file'), options.body.get('programMap')]);
    return Response.json({ stdout: ['OK'] });
  });
  for (const name of ['core_control_flow', 'gen_constraints']) {
    assert.equal((await onDevice('http://esp32.test', prefix, ['OK'], name)).status, 'pass');
  }
  assert.equal(new Set(uploads).size, 4);
});

test('legacy compiler entrypoint uses the canonical implementation and libraries', () => {
  assert.equal(legacy, compilePascalishProgramWithAntlr);
  assert.equal(resolveLibrary('JSON').id, 'JSON');
  assert.match(resolveLibrary('JSON').sourcePath, /languages[\\/]pascalish[\\/]libraries/);
});

test('positive validation checks exact stdout, runtime failures and step limits', () => {
  const stdout = ['TEST sample: OK'];
  assert.equal(checkOutput({ stdout }, stdout).status, 'pass');
  for (const result of [
    { stdout: ['TEST sample: FAIL'] }, { stdout: [...stdout, 'extra'] }, {},
    { stdout, runtimeError: 'error' }, { stdout, error: 'error' },
    { stdout, state: { __runtime_error: 'error' } }, { stdout, stepLimitHit: true }
  ]) assert.equal(checkOutput(result, stdout).status, 'fail');
});

test('negative validation does not mistake parser rejection for generic correctness', () => {
  const diagnostic = 'generic.*arity';
  assert.equal(checkNegative({ stage: 'compiled' }, diagnostic).status, 'fail');
  assert.equal(checkNegative({ stage: 'compile-error', error: 'Parse failed: generic arity' }, diagnostic).status, 'blocked');
  assert.equal(checkNegative({ stage: 'compile-error', error: 'Missing library' }, diagnostic).status, 'fail');
  assert.equal(checkNegative({ stage: 'compile-error', error: 'Wrong generic arity' }, diagnostic).status, 'pass');
});
