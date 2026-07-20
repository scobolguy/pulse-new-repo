import path from 'node:path';

function parseJsonMaybe(text) {
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildFitnessReport({ args, sourceMessage, durationMs, deliveryCount, responsePayload }) {
  const successCount = Number(deliveryCount || 0) > 0 ? 1 : 0;
  const failureCount = successCount > 0 ? 0 : 1;
  const latencyMs = Math.max(0, Number(durationMs || 0));
  const successRate = successCount > 0 ? 1 : 0;
  const retryCount = 0;
  const score = (successCount * 100000) - latencyMs - (retryCount * 1000);

  return {
    organismId: String(args.organismId || args.serviceId || 'organism-0'),
    generation: Number.parseInt(args.generation || '0', 10) || 0,
    inputQueue: String(args.inputQueue || ''),
    mode: 'esp32-edge',
    sourceMessageLength: String(sourceMessage || '').length,
    successCount,
    failureCount,
    retryCount,
    deliveryCount: Number(deliveryCount || 0),
    latencyMs,
    successRate,
    score,
    measuredAt: new Date().toISOString(),
    responseCode: Number(responsePayload?.statusCode || 0) || null,
    responseMode: String(responsePayload?.mode || ''),
    edgeNode: String(responsePayload?.edge?.edgeNode || '') || null
  };
}

export async function runSingleMessageForEsp32Evolution(args) {
  const backendBase = String(args.backendUrl || process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  const sourceMessage = String(args.message || '');
  const startedAt = Date.now();

  const response = await fetch(`${backendBase}/api/edge/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': String(args.actorUserId || 'system-admin')
    },
    body: JSON.stringify({
      inputQueue: String(args.inputQueue || 'swift.mt103.parsed'),
      message: sourceMessage,
      sourceService: String(args.serviceId || 'evolution-esp32'),
      useEdge: true
    }),
    signal: AbortSignal.timeout(Number(args.timeoutMs || 15000))
  });

  const rawText = await response.text();
  const payload = parseJsonMaybe(rawText);
  const durationMs = Date.now() - startedAt;

  const publishedCount = Number(payload?.result?.publishedCount ?? payload?.edge?.edgePublishedCount ?? payload?.publishedCount ?? 0) || 0;
  const normalizedMessage = payload?.result?.deliveries?.[0]?.delivery?.normalizedMessage
    || payload?.result?.normalizedMessage
    || payload?.edge?.normalizedMessage
    || '';

  const deliveries = Array.isArray(payload?.result?.deliveries)
    ? payload.result.deliveries.map((delivery) => ({
      queueName: String(delivery?.queueName || args.inputQueue || ''),
      message: String(delivery?.delivery?.normalizedMessage || delivery?.delivery?.message || normalizedMessage || sourceMessage || '')
    }))
    : [];

  const fitness = buildFitnessReport({
    args,
    sourceMessage,
    durationMs,
    deliveryCount: publishedCount || deliveries.length || (response.ok ? 1 : 0),
    responsePayload: payload
  });

  return {
    runtime: 'esp32-edge',
    lifecycle: {
      unitKind: 'edge',
      unitId: String(payload?.edge?.edgeNode || 'esp32-edge'),
      daemonRefreshMs: null,
      loadedAt: new Date().toISOString(),
      unloadedAt: new Date().toISOString()
    },
    pcodePath: path.relative(process.cwd(), args.pcode || ''),
    programMapPath: path.relative(process.cwd(), args.programMap || ''),
    inputQueue: String(args.inputQueue || 'swift.mt103.parsed'),
    sourceMessage,
    publishedCount: publishedCount || deliveries.length || (response.ok ? 1 : 0),
    deliveries,
    stdout: [],
    globals: {},
    orchestration: null,
    response: payload,
    error: response.ok ? null : { status: response.status, body: rawText },
    fitness
  };
}