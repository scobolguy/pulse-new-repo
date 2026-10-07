import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../aggregator/scripts/pcode-signing.mjs';

const host = process.env.ESP32_HOST || '192.168.2.155';
const baseUrl = `http://${host}`;
const messageCount = Number(process.env.MESSAGE_COUNT || 100);
const workerCounts = [1, 2];
const maxInFlight = Number(process.env.MAX_IN_FLIGHT || 32);
const aggregatorRoot = path.resolve(fileURLToPath(new URL('../aggregator', import.meta.url)));
const sourcePath = path.resolve(aggregatorRoot, '..', 'src', 'generic-mapper.pas');
const remotePcode = '/generic-mapper-bench.pcode';
const remoteMap = '/generic-mapper-bench.map.json';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(pathname, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
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
      lastError = error;
      await sleep(50 * (attempt + 1));
    }
  }
  throw lastError;
}

async function postForm(pathname, values) {
  return request(pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values)
  });
}

function makeMessage(index) {
  return JSON.stringify({
    finEnvelope: {
      block4: {
        fields: {
          '20': `GM-BENCH-${index}`,
          '21': `E2E-${index}`,
          '23B': 'CRED',
          '32A': { components: { valueDate: '260920', currency: 'USD', amount: '1000,00' } },
          '50K': '/000000001\nGENERIC APPLICANT',
          '52A': 'BANKUS33XXX',
          '57A': 'BANKGB22XXX',
          '59': '/000000002\nGENERIC BENEFICIARY',
          '70': `BENCHMARK ${index}`,
          '71A': 'SHA'
        }
      },
      meta: { createdAt: '2026-09-20T12:00:00.000Z' }
    }
  });
}

async function configure(workerCount) {
  let response;
  let body;
  try {
    const result = await postForm('/pmachine/edge_ingress_config', {
      workerCount: String(workerCount),
      queueLength: '8',
      resultLimit: '8',
      workerStackBytes: '16384',
      reboot: '1'
    });
    response = result.response;
    body = result.body;
  } catch (error) {
    // The device may close the rebooting HTTP connection before sending its response.
    if (error?.cause?.code !== 'UND_ERR_SOCKET' && error?.code !== 'UND_ERR_SOCKET') throw error;
  }
  if (response && !response.ok) throw new Error(`worker config failed: ${response.status} ${JSON.stringify(body)}`);
  if (response && Number(body.workerCount) !== workerCount) {
    throw new Error(`device clamped workerCount=${workerCount} to ${body.workerCount}`);
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const live = await request('/pmachine/edge_ingress_config');
      if (live.response.ok && Number(live.body.workerCount) === workerCount && live.body.queueCapacity === 8) return live.body;
    } catch {}
    await sleep(500);
  }
  throw new Error(`ESP32 did not return with workerCount=${workerCount}`);
}

async function submit(index) {
  const { response, body } = await postForm('/pmachine/edge_ingress_stage', {
    file: remotePcode,
    programMap: remoteMap,
    inputQueue: 'swift.mt103.inbound',
    message: makeMessage(index),
    runRouter: '1',
    async: '1',
    max: '65536'
  });
  if (response.status === 429) return null;
  if (!response.ok || !body.jobId) {
    throw new Error(`submit ${index} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return String(body.jobId);
}

async function waitForJob(jobId) {
  for (;;) {
    const { response, body } = await request(`/pmachine/edge_ingress_status?jobId=${encodeURIComponent(jobId)}`);
    if (!response.ok) throw new Error(`status ${jobId} failed: ${response.status} ${JSON.stringify(body)}`);
    if (body.state === 'completed' || body.state === 'failed') return body;
    await sleep(250);
  }
}

function validateOutput(body) {
  assert.equal(body.state, 'completed');
  assert.ok(Number(body.statusCode) < 400, JSON.stringify(body));
  const result = JSON.parse(body.body);
  const mapped = result.deliveries?.[0]?.message
    ? JSON.parse(result.deliveries[0].message)
    : result;
  const transaction = mapped.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf;
  assert.equal(transaction?.IntrBkSttlmDt, '2026-09-20');
  assert.equal(transaction?.IntrBkSttlmAmt?.['@Ccy'], 'USD');
  assert.equal(transaction?.IntrBkSttlmAmt?.['#text'], '1000.00');
  assert.equal(transaction?.Dbtr?.Nm, 'GENERIC APPLICANT');
  assert.equal(transaction?.Cdtr?.Nm, 'GENERIC BENEFICIARY');
  return result;
}

async function runTrial(workerCount) {
  const config = await configure(workerCount);
  const startedAt = performance.now();
  const pending = new Map();
  const completed = [];
  let nextIndex = 1;
  let retries429 = 0;

  while (completed.length < messageCount) {
    while (nextIndex <= messageCount && pending.size < Math.min(maxInFlight, workerCount)) {
      const jobId = await submit(nextIndex);
      if (jobId === null) {
        retries429 += 1;
        await sleep(10);
        continue;
      }
      pending.set(jobId, nextIndex);
      nextIndex += 1;
    }

    for (const [jobId, index] of pending) {
      const { response, body } = await request(`/pmachine/edge_ingress_status?jobId=${encodeURIComponent(jobId)}`);
      if (response.status === 404 && body === 'Unknown jobId') continue;
      if (!response.ok) throw new Error(`status ${jobId} failed: ${response.status} ${JSON.stringify(body)}`);
      if (body.state === 'completed' || body.state === 'failed') {
        completed.push({ index, result: body });
        pending.delete(jobId);
      }
    }
    if (pending.size > 0) await sleep(100);
    else await sleep(250);
  }

  const elapsedMs = performance.now() - startedAt;
  const checked = validateOutput(completed[0].result);
  return {
    workerCount,
    requested: messageCount,
    completed: completed.length,
    failures: completed.filter(item => item.result.state !== 'completed' || Number(item.result.statusCode) >= 400).length,
    retries429,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    averageMsPerTransaction: Number((elapsedMs / completed.length).toFixed(2)),
    transactionsPerSecond: Number((completed.length * 1000 / elapsedMs).toFixed(2)),
    memory: completed[0].result.memory || null,
    conversionCheck: {
      settlementDate: '2026-09-20',
      amount: '1000.00',
      currency: 'USD',
      parties: 'account lines stripped'
    },
    processedByGenericMapper: checked.globals?.GenericMapper__self__processed ?? null,
    config
  };
}

const sourceText = await fs.readFile(sourcePath, 'utf8');
const artifact = compilePascalishProgramWithAntlr(sourceText);
const compactProgramMap = {
  ...artifact.programMap,
  typeRegistry: undefined,
  sourceMap: undefined,
  classDeclarations: undefined,
  variableDeclarations: undefined
};
const signedMap = attachPcodeSignature(compactProgramMap, artifact.pcodeText);

for (const [file, body] of [[remotePcode, artifact.pcodeText], [remoteMap, `${JSON.stringify(signedMap)}\n`]]) {
  let uploaded = false;
  for (let attempt = 0; attempt < 4 && !uploaded; attempt += 1) {
    try {
      const { response, body: result } = await postForm('/ffs/upload', { file, body });
      if (response.ok) uploaded = true;
      else if (attempt === 3) throw new Error(`upload ${file} failed: ${response.status} ${JSON.stringify(result)}`);
    } catch (error) {
      if (attempt === 3) throw error;
    }
    if (!uploaded) await sleep(500 * (attempt + 1));
  }
  await sleep(500);
}

const results = [];
for (const workerCount of workerCounts) results.push(await runTrial(workerCount));
console.log(JSON.stringify({ status: 'PASS', host, runtime: 'esp32-pmachine', messageCount, results }, null, 2));