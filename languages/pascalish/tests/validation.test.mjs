import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOutput, checkNegative } from '../validation/evaluate.mjs';
import { compilePascalishProgramWithAntlr } from '../src/compile-pascalish-program-antlr-to-pcode.mjs';
import { compilePascalishProgramWithAntlr as legacy } from '../../../virtualMachines/esp32/aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { resolveLibrary } from '../src/pascalish-library-registry.mjs';

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
