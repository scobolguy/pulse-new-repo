import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { compileCobolishToPmachine } from './compile-interoperable-language.mjs';
import { compileConversionRuleToOps } from './compile-mapping-rule.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve('.');
const DEMO_DIR = path.join(ROOT, 'data', 'cbds', 'cobolish-demo');

// The Cobolish service under test. It declares its librarian role, pulls a
// shared library from the Data Librarian, defines the CBDS mapper inline in a
// MAPPING SECTION of the DATA DIVISION (compiled to native opcodes), and routes
// messages from the MT103 queue through that mapper.
const COBOLISH_SOURCE = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. CBDS-CONVERTER.',
  'PULSE SERVICE "cbds-converter" ON LOCAL.',
  '',
  'ROLE CODE_LIBRARIAN.',
  'LIBRARY "payments-common" FROM LIBRARIAN.',
  'USE "payments-common" AS CORE.',
  'ROUTE "swift.mt103.parsed" TO "cbds.pacs.outbound" USING MAPPER cbds-mt103-to-pacs008.',
  '',
  'DATA DIVISION.',
  'MAPPING SECTION.',
  'MAPPER-ENTRY cbds-mt103-to-pacs008',
  '    SOURCE-TYPE swift-mt103',
  '    TARGET-TYPE pacs.',
  '',
  'MAP-RULE block4.20 TO Document.FIToFICstmrCdtTrf.GrpHdr.MsgId',
  '    USING BEGIN output = trim(src) END.',
  'MAP-RULE block4.20 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId',
  '    USING BEGIN output = trim(src) END.',
  'MAP-RULE block4.21 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId',
  '    USING BEGIN output = trim(src) END.',
  'MAP-RULE block4.23B TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.32A.date TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt',
  '    USING BEGIN output = yymmddtoiso(src) END.',
  'MAP-RULE block4.32A.currency TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.32A.amount TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text',
  '    USING BEGIN output = mtamounttodecimal(src) END.',
  'MAP-RULE block4.33B.currency TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.33B.amount TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text',
  '    USING BEGIN output = mtamounttodecimal(src) END.',
  'MAP-RULE block4.50K TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm',
  '    USING BEGIN output = mtpartyname(src) END.',
  'MAP-RULE block4.52A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.53A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.56A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.57A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI',
  '    USING BEGIN output = upper(trim(src)) END.',
  'MAP-RULE block4.59 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm',
  '    USING BEGIN output = mtpartyname(src) END.',
  'MAP-RULE block4.70 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd',
  '    USING BEGIN output = trim(src) END.',
  'MAP-RULE block4.71A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr',
  '    USING BEGIN output = mtchargebearertoiso(src) END.',
  'MAP-RULE block4.71B TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text',
  '    USING BEGIN output = mtamounttodecimal(src) END.',
  'MAP-RULE block4.72 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf',
  '    USING BEGIN output = trim(src) END.',
  'MAP-RULE meta.createdAt TO Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm',
  '    USING BEGIN output = trim(src) END.',
  '',
  'PROCEDURE DIVISION.',
  '    DISPLAY "CBDS-CONVERTER READY".',
  '    GOBACK.',
  'END PROGRAM CBDS-CONVERTER.',
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
    if (m) {
      currentTag = m[1];
      fields[currentTag] = m[2] || '';
      continue;
    }
    if (currentTag) {
      fields[currentTag] = `${fields[currentTag]}\n${line}`.trim();
    }
  }

  const m32A = String(fields['32A'] || '').match(/^(\d{6})([A-Z]{3})([0-9,.]+)$/);
  const m33B = String(fields['33B'] || '').match(/^([A-Z]{3})([0-9,.]+)$/);

  return {
    block4: {
      '20': fields['20'] || '',
      '21': fields['21'] || '',
      '23B': fields['23B'] || '',
      '32A': { date: m32A ? m32A[1] : '', currency: m32A ? m32A[2] : '', amount: m32A ? m32A[3] : '' },
      '33B': { currency: m33B ? m33B[1] : '', amount: m33B ? m33B[2] : '' },
      '50K': fields['50K'] || '',
      '52A': fields['52A'] || '',
      '53A': fields['53A'] || '',
      '56A': fields['56A'] || '',
      '57A': fields['57A'] || '',
      '59': fields['59'] || '',
      '70': fields['70'] || '',
      '71A': fields['71A'] || '',
      '71B': fields['71B'] || '',
      '72': fields['72'] || ''
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

  const cobolishPath = path.join(DEMO_DIR, 'cbds-converter.cob');
  await fs.writeFile(cobolishPath, COBOLISH_SOURCE, 'utf-8');

  // Compile Cobolish -> portable Pascalish -> pcode + program map. The inline
  // MAPPING SECTION becomes a mapper entry whose rules are compiled to native
  // opcodes (no runtime string interpretation).
  const artifact = compileCobolishToPmachine(COBOLISH_SOURCE, { fileName: 'cbds-converter.cob' });
  if (!artifact.native?.valid) {
    throw new Error(`Cobolish parse failed:\n${(artifact.native?.syntaxErrors || []).join('\n')}`);
  }

  const programMap = artifact.programMap || {};
  // Inline mappers are namespaced under the service id by the Pascalish
  // compiler (e.g. "cbds-converter.cbds-mt103-to-pacs008").
  const mapperEntry = (programMap.entries || []).find((e) => e && e.kind === 'mapper' && String(e.id).endsWith('cbds-mt103-to-pacs008'));
  if (!mapperEntry) throw new Error('MAPPING SECTION did not produce a cbds-mt103-to-pacs008 mapper entry');
  for (const item of mapperEntry.items || []) {
    if (!item.ops) item.ops = compileConversionRuleToOps(item.conversionRule);
  }

  const pcodePath = path.join(DEMO_DIR, 'cbds-converter.pcode');
  const programMapPath = path.join(DEMO_DIR, 'cbds-converter.program.json');
  const portablePath = path.join(DEMO_DIR, 'cbds-converter.portable.pas');
  await fs.writeFile(pcodePath, artifact.pcodeText, 'utf-8');
  await fs.writeFile(programMapPath, `${JSON.stringify(programMap, null, 2)}\n`, 'utf-8');
  await fs.writeFile(portablePath, `${artifact.portableSource}\n`, 'utf-8');

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
  if (!delivery) throw new Error('No cbds.pacs.outbound delivery produced by the Cobolish service');

  const pacsObject = JSON.parse(String(delivery.message || '{}'));
  const outputJsonPath = path.join(DEMO_DIR, 'pacs008-output.json');
  const outputXmlPath = path.join(DEMO_DIR, 'pacs008-output.xml');
  await fs.writeFile(outputJsonPath, `${JSON.stringify(pacsObject, null, 2)}\n`, 'utf-8');
  await fs.writeFile(outputXmlPath, `<?xml version="1.0" encoding="UTF-8"?>\n${toXml('Document', pacsObject.Document, '')}\n`, 'utf-8');

  section('COBOLISH CODE THAT RAN');
  process.stdout.write(COBOLISH_SOURCE);

  section('GENERATED PORTABLE PASCALISH (COMPILED FROM COBOLISH)');
  console.log(artifact.portableSource);

  section('COMPILED MAPPER (NATIVE OPCODES, FIRST 6 RULES)');
  for (const item of (mapperEntry.items || []).slice(0, 6)) {
    console.log(`  ${item.sourcePath} -> ${JSON.stringify(item.ops)}`);
  }

  section('GENERATED PCODE');
  console.log(String(artifact.pcodeText || '').trim());

  section('INPUT MESSAGE (MT103)');
  console.log(MT103_TEXT);

  section('OUTPUT MESSAGE (PACS.008 JSON)');
  console.log(JSON.stringify(pacsObject, null, 2));

  section('ARTIFACTS');
  for (const p of [cobolishPath, portablePath, pcodePath, programMapPath, inputPath, outputJsonPath, outputXmlPath]) {
    console.log(`- ${path.relative(ROOT, p)}`);
  }
  console.log('\n[cobolish-cbds-demo] PASS: Cobolish service converted MT103 to PACS.008 via an inline MAPPING SECTION compiled to native opcodes');
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
