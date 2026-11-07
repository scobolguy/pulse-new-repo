import assert from 'node:assert/strict';
import test from 'node:test';
import { compileCsharpToPcode } from '../src/compile-csharp-to-pcode.mjs';
import { CASES } from '../validation/cases.mjs';
import { evaluate } from '../../dotnet/validation/evaluate.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

for (const item of CASES.filter(item => ['numeric', 'integers'].includes(item.feature))) {
  test(`${item.id} Int32 contexts and scalar conversions`, async () => {
    let artifact, actual;
    try { artifact = compileCsharpToPcode(item.source, { fileName: item.id + '.cs' }); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      assert.match(error.message, /C# .*\.cs:\d+:\d+:/);
      actual = { stage: 'compile-error', errorName: error.name, diagnostic: error.message };
    }
    if (artifact) {
      const instructions = parsePcode(artifact.pcodeText);
      assert.equal(Object.keys(artifact.programMap.sourceMap).length, instructions.length);
      try {
        const result = await executeProgram({
          instructions, programMap: artifact.programMap, inputQueue: '', sourceMessage: '',
          runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
        });
        actual = { stage: 'executed', result, procedures: artifact.programMap.procedures };
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        actual = { stage: 'runtime-error', errorName: error.name, diagnostic: error.message };
      }
    }
    const result = evaluate(item, actual);
    assert.equal(result.status, 'pass', JSON.stringify({ item, actual, result }));
  });
}
