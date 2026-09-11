import fs from 'node:fs/promises';
import { compileCobolishToPmachine } from './compile-interoperable-language.mjs';
import { compileConversionRuleToOps } from './compile-mapping-rule.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const BASE = (process.env.ESP32_BASE_URL || `http://${process.env.ESP32_HOST || '192.168.2.155'}`).replace(/\/+$/, '');
const SOURCE_PATH = new URL('../data/cbds/cobolish-demo/mt103-pacs008-load-test.cob', import.meta.url);
const REMOTE_PCODE = '/cobload.pc';
const REMOTE_MAP = '/cobload.map.json';
const INPUT = [
  'MT103',
  ':20:COBOLISH-LOAD-001',
  ':21:COBOLISH-E2E-001',
  ':23B:CRED',
  ':32A:260907USD1250,00',
  ':50K:ALPHA IMPORTS LTD',
  ':57A:BKTRUS33',
  ':59:/000123456',
  'BETA SUPPLIES INC',
  ':70:Invoice 42',
  ':71A:SHA'
].join('\n');

async function upload(file, body) {
  const response = await fetch(`${BASE}/ffs/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ file, body }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`upload ${file} failed (${response.status}): ${await response.text()}`);
}

async function execute() {
  const response = await fetch(`${BASE}/pmachine/execute_file`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      file: REMOTE_PCODE,
      programMap: REMOTE_MAP,
      inputQueue: 'swift.mt103.parsed',
      message: INPUT,
      max: '65536'
    }),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`execute failed (${response.status}): ${text}`);
  return JSON.parse(text);
}

const source = await fs.readFile(SOURCE_PATH, 'utf8');
const artifact = compileCobolishToPmachine(source, { fileName: 'mt103-pacs008-load-test.cob' });
if (!artifact.native?.valid) throw new Error(`Cobolish compile failed: ${(artifact.native?.syntaxErrors || []).join('; ')}`);
const programMap = artifact.programMap || {};
for (const entry of programMap.entries || []) {
  for (const item of entry.items || []) {
    if (!item.ops && item.conversionRule) item.ops = compileConversionRuleToOps(item.conversionRule);
  }
}
const pcode = artifact.pcodeText.endsWith('\n') ? artifact.pcodeText : `${artifact.pcodeText}\n`;
const signedMap = attachPcodeSignature(programMap, pcode);
await upload(REMOTE_PCODE, pcode);
await upload(REMOTE_MAP, JSON.stringify(signedMap));

const results = [];
let firstPayload;
for (let attempt = 1; attempt <= 10; attempt += 1) {
  const started = performance.now();
  const payload = await execute();
  firstPayload ||= payload;
  const delivery = (payload.deliveries || []).find((item) => item.queueName === 'cbds.pacs.outbound') || payload.deliveries?.[0];
  results.push({
    attempt,
    ok: !payload.runtimeError && Boolean(delivery),
    elapsedMs: Math.round(performance.now() - started),
    runtimeError: payload.runtimeError || null,
    outputQueue: delivery?.queueName || null,
    output: delivery?.message || ''
  });
}

console.log('=== INCOMING MT103 ===');
console.log(INPUT);
console.log('=== COBOLISH STDOUT MARKERS ===');
console.log((firstPayload.stdout || []).join('\n'));
console.log('=== OUTGOING PACS.008 (ATTEMPT 1) ===');
console.log(results[0].output || '(empty delivery message)');
console.log('=== SUMMARY ===');
console.log(JSON.stringify({
  target: BASE,
  compiled: true,
  passed: results.filter((result) => result.ok).length,
  failed: results.filter((result) => !result.ok).length,
  averageMs: Math.round(results.reduce((sum, result) => sum + result.elapsedMs, 0) / results.length),
  outputQueue: results[0].outputQueue,
  instructionCount: pcode.split('\n').filter(Boolean).length
}, null, 2));
