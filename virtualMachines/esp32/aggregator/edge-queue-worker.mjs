import process from 'node:process';

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const queueManagerUrl = String(arg('qm', process.env.EDGE_QM_URL || 'http://127.0.0.1:4100')).replace(/\/+$/, '');
const esp32Url = String(arg('esp32', process.env.EDGE_ESP32_URL || 'http://192.168.2.155')).replace(/\/+$/, '');
const inputQueue = arg('input-queue', process.env.EDGE_INPUT_QUEUE || 'edge.generic-mapper.requests');
const defaultReplyQueue = arg('reply-queue', process.env.EDGE_REPLY_QUEUE || 'edge.generic-mapper.replies');
const workerId = arg('worker-id', process.env.EDGE_WORKER_ID || `edge-queue-worker-${process.pid}`);
const pcodeFile = arg('file', process.env.EDGE_PCODE_FILE || '/generic-mapper-bench.pcode');
const programMap = arg('program-map', process.env.EDGE_PROGRAM_MAP || '/generic-mapper-bench.map.json');
const leaseMs = Number(arg('lease-ms', process.env.EDGE_LEASE_MS || '30000'));
const idleMs = Number(arg('idle-ms', process.env.EDGE_IDLE_MS || '250'));
const maxBytes = Number(arg('max', process.env.EDGE_MAX_BYTES || '65536'));
const once = process.argv.includes('--once');

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${queueManagerUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) {
    const error = new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function claim() {
  try {
    const body = await jsonRequest('/claim', {
      method: 'POST',
      body: JSON.stringify({ queueName: inputQueue, workerId, leaseMs })
    });
    return body.claim || null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function enqueue(queueName, message, messageId, correlationId, sourceService) {
  return jsonRequest('/enqueue', {
    method: 'POST',
    body: JSON.stringify({
      queueName,
      message,
      sourceService,
      messageId,
      messageEnvelope: { correlationId, messageId, sourceService }
    })
  });
}

async function invokeEsp32(message, sourceQueue) {
  const form = new URLSearchParams({
    file: pcodeFile,
    programMap,
    inputQueue: sourceQueue,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    runRouter: '1',
    async: '0',
    max: String(maxBytes)
  });
  const response = await fetch(`${esp32Url}/pmachine/edge_ingress_stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: form,
    signal: AbortSignal.timeout(45000)
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) throw new Error(`ESP32 failed (${response.status}): ${text.slice(0, 400)}`);
  if (!Array.isArray(body.deliveries)) throw new Error('ESP32 response has no deliveries array');
  return body;
}

async function processClaim(claimed) {
  const claimToken = claimed.claimToken;
  const envelope = claimed.message?.messageEnvelope || {};
  const payload = claimed.message?.message ?? claimed.message;
  const messageId = String(claimed.message?.messageId || envelope.messageId || `claim-${claimToken}`);
  const correlationId = String(envelope.correlationId || messageId);
  const replyQueue = String(envelope.replyQueue || defaultReplyQueue);
  const heartbeat = setInterval(() => {
    jsonRequest('/claim/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ queueName: inputQueue, workerId, claimToken, extendMs: leaseMs })
    }).catch(error => console.error(`[edge-worker] heartbeat failed ${claimToken}: ${error.message}`));
  }, Math.max(1000, Math.floor(leaseMs / 2)));

  try {
    const execution = await invokeEsp32(payload, inputQueue);
    const published = [];
    for (const [index, delivery] of execution.deliveries.entries()) {
      const deliveryId = `${messageId}:delivery:${index}`;
      await enqueue(delivery.queueName, delivery.message, deliveryId, correlationId, workerId);
      published.push({ queueName: delivery.queueName, messageId: deliveryId });
    }
    await enqueue(replyQueue, {
      type: 'edge.transaction.completed',
      correlationId,
      messageId,
      published,
      publishedCount: published.length,
      execution: {
        messageType: execution.messageType || null,
        conversionApplied: Boolean(execution.conversionApplied),
        stepCount: execution.stepCount || 0
      }
    }, `${messageId}:completed`, correlationId, workerId);
    const result = await jsonRequest('/claim/complete', {
      method: 'POST',
      body: JSON.stringify({ queueName: inputQueue, workerId, claimToken, completionMeta: { correlationId, messageId, published } })
    });
    return { status: 'completed', correlationId, messageId, published, result };
  } catch (error) {
    const detail = String(error?.message || error);
    await jsonRequest('/claim/fail', {
      method: 'POST',
      body: JSON.stringify({ queueName: inputQueue, workerId, claimToken, reason: detail })
    }).catch(failure => console.error(`[edge-worker] failed to record failure: ${failure.message}`));
    return { status: 'failed', correlationId, messageId, error: detail };
  } finally {
    clearInterval(heartbeat);
  }
}

async function main() {
  console.log(`[edge-worker] ${workerId} consuming ${inputQueue} via ${queueManagerUrl}`);
  do {
    const claimed = await claim();
    if (!claimed) {
      if (once) return;
      await new Promise(resolve => setTimeout(resolve, idleMs));
      continue;
    }
    const result = await processClaim(claimed);
    console.log(`[edge-worker] ${result.status} correlationId=${result.correlationId} messageId=${result.messageId}`);
  } while (!once);
}

main().catch(error => {
  console.error(`[edge-worker] fatal: ${error.stack || error}`);
  process.exitCode = 1;
});
