import http from 'node:http';

const port = Number(process.env.COMMUNICATIONS_MAPPER_PORT || process.argv[2] || 4777);
const jobs = new Map();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(`${JSON.stringify(payload)}\n`);
}

function normalizePayload(request) {
  const payload = request?.payload || {};
  const amountText = String(payload.amount ?? '').trim().replace(',', '.');
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) throw new Error('payload.amount must be numeric');
  return {
    messageId: String(payload.reference || payload.messageId || '').trim(),
    amount,
    currency: String(payload.currency || '').trim().toUpperCase(),
  };
}

function mapRequest(request, mode) {
  const mapperId = String(request?.mapperId || '').trim();
  if (mapperId !== 'communications-normalize') throw new Error(`Unknown mapper: ${mapperId}`);
  const mapped = normalizePayload(request);
  if (!mapped.messageId || !mapped.currency) throw new Error('reference and currency are required');
  return {
    mapperId,
    sourceType: String(request.sourceType || 'swift-mt103'),
    targetType: String(request.targetType || 'pacs'),
    mode,
    payload: mapped,
  };
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', chunk => { raw += String(chunk); });
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok', service: 'communications-mapper' });
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/jobs/')) {
      const job = jobs.get(decodeURIComponent(url.pathname.slice('/jobs/'.length)));
      if (!job) {
        sendJson(response, 404, { error: 'job not found' });
        return;
      }
      sendJson(response, 200, job);
      return;
    }

    if (request.method !== 'POST' || !['/map', '/map/async'].includes(url.pathname)) {
      sendJson(response, 404, { error: 'not found' });
      return;
    }

    const body = await parseBody(request);
    const mode = url.pathname === '/map/async' ? 'async' : 'sync';
    const result = mapRequest(body, mode);
    if (mode === 'sync') {
      sendJson(response, 200, result);
      return;
    }

    const jobId = `communications-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    jobs.set(jobId, { jobId, status: 'queued', result: null });
    setTimeout(() => jobs.set(jobId, { jobId, status: 'completed', result }), 25);
    sendJson(response, 202, { jobId, status: 'queued' });
  } catch (error) {
    sendJson(response, 400, { error: error?.message || String(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[communications-mapper] listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
