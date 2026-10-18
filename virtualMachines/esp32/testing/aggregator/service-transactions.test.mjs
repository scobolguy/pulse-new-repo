import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createServiceTransactions } from '../../aggregator/src/backend/modules/serviceTransactions.mjs';

const logger = { log() {}, warn() {}, error: console.error };
const ready = {
  instanceId: 'files-1', serviceId: 'pulse-filesystem', reporting: 'fresh',
  readiness: { ready: true }, listeners: [{ protocol: 'http', host: '127.0.0.1', port: 54321 }],
};
async function directory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-service-transactions-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function seedRecord(storageRoot, extra = {}) {
  const record = {
    transactionId: randomUUID(), serviceId: 'pulse-filesystem',
    request: { method: 'GET', path: '/read' }, responseLimit: 1000000,
    status: 'completed', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z',
    result: { status: 200, body: { items: ['schema.xsd'] } }, ...extra,
  };
  await fs.writeFile(path.join(storageRoot, `${record.transactionId}.json`), JSON.stringify(record));
  return record;
}

test('a full 10,000-record completed backlog is archived on startup and remains queryable after restart', async t => {
  const storageRoot = await directory(t);
  let first;
  for (let batch = 0; batch < 100; batch++) {
    const records = await Promise.all(Array.from({ length: 100 }, () => seedRecord(storageRoot)));
    first ||= records[0];
  }
  let calls = 0;
  const options = { storageRoot, logger, intervalMs: 60000, instances: () => [],
    fetchImpl: async () => { calls++; assert.fail('completed history must not be replayed'); } };
  let store = await createServiceTransactions(options);
  assert.equal((await fs.readdir(storageRoot)).filter(name => name.endsWith('.json')).length, 0);
  assert.equal((await fs.readdir(path.join(storageRoot, 'archive'))).length, 10000);
  assert.deepEqual(await store.get(first.transactionId), first);
  const accepted = await store.submit('pulse-filesystem', { method: 'GET', path: '/new' });
  assert.equal(accepted.status, 'held');
  await store.stop();
  store = await createServiceTransactions(options);
  t.after(() => store.stop());
  assert.deepEqual(await store.get(first.transactionId), first);
  assert.equal((await store.get(accepted.transactionId)).status, 'held');
  assert.equal(calls, 0);
  assert.equal(await store.get('../archive'), undefined);
  assert.equal(await store.get(randomUUID()), undefined);
});

test('admission archives completed records at capacity but preserves protected work', async t => {
  const storageRoot = await directory(t);
  let observations = [ready];
  const store = await createServiceTransactions({
    storageRoot, logger, intervalMs: 60000, maxRecords: 2, instances: () => observations,
    fetchImpl: async () => new Response('{"items":["schema.xsd"]}'),
  });
  t.after(() => store.stop());
  const completed = await store.submit('pulse-filesystem', { method: 'GET', path: '/read' });
  await waitFor(store, completed.transactionId, 'completed');
  observations = [];
  const held = await store.submit('pulse-filesystem', { method: 'GET', path: '/held' });
  const next = await store.submit('pulse-filesystem', { method: 'GET', path: '/next' });
  assert.equal(next.status, 'held');
  assert.equal((await store.get(held.transactionId)).status, 'held');
  assert.equal((await store.get(completed.transactionId)).status, 'completed');
  assert.deepEqual(await fs.readdir(path.join(storageRoot, 'archive')), [`${completed.transactionId}.json`]);
  await assert.rejects(store.submit('pulse-filesystem', { method: 'GET', path: '/full' }),
    error => error.status === 503 && /storage capacity/.test(error.message));
});

test('reconciliation archives unreferenced completion and request clients can read archived results', async t => {
  const storageRoot = await directory(t);
  let store;
  store = await createServiceTransactions({
    storageRoot, logger, intervalMs: 60000, instances: () => [ready],
    fetchImpl: async () => new Response('{"items":["schema.xsd"]}'),
  });
  t.after(() => store.stop());
  const result = store.request('pulse-filesystem', { method: 'GET', path: '/read' });
  let id;
  while (!id) {
    id = (await fs.readdir(storageRoot)).find(name => name.endsWith('.json'))?.slice(0, -5);
    if (!id) await new Promise(resolve => setTimeout(resolve, 10));
  }
  await waitFor(store, id, 'completed');
  await store.reconcile();
  assert.equal((await fs.readdir(storageRoot)).filter(name => name.endsWith('.json')).length, 0);
  assert.deepEqual(await result, { status: 200, body: { items: ['schema.xsd'] }, contentType: 'text/plain;charset=UTF-8' });
  await fs.writeFile(path.join(storageRoot, 'archive', `${id}.json`), '{broken');
  await assert.rejects(store.get(id), SyntaxError);
});

test('completed children remain active until their live parents consume their result', async t => {
  const storageRoot = await directory(t);
  const parentId = randomUUID();
  const child = await seedRecord(storageRoot, { parentTransactionId: parentId });
  const parent = await seedRecord(storageRoot, {
    transactionId: parentId, status: 'waiting-child', childTransactionId: child.transactionId,
    childServiceId: child.serviceId, result: undefined,
  });
  const uncertain = await seedRecord(storageRoot, { status: 'uncertain', result: undefined });
  const allocated = await seedRecord(storageRoot, { status: 'allocated', result: undefined });
  const store = await createServiceTransactions({
    storageRoot, logger, intervalMs: 60000, instances: () => [],
    fetchImpl: async () => assert.fail('restored dispatched work must not be replayed'),
  });
  t.after(() => store.stop());
  assert.deepEqual(await fs.readdir(path.join(storageRoot, 'archive')), []);
  assert.equal((await store.get(child.transactionId)).status, 'completed');
  assert.equal((await store.get(allocated.transactionId)).status, 'uncertain');
  await store.reconcile();
  assert.equal((await store.get(parent.transactionId)).status, 'completed');
  assert.deepEqual((await fs.readdir(path.join(storageRoot, 'archive'))).sort(),
    [`${child.transactionId}.json`, `${parent.transactionId}.json`].sort());
  assert.equal((await store.get(uncertain.transactionId)).status, 'uncertain');
  assert.equal((await store.get(allocated.transactionId)).status, 'uncertain');
});

test('held transactions survive restart and use only a ready advertised listener', async t => {
  const storageRoot = await directory(t);
  let observations = [{ ...ready, readiness: { ready: false } }];
  const requests = [];
  const options = { storageRoot, logger, intervalMs: 60000, aggregatorId: 'test-ingress',
    instances: () => observations,
    fetchImpl: async (url, request) => {
      requests.push({ url: String(url), request });
      return new Response('{"status":"ok","body":{"items":[]}}', { status: 200 });
    },
  };
  let store = await createServiceTransactions(options);
  const accepted = await store.submit('pulse-filesystem', { method: 'POST', path: '/api/files/read', body: { path: 'hello' } });
  assert.equal(accepted.status, 'held');
  assert.equal(requests.length, 0);
  const persisted = JSON.parse(await fs.readFile(path.join(storageRoot, `${accepted.transactionId}.json`), 'utf8'));
  assert.equal(persisted.status, 'held');
  await store.stop();
  store = await createServiceTransactions(options);
  observations = [ready];
  await store.reconcile();
  await store.stop();
  const result = await store.get(accepted.transactionId);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.result.body, { status: 'ok', body: { items: [] } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:54321/api/files/read');
  assert.equal(requests[0].request.headers['x-pulse-transaction-id'], accepted.transactionId);
  assert.equal(requests[0].request.headers['x-pulse-ingress-aggregator-id'], 'test-ingress');
});
test('ambiguous dispatch is held uncertain without replay, including after restart', async t => {
  const storageRoot = await directory(t);
  let calls = 0;
  const options = { storageRoot, logger, intervalMs: 60000, instances: () => [ready],
    fetchImpl: async () => { calls++; throw new Error('Connection lost after sending'); } };
  let store = await createServiceTransactions(options);
  const accepted = await store.submit('pulse-filesystem', { method: 'POST', path: '/write', body: 'value' });
  assert.equal(accepted.status, 'allocated');
  await store.stop();
  assert.equal((await store.get(accepted.transactionId)).status, 'uncertain');
  store = await createServiceTransactions(options);
  await store.reconcile();
  await store.stop();
  assert.equal(calls, 1);
  assert.equal((await store.get(accepted.transactionId)).status, 'uncertain');
});
test('stale or missing listener reports cannot allocate; invalid paths are rejected', async t => {
  const storageRoot = await directory(t);
  const store = await createServiceTransactions({ storageRoot, logger, intervalMs: 60000,
    instances: () => [{ ...ready, reporting: 'stale' }, { ...ready, instanceId: 'files-2', listeners: [] }],
    fetchImpl: async () => { assert.fail('must not dispatch'); } });
  t.after(() => store.stop());
  const accepted = await store.submit('pulse-filesystem', { method: 'GET', path: '/read' });
  assert.equal(accepted.status, 'held');
  await assert.rejects(store.submit('pulse-filesystem', { method: 'GET', path: '//evil.test/read' }), /Invalid/);
  await assert.rejects(store.submit('pulse-filesystem', { method: 'POST', path: '/read', body: 'x'.repeat(65537) }), /capacity/);
});

test('allocation requires fresh bound identities throughout the dependency chain and rejects cycles', async t => {
  const storageRoot = await directory(t);
  let calls = 0;
  let observations = [
    { ...ready, serviceId: 'pulse-data-librarian', instanceId: 'librarian',
      dependencies: { 'pulse-filesystem': { instanceId: 'files-1' } } },
    { ...ready, reporting: 'stale' },
  ];
  const store = await createServiceTransactions({
    storageRoot, logger, intervalMs: 60000, instances: () => observations,
    fetchImpl: async () => { calls++; return new Response('{}'); },
  });
  const accepted = await store.submit('pulse-data-librarian', { method: 'GET', path: '/catalogs' });
  assert.equal(accepted.status, 'held');
  assert.equal((await store.snapshot()).find(instance => instance.instanceId === 'librarian').dependencyChainReady, false);
  observations[1] = { ...ready, serviceId: 'wrong-service' };
  await store.reconcile();
  assert.equal(calls, 0);
  observations[1] = { ...ready, dependencies: { 'pulse-data-librarian': { instanceId: 'librarian' } } };
  await store.reconcile();
  assert.equal(calls, 0);
  observations[1] = ready;
  assert.equal((await store.snapshot()).find(instance => instance.instanceId === 'librarian').dependencyChainReady, true);
  await store.reconcile();
  await store.stop();
  assert.equal(calls, 1);
  assert.equal((await store.get(accepted.transactionId)).status, 'completed');
});

async function waitFor(store, id, status) {
  const deadline = Date.now() + 3000;
  while ((await store.get(id))?.status !== status && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal((await store.get(id))?.status, status);
}

test('native continuations persist while held and resolve after restart without replaying the parent', async t => {
  const storageRoot = await directory(t);
  let calls = 0;
  let observations = [ready, {
    ...ready, instanceId: 'board', serviceId: 'pulse-librarian-s3-readonly',
    listeners: [{ protocol: 'http', host: 'board', port: 80 }],
    dependencies: { 'pulse-filesystem': { instanceId: ready.instanceId } },
  }];
  let store;
  const options = { storageRoot, logger, intervalMs: 60000, instances: () => observations,
    fetchImpl: async (url, request) => {
      calls++;
      if (url.hostname === 'board') {
        observations = [];
        await assert.rejects(store.submit('pulse-filesystem', {
          method: 'POST', path: '/read', body: {},
        }, { parentTransactionId: request.headers['x-pulse-transaction-id'], parentInstanceId: 'other-board' }),
        error => error.status === 409);
        const child = await store.submit('pulse-filesystem', {
          method: 'POST', path: '/read', body: {},
        }, { parentTransactionId: request.headers['x-pulse-transaction-id'], parentInstanceId: 'board' });
        return new Response(JSON.stringify({
          pulseContinuation: { transactionId: child.transactionId, serviceId: child.serviceId },
        }), { status: 202 });
      }
      return new Response('{"items":["schema.xsd"]}');
    } };
  store = await createServiceTransactions(options);
  const parent = await store.submit('pulse-librarian-s3-readonly', { method: 'POST', path: '/catalogs', body: {} });
  await waitFor(store, parent.transactionId, 'waiting-child');
  const childId = (await store.get(parent.transactionId)).childTransactionId;
  assert.equal((await store.get(childId)).status, 'held');
  await store.stop();
  store = await createServiceTransactions(options);
  await store.reconcile();
  assert.equal(calls, 1);
  observations = [ready];
  await store.reconcile();
  await waitFor(store, childId, 'completed');
  await store.reconcile();
  const result = await store.get(parent.transactionId);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.result, { status: 200, body: { status: 200, body: '{"items":["schema.xsd"]}' } });
  assert.equal(calls, 2);
  await store.stop();
});

test('oversized streamed responses become uncertain before the complete response is buffered', async t => {
  const storageRoot = await directory(t);
  let chunksRead = 0;
  let cancelled = false;
  const store = await createServiceTransactions({ storageRoot, logger, intervalMs: 60000,
    instances: () => [ready], fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) { chunksRead++; controller.enqueue(new Uint8Array(250000)); },
      cancel() { cancelled = true; },
    })) });
  const record = await store.submit('pulse-filesystem', { method: 'GET', path: '/read' });
  await waitFor(store, record.transactionId, 'uncertain');
  assert.match((await store.get(record.transactionId)).transportError, /capacity/);
  assert.equal(cancelled, true);
  assert.ok(chunksRead <= 6);
  await store.stop();
});

test('unrelated continuation IDs cannot be used to complete a parent transaction', async t => {
  const storageRoot = await directory(t);
  let unrelated;
  const store = await createServiceTransactions({ storageRoot, logger, intervalMs: 60000,
    instances: () => [ready, {
      ...ready, instanceId: 'board', serviceId: 'pulse-librarian-s3-readonly',
      dependencies: { 'pulse-filesystem': { instanceId: ready.instanceId } },
    }],
    fetchImpl: async url => url.pathname === '/parent'
      ? new Response(JSON.stringify({ pulseContinuation: {
        transactionId: unrelated.transactionId, serviceId: 'pulse-filesystem',
      } }), { status: 202 }) : new Response('{}'),
  });
  unrelated = await store.submit('pulse-filesystem', { method: 'GET', path: '/read' });
  await waitFor(store, unrelated.transactionId, 'completed');
  const parent = await store.submit('pulse-librarian-s3-readonly', { method: 'GET', path: '/parent' });
  await waitFor(store, parent.transactionId, 'uncertain');
  assert.match((await store.get(parent.transactionId)).transportError, /Invalid or unbound/);
  await store.stop();
});

test('binary results retain exact bytes and have an explicit tracking encoding', async t => {
  const storageRoot = await directory(t);
  const bytes = Buffer.from([0, 255, 128, 13, 10]);
  const store = await createServiceTransactions({ storageRoot, logger, intervalMs: 60000,
    instances: () => [ready],
    fetchImpl: async () => new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }),
  });
  const accepted = await store.submit('pulse-filesystem', { method: 'GET', path: '/binary' });
  await waitFor(store, accepted.transactionId, 'completed');
  const result = (await store.get(accepted.transactionId)).result;
  assert.equal(result.bodyEncoding, 'base64');
  assert.deepEqual(Buffer.from(result.body, result.bodyEncoding), bytes);
  await store.stop();
});

test('uncertain child outcomes propagate through multiple continuation levels without replay', async t => {
  const storageRoot = await directory(t);
  const observations = [
    ready,
    { ...ready, instanceId: 'librarian', serviceId: 'pulse-data-librarian',
      listeners: [{ protocol: 'http', host: 'librarian', port: 80 }],
      dependencies: { 'pulse-filesystem': { instanceId: ready.instanceId } } },
    { ...ready, instanceId: 'mapper', serviceId: 'pulse-data-mapper',
      listeners: [{ protocol: 'http', host: 'mapper', port: 80 }],
      dependencies: { 'pulse-data-librarian': { instanceId: 'librarian' } } },
  ];
  let calls = 0;
  let store;
  const options = { storageRoot, logger, intervalMs: 60000, instances: () => observations,
    fetchImpl: async (url, request) => {
      calls++;
      const serviceId = url.hostname === 'mapper' ? 'pulse-data-librarian'
        : url.hostname === 'librarian' ? 'pulse-filesystem' : null;
      if (!serviceId) throw new Error('Connection lost after sending child');
      const child = await store.submit(serviceId, { method: 'POST', path: '/read', body: {} },
        { parentTransactionId: request.headers['x-pulse-transaction-id'] });
      return new Response(JSON.stringify({
        pulseContinuation: { transactionId: child.transactionId, serviceId },
      }), { status: 202 });
    } };
  store = await createServiceTransactions(options);
  const parent = await store.submit('pulse-data-mapper', { method: 'POST', path: '/run', body: {} });
  await waitFor(store, parent.transactionId, 'waiting-child');
  const childId = (await store.get(parent.transactionId)).childTransactionId;
  await waitFor(store, childId, 'waiting-child');
  const grandchildId = (await store.get(childId)).childTransactionId;
  await waitFor(store, grandchildId, 'uncertain');
  await store.reconcile();
  await store.reconcile();
  assert.equal((await store.get(childId)).status, 'uncertain');
  assert.equal((await store.get(parent.transactionId)).status, 'uncertain');
  assert.match((await store.get(parent.transactionId)).transportError, /Connection lost/);
  await store.stop();
  store = await createServiceTransactions(options);
  await store.reconcile();
  assert.equal(calls, 3);
  assert.equal((await store.get(parent.transactionId)).status, 'uncertain');
  await store.stop();
});
