import fs from 'node:fs/promises';
import path from 'node:path';
import { runSingleMessageForEvolution } from './run-js-pmachine.mjs';

const BACKEND_BASE_URL = (process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const SERVICE_ID = String(process.env.SERVICE_ID || '').trim();
const INSTANCE_ID = String(process.env.INSTANCE_ID || `${SERVICE_ID}:${process.pid}`).trim();
const PCODE_PATH = String(process.env.PCODE_PATH || '').trim();
const PROGRAM_MAP_PATH = String(process.env.PROGRAM_MAP_PATH || '').trim();
const INPUT_QUEUE = String(process.env.INPUT_QUEUE || `${SERVICE_ID}.in`).trim();
const REQUEST_QUEUE = String(process.env.REQUEST_QUEUE || `service.${SERVICE_ID.toLowerCase()}.requests`).trim();
const POLL_MS = Math.max(25, Number.parseInt(process.env.POLL_MS || '100', 10));
const CLAIM_LEASE_MS = Math.max(1000, Number.parseInt(process.env.CLAIM_LEASE_MS || '30000', 10));
const HTTP_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.HTTP_TIMEOUT_MS || '30000', 10));
let stopping = false;

if (!SERVICE_ID || !PCODE_PATH || !PROGRAM_MAP_PATH) {
  throw new Error('SERVICE_ID, PCODE_PATH, and PROGRAM_MAP_PATH are required');
}

async function requestJson(route, body) {
  const response = await fetch(`${BACKEND_BASE_URL}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': 'system-admin' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) throw new Error(`${response.status} ${route}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload;
}

async function claimOne() {
  const response = await fetch(`${BACKEND_BASE_URL}/api/queue/${encodeURIComponent(REQUEST_QUEUE)}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workerId: INSTANCE_ID, leaseMs: CLAIM_LEASE_MS }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  if (response.status === 404) return null;
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) throw new Error(`${response.status} claim ${REQUEST_QUEUE}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload.claim || null;
}

function serviceMessage(input, envelope) {
  const httpVerb = String(input?.method || envelope?.method || 'POST').trim().toUpperCase();
  let message;
  if (input?.body && typeof input.body === 'object' && Object.prototype.hasOwnProperty.call(input.body, 'message')) {
    message = input.body.message;
  } else if (input?.body != null) {
    message = input.body;
  } else if (Object.prototype.hasOwnProperty.call(input || {}, 'message')) {
    message = input.message;
  } else {
    message = envelope?.message || '';
  }
  if (httpVerb !== 'GET') return message;
  if (message && typeof message === 'object' && !Array.isArray(message)) {
    return JSON.stringify({ ...message, httpVerb });
  }
  return JSON.stringify({ httpVerb, src: message == null ? '' : String(message) });
}

async function writeReply(replyRoot, payload) {
  if (!replyRoot) return;
  await fs.mkdir(path.dirname(replyRoot), { recursive: true });
  const jsonTempPath = `${replyRoot}.json.${process.pid}.tmp`;
  await fs.writeFile(jsonTempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.rename(jsonTempPath, `${replyRoot}.json`);
  const xml = String(payload.value || payload.response || '');
  const xmlTempPath = `${replyRoot}.xml.${process.pid}.tmp`;
  await fs.writeFile(xmlTempPath, `${xml}\n`, 'utf8');
  await fs.rename(xmlTempPath, `${replyRoot}.xml`);
}

async function processClaim(claim) {
  const envelope = claim?.message?.message || claim?.message || {};
  const replyRoot = String(envelope.replyRoot || '').trim();
  let heartbeat;
  try {
    heartbeat = setInterval(() => {
      void requestJson(`/api/queue/${encodeURIComponent(REQUEST_QUEUE)}/claim/heartbeat`, {
        workerId: INSTANCE_ID,
        claimToken: claim.claimToken,
        extendMs: CLAIM_LEASE_MS
      }).catch(() => {});
    }, Math.max(1000, Math.floor(CLAIM_LEASE_MS / 3)));
    heartbeat.unref?.();

    if (replyRoot) {
      try {
        const existingReply = JSON.parse(await fs.readFile(`${replyRoot}.json`, 'utf8'));
        if (existingReply?.jobId === envelope.jobId && existingReply?.serviceId === SERVICE_ID) {
          await requestJson(`/api/queue/${encodeURIComponent(REQUEST_QUEUE)}/claim/complete`, {
            workerId: INSTANCE_ID,
            claimToken: claim.claimToken,
            completionMeta: { jobId: envelope.jobId, serviceId: SERVICE_ID, serviceInstanceId: existingReply.serviceInstanceId, state: 'completed', reusedReply: true }
          });
          return;
        }
      } catch (error) {
        if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
    }

    const inputText = await fs.readFile(envelope.inputFile, 'utf8');
    const input = JSON.parse(inputText);
    const result = await runSingleMessageForEvolution({
      pcode: PCODE_PATH,
      programMap: PROGRAM_MAP_PATH,
      message: serviceMessage(input, envelope),
      inputQueue: INPUT_QUEUE,
      backendUrl: BACKEND_BASE_URL,
      serviceId: SERVICE_ID,
      actorUserId: 'system-admin',
      fitnessOut: ''
    });
    const value = result?.response
      ?? result?.deliveries?.[0]?.message
      ?? result?.stdout?.at?.(-1)
      ?? '';
    const reply = {
      value,
      response: value,
      serviceId: SERVICE_ID,
      serviceInstanceId: INSTANCE_ID,
      jobId: envelope.jobId || null,
      messageId: input.messageId || envelope.messageId || null,
      deliveries: result?.deliveries || [],
      stdout: result?.stdout || [],
      globals: result?.globals || {},
      stepCount: result?.stepCount ?? null
    };
    await writeReply(replyRoot, reply);
    await requestJson(`/api/queue/${encodeURIComponent(REQUEST_QUEUE)}/claim/complete`, {
      workerId: INSTANCE_ID,
      claimToken: claim.claimToken,
      completionMeta: { jobId: envelope.jobId, serviceId: SERVICE_ID, serviceInstanceId: INSTANCE_ID, state: 'completed' }
    });
  } catch (error) {
    if (replyRoot) {
      await fs.mkdir(path.dirname(replyRoot), { recursive: true });
      await fs.writeFile(`${replyRoot}.error.json`, `${JSON.stringify({ error: error.message }, null, 2)}\n`, 'utf8');
    }
    try {
      await requestJson(`/api/queue/${encodeURIComponent(REQUEST_QUEUE)}/claim/fail`, {
        workerId: INSTANCE_ID,
        claimToken: claim.claimToken,
        reason: error.message,
        maxAttempts: 3,
        delayMs: 1000
      });
    } catch {
      // The lease may have expired or another worker may already have completed the claim.
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

async function main() {
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  console.error(`[pmachine-service-instance] started service=${SERVICE_ID} instance=${INSTANCE_ID} queue=${REQUEST_QUEUE}`);
  while (!stopping) {
    try {
      const claim = await claimOne();
      if (claim) {
        await processClaim(claim);
        continue;
      }
    } catch (error) {
      console.error(`[pmachine-service-instance] ${INSTANCE_ID}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((error) => {
  console.error(`[pmachine-service-instance] Failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
