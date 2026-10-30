import http from 'node:http';
import fs from 'node:fs/promises';
import { runRequester } from './requester.mjs';

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 8192) throw Object.assign(new Error('Request exceeds 8 KiB'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON request'), { status: 400 }); }
}

export async function createPathwayHttpServer(controller, requester, { host = '127.0.0.1', port = 4320 } = {}) {
  const files = new Map(await Promise.all([
    ['/', 'index.html', 'text/html'], ['/screen.mjs', 'screen.mjs', 'text/javascript'],
    ['/request-recovery.mjs', 'request-recovery.mjs', 'text/javascript'],
  ].map(async ([route, name, mime]) => [route, { mime, body: await fs.readFile(new URL(`../public/${name}`, import.meta.url)) }])));
  const reply = (response, status, value) => {
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      // Same-origin browser API; no CORS or unauthenticated remote deployment interface.
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        return reply(response, 403, { error: 'Cross-origin request rejected' });
      }
      if (request.method === 'GET' && files.has(url.pathname)) {
        const file = files.get(url.pathname);
        response.writeHead(200, {
          'content-type': file.mime, 'cache-control': 'no-store',
          'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
        });
        return response.end(file.body);
      }
      if (request.method === 'GET' && url.pathname === '/api/screen') return reply(response, 200, requester.programMap.screenCobol);
      if (request.method === 'GET' && url.pathname === '/api/status') return reply(response, 200, controller.snapshot());
      if (request.method === 'POST' && url.pathname === '/api/requester') {
        const body = await readJson(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected requester object');
        const result = await runRequester(requester, body.values,
          (name, record, options) => controller.send(name, record, options), { requestId: body.requestId });
        return reply(response, 200, { ...result, ...(body.requestId ? { requestId: body.requestId } : {}) });
      }
      return reply(response, 404, { error: 'Not found' });
    } catch (error) {
      controller.report(`HTTP requester: ${error.message}`);
      reply(response, error.status ?? 400, { error: error.message, uncertain: error.uncertain === true });
    }
  });
  server.requestTimeout = 15000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}
