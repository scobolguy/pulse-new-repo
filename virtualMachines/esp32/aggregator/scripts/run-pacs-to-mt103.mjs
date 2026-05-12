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

function mtFieldEscape(value) {
  return String(value ?? '').toUpperCase().slice(0, 35);
}

async function main() {
  const content = await fs.readFile(MAPPINGS_PATH, 'utf-8');
  const mappings = JSON.parse(content);
  const mapping = mappings.find((m) => m.id === 'pacs-to-mt103');
  if (!mapping) throw new Error('Mapping pacs-to-mt103 not found');

  const source = {
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: 'PACS-MSG-001',
        },
        CdtTrfTxInf: {
          PmtId: {
            EndToEndId: 'E2E-PACS-789',
          },
          IntrBkSttlmDt: '2026-05-15',
          IntrBkSttlmAmt: {
            '@Ccy': 'usd',
            '#text': '25000.50',
          },
          Dbtr: {
            Nm: 'John Smith',
          },
          DbtrAcct: {
            Id: {
              IBAN: 'DE89370400440532013000',
            },
          },
          DbtrAgt: {
            FinInstnId: {
              BICFI: 'deutdedd',
            },
          },
          CdtrAgt: {
            FinInstnId: {
              BICFI: 'chqabebbxxx',
            },
          },
          Cdtr: {
            Nm: 'Jane Doe',
          },
          CdtrAcct: {
            Id: {
              IBAN: 'IT60X0542811101000000123456',
            },
          },
          RmtInf: {
            Ustrd: 'Invoice 12345',
          },
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
  console.log('Input (JSON):');
  console.log(JSON.stringify(source, null, 2));
  console.log('Output (MT103 fields):');
  console.log(JSON.stringify(target, null, 2));

  const outPath = path.join(ROOT, 'data', 'pacs-to-mt103-output.txt');
  let mt103Output = '';
  for (const [key, value] of Object.entries(target)) {
    mt103Output += `${key}: ${value}\n`;
  }
  await fs.writeFile(outPath, mt103Output, 'utf-8');
  console.log(`Wrote MT103 output to: ${outPath}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
