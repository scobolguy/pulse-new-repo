import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { compileMnfToPcode, readFixedForm, MNF_STARTER } from '../src/compile-mnf-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { runPcodeOnEsp32 } from '../../../virtualMachines/esp32/aggregator/scripts/run-pascal-on-esp32-node.mjs';

const fixed = lines => lines.map(line => '      ' + line).join('\n');
const esp32Host = process.env.MNF_ESP32_HOST;
async function run(source) {
  const artifact = compileMnfToPcode(source);
  if (esp32Host) {
    const { sourceMap, ...programMap } = artifact.programMap;
    const { result } = await runPcodeOnEsp32({
      pcodeText: artifact.pcodeText, programMap, node: esp32Host,
      sourceFileName: 'mnf-validation.ftn', inputQueue: 'mnf.test',
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(!result.error, result.error);
    assert.ok(!result.stepLimitHit);
    return result.stdout;
  }
  const mappingsById = new Map();
  mappingsById.__globals = artifact.programMap.globals;
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(), mappingsById,
    queueTypesByName: new Map(), isoTypeIds: new Set(), inputQueue: 'mnf.test',
    sourceMessage: '', runtimeContext: {}
  });
  assert.ok(!result.error, result.error);
  assert.ok(!result.stepLimitHit);
  return result.stdout;
}

test('starter and example execute on the selected p-machine', async () => {
  assert.deepEqual(await run(MNF_STARTER), ['SUM = 55']);
  assert.deepEqual(await run(await fs.readFile(new URL('../examples/nostalgia.ftn', import.meta.url), 'utf8')), ['SUM = 6']);
});
test('integer arithmetic, precedence, powers, real promotion and implicit types', async () => {
  assert.deepEqual(await run(fixed([
    'INTEGER I', 'I=2+3*4', "PRINT, I,',',-2**2,',',(2+3)**2,',',7/2",
    'X=3', 'Y=X/2', "PRINT, 'REAL=',Y", 'END'
  ])), ['14,-4,25,3', 'REAL=1.500000E+00']);
});
test('descending DO, expression bounds evaluated once, and post-test semantics', async () => {
  assert.deepEqual(await run([
    '      INTEGER I,N', '      N=3', '      DO 10 I=N,1,-1', "      PRINT, I",
    '      N=99', '   10 CONTINUE', '      DO 20 I=5,1', "      PRINT, 'ONCE=',I",
    '   20 CONTINUE', '      END'
  ].join('\n')), ['3', '2', '1', 'ONCE=5']);
});
test('nested DO loops can share a terminal label', async () => {
  assert.deepEqual(await run([
    '      DO 10 I=1,2', '      DO 10 J=1,2', "      PRINT, I,':',J", '   10 CONTINUE', '      END'
  ].join('\n')), ['1:1', '1:2', '2:1', '2:2']);
});
test('fixed columns, continuation, comments, sequence field and escaped quotes', async () => {
  const source = [
    'C a comment', '      INTEGER I', '      I=1+', '     +2',
    "      PRINT, 'IT''S ',I".padEnd(72) + '00000001', '      END'
  ].join('\n');
  assert.deepEqual(await run(source), ["IT'S 3"]);
  assert.equal(readFixedForm(source)[1].line, 3);
});
test('labels, GO TO, STOP and source-map instruction positions', async () => {
  const source = ['      GO TO 10', "      PRINT, 'WRONG'", "   10 PRINT, 'OK'", '      STOP', '      END'].join('\n');
  assert.deepEqual(await run(source), ['OK']);
  const artifact = compileMnfToPcode(source, { fileName: 'labels.ftn' });
  assert.equal(artifact.programMap.sourceMap[0].sourceLine, 1);
  assert.equal(artifact.programMap.sourceMap[3].sourceLine, 2);
  assert.equal(Object.keys(artifact.programMap.sourceMap).length, parsePcode(artifact.pcodeText).length);
});
test('unsupported syntax and invalid structures fail explicitly', () => {
  for (const [source, message] of [
    [fixed(['I=1']), /requires END/],
    [fixed(['I=1', 'INTEGER I', 'END']), /Declarations must precede/],
    [fixed(['INTEGER I', 'I=1.5', 'END']), /REAL-to-INTEGER/],
    [fixed(['DO 10 I=1,3,0', 'END']), /nonzero/],
    [fixed(['DO 10 I=1,3', 'END']), /Unterminated DO/],
    [fixed(['DO 10 X=1,3', 'END']), /must be INTEGER/],
    [fixed(['PRINT *, 1', 'END']), /Unsupported statement/],
    [fixed(['READ, I', 'END']), /Unsupported statement/],
    [fixed(['I=2**J', 'END']), /Starter exponent/],
    [fixed(['GO TO 20', 'END']), /Undefined label/],
    [fixed(['I=F(2)', 'END']), /Unsupported expression/],
    ['     +I=1\n      END', /Continuation requires/],
    ['\tI=1\n      END', /Tabs/],
    [fixed(['END', 'I=1']), /after END/]
  ]) assert.throws(() => compileMnfToPcode(source, { standard: 'starter' }), message);
});
