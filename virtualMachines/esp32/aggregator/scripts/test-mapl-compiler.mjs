import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { compileMaplWithAntlr } from './compile-mapl-antlr-to-pcode.mjs';

const source = `
map CustomerToAccount from Customer to Account;
  account.name := customer.name;
  account.code := upper(customer.code);
  account.country := customer.country default "UNKNOWN";
  if customer.active = true then
    account.status := customer.status;
  end;
  validate customer.id <> "";
end;
`;

const compiled = compileMaplWithAntlr(source);
const entry = compiled.programMap.entries[0];

assert.equal(entry.id, 'CustomerToAccount');
assert.equal(entry.sourceTypeId, 'Customer');
assert.equal(entry.targetTypeId, 'Account');
assert.equal(entry.items.length, 3);
assert.deepEqual(entry.items[0], {
  sourcePath: 'customer.name',
  targetPath: 'account.name',
  conversionRule: 'OUTPUT := SRC;'
});
assert.equal(entry.items[1].conversionRule, 'OUTPUT := upper(SRC);');
assert.match(compiled.pcodeText, /OP_MAP SRC, "CustomerToAccount", mappedPayload/);
assert.match(compiled.pcodeText, /MAP_RETURN mappedPayload/);
assert.equal(compiled.programMap.compatibility[0].irOnly.length, 3);
assert.throws(() => compileMaplWithAntlr('map broken'), /\[MAPL\] Parse failed/);

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-mapl-authoring-'));
const librarianRoot = path.join(runtimeRoot, 'services', 'librarian');
fs.mkdirSync(librarianRoot, { recursive: true });
fs.writeFileSync(path.join(librarianRoot, 'data-types.json'), JSON.stringify([
  { id: 'swift-mt700', label: 'SWIFT FIN Message - MT700', kind: 'message', isIso: false },
  { id: 'pacs', label: 'ISO 20022 - PACS', kind: 'message', isIso: true },
  { id: 'swift-mt940', label: 'SWIFT FIN Message - MT940', kind: 'message', isIso: false },
  { id: 'camt', label: 'ISO 20022 - CAMT', kind: 'message', isIso: true }
]));

process.env.PULSE_RUNTIME_DATA_ROOT = runtimeRoot;
process.env.PULSE_MAP_EXPORT_ROOT = path.join(runtimeRoot, 'maps');
const { registerMapperRoutes } = await import(`../src/backend/mapperRoutes.mjs?test=${Date.now()}`);
const app = express();
app.use(express.json());
registerMapperRoutes(app);
const server = app.listen(0);
await new Promise(resolve => server.once('listening', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/api/mapper/authoring/deterministic-generate`;

try {
  const validResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      intent: {
        intentKind: 'map-message-type',
        sourceTypeId: 'swift-mt700',
        targetTypeId: 'pacs',
        mapId: 'librarian_map'
      }
    })
  });
  assert.equal(validResponse.status, 201, await validResponse.clone().text());
  const valid = await validResponse.json();
  assert.equal(valid.librarianContracts.source.id, 'swift-mt700');
  assert.equal(valid.librarianContracts.target.id, 'pacs');
  assert.ok(fs.existsSync(valid.stored.pcode));
  assert.ok(fs.existsSync(valid.stored.programMap));

  const mt940Response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'convert an MT940 to a camt message',
      persist: true
    })
  });
  assert.equal(mt940Response.status, 201);
  const mt940 = await mt940Response.json();
  assert.equal(mt940.normalizedIntent.sourceTypeId, 'swift-mt940');
  assert.equal(mt940.normalizedIntent.targetTypeId, 'camt');
  assert.match(mt940.artifacts.mapl, /BkToCstmrStmt/);
  assert.doesNotMatch(mt940.artifacts.mapl, /FIToFICstmrCdtTrf/);
  assert.match(mt940.compiledMapl.pcodeText, /OP_MAP SRC, "mt940_to_camt053", mappedPayload/);
  const externalMap = JSON.parse(fs.readFileSync(path.resolve('data/data-maps/mt940-to-camt053.map'), 'utf8'));
  for (const rule of externalMap.rules) {
    assert.ok(mt940.artifacts.mapl.includes(`${rule.targetPath} := ${rule.sourcePath};`));
    assert.ok(mt940.artifacts.pascalish.includes(`MAP \"${rule.sourcePath.replace(/^source\./, '')}\" TO \"${rule.targetPath.replace(/^target\./, '')}\"`));
  }

  const mt940Message = [
    '{1:F01BANKBEBBAXXX0000000000}{2:I940BANKDEFFXXXXN}{4:',
    ':20:STATEMENT-20260802',
    ':25:DE89370400440532013000',
    ':28C:00001/001',
    ':60F:C260801EUR1234,56',
    ':61:2608020802C250,00NTRFNONREF',
    ':62F:C260802EUR1484,56',
    '-}'
  ].join('\n');
  const runtimeResult = JSON.parse(execFileSync(process.execPath, [
    path.resolve('scripts/run-js-pmachine.mjs'),
    '--pcode', mt940.stored.pcode,
    '--program-map', mt940.stored.programMap,
    '--input-queue', 'swift.mt940.inbound',
    '--message', mt940Message
  ], { encoding: 'utf8' }));
  const mappedPayload = JSON.parse(runtimeResult.globals.mappedPayload);
  assert.deepEqual(runtimeResult.response, mappedPayload);
  const statement = mappedPayload.Document.BkToCstmrStmt.Stmt;
  assert.equal(mappedPayload.Document.BkToCstmrStmt.GrpHdr.MsgId, 'STATEMENT-20260802');
  assert.match(mappedPayload.Document.BkToCstmrStmt.GrpHdr.CreDtTm, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(statement.Id, 'STATEMENT-20260802');
  assert.equal(statement.ElctrncSeqNb, '1');
  assert.equal(statement.LglSeqNb, '1');
  assert.equal(statement.Acct.Id.Othr.Id, 'DE89370400440532013000');
  assert.equal(statement.Bal[0].Tp.CdOrPrtry.Cd, 'OPBD');
  assert.equal(statement.Bal[0].Amt['@Ccy'], 'EUR');
  assert.equal(statement.Bal[0].Amt['#text'], '1234.56');
  assert.equal(statement.Bal[1].Tp.CdOrPrtry.Cd, 'CLBD');
  assert.equal(statement.Bal[1].Amt['#text'], '1484.56');
  assert.equal(statement.Ntry[0].Amt['@Ccy'], 'EUR');
  assert.equal(statement.Ntry[0].Amt['#text'], '250.00');
  assert.equal(statement.Ntry[0].CdtDbtInd, 'CRDT');
  assert.equal(statement.Ntry[0].Sts.Cd, 'BOOK');
  assert.equal(statement.Ntry[0].BkTxCd.Prtry.Cd, 'NTRF');
  assert.equal(mappedPayload.Document['@xmlns'], 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.14');

  const requestedDirectory = path.join(process.env.PULSE_MAP_EXPORT_ROOT, 'MT940_to_camt');
  const streamResponse = await fetch(`${endpoint.replace('/deterministic-generate', '/ollama-intent-stream')}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: `convert an MT940 to a camt message, put the map file into ${requestedDirectory}`
    })
  });
  assert.equal(streamResponse.status, 200);
  const streamEvents = (await streamResponse.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(streamEvents.filter(event => event.type === 'progress').map(event => event.message), [
    'Understanding mapping request',
    'Consulting Data Librarian',
    'Looking at existing maps',
    'Compiling MAPL',
    'Saving generated artifacts',
    `Writing ${path.join(requestedDirectory, 'MT940_to_camt.mapl')}`
  ]);
  const streamResult = streamEvents.find(event => event.type === 'result');
  assert.equal(streamResult.output, mt940.artifacts.mapl);
  assert.equal(streamResult.savedPath, path.join(requestedDirectory, 'MT940_to_camt.mapl'));
  assert.equal(fs.readFileSync(streamResult.savedPath, 'utf8'), mt940.artifacts.mapl);

  const testStreamResponse = await fetch(`${endpoint.replace('/deterministic-generate', '/test-last-stream')}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  assert.equal(testStreamResponse.status, 200);
  const testStreamEvents = (await testStreamResponse.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(testStreamEvents.filter(event => event.type === 'progress').map(event => event.message), [
    'Locating the last generated map',
    'Preparing representative test data',
    'Running the map on the JS p-machine',
    'Formatting input and output'
  ]);
  const testStreamResult = testStreamEvents.find(event => event.type === 'result');
  assert.equal(testStreamResult.mapId, 'mt940_to_camt053');
  assert.match(testStreamResult.input, /:20:STATEMENT-20260802/);
  assert.equal(testStreamResult.outputFormat, 'xml');
  assert.equal(testStreamResult.outputMediaType, 'application/xml');
  assert.match(testStreamResult.output, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(testStreamResult.output, /<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt\.053\.001\.14"/);
  assert.match(testStreamResult.output, /<MsgId>STATEMENT-20260802<\/MsgId>/);
  assert.match(testStreamResult.output, /<Amt Ccy="EUR">250\.00<\/Amt>/);

  const invalidResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      intent: {
        intentKind: 'map-message-type',
        sourceTypeId: 'unknown-input',
        targetTypeId: 'pacs'
      },
      persist: false
    })
  });
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /Data Librarian message formats/);
} finally {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}

console.log('[MAPL-TEST] Compiler, librarian contract, and runtime artifact checks passed');