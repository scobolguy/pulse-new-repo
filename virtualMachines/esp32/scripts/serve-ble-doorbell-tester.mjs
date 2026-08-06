import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const port = Number.parseInt(process.env.PORT || '8787', 10);
const cydHost = process.env.CYD_HOST || '192.168.2.155';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testerPath = path.join(root, 'tools', 'ble-doorbell-tester.html');

function proxyToCyd(request, response, targetPath, method = 'GET') {
  const upstream = http.request({ hostname: cydHost, port: 80, path: targetPath, method, headers: {
    'content-type': request.headers['content-type'] || 'application/octet-stream',
    'content-length': request.headers['content-length'] || '0'
  }, timeout: 5000 }, upstreamResponse => {
    response.writeHead(upstreamResponse.statusCode || 502, {
      'Content-Type': upstreamResponse.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-store'
    });
    upstreamResponse.pipe(response);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('CYD LAN request timed out')));
  upstream.on('error', error => {
    if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: error.message }));
  });
  if (method === 'POST') request.pipe(upstream);
  else upstream.end();
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/api/cyd/status' && request.method === 'GET') {
    proxyToCyd(request, response, '/status');
    return;
  }
  if (request.url === '/api/cyd/ring' && request.method === 'POST') {
    proxyToCyd(request, response, '/api/doorbell/ring', 'POST');
    return;
  }
  if (request.url === '/api/cyd/frame' && request.method === 'POST') {
    proxyToCyd(request, response, '/api/doorbell/frame', 'POST');
    return;
  }
  if (request.url !== '/' && request.url !== '/tools/ble-doorbell-tester.html') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  try {
    const page = await readFile(testerPath);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src blob:; connect-src 'self'"
    });
    response.end(page);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Unable to load tester: ${error.message}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CYD LAN-first doorbell tester: http://localhost:${port}`);
  console.log(`CYD LAN target: http://${cydHost}`);
});
