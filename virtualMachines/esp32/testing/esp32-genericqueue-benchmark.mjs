const baseUrl = (process.env.ESP32_BASE_URL || 'http://192.168.2.155').replace(/\/+$/, '');
const workerCount = Number(process.env.WORKER_COUNT || 1);
const messageCount = Number(process.env.MESSAGE_COUNT || 100);
const maxInFlight = Number(process.env.MAX_IN_FLIGHT || 32);
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || 20);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeMessage(index) {
  return [
    'MT103',
    `:20:GQ-BENCH-${workerCount}-${index}`,
    `:21:E2E-${workerCount}-${index}`,
    ':23B:CRED',
    ':32A:260921USD1000,00',
    ':50K:ALPHA IMPORTS LTD',
    ':57A:BKTRUS33',
    ':59:/000123456',
    'BETA SUPPLIES INC',
    `:70:GenericQueue benchmark ${workerCount}/${index}`,
    ':71A:SHA'
  ].join('\n');
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

async function setWorkers() {
  const body = new URLSearchParams({ workerCount: String(workerCount), queueLength: '64', resultLimit: '128' });
  const { response, body: result } = await request('/pmachine/edge_ingress_config', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error(`worker config failed: ${response.status} ${JSON.stringify(result)}`);
  if (Number(result.workerCount) !== workerCount) {
    throw new Error(`device clamped workerCount=${workerCount} to ${result.workerCount}; rebuild firmware with PROFILE_MAX_CONCURRENT_TASKS >= ${workerCount}`);
  }
  return result;
}

async function submit(index) {
  const body = new URLSearchParams({
    file: '/router-mapper.pcode',
    programMap: '/router-mapper.program.json',
    inputQueue: 'swift.mt103.parsed',
    message: makeMessage(index),
    runRouter: '1',
    async: '1',
    max: '65536'
  });
  const { response, body: result } = await request('/pmachine/edge_ingress_stage', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (response.status === 429) return null;
  if (!response.ok) throw new Error(`submit ${index} failed: ${response.status} ${JSON.stringify(result)}`);
  if (!result.jobId) throw new Error(`submit ${index} returned no jobId: ${JSON.stringify(result)}`);
  return String(result.jobId);
}

async function readStatus(jobId) {
  const { response, body } = await request(`/pmachine/edge_ingress_status?jobId=${encodeURIComponent(jobId)}`);
  if (!response.ok) throw new Error(`status ${jobId} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const config = await setWorkers();
const startedAt = performance.now();
const pending = new Map();
const completed = new Set();
let nextIndex = 0;
let submission429 = 0;
let failures = 0;

while (completed.size < messageCount) {
  while (nextIndex < messageCount && pending.size < maxInFlight) {
    const jobId = await submit(nextIndex);
    if (jobId === null) {
      submission429 += 1;
      await sleep(50);
      continue;
    }
    pending.set(jobId, nextIndex);
    nextIndex += 1;
  }

  for (const [jobId, index] of pending) {
    const status = await readStatus(jobId);
    if (status.state === 'completed') {
      if (Number(status.statusCode) >= 400 || status.runtimeError || status.error) failures += 1;
      completed.add(index);
      pending.delete(jobId);
    } else if (status.state === 'failed') {
      failures += 1;
      completed.add(index);
      pending.delete(jobId);
    }
  }

  if (pending.size > 0) await sleep(pollIntervalMs);
}

const elapsedMs = performance.now() - startedAt;
const tps = messageCount / (elapsedMs / 1000);
console.log(JSON.stringify({
  baseUrl,
  workerCount,
  messageCount,
  completed: completed.size,
  failures,
  submission429,
  elapsedMs: Number(elapsedMs.toFixed(1)),
  tps: Number(tps.toFixed(2)),
  config
}, null, 2));
