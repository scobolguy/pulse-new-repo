import assert from 'node:assert/strict';
import test from 'node:test';
import { compileVb11ToPcode } from '../src/compile-vb11.mjs';
import { compileVbishToPcode } from '../src/compile-vbish-to-pcode.mjs';
import { compileVbishWithAntlr } from '../src/vbish-antlr-compiler.mjs';
import { CASES } from '../validation/cases.mjs';
import { summarizeCoverage, validateInventory } from '../validation/coverage.mjs';
import { selectCases } from '../validation/run.mjs';
import { evaluate } from '../../dotnet/validation/evaluate.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

test('VB inventory and selectors distinguish supported tests from unsupported probes', () => {
  validateInventory(CASES);
  assert.ok(CASES.length >= 100);
  assert.equal(new Set(CASES.map(item => item.id)).size, CASES.length);
  assert.equal(summarizeCoverage(CASES).length, 11);
  assert.ok(summarizeCoverage(CASES).every(chapter => chapter.caseIds.length > 0));
  assert.equal(selectCases(['--case', 'VB-CALL-001']).cases.length, 1);
  assert.deepEqual(selectCases(['--suite', 'integers']).cases.map(item => item.id),
    CASES.filter(item => item.feature === 'integers').map(item => item.id));
  for (const args of [['--case', 'missing'], ['--jobs', '0'], ['--out'], ['--suite', 'unknown']])
    assert.throws(() => selectCases(args));
  assert.throws(() => validateInventory([CASES[0], CASES[0]]));
  assert.throws(() => compileVbishToPcode('', { profile: 'unknown' }), /Unknown language profile/);
  assert.equal(compileVbishWithAntlr(CASES[0].source, { profile: 'vb11' }).valid, true);
  assert.equal(compileVbishWithAntlr('not a VB program', { profile: 'vb11' }).valid, false);
  assert.equal(compileVbishWithAntlr('Sub Main()\nDim module As Integer = 1\nPrint module\nEnd Sub').valid, true);
});

for (const item of CASES) {
  test(`${item.id} ${item.clause}`, async () => {
    let artifact, actual;
    try { artifact = compileVb11ToPcode(item.source, { fileName: item.id + '.vb' }); }
    catch (error) {
      actual = { stage: 'compile-error', errorName: error.name, diagnostic: error.message };
      if (error instanceof SyntaxError) assert.match(error.message, /VBish .*\.vb:\d+:\d+:/);
    }
    if (artifact) {
      const instructions = parsePcode(artifact.pcodeText);
      assert.equal(Object.keys(artifact.programMap.sourceMap).length, instructions.length);
      assert.deepEqual(artifact.programMap.targets, ['js']);
      assert.equal(artifact.programMap.languageProfile, 'vb11-scalar');
      try {
        const result = await executeProgram({
          instructions, programMap: artifact.programMap, inputQueue: '', sourceMessage: '',
          runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
        });
        actual = { stage: 'executed', result, procedures: artifact.programMap.procedures };
      } catch (error) {
        actual = { stage: 'runtime-error', errorName: error.name, diagnostic: error.message };
      }
    }
    const evaluated = evaluate(item, actual);
    assert.equal(evaluated.status, item.kind === 'unsupported' ? 'unsupported' : 'pass',
      JSON.stringify({ expected: item, actual, evaluated }));
  });
}
