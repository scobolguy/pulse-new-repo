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

async function main() {
  const content = await fs.readFile(MAPPINGS_PATH, 'utf-8');
  const mappings = JSON.parse(content);
  const mapping = mappings.find((m) => m.id === 'pacs-to-mt202');
  if (!mapping) throw new Error('Mapping pacs-to-mt202 not found');

  const source = {
    Document: {
      FIToFICdtTrf: {
        GrpHdr: {
          MsgId: 'PACS-MSG-202',
        },
        CdtTrfTxInf: {
          PmtId: {
            EndToEndId: 'E2E-PACS-202',
          },
          IntrBkSttlmDt: '2026-05-20',
          IntrBkSttlmAmt: {
            '@Ccy': 'eur',
            '#text': '100000.00',
          },
          Dbtr: {
            Nm: 'Bank A',
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
          IntrmyAgt1: {
            FinInstnId: {
              BICFI: 'norseit2x10',
            },
          },
          CdtrAgt: {
            FinInstnId: {
              BICFI: 'chqabebbxxx',
            },
          },
          Cdtr: {
            Nm: 'Bank B',
          },
          CdtrAcct: {
            Id: {
              IBAN: 'IT60X0542811101000000123456',
            },
          },
          InstrForNxtAgt: {
            InstrInf: 'INTER BANK TRANSFER',
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
  console.log('Output (MT202 fields):');
  console.log(JSON.stringify(target, null, 2));

  const outPath = path.join(ROOT, 'data', 'pacs-to-mt202-output.txt');
  let mt202Output = '';
  for (const [key, value] of Object.entries(target)) {
    mt202Output += `${key}: ${value}\n`;
  }
  await fs.writeFile(outPath, mt202Output, 'utf-8');
  console.log(`Wrote MT202 output to: ${outPath}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
