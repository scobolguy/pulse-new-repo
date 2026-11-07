import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluate } from '../validation/evaluate.mjs';
import { CASES } from '../validation/cases.mjs';
import { runValidation, selectCases } from '../validation/run.mjs';
import { summarizeCoverage, validateInventory } from '../validation/coverage.mjs';
import { compileCsharpToPcode } from '../src/compile-csharp-to-pcode.mjs';
import { parsePcode, executeProgram } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

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
  assert.ok(CASES.length >= 240);
  assert.doesNotThrow(() => validateInventory(CASES));
  assert.equal(new Set(CASES.map(item => item.id)).size, CASES.length);
  for (const item of CASES) {
    assert.match(item.clause, /^\d+(?:\.|;|$)/);
    assert.ok(item.source);
    if (item.diagnostic) assert.doesNotThrow(() => new RegExp(item.diagnostic));
  }
  assert.equal(selectCases(['--suite', 'generics']).cases.length, CASES.filter(item => item.suite === 'generics').length);
  assert.equal(selectCases(['--case', 'CS-GEN-001']).cases.length, 1);
  for (const args of [['--suite', 'unknown'], ['--case', 'missing'], ['--out'], ['--oops', 'value'],
    ['--suite', 'core', '--case', 'CS-GEN-001'], ['--suite', 'core', '--suite', 'core'],
    ['--jobs', '0'], ['--jobs', '9'], ['--jobs', '1.5'], ['--jobs', 'no']])
    assert.throws(() => selectCases(args));
  assert.equal(selectCases(['--jobs', '4']).jobs, 4);
  assert.deepEqual(selectCases(['--suite', 'integers']).cases.map(item => item.id),
    CASES.filter(item => item.feature === 'integers').map(item => item.id));
});

test('invalid corpus entries fail before execution rather than producing success-shaped results', () => {
  const valid = CASES[0];
  for (const cases of [
    [], [valid, valid], [{ ...valid, id: 'bad' }], [{ ...valid, clause: 'not-a-clause' }],
    [{ ...valid, source: '' }], [{ ...valid, stdout: undefined }], [{ ...valid, stdout: [1] }],
    [{ ...valid, kind: 'unknown' }], [{ ...valid, suite: 'unsupported' }],
    [{ ...valid, kind: 'negative', diagnostic: '' }],
    [{ ...valid, kind: 'negative', diagnostic: '[' }],
    [{ ...valid, kind: 'runtime-error', suite: 'runtime', diagnostic: 'fault' }]
  ]) assert.throws(() => validateInventory(cases));
});

test('coverage maps every language chapter without claiming that probes establish conformance', () => {
  const coverage = summarizeCoverage(CASES);
  assert.deepEqual(coverage.map(item => item.chapter), Array.from({ length: 18 }, (_, i) => i + 6));
  assert.ok(coverage.every(item => item.caseIds.length > 0));
  assert.ok(coverage.every(item => item.status !== 'complete'));
  assert.equal(coverage.find(item => item.chapter === 16).status, 'unsupported-probes-only');
  const filtered = summarizeCoverage(selectCases(['--suite', 'generics']).cases);
  assert.equal(filtered.find(item => item.chapter === 16).status, 'not-tested');
  assert.ok(filtered.find(item => item.chapter === 15).supportedCases > 0);
});

test('every supported artifact has a complete source map and every rejection has a located diagnostic', () => {
  for (const item of CASES) {
    const fileName = item.id + '.cs';
    if (['negative', 'unsupported'].includes(item.kind)) {
      assert.throws(() => compileCsharpToPcode(item.source, { fileName }), error => {
        assert.equal(error.name, 'SyntaxError', item.id);
        assert.match(error.message, new RegExp(item.diagnostic), item.id);
        assert.ok(error.message.startsWith(`C# ${fileName}:`), item.id);
        assert.match(error.message, /:\d+:\d+:/, item.id);
        return true;
      }, item.id);
      continue;
    }
    const artifact = compileCsharpToPcode(item.source, { fileName });
    const instructions = parsePcode(artifact.pcodeText);
    const sourceLines = item.source.split('\n');
    assert.equal(artifact.programMap.sourceLanguage, 'csharp', item.id);
    assert.equal(Object.keys(artifact.programMap.sourceMap).length, instructions.length, item.id);
    for (let address = 0; address < instructions.length; address++) {
      const location = artifact.programMap.sourceMap[address];
      assert.ok(location, `${item.id}: instruction ${address}`);
      assert.equal(location.sourceFile, fileName, item.id);
      assert.ok(Number.isInteger(location.sourceLine) && location.sourceLine >= 1
        && location.sourceLine <= sourceLines.length, item.id);
      assert.ok(Number.isInteger(location.sourceColumn) && location.sourceColumn >= 1, item.id);
    }
  }
});

for (const item of CASES.filter(item => item.suite === 'overloads' && item.kind === 'positive')) {
  test(`${item.id} executes distinct overloads on the JavaScript p-machine`, async () => {
    const artifact = compileCsharpToPcode(item.source, { fileName: item.id + '.cs' });
    const result = await executeProgram({
      instructions: parsePcode(artifact.pcodeText), programMap: artifact.programMap,
      inputQueue: '', sourceMessage: '', runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
    });
    assert.equal(evaluate(item, { stage: 'executed', result, procedures: artifact.programMap.procedures }).status, 'pass');
    const signatures = Object.values(artifact.programMap.procedures).map(procedure =>
      `${procedure.signature}<${procedure.typeArguments.join(',')}>`);
    assert.equal(new Set(signatures).size, signatures.length);
  });
}

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
  assert.match(saved.harnessFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(saved.coverage.selection.find(item => item.chapter === 16).status, 'not-tested');
  assert.equal(saved.coverage.inventory.find(item => item.chapter === 16).status, 'unsupported-probes-only');
  const source = await fs.readFile(path.resolve(out, saved.cases[0].sourceFile), 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'), saved.cases[0].sourceSha256);
  const prefix = path.join(out, 'CS-GEN-008', 'CS-GEN-008');
  assert.match(await fs.readFile(prefix + '.pcode', 'utf8'), /CALL/);
  assert.equal(JSON.parse(await fs.readFile(prefix + '.program.json', 'utf8')).sourceLanguage, 'csharp');
});
