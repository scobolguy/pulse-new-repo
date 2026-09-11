import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { compileVbishToPmachine } from './compile-interoperable-language.mjs';
import { compileConversionRuleToOps, emitMapperRoutinePcode } from './compile-mapping-rule.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve('.');
const DEMO_DIR = path.join(ROOT, 'data', 'cbds', 'vbish-demo');
const MAPPER_LIBRARY_PATH = path.resolve(ROOT, '..', 'pcode', 'cbds-router-mapper.program.json');

// The VBish service under test. It declares its librarian role, pulls a shared
// library from the Data Librarian, imports the CBDS mapper from the Mapping
// Librarian, and routes messages from the MT103 queue through that mapper.
const VBISH_SOURCE = [
  'Service "vbish-mt103-to-pacs008" On Local',
  '',
  'Role Code_Librarian',
  'Library "payments-common" From Librarian',
  'Use "payments-common" As Core',
  'Import Mapper "cbds-mt103-to-pacs008" From Mapper',
  '',
  'Route "swift.mt103.parsed" To "cbds.pacs.outbound" Using Mapper "cbds-mt103-to-pacs008"',
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

function section(title) {
  console.log(`\n=== ${title} ${'='.repeat(Math.max(0, 60 - title.length))}`);
}

async function main() {
  await fs.mkdir(DEMO_DIR, { recursive: true });

  // 1. The VBish source under test.
  const vbishPath = path.join(DEMO_DIR, 'vbish-mt103-to-pacs008.vbs');
  await fs.writeFile(vbishPath, VBISH_SOURCE, 'utf-8');

  // 2. Compile VBish -> portable Pascalish -> pcode + program map.
  const artifact = compileVbishToPmachine(VBISH_SOURCE, { fileName: 'vbish-mt103-to-pacs008.vbs' });
  if (!artifact.native?.valid) {
    throw new Error(`VBish parse failed:\n${(artifact.native?.syntaxErrors || []).join('\n')}`);
  }

  // 3. Resolve `Import Mapper ... From Mapper` against the mapper library and
  //    merge the mapper definition into this service's program map.
  const mapperLibrary = JSON.parse(await fs.readFile(MAPPER_LIBRARY_PATH, 'utf-8'));
  const importedMapperIds = new Set((artifact.native.mapperImports || []).map((m) => m.id));
  const libraryEntries = (mapperLibrary.entries || [])
    .filter((entry) => entry && entry.kind === 'mapper' && importedMapperIds.has(entry.id))
    .map((entry) => ({
      ...entry,
      items: (entry.items || []).map((item) => ({
        ...item,
        ops: item.ops || compileConversionRuleToOps(item.conversionRule)
      }))
    }));
  if (libraryEntries.length === 0) {
    throw new Error('Imported mapper "cbds-mt103-to-pacs008" was not found in the mapper library. Run scripts/prove-cbds-via-pcode.mjs first.');
  }
  const programMap = artifact.programMap || {};
  programMap.entries = [...(programMap.entries || []), ...libraryEntries];

  // The VBish service imports the mapper rather than defining it inline, so its
  // pcode has `CALL MAP_<id> 0` but no routine body. Append the routine compiled
  // from the imported library mapper so the call resolves at runtime.
  let pcodeText = String(artifact.pcodeText || '');
  for (const entry of libraryEntries) {
    pcodeText = `${pcodeText.trimEnd()}\n${emitMapperRoutinePcode(entry)}\n`;
  }

  const pcodePath = path.join(DEMO_DIR, 'vbish-mt103-to-pacs008.pcode');
  const programMapPath = path.join(DEMO_DIR, 'vbish-mt103-to-pacs008.program.json');
  const portablePath = path.join(DEMO_DIR, 'vbish-mt103-to-pacs008.portable.pas');
  await fs.writeFile(pcodePath, pcodeText, 'utf-8');
  await fs.writeFile(programMapPath, `${JSON.stringify(programMap, null, 2)}\n`, 'utf-8');
  await fs.writeFile(portablePath, `${artifact.portableSource}\n`, 'utf-8');

  // 4. The input message: raw MT103, parsed into the swift.mt103.parsed shape.
  const inputObject = parseMt103ToObject(MT103_TEXT);
  const inputPath = path.join(DEMO_DIR, 'mt103-input.json');
  await fs.writeFile(inputPath, `${JSON.stringify(inputObject, null, 2)}\n`, 'utf-8');

  // 5. Run the compiled VBish service on the JS PMachine.
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
  if (!delivery) throw new Error('No cbds.pacs.outbound delivery produced by the VBish service');

  const pacsObject = JSON.parse(String(delivery.message || '{}'));
  const outputJsonPath = path.join(DEMO_DIR, 'pacs008-output.json');
  const outputXmlPath = path.join(DEMO_DIR, 'pacs008-output.xml');
  await fs.writeFile(outputJsonPath, `${JSON.stringify(pacsObject, null, 2)}\n`, 'utf-8');
  await fs.writeFile(outputXmlPath, `<?xml version="1.0" encoding="UTF-8"?>\n${toXml('Document', pacsObject.Document, '')}\n`, 'utf-8');

  // 6. Report.
  section('VBISH CODE THAT RAN');
  process.stdout.write(VBISH_SOURCE);

  section('GENERATED PORTABLE PASCALISH (COMPILED FROM VBISH)');
  console.log(artifact.portableSource);

  section('GENERATED PCODE');
  console.log(String(artifact.pcodeText || '').trim());

  section('INPUT MESSAGE (MT103)');
  console.log(MT103_TEXT);

  section('OUTPUT MESSAGE (PACS.008 JSON)');
  console.log(JSON.stringify(pacsObject, null, 2));

  section('ARTIFACTS');
  for (const p of [vbishPath, portablePath, pcodePath, programMapPath, inputPath, outputJsonPath, outputXmlPath]) {
    console.log(`- ${path.relative(ROOT, p)}`);
  }
  console.log('\n[vbish-cbds-demo] PASS: VBish service converted MT103 to PACS.008 via the CBDS mapper');
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
