import fs from 'fs/promises';
import path from 'path';
import { runPL0 } from './pl0-interpreter.mjs';

const ROOT = path.resolve('.');
const MAPPINGS_PATH = path.join(ROOT, 'data', 'data-mappings.json');

function getPathValue(obj, dotPath) {
  return String(dotPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPathValue(obj, dotPath, value) {
  const keys = String(dotPath || '').split('.').filter(Boolean);
  if (keys.length === 0) return;
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function evaluateRule(ruleText, srcValue) {
  const sourceCode = String(ruleText || '').trim();
  if (!sourceCode) return srcValue;
  
  const result = runPL0(sourceCode, { src: srcValue });
  return result.output != null ? result.output : '';
}

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function objectToXml(name, value, indent = '') {
  if (value == null) return `${indent}<${name}/>`;

  if (typeof value !== 'object') {
    return `${indent}<${name}>${xmlEscape(value)}</${name}>`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => objectToXml(name, item, indent)).join('\n');
  }

  const attrs = [];
  const childEntries = [];
  let textValue = null;

  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('@')) {
      attrs.push(`${k.slice(1)}="${xmlEscape(v)}"`);
      continue;
    }
    if (k === '#text') {
      textValue = v;
      continue;
    }
    childEntries.push([k, v]);
  }

  const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  if (childEntries.length === 0 && textValue == null) {
    return `${indent}<${name}${attrText}/>`;
  }

  if (childEntries.length === 0) {
    return `${indent}<${name}${attrText}>${xmlEscape(textValue)}</${name}>`;
  }

  const childXml = childEntries
    .map(([childName, childVal]) => objectToXml(childName, childVal, `${indent}  `))
    .join('\n');

  const textSegment = textValue == null ? '' : xmlEscape(textValue);
  if (textSegment) {
    return `${indent}<${name}${attrText}>${textSegment}\n${childXml}\n${indent}</${name}>`;
  }

  return `${indent}<${name}${attrText}>\n${childXml}\n${indent}</${name}>`;
}

async function main() {
  const content = await fs.readFile(MAPPINGS_PATH, 'utf-8');
  const mappings = JSON.parse(content);
  const mapping = mappings.find((m) => m.id === 'mt202-to-pacs');
  if (!mapping) throw new Error('Mapping mt202-to-pacs not found');

  const source = {
    finEnvelope: {
      block4: {
        fields: {
          '20': 'REF987654321',
          '21': 'E2E-123456789',
          '32A': { components: { valueDate: '260515', currency: 'usd', amount: '50000,00' } },
          '52A': 'DEUTDEDD',
          '56A': 'NORSEIT2X10',
          '57A': 'CHQABEBBXXX',
          '58A': 'IRVTIT2XXXX',
          '72': '/BENEFICIARY/DETAILS',
        },
      },
    },
  };

  const target = {};
  for (const item of mapping.items) {
    const srcValue = getPathValue(source, item.sourcePath);
    const outValue = evaluateRule(item.conversionRule, srcValue);
    setPathValue(target, item.targetPath, outValue);
  }

  console.log('Executed mapping:', mapping.id);
  console.log('Input:');
  console.log(JSON.stringify(source, null, 2));
  console.log('Output (JSON):');
  console.log(JSON.stringify(target, null, 2));

  const xmlBody = Object.entries(target)
    .map(([rootName, rootValue]) => objectToXml(rootName, rootValue, ''))
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;

  console.log('Output (XML):');
  console.log(xml);

  const outPath = path.join(ROOT, 'data', 'mt202-to-pacs-output.xml');
  await fs.writeFile(outPath, `${xml}\n`, 'utf-8');
  console.log(`Wrote XML output to: ${outPath}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
