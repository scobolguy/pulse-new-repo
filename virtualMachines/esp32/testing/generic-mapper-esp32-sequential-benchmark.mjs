import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../aggregator/scripts/pcode-signing.mjs';

const host = process.env.ESP32_HOST || '192.168.2.155';
const baseUrl = `http://${host}`;
const count = Number(process.env.MESSAGE_COUNT || 100);
const root = path.resolve(fileURLToPath(new URL('../aggregator', import.meta.url)));
const sourcePath = path.join(root, 'data', 'generic-mapper.pas');
const pcodeFile = '/generic-mapper-100.pcode';
const mapFile = '/generic-mapper-100.map.json';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(pathname, options = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${pathname}`, {
        ...options,
        headers: { connection: 'close', ...(options.headers || {}) },
        signal: AbortSignal.timeout(15000)
      });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      return { response, body };
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
}

async function upload(file, body) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { response, body: result } = await request('/ffs/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ file, body })
      });
      if (response.ok) return;
      if (attempt === 4) throw new Error(`upload ${file}: ${response.status} ${JSON.stringify(result)}`);
    } catch (error) {
      if (attempt === 4) throw error;
    }
    await sleep(500 * (attempt + 1));
  }
}

function message(index) {
  return JSON.stringify({ finEnvelope: { block4: { fields: {
    '20': `GM-SEQ-${index}`,
    '21': `E2E-${index}`,
    '23B': 'CRED',
    '32A': { components: { valueDate: '260920', currency: 'USD', amount: '1000,00' } },
    '50K': '/000000001\nGENERIC APPLICANT',
    '52A': 'BANKUS33XXX',
    '57A': 'BANKGB22XXX',
    '59': '/000000002\nGENERIC BENEFICIARY',
    '70': `SEQUENTIAL ${index}`,
    '71A': 'SHA'
  } }, meta: { createdAt: '2026-09-20T12:00:00.000Z' } } });
}

function validate(result, index) {
  assert.equal(result.publishedCount, 1, `transaction ${index}`);
  const output = result.deliveries?.[0]?.message || '';
  assert.match(output, /<IntrBkSttlmDt>2026-09-20<\/IntrBkSttlmDt>/, `date ${index}`);
  assert.match(output, /<IntrBkSttlmAmt[^>]*Ccy="USD"[^>]*>1000\.00<\/IntrBkSttlmAmt>/, `amount ${index}`);
  assert.match(output, /<Nm>GENERIC APPLICANT<\/Nm>/, `debtor ${index}`);
  assert.match(output, /<Nm>GENERIC BENEFICIARY<\/Nm>/, `creditor ${index}`);
}

const source = await fs.readFile(sourcePath, 'utf8');
const artifact = compilePascalishProgramWithAntlr(source);
const compactMap = {
  ...artifact.programMap,
  typeRegistry: undefined,
  sourceMap: undefined,
  classDeclarations: undefined,
  variableDeclarations: undefined
};
const signedMap = attachPcodeSignature(compactMap, artifact.pcodeText);
await upload(pcodeFile, artifact.pcodeText);
await sleep(750);
await upload(mapFile, `${JSON.stringify(signedMap)}\n`);
await sleep(750);

const started = performance.now();
let totalSteps = 0;
for (let index = 1; index <= count; index += 1) {
  const { response, body } = await request('/pmachine/execute_file', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      file: pcodeFile,
      programMap: mapFile,
      inputQueue: 'swift.mt103.inbound',
      message: message(index),
      runRouter: '0',
      max: '65536'
    })
  });
  if (!response.ok) throw new Error(`transaction ${index}: HTTP ${response.status} ${JSON.stringify(body)}`);
  validate(body, index);
  totalSteps += Number(body.stepCount || 0);
}
const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  status: 'PASS',
  host,
  runtime: 'esp32-pmachine',
  transactions: count,
  failures: 0,
  elapsedMs: Number(elapsedMs.toFixed(1)),
  averageMsPerTransaction: Number((elapsedMs / count).toFixed(2)),
  transactionsPerSecond: Number((count * 1000 / elapsedMs).toFixed(2)),
  averageStepsPerTransaction: Number((totalSteps / count).toFixed(1)),
  conversions: {
    settlementDate: '260920 -> 2026-09-20',
    amount: '1000,00 -> 1000.00',
    currency: 'USD',
    partyNames: 'account lines stripped'
  }
}, null, 2));
