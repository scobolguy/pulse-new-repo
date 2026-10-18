import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchServiceResponse } from '../../aggregator/src/service-lifecycle/browser-transport.mjs';
import { createServiceInstancePolicy } from '../../aggregator/src/service-lifecycle/instance-policy.mjs';

const id = '12345678-1234-1234-1234-123456789abc';
const accepted = () => new Response('{}', {
  status: 202, headers: { 'x-pulse-transaction-id': id },
});

test('ready streaming responses pass through untouched', async () => {
  const response = new Response('{"row":1}\n', {
    headers: { 'content-type': 'application/x-ndjson', 'x-pulse-transaction-id': id },
  });
  assert.equal(await fetchServiceResponse('/api/mapper/run', {}, async () => response), response);
  assert.equal(await response.text(), '{"row":1}\n');
});

test('held browser work follows Pascalish decisions and restores exact binary results', async t => {
  const policy = await createServiceInstancePolicy();
  t.after(() => policy.stop());
  const calls = [];
  const states = ['waiting-child', 'completed'];
  const bytes = Buffer.from([0, 255, 128, 13, 10]);
  const response = await fetchServiceResponse('/api/mapper/export', { method: 'POST', body: '{}' },
    async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) return accepted();
      const status = states.shift();
      const decision = await policy.dispatch('/transaction-action', {
        transaction: { status }, elapsedMs: 0,
      });
      return Response.json({
        transactionId: id, status, clientDecision: { ...decision, pollMs: 1 },
        ...(status === 'completed' ? { result: { status: 200, body: bytes.toString('base64'),
          bodyEncoding: 'base64', contentType: 'application/octet-stream' } } : {}),
      });
    });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  assert.ok(calls.slice(1).every(call => call.url.startsWith(`/api/runtime/transactions/${id}?elapsedMs=`)));
});

test('uncertainty and timeout retain tracking identity without resubmitting', async t => {
  const policy = await createServiceInstancePolicy();
  t.after(() => policy.stop());
  for (const status of ['uncertain', 'held']) {
    let calls = 0;
    await assert.rejects(fetchServiceResponse('/api/librarian/upload', { method: 'POST' },
      async () => {
        if (++calls === 1) return accepted();
        const decision = await policy.dispatch('/transaction-action', {
          transaction: { status }, elapsedMs: 30000,
        });
        return Response.json({ transactionId: id, status, clientDecision: decision });
      }), error => error.transactionId === id && error.message.includes(id));
    assert.equal(calls, 2);
  }
});

test('status identity mismatches and aborted polling fail with the durable tracking ID', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchServiceResponse('/api/librarian/schemas', { signal: controller.signal },
    async () => {
      if (++calls === 1) return accepted();
      controller.abort(new Error('View closed'));
      return Response.json({ transactionId: id, status: 'held',
        clientDecision: { action: 'poll', pollMs: 1 } });
    }), error => error.transactionId === id && /View closed/.test(error.message));
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(fetchServiceResponse('/api/librarian/schemas', {}, async () =>
    ++calls === 1 ? accepted() : Response.json({ transactionId: 'wrong' })),
  error => error.transactionId === id && /identity mismatch/.test(error.message));
});
