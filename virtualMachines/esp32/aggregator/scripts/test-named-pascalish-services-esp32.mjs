import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const baseUrl = (process.env.ESP32_SERVICE_BASE_URL || 'http://192.168.2.115').replace(/\/$/, '');
const serviceDefinitions = [
  { serviceId: 'blink10', sourcePath: new URL('../data/blink10.pas', import.meta.url) },
  { serviceId: 'factorialService', sourcePath: new URL('../data/factorialService.pas', import.meta.url) }
];

async function postForm(route, fields) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${route} returned ${response.status}: ${text.slice(0, 500)}`);
  return text;
}

async function requestJson(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    signal: AbortSignal.timeout(60000)
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${route} returned non-JSON (${response.status}): ${text.slice(0, 500)}`);
  }
  if (!response.ok) throw new Error(`${route} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function waitForAsyncJob(jobId) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const payload = await requestJson(`/pmachine/execute_file_async_status?jobId=${jobId}`);
    if (payload.state === 'queued' || payload.state === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    return payload;
  }
  throw new Error(`async p-code job ${jobId} did not complete within 15 seconds`);
}

async function waitForAsyncJobRunning(jobId) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const payload = await requestJson(`/pmachine/execute_file_async_status?jobId=${jobId}`);
    if (payload.state === 'running') return payload;
    assert.equal(payload.state, 'queued', `unexpected async job state: ${JSON.stringify(payload)}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`async p-code job ${jobId} did not start within 3 seconds`);
}

for (const service of serviceDefinitions) {
  const sourceText = await fs.readFile(service.sourcePath, 'utf8');
  const { pcodeText, programMap } = compilePascalishProgramWithAntlr(sourceText);
  const endpoint = programMap.serviceEndpoints?.find((item) => item.verb === 'GET');
  assert.ok(endpoint?.entryLabel, `${service.serviceId} must compile to an executable GET endpoint`);
  const remoteBase = `/${service.serviceId}`;
  const file = `${remoteBase}.pc`;
  const programMapPath = `${remoteBase}.map`;
  const signedMap = attachPcodeSignature(programMap, pcodeText);

  await postForm('/ffs/upload', { file, body: pcodeText });
  await postForm('/ffs/upload', { file: programMapPath, body: `${JSON.stringify(signedMap)}\n` });
  await requestJson('/api/services/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ serviceId: service.serviceId, file, programMap: programMapPath })
  });
}
console.log(`[named-pascalish-services] registered ${serviceDefinitions.map((service) => service.serviceId).join(', ')}`);

const overlapPcode = `PUSH_INT 9000
DELAY_MS
PUSH_STR "secondary machine done"
PRINT
PRINT_NL
HALT
`;
const overlapInput = '{"message":"wait-overlap"}\n';
await postForm('/ffs/upload', { file: '/wait-overlap.pcode', body: overlapPcode });
await postForm('/ffs/upload', { file: '/wait-overlap.json', body: overlapInput });

async function sendGetPromise(serviceId, query = {}) {
  const url = new URL(`${baseUrl}/api/service/${encodeURIComponent(serviceId)}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const deadline = Date.now() + 90000;
  let busyResponses = 0;
  console.log(`[named-pascalish-services] GET ${url.pathname}${url.search}`);
  while (Date.now() < deadline) {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${serviceId} returned non-JSON (${response.status}): ${text.slice(0, 500)}`);
    }
    if (response.status === 503 && String(payload?.error || '').includes('busy')) {
      busyResponses += 1;
      if (busyResponses === 1) console.log(`[named-pascalish-services] ${serviceId} queued behind the single PMachine`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    if (!response.ok || payload.ok !== true) {
      throw new Error(`${serviceId} returned ${response.status}: ${JSON.stringify(payload)}`);
    }
    console.log(`[named-pascalish-services] ${serviceId} completed in ${busyResponses} busy retry(s)`);
    return payload;
  }
  throw new Error(`${serviceId} remained busy beyond the Promise deadline`);
}

console.log('[named-pascalish-services] starting a 9-second wait on the secondary PMachine');
const queuedJob = await requestJson(
  '/pmachine/execute_file_async?file=%2Fwait-overlap.pcode&inputFile=%2Fwait-overlap.json',
  { method: 'POST' }
);
await waitForAsyncJobRunning(queuedJob.jobId);
console.log('[named-pascalish-services] secondary is waiting; dispatching factorial to the primary PMachine');
const overlapFactorial = await sendGetPromise('factorialService', { n: 5 });
assert.equal(overlapFactorial.response, 120);
const secondaryStillRunning = await requestJson(`/pmachine/execute_file_async_status?jobId=${queuedJob.jobId}`);
assert.equal(secondaryStillRunning.state, 'running', 'secondary wait must still be active after the primary finishes');

const secondaryResult = await waitForAsyncJob(queuedJob.jobId);
assert.equal(secondaryResult.ok, true);
assert.deepEqual(secondaryResult.stdout, ['secondary machine done']);

console.log('[named-pascalish-services] wait overlap passed; running blink10 on the primary');
const blink = await sendGetPromise('blink10');
console.log('[named-pascalish-services] blink10 finished; dispatching factorial Promises');
const [factorialFive, factorialTen] = await Promise.all([
  sendGetPromise('factorialService', { n: 5 }),
  sendGetPromise('factorialService', { n: 10 })
]);
console.log('[named-pascalish-services] Promise calls completed; testing /api/device/LEDPIN');
const ledOn = await requestJson('/api/device/LEDPIN?action=turnOn');
console.log('[named-pascalish-services] LED on; restoring off');
const ledOff = await requestJson('/api/device/LEDPIN?action=turnOff');

assert.equal(blink.response, 'blink10 complete');
assert.equal(factorialFive.response, 120);
assert.equal(factorialTen.response, 3628800);
assert.equal(ledOn.ok, true);
assert.equal(ledOff.ok, true);
assert.equal(ledOff.value, 'ok');

console.log(JSON.stringify({
  status: 'ok',
  board: baseUrl,
  registeredServices: serviceDefinitions.map((service) => service.serviceId),
  promiseResults: [
    { serviceId: 'blink10', response: blink.response },
    { serviceId: 'async-worker', response: secondaryResult.stdout[0], overlappedPrimaryService: overlapFactorial.response },
    { serviceId: 'factorialService', n: 5, response: factorialFive.response },
    { serviceId: 'factorialService', n: 10, response: factorialTen.response },
    { deviceId: 'LEDPIN', actions: [ledOn.action, ledOff.action], finalValue: ledOff.value }
  ]
}, null, 2));
console.log('[named-pascalish-services-esp32] PASS: both services registered and dispatched through concurrent GET Promises');
