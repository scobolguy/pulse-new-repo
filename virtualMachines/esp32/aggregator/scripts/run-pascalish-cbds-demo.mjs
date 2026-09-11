import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { compileRouterMapperDSL } from './compile-pascal.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve('.');
const DEMO_DIR = path.join(ROOT, 'data', 'cbds', 'pascalish-demo');

// The Pascalish service under test. Pascalish is the canonical language: the
// mapper is declared inline, and a router binds the MT103 queue through that
// mapper to the PACS.008 output queue. Rules compile to native opcodes.
const PASCALISH_SOURCE = [
  'service "cbds-converter" on local;',
  'role code_librarian;',
  'library "payments-common" from librarian;',
  'use "payments-common" as CORE;',
  'mapper "cbds-mt103-to-pacs008" source "swift-mt103" target "pacs" begin',
  '  map "block4.20" to "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" using "output = trim(src)";',
  '  map "block4.20" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId" using "output = trim(src)";',
  '  map "block4.21" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId" using "output = trim(src)";',
  '  map "block4.23B" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry" using "output = upper(trim(src))";',
  '  map "block4.32A.date" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" using "output = yymmddtoiso(src)";',
  '  map "block4.32A.currency" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" using "output = upper(trim(src))";',
  '  map "block4.32A.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" using "output = mtamounttodecimal(src)";',
  '  map "block4.33B.currency" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy" using "output = upper(trim(src))";',
  '  map "block4.33B.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text" using "output = mtamounttodecimal(src)";',
  '  map "block4.50K" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" using "output = mtpartyname(src)";',
  '  map "block4.52A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI" using "output = upper(trim(src))";',
  '  map "block4.53A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI" using "output = upper(trim(src))";',
  '  map "block4.56A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI" using "output = upper(trim(src))";',
  '  map "block4.57A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI" using "output = upper(trim(src))";',
  '  map "block4.59" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" using "output = mtpartyname(src)";',
  '  map "block4.70" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd" using "output = trim(src)";',
  '  map "block4.71A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr" using "output = mtchargebearertoiso(src)";',
  '  map "block4.71B" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text" using "output = mtamounttodecimal(src)";',
  '  map "block4.72" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf" using "output = trim(src)";',
  '  map "meta.createdAt" to "Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm" using "output = trim(src)";',
  'end;',
  '',
  'begin',
  '  route cbds_mapper from "swift.mt103.parsed" to "cbds.pacs.outbound";',
  'end',
  '.',
  ''
].join('\n');

const MT103_TEXT = [
  'MT103',
  ':20:CBDSREF123456',
  ':21:CBDS-E2E-0001',
  ':23B:CRED',
  ':32A:260702CAD12500,45',
  ':33B:CAD12500,45',
  ':50K:/123456789',
  'ALPHA IMPORTS LTD',
  ':52A:ROYCCAT2',
  ':53A:BOFACATT',
  ':56A:CITIUS33',
  ':57A:TDOMCATTTOR',
  ':59:/000987654321',
  'BETA SUPPLIES INC',
  ':70:INV-2026-07-02',
  ':71A:SHA',
  ':71B:15,00',
  ':72:/INS/CBDS ROUTING'
].join('\n');

function parseMt103ToObject(mtText) {
  const lines = String(mtText || '').split(/\r?\n/);
  const fields = {};
  let currentTag = null;
  for (const lineRaw of lines) {
    const line = String(lineRaw || '');
    const m = line.match(/^:([0-9]{2}[A-Z]?):(.*)$/);
    if (m) { currentTag = m[1]; fields[currentTag] = m[2] || ''; continue; }
    if (currentTag) fields[currentTag] = `${fields[currentTag]}\n${line}`.trim();
  }
  const m32A = String(fields['32A'] || '').match(/^(\d{6})([A-Z]{3})([0-9,.]+)$/);
  const m33B = String(fields['33B'] || '').match(/^([A-Z]{3})([0-9,.]+)$/);
  return {
    block4: {
      '20': fields['20'] || '', '21': fields['21'] || '', '23B': fields['23B'] || '',
      '32A': { date: m32A ? m32A[1] : '', currency: m32A ? m32A[2] : '', amount: m32A ? m32A[3] : '' },
      '33B': { currency: m33B ? m33B[1] : '', amount: m33B ? m33B[2] : '' },
      '50K': fields['50K'] || '', '52A': fields['52A'] || '', '53A': fields['53A'] || '',
      '56A': fields['56A'] || '', '57A': fields['57A'] || '', '59': fields['59'] || '',
      '70': fields['70'] || '', '71A': fields['71A'] || '', '71B': fields['71B'] || '', '72': fields['72'] || ''
    },
    meta: { createdAt: new Date().toISOString() }
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function toXml(name, value, indent = '') {
  if (value == null) return `${indent}<${name}/>`;
  if (typeof value !== 'object') return `${indent}<${name}>${escapeXml(value)}</${name}>`;
  if (Array.isArray(value)) return value.map((item) => toXml(name, item, indent)).join('\n');
  const attrs = [];
  const children = [];
  let textValue = null;
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('@')) attrs.push(`${k.slice(1)}="${escapeXml(v)}"`);
    else if (k === '#text') textValue = v;
    else children.push([k, v]);
  }
  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
  if (children.length === 0 && textValue == null) return `${indent}<${name}${attrText}/>`;
  if (children.length === 0) return `${indent}<${name}${attrText}>${escapeXml(textValue)}</${name}>`;
  const childXml = children.map(([k, v]) => toXml(k, v, `${indent}  `)).join('\n');
  if (textValue != null) return `${indent}<${name}${attrText}>${escapeXml(textValue)}\n${childXml}\n${indent}</${name}>`;
  return `${indent}<${name}${attrText}>\n${childXml}\n${indent}</${name}>`;
}

function section(title) {
  console.log(`\n=== ${title} ${'='.repeat(Math.max(0, 60 - title.length))}`);
}

async function main() {
  await fs.mkdir(DEMO_DIR, { recursive: true });

  const pasPath = path.join(DEMO_DIR, 'cbds-converter.pas');
  await fs.writeFile(pasPath, PASCALISH_SOURCE, 'utf-8');

  // Compile Pascalish directly to pcode + program map.
  const artifact = compileRouterMapperDSL(PASCALISH_SOURCE);
  const programMap = artifact.programMap || {};
  const mapperEntry = (programMap.entries || []).find((e) => e && e.kind === 'mapper' && String(e.id).endsWith('cbds-mt103-to-pacs008'));
  if (!mapperEntry) throw new Error('Pascalish mapper entry was not produced');
  const hasOps = (mapperEntry.items || []).every((item) => Array.isArray(item.ops) && item.ops.length > 0);
  if (!hasOps) throw new Error('Pascalish mapper items are missing compiled ops');

  const pcodePath = path.join(DEMO_DIR, 'cbds-converter.pcode');
  const programMapPath = path.join(DEMO_DIR, 'cbds-converter.program.json');
  await fs.writeFile(pcodePath, artifact.pcodeText, 'utf-8');
  await fs.writeFile(programMapPath, `${JSON.stringify(programMap, null, 2)}\n`, 'utf-8');

  const inputObject = parseMt103ToObject(MT103_TEXT);
  const inputPath = path.join(DEMO_DIR, 'mt103-input.json');
  await fs.writeFile(inputPath, `${JSON.stringify(inputObject, null, 2)}\n`, 'utf-8');

  const { stdout } = await execFileAsync('node', [
    '.\\scripts\\run-js-pmachine.mjs',
    '--pcode', path.relative(ROOT, pcodePath),
    '--program-map', path.relative(ROOT, programMapPath),
    '--input-queue', 'swift.mt103.parsed',
    '--message-file', path.relative(ROOT, inputPath)
  ], { cwd: ROOT, maxBuffer: 2 * 1024 * 1024 });

  const runResult = JSON.parse(stdout);
  if (runResult.error) throw new Error(`PMachine run failed: ${runResult.error}`);
  const delivery = (runResult.deliveries || []).find((d) => d.queueName === 'cbds.pacs.outbound');
  if (!delivery) throw new Error('No cbds.pacs.outbound delivery produced by the Pascalish service');

  const pacsObject = JSON.parse(String(delivery.message || '{}'));
  const outputJsonPath = path.join(DEMO_DIR, 'pacs008-output.json');
  const outputXmlPath = path.join(DEMO_DIR, 'pacs008-output.xml');
  await fs.writeFile(outputJsonPath, `${JSON.stringify(pacsObject, null, 2)}\n`, 'utf-8');
  await fs.writeFile(outputXmlPath, `<?xml version="1.0" encoding="UTF-8"?>\n${toXml('Document', pacsObject.Document, '')}\n`, 'utf-8');

  section('PASCALISH CODE THAT RAN');
  process.stdout.write(PASCALISH_SOURCE);

  section('GENERATED PCODE');
  console.log(String(artifact.pcodeText || '').trim());

  section('COMPILED MAPPER (NATIVE OPCODES, FIRST 6 RULES)');
  for (const item of (mapperEntry.items || []).slice(0, 6)) {
    console.log(`  ${item.sourcePath} -> ${JSON.stringify(item.ops)}`);
  }

  section('INPUT MESSAGE (MT103)');
  console.log(MT103_TEXT);

  section('OUTPUT MESSAGE (PACS.008 JSON)');
  console.log(JSON.stringify(pacsObject, null, 2));

  section('ARTIFACTS');
  for (const p of [pasPath, pcodePath, programMapPath, inputPath, outputJsonPath, outputXmlPath]) {
    console.log(`- ${path.relative(ROOT, p)}`);
  }
  console.log('\n[pascalish-cbds-demo] PASS: Pascalish service converted MT103 to PACS.008 via an inline mapper compiled to native opcodes');
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
