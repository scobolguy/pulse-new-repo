import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileRouterMapperDSL } from './compile-pascal.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

const ESP32_BASE_URL = process.env.ESP32_BASE_URL || 'http://192.168.2.155';
const TOTAL = 100;
const INPUT_QUEUE = 'swift.mt103.parsed';
const OUTPUT_QUEUE = 'tx.pacs.created';
const SOURCE_PATH = path.resolve('data', 'mt103-to-pacs.service.pas');

function makeMt103(index) {
  const id = `DUAL-${String(index).padStart(3, '0')}`;
  return [
    'MT103',
    `:20:${id}`,
    ':32A:260919USD1000,25',
    `:50K:DUAL APPLICANT ${index}`,
    ':57A:DUALBANKXXX',
    ':59:/123456789',
    `DUAL BENEFICIARY ${index}`
  ].join('\n');
}

function parseMt103(message) {
  const fields = {};
  let currentTag = '';
  for (const line of message.split(/\r?\n/)) {
    const match = line.match(/^:([0-9]{2}[A-Z]?):(.*)$/);
    if (match) {
      currentTag = match[1];
      fields[currentTag] = match[2] || '';
    } else if (currentTag) {
      fields[currentTag] = `${fields[currentTag]}\n${line}`.trim();
    }
  }
  const amount = String(fields['32A'] || '').match(/^(\d{6})([A-Z]{3})([0-9,.]+)$/);
  return {
    block4: {
      '20': fields['20'] || '',
      '32A': { date: amount?.[1] || '', currency: amount?.[2] || '', amount: amount?.[3] || '' },
      '50K': fields['50K'] || '',
      '57A': fields['57A'] || '',
      '59': fields['59'] || ''
    }
  };
}

function isPacsDelivery(deliveries) {
  const delivery = (deliveries || []).find((item) =>
    (item.outputQueue || item.queueName) === OUTPUT_QUEUE
  );
  return Boolean(delivery && String(delivery.message || '').includes('FIToFICstmrCdtTrf'));
}

async function runEsp32(message) {
  const query = new URLSearchParams({
    serviceId: 'mt103-to-pacs-service',
    rules: '/hrr.json',
    mappings: '/hdm.json',
    inputQueue: INPUT_QUEUE,
    message
  });
  const response = await fetch(`${ESP32_BASE_URL}/pmachine/router/run?${query}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json();
  return { ok: response.ok && payload.publishedCount === 1 && isPacsDelivery(payload.deliveries), payload };
}

async function run() {
  const source = await fs.readFile(SOURCE_PATH, 'utf8');
  const artifact = compileRouterMapperDSL(source);
  const signedMap = attachPcodeSignature(structuredClone(artifact.programMap), artifact.pcodeText);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dual-runtime-100-'));
  const pcodePath = path.join(tmpDir, 'service.pcode');
  const mapPath = path.join(tmpDir, 'service.program.json');
  await fs.writeFile(pcodePath, artifact.pcodeText, 'utf8');
  await fs.writeFile(mapPath, JSON.stringify(signedMap), 'utf8');
  const instructions = parsePcode(artifact.pcodeText);
  const opcodeMap = await loadOpcodeMap();
  const results = { esp32: [], js: [] };

  for (let index = 1; index <= TOTAL; index += 1) {
    const lane = index % 2 === 0 ? 'js' : 'esp32';
    const mt103 = makeMt103(index);
    const started = performance.now();
    let outcome;
    try {
      if (lane === 'esp32') {
        outcome = await runEsp32(mt103);
      } else {
        const runtime = await executeProgram({
          instructions,
          opcodeMap,
          inputQueue: INPUT_QUEUE,
          sourceMessage: JSON.stringify(parseMt103(mt103)),
          mappingsById: new Map((signedMap.entries || [])
            .filter((entry) => entry.kind === 'mapper')
            .map((entry) => [entry.id, entry]))
        });
        outcome = { ok: isPacsDelivery(runtime.deliveries), payload: runtime };
      }
    } catch (error) {
      outcome = { ok: false, error: String(error?.message || error) };
    }
    results[lane].push({ index, ok: outcome.ok, elapsedMs: Number((performance.now() - started).toFixed(2)) });
    console.log(`${index},${lane},${outcome.ok ? 'ok' : 'failed'},${results[lane].at(-1).elapsedMs}ms`);
  }

  for (const lane of ['esp32', 'js']) {
    const rows = results[lane];
    const ok = rows.filter((row) => row.ok).length;
    const totalMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);
    console.log(JSON.stringify({ lane, attempted: rows.length, successful: ok, failed: rows.length - ok, percentageOfAll: `${ok}%`, totalWallMs: Number(totalMs.toFixed(2)), averageMs: Number((totalMs / rows.length).toFixed(2)) }));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});