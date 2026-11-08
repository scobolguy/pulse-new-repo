import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const target = process.env.PULSE_MESSAGE_TEST_NODE;

test('ESP32 executes library-backed message conversion opcodes and compiled mappings', {
  skip: !target, timeout: 180000,
}, async () => {
  for (const route of ['/pmachine/status', '/pmachine/service_host/status']) {
    const response = await requestEsp32(new URL(route, target), { timeoutMs: 15000 });
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(await response.text()).running, false, 'Board must be idle');
  }
  const cases = [
    ['date pivot', 'PUSH_STR "700102"\nYYMMDD_TO_ISO\nPRINT\nPRINT_NL\nHALT\n', ['1970-01-02']],
    ['amount', 'PUSH_STR "1 234,50"\nMT_AMOUNT_TO_DECIMAL\nPRINT\nPRINT_NL\nHALT\n', ['1234.50']],
    ['native multiline party', 'PUSH_STR "/ACCOUNT\\nAlice\\nAddress"\nMT_PARTY_NAME\nPRINT\nPRINT_NL\nHALT\n',
      ['Alice\nAddress']],
    ['native charge code', 'PUSH_STR "OUR"\nMT_CHARGE_TO_ISO\nPRINT\nPRINT_NL\nHALT\n', ['OUR']],
    ['compiled mapping', 'OP_MAP SRC, "payment"\nPRINT\nPRINT_NL\nHALT\n',
      ['{"Document":{"amount":"1234.50","date":"1970-01-02"}}'],
      { entries: [{ kind: 'mapper', id: 'payment', sourceTypeId: 'json', targetTypeId: 'pacs', items: [
        { sourcePath: 'amount', targetPath: 'Document.amount', ops: ['SRC', 'MT_AMOUNT_TO_DECIMAL'] },
        { sourcePath: 'date', targetPath: 'Document.date', ops: ['SRC', 'YYMMDD_TO_ISO'] },
      ] }] }, '{"amount":"1 234,50","date":"700102"}'],
  ];
  for (const [name, pcode, expected, programMap = {}, message = ''] of cases) {
    const response = await requestEsp32(new URL('/pmachine/execute_json', target), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 25000,
      body: JSON.stringify({
        pcode, programMap: attachPcodeSignature(programMap, pcode),
        inputQueue: 'library.conversion.test', message, stdin: '',
      }),
    });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    const result = JSON.parse(text);
    assert.equal(result.ok, true, `${name}: ${text}`);
    assert.ok(result.instructionCount > 1);
    assert.deepEqual(result.stdout, expected, name);
  }
  const pcode = 'ROUTE_MAP_RUN missing-mapper\nROUTE_EMIT must-not-deliver\nHALT\n';
  const response = await requestEsp32(new URL('/pmachine/execute_json', target), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 25000,
    body: JSON.stringify({
      pcode, programMap: attachPcodeSignature({}, pcode),
      inputQueue: 'library.conversion.test', message: 'unchanged', stdin: '',
    }),
  });
  const text = await response.text();
  const result = JSON.parse(text);
  assert.equal(result.ok, false, text);
  assert.match(JSON.stringify(result), /Mapping not found: missing-mapper/);
});
