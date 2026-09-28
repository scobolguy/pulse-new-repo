import fs from 'node:fs/promises';
import path from 'node:path';
import { compileRouterMapperDSL } from '../aggregator/scripts/compile-pascal.mjs';

const baseUrl = (process.env.ESP32_BASE_URL || 'http://192.168.2.155').replace(/\/+$/, '');
const messageCount = Number(process.env.MESSAGE_COUNT || 100);
const sourcePath = path.resolve('aggregator/data/cbds/pascalish-demo/cbds-converter.pas');
const remotePcode = '/pascalish-genericmapper.pcode';
const remoteMap = '/pascalish-genericmapper.program.json';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, body };
}

async function waitForDevice(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { response } = await request('/services/describe', { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`ESP32 did not become reachable at ${baseUrl}`);
}

async function upload(file, content) {
  const { response, body } = await request(`/ffs/upload?file=${encodeURIComponent(file)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: content
  });
  if (!response.ok) throw new Error(`upload ${file} failed: ${response.status} ${JSON.stringify(body)}`);
}

async function verifyUpload(file, expected) {
  const { response, body } = await request(`/ffs/get?file=${encodeURIComponent(file)}`);
  if (!response.ok || String(body) !== expected) {
    throw new Error(`FFS verification failed for ${file}: ${response.status}`);
  }
}

function makeMessage(workerCount, index) {
  return [
    'MT103',
    `:20:PASCALISH-GQ-${workerCount}-${index}`,
    `:21:E2E-${workerCount}-${index}`,
    ':23B:CRED',
    ':32A:260921USD1000,00',
    ':50K:ALPHA IMPORTS LTD',
    ':57A:BKTRUS33',
    ':59:/000123456',
    'BETA SUPPLIES INC',
    `:70:Pascalish GenericMapper ${workerCount}/${index}`,
    ':71A:SHA'
  ].join('\n');
}

async function configureWorkers(workerCount) {
  const { response, body } = await request('/pmachine/edge_ingress_config', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      workerCount: String(workerCount),
      queueLength: '64',
      resultLimit: '128',
      reboot: '1'
    })
  });
  if (!response.ok) throw new Error(`worker config failed: ${response.status} ${JSON.stringify(body)}`);
  await sleep(1500);
  await waitForDevice();
  const live = await request('/pmachine/edge_ingress_config');
  if (Number(live.body.workerCount) !== workerCount) {
    throw new Error(`device reported workerCount=${live.body.workerCount}, requested ${workerCount}`);
  }
  return live.body;
}

async function submit(workerCount, index) {
  const { response, body } = await request('/pmachine/edge_ingress_stage', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      file: remotePcode,
      programMap: remoteMap,
      inputQueue: 'swift.mt103.parsed',
      message: makeMessage(workerCount, index),
      runRouter: '1',
      async: '1',
      max: '65536'
    })
  });
  if (response.status === 429) return null;
  if (!response.ok) throw new Error(`submit ${index} failed: ${response.status} ${JSON.stringify(body)}`);
  return String(body.jobId);
}

async function readStatus(jobId) {
  const { response, body } = await request(`/pmachine/edge_ingress_status?jobId=${encodeURIComponent(jobId)}`);
  if (!response.ok) throw new Error(`status ${jobId} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function runTrial(workerCount) {
  const config = await configureWorkers(workerCount);
  const startedAt = performance.now();
  const pending = new Map();
  const completed = new Set();
  let nextIndex = 1;
  let retries429 = 0;
  let failures = 0;
  const maxInFlight = workerCount * 4;

  while (completed.size < messageCount) {
    while (nextIndex <= messageCount && pending.size < maxInFlight) {
      const jobId = await submit(workerCount, nextIndex);
      if (!jobId) {
        retries429 += 1;
        await sleep(50);
        continue;
      }
      pending.set(jobId, nextIndex);
      nextIndex += 1;
    }

    for (const [jobId, index] of pending) {
      const status = await readStatus(jobId);
      if (status.state === 'completed' || status.state === 'failed') {
        if (status.state === 'failed' || Number(status.statusCode) >= 400 || status.runtimeError || status.error) failures += 1;
        completed.add(index);
        pending.delete(jobId);
      }
    }
    if (pending.size) await sleep(20);
  }

  const elapsedMs = performance.now() - startedAt;
  return {
    workerCount,
    requested: messageCount,
    completed: completed.size,
    failures,
    retries429,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    tps: Number((completed.size / (elapsedMs / 1000)).toFixed(2)),
    config
  };
}

const source = await fs.readFile(sourcePath, 'utf8');
const artifact = compileRouterMapperDSL(source);
if (!artifact?.pcodeText || !artifact?.programMap) throw new Error('Pascalish compilation produced no p-code/program map');
await upload(remotePcode, artifact.pcodeText);
await upload(remoteMap, JSON.stringify(artifact.programMap));
await verifyUpload(remotePcode, artifact.pcodeText);
await verifyUpload(remoteMap, JSON.stringify(artifact.programMap));

const results = [];
for (const workerCount of [1, 2]) results.push(await runTrial(workerCount));
console.log(JSON.stringify({
  runtime: 'esp32',
  baseUrl,
  source: sourcePath,
  remotePcode,
  remoteMap,
  results
}, null, 2));
