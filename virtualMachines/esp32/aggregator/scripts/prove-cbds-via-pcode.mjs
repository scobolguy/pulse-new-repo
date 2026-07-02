import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve('.');
const CBDS_DIR = path.join(ROOT, 'data', 'cbds');
const OUT_DIR = path.join(CBDS_DIR, 'pcode-proof');

const PCODE_PATH = path.join('..', 'pcode', 'cbds-router-mapper.pcode');
const MAP_PATH = path.join('..', 'pcode', 'cbds-router-mapper.program.json');

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

  const m32A = String(fields['32A'] || '').match(/^(\d{6})([A-Z]{3})([0-9,\.]+)$/);
  const m33B = String(fields['33B'] || '').match(/^([A-Z]{3})([0-9,\.]+)$/);

  return {
    block4: {
      '20': fields['20'] || '',
      '21': fields['21'] || '',
      '23B': fields['23B'] || '',
      '32A': {
        date: m32A ? m32A[1] : '',
        currency: m32A ? m32A[2] : '',
        amount: m32A ? m32A[3] : ''
      },
      '33B': {
        currency: m33B ? m33B[1] : '',
        amount: m33B ? m33B[2] : ''
      },
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
    meta: {
      createdAt: new Date().toISOString()
    }
  };
}

function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.').map((part) => part.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setByPath(target, dottedPath, value) {
  const parts = String(dottedPath || '').split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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

async function main() {
  await fs.mkdir(CBDS_DIR, { recursive: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const mt103Text = [
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
    ':72:/INS/CBDS ROUTING',
  ].join('\n');

  const srcObj = parseMt103ToObject(mt103Text);
  const sourceJsonPath = path.join(CBDS_DIR, 'cbds-mt103-input-for-pcode.json');
  await fs.writeFile(sourceJsonPath, `${JSON.stringify(srcObj, null, 2)}\n`, 'utf-8');

  const pcodeText = [
    '# Manual pcode proof for CBDS MT103->PACS',
    'ENTRY:',
    'ROUTE_MATCH_QUEUE "swift.mt103.parsed"',
    'JZ FINISH',
    "ROUTE_TRANSFORM \"output := map('cbds-mt103-to-pacs008', src);\"",
    'ROUTE_EMIT "cbds.pacs.outbound"',
    'FINISH:',
    'HALT',
    ''
  ].join('\n');

  const programMap = {
    version: 1,
    serviceId: 'cbds-pcode-proof',
    runtimeUnit: {
      kind: 'service',
      id: 'cbds-pcode-proof',
      refreshMs: null
    },
    entries: [
      {
        kind: 'mapper',
        id: 'cbds-mt103-to-pacs008',
        sourceTypeId: 'swift-mt103',
        targetTypeId: 'pacs',
        items: [
          { sourcePath: 'block4.20', targetPath: 'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId', conversionRule: 'output := trim(src);' },
          { sourcePath: 'block4.20', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId', conversionRule: 'output := trim(src);' },
          { sourcePath: 'block4.21', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId', conversionRule: 'output := trim(src);' },
          { sourcePath: 'block4.23B', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.32A.date', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt', conversionRule: 'output := yymmddtoiso(src);' },
          { sourcePath: 'block4.32A.currency', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.32A.amount', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text', conversionRule: 'output := mtamounttodecimal(src);' },
          { sourcePath: 'block4.33B.currency', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.33B.amount', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text', conversionRule: 'output := mtamounttodecimal(src);' },
          { sourcePath: 'block4.50K', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm', conversionRule: 'output := mtpartyname(src);' },
          { sourcePath: 'block4.52A', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.53A', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.56A', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.57A', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI', conversionRule: 'output := upper(trim(src));' },
          { sourcePath: 'block4.59', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm', conversionRule: 'output := mtpartyname(src);' },
          { sourcePath: 'block4.70', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd', conversionRule: 'output := trim(src);' },
          { sourcePath: 'block4.71A', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr', conversionRule: 'output := mtchargebearertoiso(src);' },
          { sourcePath: 'block4.71B', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text', conversionRule: 'output := mtamounttodecimal(src);' },
          { sourcePath: 'block4.72', targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf', conversionRule: 'output := trim(src);' },
          { sourcePath: 'meta.createdAt', targetPath: 'Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm', conversionRule: 'output := trim(src);' }
        ]
      }
    ]
  };

  const pcodeAbsPath = path.resolve(ROOT, PCODE_PATH);
  const mapAbsPath = path.resolve(ROOT, MAP_PATH);
  await fs.mkdir(path.dirname(pcodeAbsPath), { recursive: true });
  await fs.mkdir(path.dirname(mapAbsPath), { recursive: true });
  await fs.writeFile(pcodeAbsPath, pcodeText, 'utf-8');
  await fs.writeFile(mapAbsPath, `${JSON.stringify(programMap, null, 2)}\n`, 'utf-8');

  const { stdout } = await execFileAsync('node', [
    '.\\scripts\\run-js-pmachine.mjs',
    '--pcode', PCODE_PATH,
    '--program-map', MAP_PATH,
    '--input-queue', 'swift.mt103.parsed',
    '--message-file', '.\\data\\cbds\\cbds-mt103-input-for-pcode.json'
  ], { cwd: ROOT, maxBuffer: 2 * 1024 * 1024 });

  const runResult = JSON.parse(stdout);
  const delivery = Array.isArray(runResult.deliveries) ? runResult.deliveries.find((d) => d.queueName === 'cbds.pacs.outbound') : null;
  if (!delivery) throw new Error('No cbds.pacs.outbound delivery produced by pcode VM');

  const pacsObj = JSON.parse(String(delivery.message || '{}'));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${toXml('Document', pacsObj.Document, '')}\n`;

  const resultJsonPath = path.join(OUT_DIR, 'cbds-pcode-run-result.json');
  const pacsJsonPath = path.join(OUT_DIR, 'cbds-pcode-transformed-pacs.json');
  const pacsXmlPath = path.join(OUT_DIR, 'cbds-pcode-transformed-pacs.xml');

  await fs.writeFile(resultJsonPath, `${JSON.stringify(runResult, null, 2)}\n`, 'utf-8');
  await fs.writeFile(pacsJsonPath, `${JSON.stringify(pacsObj, null, 2)}\n`, 'utf-8');
  await fs.writeFile(pacsXmlPath, xml, 'utf-8');

  // Proof assertions (through pcode output)
  const assert = (actual, expected, label) => {
    if (String(actual ?? '') !== String(expected ?? '')) {
      throw new Error(`${label} expected ${expected} but got ${actual}`);
    }
  };

  assert(getByPath(pacsObj, 'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId'), 'CBDSREF123456', 'MsgId');
  assert(getByPath(pacsObj, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId'), 'CBDS-E2E-0001', 'EndToEndId');
  assert(getByPath(pacsObj, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt'), '2026-07-02', 'IntrBkSttlmDt');
  assert(getByPath(pacsObj, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy'), 'CAD', 'IntrBkSttlmAmt currency');
  assert(getByPath(pacsObj, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text'), '12500.45', 'IntrBkSttlmAmt amount');

  const proofSummary = {
    proof: 'pcode-engine-transform',
    dslPath: null,
    compileMode: 'manual-pcode-and-program-map',
    pcodePath: path.relative(ROOT, path.resolve(ROOT, PCODE_PATH)),
    programMapPath: path.relative(ROOT, path.resolve(ROOT, MAP_PATH)),
    runtimeOutput: path.relative(ROOT, resultJsonPath),
    transformedJson: path.relative(ROOT, pacsJsonPath),
    transformedXml: path.relative(ROOT, pacsXmlPath),
    assertions: 'passed'
  };

  const summaryPath = path.join(OUT_DIR, 'cbds-pcode-proof-summary.json');
  await fs.writeFile(summaryPath, `${JSON.stringify(proofSummary, null, 2)}\n`, 'utf-8');

  console.log('CBDS pcode proof passed');
  console.log(`- ${summaryPath}`);
  console.log(`- ${resultJsonPath}`);
  console.log(`- ${pacsJsonPath}`);
  console.log(`- ${pacsXmlPath}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
