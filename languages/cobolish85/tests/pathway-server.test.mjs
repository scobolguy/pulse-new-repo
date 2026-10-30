import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileCobolishToPcode } from '../src/compile-cobolish-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../virtualMachines/esp32/pmachines/javascript/src/service-host.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { createBoundedTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/bounded-text.mjs';
const source = await fs.readFile(new URL('../../../virtualMachines/esp32/pathway/examples/echo.cob', import.meta.url), 'utf8');

test('COBOLish server handles independent requests and emits an ESP32-bounded image', async () => {
  const compiled = compileCobolishToPcode(source, { hostServices: true });
  assert.match(encodeHostedImage(compiled.pcodeText), /^PHI1/);
  assert.deepEqual(compiled.programMap.serviceEndpoints, [{ verb: 'POST', path: '/api/pathway/echo' }]);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pathway-compiler-test', httpPort: null, udpPort: null,
  });
  try {
    await host.start();
    for (const body of ['first', 'second']) {
      const result = await host.dispatch({ method: 'POST', path: '/api/pathway/echo', body: JSON.stringify({ data: body }), peer: 'test' });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { data: body.padEnd(40), code: 0 });
    }
  } finally { await host.stop(); }
});
test('server extensions require explicit hosted compilation and an alphanumeric record', () => {
  assert.throws(() => compileCobolishToPcode(source), /requires hostServices/);
  assert.throws(() => compileCobolishToPcode(source.replace('PIC X(40)', 'PIC 9(4)'), { hostServices: true }), /alphanumeric/);
  assert.throws(() => compileCobolishToPcode(source.replace('PULSE SERVICE echo.', ''), { hostServices: true }), /requires PULSE SERVICE/);
});
test('inventory syntax declares a granted JavaScript-only library and validates complete reply fields', async () => {
  const inventory = source.replace('PIC X(40)', 'PIC X(64)')
    .replace('PROCEDURE DIVISION.', '01 REPLY-TEXT PIC X(96).\nPROCEDURE DIVISION.')
    .replace('PULSE SEND REQUEST-TEXT', 'PULSE INVENTORY REQUEST-TEXT INTO REPLY-TEXT\nPULSE SEND REPLY-TEXT');
  const compiled = compileCobolishToPcode(inventory, { hostServices: true });
  assert.deepEqual(compiled.programMap.targets, ['js']);
  assert.deepEqual(compiled.programMap.requiredHostCapabilities, ['inventory.transaction']);
  assert.match(compiled.pcodeText, /CALL_EXT host\.inventory_apply 2/);
  assert.throws(() => compileCobolishToPcode(inventory), /requires hostServices/);
  assert.throws(() => compileCobolishToPcode(inventory.replace('PIC X(96)', 'PIC X(32)'), { hostServices: true }), /at least 96/);
  assert.throws(() => compileCobolishToPcode(inventory.replace('PIC X(64)', 'PIC 9(4)'), { hostServices: true }), /alphanumeric/);
  await assert.rejects(createPascalishServiceHost({ compiled, collectorId: 'ungranted', httpPort: null, udpPort: null }), /inventory.transaction/);
});

const nativeSource = `IDENTIFICATION DIVISION.
PROGRAM-ID. HOST-CALLS.
PULSE SERVICE host-calls.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 INPUT-TEXT PIC X(64).
01 OUTPUT-TEXT PIC X(96).
01 JSON-TEXT PIC X(256).
01 INTEGER-VALUE PIC S9(9) COMP-5.
PROCEDURE DIVISION.
    PULSE RECEIVE INTO INPUT-TEXT
    COMPUTE INTEGER-VALUE = 513 / 256
    CALL "host.json_set" USING "{}" "quotient" INTEGER-VALUE
        RETURNING JSON-TEXT
    CALL "host.json_set" USING JSON-TEXT "data" INPUT-TEXT
        RETURNING JSON-TEXT
    PULSE SEND JSON-TEXT AS JSON.`;
test('native integer storage, typed host calls and JSON replies need no Pascalish library', async () => {
  const compiled = compileCobolishToPcode(nativeSource, { hostServices: true, nativeTarget: true });
  assert.doesNotMatch(compiled.pcodeText, /PUSH_DEC|DEC_|PROC_COBOL_RT_/);
  assert.match(encodeHostedImage(compiled.pcodeText, { profile: 'extended' }), /^PHI1/);
  const host = await createPascalishServiceHost({ compiled, collectorId: 'native-cobol-abi', httpPort: null, udpPort: null });
  try {
    await host.start();
    const result = await host.dispatch({ method: 'POST', path: '/api/pathway/host-calls', body: '{"data":"  leading spaces  "}' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { quotient: 2, data: '  leading spaces' });
  } finally { await host.stop(); }
});
test('native profile rejects unsupported decimal operations and invalid host call contracts', () => {
  const options = { hostServices: true, nativeTarget: true };
  for (const [from, to, message] of [
    ['PIC S9(9) COMP-5', 'PIC S9(9)', /requires PIC/],
    ['PIC S9(9) COMP-5', 'PIC S9(8)V9 COMP-5', /requires PIC/],
    ['513 / 256', '1.5', /does not support PUSH_DEC/],
    ['513 / 256', '513 / 256 * 256', /standalone COMPUTE/],
    ['513 / 256', '2147483648', /32-bit bounds/],
    ['"quotient" INTEGER-VALUE', 'INTEGER-VALUE INTEGER-VALUE', /argument 2 requires string/],
    ['RETURNING JSON-TEXT', 'RETURNING INTEGER-VALUE', /string receiver/],
    ['"host.json_set"', '"host.no_such_call"', /Unsupported portable host CALL/],
    ['"host.json_set"', '"host.text_trim"', /Unsupported portable host CALL/],
    ['"host.json_set"', '"host.cache_get"', /Unsupported portable host CALL/],
    ['USING "{}" "quotient"', 'USING BY REFERENCE "{}" "quotient"', /BY CONTENT or BY VALUE/],
    ['AS JSON', 'AS XML', /requires JSON/],
  ]) assert.throws(() => compileCobolishToPcode(nativeSource.replace(from, to), options), message);
  const excessFields = Array.from({ length: 129 }, (_, index) => `01 FIELD-${index} PIC S9(9) COMP-5.`).join('\n');
  assert.throws(() => compileCobolishToPcode(nativeSource.replace('PROCEDURE DIVISION.', `${excessFields}\nPROCEDURE DIVISION.`),
    options), /root frame capacity exceeded/);
});
test('COBOL text ABI pads and truncates within 4096 bytes, unpadding only ASCII spaces', () => {
  const b = createBoundedTextBindings();
  assert.equal(b['host.cobol_text']('abc', 5), 'abc  ');
  assert.equal(b['host.cobol_text']('abcdef', 3), 'abc');
  assert.equal(b['host.cobol_text']('', 4096).length, 4096);
  assert.equal(b['host.cobol_unpad']('  abc\n  '), '  abc\n');
  assert.equal(b['host.cobol_unpad']('   '), '');
  for (const [value, width] of [['', 0], ['', 4097], ['x'.repeat(4097), 5], ['\u00e9', 5]]) {
    assert.throws(() => b['host.cobol_text'](value, width), /COBOL text bounds/);
  }
});
