import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { Esp32LibrarianBackend } from '../out/esp32LibrarianBackend.js';

const serviceId = 'pulse-librarian-s3-readonly';

async function withAggregator(handler, run) {
  const transactions = new Map();
  let nextId = 1;
  const server = http.createServer(async (req, res) => {
    try {
      let text = '';
      for await (const chunk of req) text += chunk;
      const body = text ? JSON.parse(text) : undefined;
      if (req.method === 'POST') {
        const transactionId = `tx-${nextId++}`;
        const behavior = await handler({ req, body, transactionId, transactions });
        transactions.set(transactionId, { behavior, body, polls: 0 });
        const acceptance = behavior.acceptance ?? {
          transactionId, status: 'allocated', statusUrl: `/api/runtime/transactions/${transactionId}`,
        };
        res.writeHead(behavior.acceptanceHttpStatus ?? 202, { 'content-type': 'application/json' });
        res.end(JSON.stringify(acceptance));
        return;
      }
      const transactionId = req.url?.split('/').pop();
      const transaction = transactions.get(transactionId);
      if (!transaction) {
        res.writeHead(404);
        res.end();
        return;
      }
      const result = await transaction.behavior.status(transaction);
      res.writeHead(result.httpStatus ?? 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { await run(baseUrl); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

function completed(transaction, page, remoteStatus = 200, envelopeStatus = 200, envelopeBody) {
  transaction.polls++;
  return {
    body: {
      transactionId: transaction.body.transactionId,
      serviceId,
      status: 'completed',
      result: {
        status: remoteStatus,
        body: { status: envelopeStatus, body: envelopeBody ?? JSON.stringify(page) },
      },
    },
  };
}

test('ESP32 catalog is routed as logical-service transactions and preserves paged metadata', async () => {
  const requests = [];
  await withAggregator(async ({ body, transactionId }) => {
    requests.push(body);
    assert.equal(body.method, 'POST');
    assert.equal(body.path, '/api/librarian/schemas/page');
    return {
      body: { transactionId },
      status: transaction => {
        if (transaction.polls === 0) {
          transaction.polls++;
          return { body: { transactionId, serviceId, status: 'waiting-child' } };
        }
        const page = transaction.body.body.cursor
          ? { entries: [{ name: 'other.xsd', kind: 'file', size: 50, modifiedAt: 'now' }], nextCursor: '' }
          : { entries: [{ name: 'Msmq.xsd', kind: 'file', size: 1804 }, { name: 'nested', kind: 'directory' }], nextCursor: 'nested' };
        return completed({ ...transaction, body: { ...transaction.body, transactionId } }, page);
      },
    };
  }, async baseUrl => {
    const api = new Esp32LibrarianBackend(baseUrl);
    assert.deepEqual(await api.schemas('schemas'), [
      { name: 'Msmq.xsd', path: 'schemas/Msmq.xsd', kind: 'file', size: 1804 },
      { name: 'nested', path: 'schemas/nested', kind: 'directory' },
      { name: 'other.xsd', path: 'schemas/other.xsd', kind: 'file', size: 50, modifiedAt: 'now' },
    ]);
    assert.deepEqual(requests.map(request => request.body), [
      { path: 'schemas', cursor: '', limit: 8 },
      { path: 'schemas', cursor: 'nested', limit: 8 },
    ]);
    assert.ok(requests.every(request => request.method === 'POST' && request.path === '/api/librarian/schemas/page'));
  });
});

test('empty catalog results remain empty and are not replaced by a fallback', async () => {
  await withAggregator(async ({ transactionId }) => ({
    body: { transactionId, status: 'held', statusUrl: `/api/runtime/transactions/${transactionId}` },
    status: transaction => completed(
      { ...transaction, body: { ...transaction.body, transactionId } },
      { entries: [], nextCursor: '' },
    ),
  }), async baseUrl => {
    assert.deepEqual(await new Esp32LibrarianBackend(baseUrl).schemas(), []);
  });
});

test('failed, uncertain, malformed and non-success remote transaction results are explicit', async () => {
  for (const status of ['failed', 'uncertain']) {
    await withAggregator(async ({ transactionId }) => ({
      status: transaction => ({
        body: { transactionId, serviceId, status, reason: 'service unavailable' },
      }),
    }), async baseUrl => assert.rejects(new Esp32LibrarianBackend(baseUrl).schemas(),
      new RegExp(`Transaction tx-1 ${status}: service unavailable`)));
  }

  await withAggregator(async ({ transactionId }) => ({
    status: transaction => completed(
      { ...transaction, body: { ...transaction.body, transactionId } }, {}, 200, 503, 'Filesystem unavailable',
    ),
  }), async baseUrl => assert.rejects(
    new Esp32LibrarianBackend(baseUrl).schemas(), /ESP32 Filesystem HTTP 503.*Filesystem unavailable/,
  ));

  await withAggregator(async ({ transactionId }) => ({
    status: transaction => completed(
      { ...transaction, body: { ...transaction.body, transactionId } }, {}, 502,
    ),
  }), async baseUrl => assert.rejects(new Esp32LibrarianBackend(baseUrl).schemas(), /ESP32 Librarian service returned HTTP 502/));

  await withAggregator(async ({ transactionId }) => ({
    status: () => ({ body: { transactionId, serviceId: 'wrong-service', status: 'held' } }),
  }), async baseUrl => assert.rejects(new Esp32LibrarianBackend(baseUrl).schemas(), /invalid status/));
});

test('transaction acceptance is validated and polling timeout retains tracking ID without cancellation', async () => {
  await withAggregator(async ({ transactionId }) => ({
    acceptance: { transactionId, status: 'allocated', statusUrl: 'http://elsewhere/transactions/1' },
    status: () => ({ body: {} }),
  }), async baseUrl => assert.rejects(new Esp32LibrarianBackend(baseUrl).schemas(), /status URL outside the configured backend/));

  let requestCount = 0;
  await withAggregator(async ({ transactionId }) => ({
    body: { transactionId, status: 'held', statusUrl: `/api/runtime/transactions/${transactionId}` },
    status: () => {
      requestCount++;
      return { body: { transactionId, serviceId, status: 'held' } };
    },
  }), async baseUrl => {
    await assert.rejects(new Esp32LibrarianBackend(baseUrl, undefined, 500).schemas(), /Transaction tx-1 did not complete.*tx-1/);
    assert.ok(requestCount > 0, 'held transactions are polled');
  });
});

test('aborted transaction polling stops promptly without cancelling the remote transaction', async () => {
  const controller = new AbortController();
  let transactionPosts = 0;
  await withAggregator(async ({ transactionId }) => ({
    body: { transactionId, status: 'held', statusUrl: `/api/runtime/transactions/${transactionId}` },
    status: () => {
      controller.abort();
      return { body: { transactionId, serviceId, status: 'held' } };
    },
  }), async baseUrl => {
    await assert.rejects(new Esp32LibrarianBackend(baseUrl, controller.signal).schemas(), /abort/i);
    transactionPosts++;
  });
  assert.equal(transactionPosts, 1);
});

test('invalid Aggregator URLs and pre-aborted requests are rejected', async () => {
  for (const url of ['file:///node', '******node', 'http://node?query=x']) {
    assert.throws(() => new Esp32LibrarianBackend(url), /HTTP\/HTTPS/);
  }
  const abort = new AbortController();
  abort.abort();
  const api = new Esp32LibrarianBackend('http://127.0.0.1:1', abort.signal);
  await assert.rejects(api.schemas(), /abort/i);
});
