import fs from 'fs/promises';
import path from 'path';
import { runPL0 } from './pl0-interpreter.mjs';

const ROOT = path.resolve('.');
const CBDS_DIR = path.join(ROOT, 'data', 'cbds');
const MAP_PATH = path.join(CBDS_DIR, 'cbds-mt103-to-pacs008.map.json');
const OUTPUT_JSON = path.join(CBDS_DIR, 'cbds-mt103-to-pacs008-output.json');
const OUTPUT_XML = path.join(CBDS_DIR, 'cbds-mt103-to-pacs008-output.xml');

function parseMt103(mtText) {
  const lines = String(mtText || '').split(/\r?\n/);
  const fields = {};
  let currentTag = null;

  for (const lineRaw of lines) {
    const line = String(lineRaw || '');
    const match = line.match(/^:([0-9]{2}[A-Z]?):(.*)$/);
    if (match) {
      currentTag = match[1];
      fields[currentTag] = match[2] || '';
      continue;
    }
    if (currentTag) {
      fields[currentTag] = `${fields[currentTag]}\n${line}`.trim();
    }
  }

  const f32A = String(fields['32A'] || '');
  const m32A = f32A.match(/^(\d{6})([A-Z]{3})([0-9,\.]+)$/);

  const f33B = String(fields['33B'] || '');
  const m33B = f33B.match(/^([A-Z]{3})([0-9,\.]+)$/);

  return {
    finEnvelope: {
      meta: {
        createdAt: new Date().toISOString(),
      },
      block4: {
        fields: {
          '20': fields['20'] || '',
          '21': fields['21'] || '',
          '23B': fields['23B'] || '',
          '32A': {
            components: {
              valueDate: m32A ? m32A[1] : '',
              currency: m32A ? m32A[2] : '',
              amount: m32A ? m32A[3] : '',
            }
          },
          '33B': {
            components: {
              currency: m33B ? m33B[1] : '',
              amount: m33B ? m33B[2] : '',
            }
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
          '72': fields['72'] || '',
        }
      }
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
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function toXml(name, value, indent = '') {
  if (value == null) return `${indent}<${name}/>`;
  if (typeof value !== 'object') return `${indent}<${name}>${escapeXml(value)}</${name}>`;
  if (Array.isArray(value)) return value.map((item) => toXml(name, item, indent)).join('\n');

  const attrs = [];
  const children = [];
  let textValue = null;

  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('@')) {
      attrs.push(`${k.slice(1)}="${escapeXml(v)}"`);
    } else if (k === '#text') {
      textValue = v;
    } else {
      children.push([k, v]);
    }
  }

  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';

  if (children.length === 0 && textValue == null) {
    return `${indent}<${name}${attrText}/>`;
  }

  if (children.length === 0) {
    return `${indent}<${name}${attrText}>${escapeXml(textValue)}</${name}>`;
  }

  const childXml = children.map(([k, v]) => toXml(k, v, `${indent}  `)).join('\n');
  if (textValue != null) {
    return `${indent}<${name}${attrText}>${escapeXml(textValue)}\n${childXml}\n${indent}</${name}>`;
  }
  return `${indent}<${name}${attrText}>\n${childXml}\n${indent}</${name}>`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function assertEq(actual, expected, label) {
  if (String(actual ?? '') !== String(expected ?? '')) {
    throw new Error(`${label} expected ${expected} but got ${actual}`);
  }
}

async function main() {
  const mt103Sample = [
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

  const map = JSON.parse(await fs.readFile(MAP_PATH, 'utf-8'));
  const parsed = parseMt103(mt103Sample);
  const output = {};

  for (const rule of map.rules || []) {
    const src = getByPath(parsed, rule.sourcePath);
    const code = String(rule.conversionRule || '').trim();
    const vars = code ? runPL0(code, { src, output: src }) : { output: src };
    const out = Object.prototype.hasOwnProperty.call(vars, 'output') ? vars.output : src;
    setByPath(output, rule.targetPath, out);
  }

  await fs.mkdir(CBDS_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${toXml('Document', output.Document, '')}\n`;
  await fs.writeFile(OUTPUT_XML, xml, 'utf-8');

  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId'), 'CBDSREF123456', 'GrpHdr.MsgId');
  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId'), 'CBDS-E2E-0001', 'PmtId.EndToEndId');
  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt'), '2026-07-02', 'IntrBkSttlmDt');
  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy'), 'CAD', 'IntrBkSttlmAmt currency');
  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text'), '12500.45', 'IntrBkSttlmAmt value');
  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm'), 'BETA SUPPLIES INC', 'Creditor name');
  assertEq(getByPath(output, 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr'), 'SHA', 'Charge bearer');

  console.log('CBDS MT103 -> PACS test passed');
  console.log(`Output JSON: ${OUTPUT_JSON}`);
  console.log(`Output XML: ${OUTPUT_XML}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
