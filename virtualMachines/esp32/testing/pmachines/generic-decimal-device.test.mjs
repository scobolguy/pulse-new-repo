import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../pmachines/javascript/index.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';
import { createDesktopTextBindings } from '../../pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../pmachines/javascript/src/desktop-intrinsic-bindings.mjs';

const target = process.env.PULSE_COBOL_TEST_NODE;
const cases = [
  ['literal and rounded quantization',
    'PUSH_DEC 123456 3\nDEC_QUANT 2 ROUNDED\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['123.46']],
  ['negative truncation',
    'PUSH_DEC -123456 3\nDEC_QUANT 2\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['-123.45']],
  ['string conversion',
    'PUSH_STR "12,34"\nDEC_CONV\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['12.34']],
  ['large exact addition',
    'PUSH_DEC 123456789012345678901234567890 4\nPUSH_DEC 1 4\nADD\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n',
    ['12345678901234567890123456.7891']],
  ['exact subtraction',
    'PUSH_DEC 3 1\nPUSH_DEC 2 1\nSUB\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['0.1']],
  ['exact multiplication',
    'PUSH_DEC 125 2\nPUSH_DEC -2 0\nMUL\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['-2.50']],
  ['exact division',
    'PUSH_DEC 1 0\nPUSH_DEC 8 0\nDIV\nDEC_QUANT 3\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['0.125']],
  ['decimal comparison',
    'PUSH_DEC 10 1\nPUSH_DEC 100 2\nEQ\nPRINT\nPRINT_NL\nHALT\n', ['1']],
  ['separate sign display',
    'PUSH_DEC -1234 2\nDEC_DISPLAY 6 2 TRAILING_SEPARATE\nPRINT\nPRINT_NL\nHALT\n', ['001234-']],
  ['edited mask containing spaces',
    'PUSH_DEC 1234 2\nDEC_EDIT "ZZ9.99 X" 0 0\nPRINT\nPRINT_NL\nHALT\n', [' 12.34 X']],
  ['blank when zero',
    'PUSH_DEC 0 2\nDEC_EDIT "ZZ9.99" 0 1\nPRINT\nPRINT_NL\nHALT\n', ['      ']],
  ['fit check',
    'PUSH_DEC 1234 2\nDEC_FITS 3\nPRINT\nPRINT_NL\nHALT\n', ['0']],
  ['escaped HIGH-VALUES compare correctly',
    'PUSH_STR "\\u00ff"\nPUSH_STR "~"\nGT\nPRINT\nPRINT_NL\nHALT\n', ['1']],
  ['COBOL text intrinsic',
    'PUSH_STR "hello"\nCALL_EXT host.string_upper 1\nPRINT\nPRINT_NL\nHALT\n', ['HELLO']],
  ['COBOL numeric intrinsic',
    'PUSH_DEC 16 0\nCALL_EXT host.math_sqrt 1\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['4']],
  ['decimal root survives collection',
    'PUSH_DEC 12345678901234567890 4\nSTORE SAVED\n' +
      'PUSH_STR "allocation churn"\nSTORE TEMP\n'.repeat(300) +
      'LOAD SAVED\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n', ['1234567890123456.7890']],
  ['whole-variable reference',
    'PUSH_DEC 1234 2\nSTORE A\nPUSH_REF A\nCALL CHANGE 1\nLOAD A\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n' +
      'CHANGE:\nPUSH_DEC 5678 2\nSTORE P\nRET\n', ['56.78'],
    { procedures: { CHANGE: { params: ['P'] } } }],
  ['character slice reference',
    'PUSH_STR "abcdef"\nSTORE A\nPUSH_REF A@1:3\nCALL CHANGE 1\nLOAD A\nPRINT\nPRINT_NL\nHALT\n' +
      'CHANGE:\nPUSH_STR "XYZ"\nSTORE P\nRET\n', ['aXYZef'],
    { procedures: { CHANGE: { params: ['P'] } } }],
  ['nested reference forwarding and padding',
    'PUSH_STR "abcdef"\nSTORE A\nPUSH_REF A@1:3\nCALL CHANGE 1\nLOAD A\nPRINT\nPRINT_NL\nHALT\n' +
      'CHANGE:\nPUSH_REF P\nCALL INNER 1\nRET\nINNER:\nPUSH_STR "Z"\nSTORE Q\nRET\n', ['aZ  ef'],
    { procedures: { CHANGE: { params: ['P'] }, INNER: { params: ['Q'] } } }],
  ['Latin-1 character slice',
    'PUSH_STR "a\\u00e9bc"\nSTORE A\nPUSH_REF A@1:1\nCALL CHANGE 1\nLOAD A\nPRINT\nPRINT_NL\nHALT\n' +
      'CHANGE:\nPUSH_STR "Z"\nSTORE P\nRET\n', ['aZbc'],
    { procedures: { CHANGE: { params: ['P'] } } }],
];

test('generic decimal regression expectations agree with JavaScript', async () => {
  const opcodeMap = await loadOpcodeMap();
  const bindings = { ...createDesktopTextBindings(), ...createDesktopIntrinsicBindings() };
  for (const [name, pcode, stdout, programMap = {}] of cases) {
    const result = await executeProgram({
      instructions: parsePcode(pcode), opcodeMap, programMap,
      runtimeContext: { callHost: (name, args) => bindings[name](...args) },
    });
    assert.ok(!result.error, `${name}: ${result.error}`);
    assert.deepEqual(result.stdout, stdout, name);
  }
});

test('physical generic ESP32 decimal instructions match JavaScript without COBOL dispatch', {
  skip: !target, timeout: 180000,
}, async () => {
  const origin = new URL(target);
  for (const route of ['/pmachine/status', '/pmachine/service_host/status']) {
    const response = await requestEsp32(new URL(route, origin), { timeoutMs: 15000 });
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(await response.text()).running, false, 'Do not interrupt active execution');
  }
  for (const [name, pcode, stdout, programMap = {}] of cases) {
    const response = await requestEsp32(new URL('/pmachine/execute_json', origin), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 25000,
      body: JSON.stringify({
        pcode, programMap: attachPcodeSignature(programMap, pcode),
        inputQueue: 'generic.decimal.test', message: '', stdin: '',
      }),
    });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    const actual = JSON.parse(text);
    assert.equal(actual.ok, true, `${name}: ${text}`);
    assert.equal(actual.stepLimitHit, false, name);
    assert.ok(actual.instructionCount > 1, `${name}: specialized COBOL dispatch must not be used`);
    assert.deepEqual(actual.stdout, stdout, name);
  }
});
