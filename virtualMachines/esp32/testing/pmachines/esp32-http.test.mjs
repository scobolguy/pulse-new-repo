import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { requestEsp32 } from './esp32-http.mjs';

async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('hardware HTTP client sends form and raw uploads with explicit lengths', async t => {
  const received = [];
  const origin = await serve(t, (request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      received.push({ headers: request.headers, body: Buffer.concat(chunks).toString() });
      response.writeHead(201);
      response.end('uploaded');
    });
  });
  const form = new URLSearchParams({ file: '/probe.json', body: '{"ok":true}' });
  const response = await requestEsp32(origin, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  assert.equal(response.ok, true);
  assert.equal(await response.text(), 'uploaded');
  await requestEsp32(origin, {
    method: 'POST', body: 'PHI1', headers: { 'Content-Type': 'application/octet-stream' }
  });
  assert.equal(received[0].body, form.toString());
  assert.equal(received[0].headers['content-type'], 'application/x-www-form-urlencoded');
  assert.equal(Number(received[0].headers['content-length']), Buffer.byteLength(form.toString()));
  assert.equal(received[1].body, 'PHI1');
  assert.equal(received[1].headers['content-length'], '4');
});

test('hardware HTTP deadline covers a stalled response body', async t => {
  const origin = await serve(t, (_request, response) => {
    response.writeHead(200);
    response.write('partial');
  });
  await assert.rejects(requestEsp32(origin, { timeoutMs: 100 }), /abort/i);
});

test('hardware HTTP client honors cancellation and preserves HTTP failures', async t => {
  const origin = await serve(t, (request, response) => {
    if (request.url === '/failure') {
      response.writeHead(503);
      response.end('busy');
    }
  });
  const response = await requestEsp32(`${origin}/failure`);
  assert.equal(response.status, 503);
  assert.equal(response.ok, false);
  assert.equal(await response.text(), 'busy');
  const controller = new AbortController();
  const pending = requestEsp32(origin, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /abort/i);
});
