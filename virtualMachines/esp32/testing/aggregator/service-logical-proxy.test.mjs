import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createServiceTransactions } from '../../aggregator/src/backend/modules/serviceTransactions.mjs';
import { registerLibrarianProxyRoutes } from '../../aggregator/src/backend/roles/librarianProxyRoutes.mjs';
import { registerMapperProxyRoutes } from '../../aggregator/src/backend/roles/mapperProxyRoutes.mjs';
import { registerServiceProcessRoutes } from '../../aggregator/src/backend/modules/serviceProcessManager.mjs';

const express = createRequire(new URL('../../aggregator/package.json', import.meta.url))('express');

test('legacy proxy routes allocate announced listeners, preserve binary and NDJSON, and hold unavailable work', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-logical-proxy-'));
  const calls = [];
  let observations = ['pulse-data-librarian', 'pulse-data-mapper'].map(serviceId => ({
    serviceId, instanceId: serviceId, reporting: 'fresh', readiness: { ready: true },
    listeners: [{ protocol: 'http', host: 'announced.test', port: 45678 }],
  }));
  const transactions = await createServiceTransactions({
    storageRoot: root, intervalMs: 60000, instances: () => observations,
    logger: { log() {}, warn() {}, error() {} },
    fetchImpl: async (url, request) => {
      calls.push({ url: url.href, ...request });
      return url.pathname.includes('upload')
        ? new Response('{"uploaded":true}', { headers: { 'content-type': 'application/json' } })
        : new Response('{"row":1}\n{"row":2}\n', { headers: { 'content-type': 'application/x-ndjson' } });
    },
  });
  const app = express();
  registerLibrarianProxyRoutes(app, { express, serviceTransactions: transactions });
  registerMapperProxyRoutes(app, { serviceTransactions: transactions });
  registerServiceProcessRoutes(app, { serviceProcessManager: {}, serviceTransactions: transactions });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await transactions.stop();
    await fs.rm(root, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const binary = Buffer.from([0, 255, 13, 10, 127]);
  const upload = await fetch(`${origin}/api/librarian/upload/schemas`, {
    method: 'POST', body: binary,
    headers: { 'content-type': 'application/octet-stream', 'x-filename': 'test.xsd' },
  });
  assert.deepEqual(await upload.json(), { uploaded: true });
  assert.deepEqual(calls[0].body, binary);
  assert.equal(calls[0].headers['x-filename'], 'test.xsd');
  assert.equal(calls[0].url, 'http://announced.test:45678/api/librarian/upload/schemas');
  const stream = await fetch(`${origin}/api/mapper/test?count=2`);
  assert.equal(stream.headers.get('content-type'), 'application/x-ndjson');
  assert.ok(stream.headers.get('x-pulse-transaction-id'));
  assert.equal(await stream.text(), '{"row":1}\n{"row":2}\n');
  assert.equal(calls[1].url, 'http://announced.test:45678/api/mapper/test?count=2');
  await transactions.reconcile();
  const status = await fetch(`${origin}/api/runtime/transactions/${stream.headers.get('x-pulse-transaction-id')}?elapsedMs=0`);
  assert.equal(status.status, 200);
  const archived = await status.json();
  assert.equal(archived.status, 'completed');
  assert.equal(archived.result.body, '{"row":1}\n{"row":2}\n');
  assert.equal(Object.hasOwn(archived, 'request'), false);
  assert.equal(archived.clientDecision.action, 'return');
  const missing = await fetch(`${origin}/api/runtime/transactions/not-a-transaction`);
  assert.equal(missing.status, 404);
  observations = [];
  const held = await fetch(`${origin}/api/librarian/catalogs`);
  assert.equal(held.status, 202);
  const tracking = await held.json();
  assert.equal(tracking.status, 'held');
  assert.equal((await transactions.get(tracking.transactionId)).serviceId, 'pulse-data-librarian');
  assert.equal(calls.length, 2);
});
