import fs from 'node:fs/promises';
import path from 'node:path';

const BACKEND_BASE_URL = (process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const INSTANCE_URL = (process.env.INSTANCE_URL || process.argv[2] || '').replace(/\/$/, '');
const SERVICE_ID = process.env.SERVICE_ID || 'mt103-to-pacs008';
const REQUEST_QUEUE = process.env.REQUEST_QUEUE || `service.${SERVICE_ID}.requests`;
const WORKER_ID = process.env.WORKER_ID || `${SERVICE_ID}:${INSTANCE_URL || 'unknown'}:${process.pid}`;
const MAX_MESSAGES = Math.max(1, Number.parseInt(process.env.MAX_MESSAGES || '1000000', 10));
const IDLE_EXIT_MS = Math.max(0, Number.parseInt(process.env.IDLE_EXIT_MS || '5000', 10));
const CLAIM_LEASE_MS = Math.max(1000, Number.parseInt(process.env.CLAIM_LEASE_MS || '30000', 10));
const ACTOR_USER_ID = process.env.ACTOR_USER_ID || 'system-admin';

if (!INSTANCE_URL) {
  console.error('INSTANCE_URL is required');
  process.exit(1);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(Number(process.env.HTTP_TIMEOUT_MS || 30000))
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`${response.status} ${url}: ${JSON.stringify(body).slice(0, 500)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function postQueue(pathSuffix, body) {
  return fetchJson(`${BACKEND_BASE_URL}/api/queue/${encodeURIComponent(REQUEST_QUEUE)}${pathSuffix}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': ACTOR_USER_ID },
    body: JSON.stringify(body)
  });
}

async function claimOne() {
  try {
    const payload = await postQueue('/claim', { workerId: WORKER_ID, leaseMs: CLAIM_LEASE_MS });
    return payload.claim || null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function unwrapEnvelope(claim) {
  return claim?.message?.message || claim?.message || {};
}

async function invokeEsp32Pmachine(message) {
  const body = new URLSearchParams({
    file: '/cobload.pc',
    programMap: '/cobload.map.json',
    inputQueue: 'swift.mt103.parsed',
    message: String(message || ''),
    max: '65536'
  });
  const response = await fetch(`${INSTANCE_URL}/pmachine/execute_file`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(Number(process.env.ESP32_TIMEOUT_MS || 30000))
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`ESP32 ${INSTANCE_URL} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return payload;
}

async function writeResult(replyRoot, result) {
  if (!replyRoot) return;
  await fs.mkdir(path.dirname(replyRoot), { recursive: true });
  await fs.writeFile(`${replyRoot}.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const xml = String(result.value || result.edgeResult?.deliveries?.[0]?.message || '');
  await fs.writeFile(`${replyRoot}.xml`, `${xml}\n`, 'utf8');
}

async function processClaim(claim) {
  const envelope = unwrapEnvelope(claim);
  const inputText = await fs.readFile(envelope.inputFile, 'utf8');
  const input = JSON.parse(inputText);
  const serviceMessage = input.body && typeof input.body === 'object' && Object.prototype.hasOwnProperty.call(input.body, 'message')
    ? input.body.message
    : input.body?.message ?? input.message ?? '';
  const edgeResult = await invokeEsp32Pmachine(serviceMessage);
  const value = edgeResult?.deliveries?.[0]?.message || edgeResult?.globals?.['OUTGOING-PACS008'] || edgeResult?.stdout?.at?.(-1) || '';
  const result = {
    value,
    serviceId: SERVICE_ID,
    serviceInstanceId: INSTANCE_URL,
    workerId: WORKER_ID,
    conversionFormat: 'mt103->pacs008',
    messageType: 'PACS008',
    conversionApplied: Boolean(value),
    edgeResult: {
      ok: edgeResult.ok === true,
      publishedCount: edgeResult.publishedCount || 0,
      stepCount: edgeResult.stepCount || 0,
      memoryPressure: edgeResult.memoryPressure || null
    }
  };
  await writeResult(envelope.replyRoot, result);
  await postQueue('/claim/complete', {
    workerId: WORKER_ID,
    claimToken: claim.claimToken,
    completionMeta: {
      jobId: envelope.jobId,
      serviceId: SERVICE_ID,
      serviceInstanceId: INSTANCE_URL,
      state: 'completed'
    }
  });
  return result;
}

async function main() {
  console.error(`[service-worker] started workerId=${WORKER_ID} queue=${REQUEST_QUEUE} instance=${INSTANCE_URL}`);
  let processed = 0;
  let idleSince = Date.now();
  while (processed < MAX_MESSAGES) {
    const claim = await claimOne();
    if (!claim) {
      if (IDLE_EXIT_MS > 0 && Date.now() - idleSince >= IDLE_EXIT_MS) break;
      await new Promise(resolve => setTimeout(resolve, 50));
      continue;
    }
    idleSince = Date.now();
    try {
      await processClaim(claim);
      processed += 1;
      process.stdout.write('.');
    } catch (error) {
      process.stdout.write('x');
      try {
        await postQueue('/claim/fail', {
          workerId: WORKER_ID,
          claimToken: claim.claimToken,
          reason: error.message,
          maxAttempts: 3,
          delayMs: 1000
        });
      } catch (failError) {
        if (failError?.status === 404 || failError?.status === 409) {
          // The claim was already completed or expired by the time we tried to fail it.
          continue;
        }
        console.error(`[service-worker] failClaim error: ${failError.message}`);
      }
    }
  }
  process.stdout.write('\n');
  console.error(`[service-worker] stopped workerId=${WORKER_ID} processed=${processed}`);
}

main().catch(error => {
  console.error(`[service-worker] ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
