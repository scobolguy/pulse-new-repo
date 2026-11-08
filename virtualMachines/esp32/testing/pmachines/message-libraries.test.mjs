import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  parseSwiftFinText, normalizeMtAmount, yyMmDdToIso, extractMtPartyName,
  mapMtChargeBearerToIso, messageObjectToXml, expandOutputMessages, maybeConvertIsoDelivery,
} from '../../libraries/swift/messages.mjs';
import { runCompiledMapping, runMappingById } from '../../libraries/messages/mapping.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/index.mjs';

const fin = '{4:\n:20:PAYMENT-1\n:32A:700102USD1234,56\n:50K:/ACCOUNT\nAlice & Bob\nAddress\n:71A:OUR\n-}';
const mapping = {
  sourceTypeId: 'swift-mt103', targetTypeId: 'pacs',
  items: [
    { sourcePath: 'block4.20', targetPath: 'Document.reference', ops: ['SRC'] },
    { sourcePath: 'block4.32A.date', targetPath: 'Document.date', ops: ['SRC', 'YYMMDD_TO_ISO'] },
    { sourcePath: 'block4.32A.amount', targetPath: 'Document.amount', ops: ['SRC', 'MT_AMOUNT_TO_DECIMAL'] },
    { sourcePath: 'block4.50K', targetPath: 'Document.party', ops: ['SRC', 'MT_PARTY_NAME'] },
    { sourcePath: 'block4.71A', targetPath: 'Document.charges', ops: ['SRC', 'MT_CHARGE_TO_ISO'] },
  ],
};

test('message library owns FIN parsing and compiled field conversions', () => {
  assert.deepEqual(parseSwiftFinText(fin).block4['32A'],
    { raw: '700102USD1234,56', date: '700102', currency: 'USD', amount: '1234,56' });
  assert.deepEqual(JSON.parse(runCompiledMapping(mapping, fin)), {
    Document: { reference: 'PAYMENT-1', date: '1970-01-02', amount: '1234.56', party: 'Alice & Bob', charges: 'DEBT' },
  });
  assert.equal(normalizeMtAmount(' 1 234,50 '), '1234.50');
  assert.equal(yyMmDdToIso('690102'), '2069-01-02');
  assert.equal(yyMmDdToIso('not a date'), 'not a date');
  assert.equal(extractMtPartyName('/ACCOUNT\nAlice\nAddress'), 'Alice');
  assert.equal(mapMtChargeBearerToIso('BEN'), 'CRED');
  const mappings = new Map([['payment-mini', mapping]]);
  assert.equal(runMappingById('payment', fin, mappings), runCompiledMapping(mapping, fin));
  assert.throws(() => runMappingById('missing', fin, mappings), /Mapping not found: missing/);
});

test('configured FIN parsing and CAMT namespaces stay in the library', () => {
  const parsed = parseSwiftFinText(':61:260101C123,45\n:86:Invoice', {
    fieldRules: [{ tags: ['61'], pattern: '^(\\d{6})([CD])(.+)$', outputPath: 'entries', append: true,
      values: [
        { targetPath: 'date', capture: 1, transform: 'yymmddToIso' },
        { targetPath: 'amount', capture: 3, transform: 'mtAmountToDecimal' },
      ] }],
    narrative: { tag: '86', entriesPath: 'entries', targetPath: 'memo' },
  });
  assert.deepEqual(parsed.entries, [{ date: '2026-01-01', amount: '123.45', memo: 'Invoice' }]);
  const camt = JSON.parse(runCompiledMapping({
    targetTypeId: 'camt', externalDefinition: { targetNamespace: 'urn:configured:camt' },
    items: [{ sourcePath: 'id', targetPath: 'Document.BkToCstmrStmt.Id', ops: ['SRC'] }],
  }, { id: 'statement' }));
  assert.equal(camt.Document['@xmlns'], 'urn:configured:camt');
  assert.equal(camt.Document['@xmlns:xsi'], 'http://www.w3.org/2001/XMLSchema-instance');
});

test('library output shaping escapes XML and splits PACS JSON/XML batches', () => {
  assert.equal(messageObjectToXml({ Document: { '@id': '"quoted"', party: "Alice & <Bob>'" } }),
    '<?xml version="1.0" encoding="UTF-8"?>\n<Document id="&quot;quoted&quot;">\n  <party>Alice &amp; &lt;Bob&gt;&apos;</party>\n</Document>');
  const batch = { Document: { FIToFICstmrCdtTrf: {
    GrpHdr: { MsgId: 'batch' }, CdtTrfTxInf: [{ Id: 'first' }, { Id: 'second' }],
  } } };
  const json = expandOutputMessages(JSON.stringify(batch)).map(JSON.parse);
  assert.equal(json.length, 2);
  assert.deepEqual(json.map(item => item.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Id), ['first', 'second']);
  assert.ok(json.every(item => item.Document.FIToFICstmrCdtTrf.GrpHdr.MsgId === 'batch'));
  const xml = expandOutputMessages(messageObjectToXml(batch));
  assert.equal(xml.length, 2);
  assert.match(xml[0], /<Id>first<\/Id>/);
  assert.doesNotMatch(xml[0], /<Id>second<\/Id>/);
  assert.match(xml[1], /<Id>second<\/Id>/);
  const shaped = maybeConvertIsoDelivery('out', JSON.stringify(batch), new Map([['out', 'pacs']]));
  assert.match(shaped, /xmlns="urn:iso:std:iso:20022:tech:xsd:pacs\.008\.001\.14"/);
  assert.match(shaped, /<hdr:BizMsgIdr>batch<\/hdr:BizMsgIdr>/);
  assert.equal(maybeConvertIsoDelivery('plain', 'unchanged', new Map()), 'unchanged');
});

test('saved message conversion opcodes remain thin working dispatchers', async () => {
  const result = await executeProgram({
    instructions: parsePcode('PUSH_STR "700102"\nYYMMDD_TO_ISO\nPRINT\nPRINT_NL\n'
      + 'PUSH_STR "1 234,50"\nMT_AMOUNT_TO_DECIMAL\nPRINT\nPRINT_NL\n'
      + 'PUSH_STR "/ACCOUNT\\nAlice\\nAddress"\nMT_PARTY_NAME\nPRINT\nPRINT_NL\n'
      + 'PUSH_STR "BEN"\nMT_CHARGE_TO_ISO\nPRINT\nPRINT_NL\nHALT\n'),
    sourceMessage: '', inputQueue: '',
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.stdout, ['1970-01-02', '1234.50', 'Alice', 'CRED']);
});

test('message conversion implementations are absent from interpreter and HTTP adapter', async () => {
  for (const source of ['pmachines/javascript/src/runtime.mjs', 'pmachines/arduino/src/pmachine.cpp',
    'pmachines/arduino/src/pmachine_routes.cpp']) {
    const text = await readFile(new URL('../../' + source, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /(?:function|bool|String|std::string)\s+(?:applyConversionRule|execCompiledRule|execCompiledMappingOps|runCompiledMapping|runMappingById|evaluateTransformExpr|applyTransformRuleText|applyTransformRule|parseSwiftFinText|parseMT103FinText|buildPacsXmlFromMt)\s*\(/);
  }
});

test('native message and presentation libraries retain their existing field semantics', { timeout: 300000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-message-library-'));
  try {
    const executable = path.join(directory, 'messages.exe');
    const build = spawnSync(process.env.CXX || 'g++', ['-std=c++17', '-DPLATFORM_RPIB=1',
      '-I' + path.join(root, 'raspberry-pi', 'include'), '-I' + path.join(root, 'src'),
      '-I' + path.join(root, '.pio', 'libdeps', 'esp32_s3_pmachine_n8r8', 'ArduinoJson', 'src'),
      path.join(root, 'testing', 'pmachines', 'message-libraries.test.cpp'),
      path.join(root, 'pmachines', 'arduino', 'src', 'scalar_runtime.cpp'), '-o', executable],
    { encoding: 'utf8', windowsHide: true });
    assert.ifError(build.error);
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const run = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
