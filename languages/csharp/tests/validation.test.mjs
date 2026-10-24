import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluate } from '../validation/evaluate.mjs';
import { CASES } from '../validation/cases.mjs';
import { runValidation, selectCases } from '../validation/run.mjs';

test('positive validation checks exact stdout, error flags, limits, exit codes and specialization identities', () => {
  const spec = { kind: 'positive', stdout: ['OK'], exitCode: 5, specializations: { Id: [['int']] } };
  const correct = {
    stage: 'executed', result: { stdout: ['OK'], globals: { CS_EXIT_CODE: 5 } },
    procedures: { ID: { name: 'Id', typeArguments: ['int'] } }
  };
  assert.equal(evaluate(spec, correct).status, 'pass');
  for (const result of [
    {}, { stdout: ['OK', 'extra'] }, { stdout: ['wrong'] },
    { ...correct.result, error: 'fault' }, { ...correct.result, runtimeError: 'fault' },
    { ...correct.result, state: { __runtime_error: 'fault' } },
    { ...correct.result, state: { __orch_error: 'fault' } },
    { ...correct.result, stepLimitHit: true }, { ...correct.result, globals: { CS_EXIT_CODE: 0 } }
  ]) assert.equal(evaluate(spec, { ...correct, result }).status, 'fail');
  assert.equal(evaluate(spec, { ...correct, procedures: {} }).status, 'fail');
  assert.equal(evaluate(spec, { ...correct, procedures: { ...correct.procedures, DUPLICATE: correct.procedures.ID } }).status, 'fail');
  assert.equal(evaluate(spec, null).status, 'fail');
  assert.equal(evaluate(spec, { stage: 'compiled' }).status, 'fail');
});

test('negative cases cannot pass on compiler crashes, missing files, unrelated rejection or runtime faults', () => {
  const spec = { kind: 'negative', diagnostic: 'unassigned local' };
  const diagnostic = { stage: 'compile-error', errorName: 'SyntaxError', diagnostic: 'Use of unassigned local' };
  assert.equal(evaluate(spec, diagnostic).status, 'pass');
  assert.equal(evaluate({ ...spec, kind: 'unsupported' }, diagnostic).status, 'unsupported');
  for (const actual of [
    { ...diagnostic, errorName: 'TypeError' }, { ...diagnostic, diagnostic: 'ENOENT' },
    { ...diagnostic, stage: 'runtime-error' }, { stage: 'compiled' }
  ]) assert.equal(evaluate(spec, actual).status, 'fail');
});

test('runtime-error cases must compile and fault with the expected exception', () => {
  const spec = { kind: 'runtime-error', diagnostic: 'DivideByZero', errorName: 'RangeError' };
  assert.equal(evaluate(spec, { stage: 'runtime-error', diagnostic: 'System.DivideByZeroException', errorName: 'RangeError' }).status, 'pass');
  for (const actual of [
    { stage: 'compile-error', diagnostic: 'DivideByZero', errorName: 'RangeError' },
    { stage: 'runtime-error', diagnostic: 'other', errorName: 'RangeError' },
    { stage: 'runtime-error', diagnostic: 'DivideByZero', errorName: 'TypeError' },
    { stage: 'executed', result: { stdout: ['0'] } }
  ]) assert.equal(evaluate(spec, actual).status, 'fail');
});

test('validation inventory includes clauses, distinct ids and separate unsupported-feature accounting', () => {
  assert.ok(CASES.length >= 60);
  assert.equal(new Set(CASES.map(item => item.id)).size, CASES.length);
  for (const item of CASES) {
    assert.match(item.clause, /^\d+(?:\.|$)/);
    assert.ok(item.source);
    if (item.diagnostic) assert.doesNotThrow(() => new RegExp(item.diagnostic));
  }
  assert.equal(selectCases(['--suite', 'generics']).cases.length, CASES.filter(item => item.suite === 'generics').length);
  assert.equal(selectCases(['--case', 'CS-GEN-001']).cases.length, 1);
  for (const args of [['--suite', 'unknown'], ['--case', 'missing'], ['--out'], ['--oops', 'value'],
    ['--suite', 'core', '--case', 'CS-GEN-001'], ['--suite', 'core', '--suite', 'core']])
    assert.throws(() => selectCases(args));
});

test('isolated validation persists a complete report, source and runnable p-code artifacts', async t => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-csharp-validation-'));
  t.after(() => fs.rm(out, { recursive: true, force: true }));
  const report = await runValidation(['--case', 'CS-GEN-008', '--out', out]);
  const saved = JSON.parse(await fs.readFile(path.join(out, 'results.json'), 'utf8'));
  assert.deepEqual(saved, report);
  assert.equal(saved.complete, true);
  assert.equal(saved.selectedCases, 1);
  assert.equal(saved.counts.pass, 1);
  assert.equal(saved.counts.fail, 0);
  assert.equal(saved.fullStandardConformance, false);
  assert.equal(saved.target, 'js');
  assert.match(saved.compilerFingerprint, /^[a-f0-9]{64}$/);
  const source = await fs.readFile(path.resolve(out, saved.cases[0].sourceFile), 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'), saved.cases[0].sourceSha256);
  const prefix = path.join(out, 'CS-GEN-008', 'CS-GEN-008');
  assert.match(await fs.readFile(prefix + '.pcode', 'utf8'), /CALL/);
  assert.equal(JSON.parse(await fs.readFile(prefix + '.program.json', 'utf8')).sourceLanguage, 'csharp');
});
