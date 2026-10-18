import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DataMapperBackend } from '../out/dataMapperBackend.js';
import { applyMappingAction, parseMapping, prototypeMapping, publicationPayload } from '../out/dataMapperModel.js';
import { LogicalServiceTransactions } from '../out/logicalServiceTransactions.js';

async function server(handler, run) {
  const transactions = new Map();
  let nextTransaction = 1;
  const instance = http.createServer(async (req, res) => {
    try {
      let text = '';
      for await (const chunk of req) text += chunk;
      const body = text ? JSON.parse(text) : undefined;
      if (req.method === 'POST' && req.url?.startsWith('/api/runtime/services/')) {
        const transactionId = `tx-${nextTransaction++}`;
        const logicalRequest = body;
        const remoteResponse = {
          status: 200,
          headers: {},
          writeHead(status) { this.status = status; },
          end(content = '') { this.content = String(content); },
        };
        const remoteReq = {
          method: logicalRequest.method, url: logicalRequest.path, serviceId: req.url.split('/')[4],
        };
        await handler(remoteReq, remoteResponse, logicalRequest.body);
        let remoteBody;
        try { remoteBody = JSON.parse(remoteResponse.content); }
        catch { remoteBody = remoteResponse.content; }
        transactions.set(transactionId, {
          serviceId: req.url.split('/')[4],
          status: remoteResponse.status,
          body: remoteBody,
        });
        return json(res, {
          transactionId, status: 'allocated', statusUrl: `/api/runtime/transactions/${transactionId}`,
        }, 202);
      }
      if (req.method === 'GET' && req.url?.startsWith('/api/runtime/transactions/')) {
        const transactionId = req.url.split('/').pop();
        const transaction = transactions.get(transactionId);
        return json(res, {
          transactionId,
          serviceId: transaction.serviceId,
          status: 'completed',
          result: { status: transaction.status, body: transaction.body },
        });
      }
      await handler(req, res, body);
    } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  try { await run(new DataMapperBackend(`http://127.0.0.1:${instance.address().port}`)); }
  finally {
    instance.closeAllConnections();
    await new Promise(resolve => instance.close(resolve));
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

test('backend lists schemas/maps/tests, creates, updates and runs the exact published map', async () => {
  let stored;
  let runs = 0;
  let writes = 0;
  const logicalRequests = [];
  await server((req, res, body) => {
    logicalRequests.push({ serviceId: req.serviceId, method: req.method, path: req.url });
    if (req.url === '/api/librarian/schemas') return json(res, { schemas: [
      { path: 'schema.json', structure: prototypeMapping().sourceStructure },
      { path: 'schema-without-tree.json', structure: null },
    ] });
    if (req.url === '/api/mapper/test-cases') return json(res, { testCases: [{ id: 'TC-1', name: 'Example' }] });
    if (req.url === '/api/mapper/maps' && req.method === 'GET') return json(res, { maps: stored ? [{ id: stored.id, name: stored.name }] : [] });
    if (req.url.endsWith('/run')) {
      runs++;
      return json(res, { mapId: stored.id, input: body.payload || { reference: 'synthetic' },
        output: { transfer: { id: body.payload?.reference || 'synthetic' } }, diagnostics: [] });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      writes++;
      stored = { ...body, submaps: req.method === 'POST' ? [] : body.submaps, updatedAt: 'now' };
      return json(res, { map: stored }, req.method === 'POST' ? 201 : 200);
    }
    return stored ? json(res, { map: stored }) : json(res, { error: 'Map not found' }, 404);
  }, async api => {
    assert.equal((await api.schemas()).length, 2);
    assert.equal((await api.testCases())[0].id, 'TC-1');
    assert.equal(await api.existingMap('missing'), undefined);
    const map = { ...prototypeMapping(), submaps: [{ id: 'child' }] };
    const created = await api.publish(map);
    assert.equal(writes, 2, 'creation preserves submaps via supported PUT');
    assert.equal((await api.maps())[0].id, map.id);
    assert.deepEqual((await api.run(map, { payload: { reference: 'R1' } })).output, { transfer: { id: 'R1' } });
    const edited = { ...map, name: 'Changed' };
    await assert.rejects(api.run(edited, { payload: {} }), /not published/);
    assert.equal(runs, 1);
    await api.publish(edited, created);
    assert.equal((await api.run(edited, { testCaseId: 'TC-1' })).input.reference, 'synthetic');
    await assert.rejects(api.run(edited, { payload: [] }), /JSON object/);
    assert.equal(runs, 2);
    assert.ok(logicalRequests.some(request => request.serviceId === 'pulse-data-librarian'
      && request.path === '/api/librarian/schemas'));
    assert.ok(logicalRequests.some(request => request.serviceId === 'pulse-data-mapper'
      && request.path === '/api/mapper/maps'));
  });
});

test('HTTP, malformed JSON, malformed lists, conflict, and cancellation errors are explicit', async () => {
  for (const [response, pattern] of [
    [res => json(res, { error: 'Invalid embedded JSON' }, 500), /Invalid embedded JSON/],
    [res => { res.writeHead(200); res.end('<html>offline</html>'); }, /invalid response object/],
    [res => json(res, { schemas: {} }), /invalid schemas list/],
    [res => json(res, { schemas: [{ path: 'bad', structure: [] }] }), /valid field structure/],
  ]) await server((req, res) => response(res), api => assert.rejects(api.schemas(), pattern));
  await server((req, res) => json(res, { error: 'Denied' }, 403), async api => {
    await assert.rejects(api.existingMap('id'), /Denied/);
  });
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(new DataMapperBackend('http://127.0.0.1:1', aborted.signal).schemas(), /abort/i);
  for (const url of ['file:///test', 'http://user:secret@localhost', 'http://localhost?query=x']) {
    assert.throws(() => new DataMapperBackend(url), /HTTP\/HTTPS/);
  }
  let puts = 0;
  await server((req, res) => {
    if (req.method === 'PUT') puts++;
    return json(res, { map: { ...prototypeMapping(), updatedAt: 'changed' } });
  }, async api => {
    await assert.rejects(api.publish(prototypeMapping(), prototypeMapping()), /changed during confirmation/);
    assert.equal(puts, 0);
  });
});

test('logical transaction transport polls held results and never replays uncertain work', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(String(url));
    calls.push({ target, method: options.method ?? 'GET', body: options.body && JSON.parse(options.body) });
    if (target.pathname.endsWith('/transactions')) {
      return Response.json({
        transactionId: 'held-1', status: 'held', statusUrl: '/api/runtime/transactions/held-1',
      }, { status: 202 });
    }
    if (target.pathname.endsWith('/held-1')) {
      return Response.json(calls.filter(call => call.target.pathname.endsWith('/held-1')).length === 1
        ? { transactionId: 'held-1', serviceId: 'pulse-data-librarian', status: 'held' }
        : {
          transactionId: 'held-1',
          serviceId: 'pulse-data-librarian',
          status: 'completed',
          result: { status: 200, body: { schemas: [] } },
        });
    }
    return Response.json({
      transactionId: 'uncertain-1', serviceId: 'pulse-data-librarian', status: 'uncertain',
      reason: 'owner restarted after dispatch',
    });
  };
  try {
    const transactions = new LogicalServiceTransactions('http://aggregator.test');
    assert.deepEqual(await transactions.request('pulse-data-librarian', {
      method: 'GET', path: '/api/librarian/schemas',
    }), { status: 200, body: { schemas: [] } });
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
    assert.deepEqual(calls[0].body, { method: 'GET', path: '/api/librarian/schemas' });
    assert.equal(calls.filter(call => call.target.pathname.endsWith('/held-1')).length, 2);

    let transactionPosts = 0;
    globalThis.fetch = async (url, options = {}) => {
      const target = new URL(String(url));
      if (options.method === 'POST') {
        transactionPosts++;
        return Response.json({
          transactionId: 'uncertain-1', status: 'allocated',
          statusUrl: '/api/runtime/transactions/uncertain-1',
        }, { status: 202 });
      }
      return Response.json({
        transactionId: 'uncertain-1',
        serviceId: 'pulse-data-librarian',
        status: 'uncertain',
        reason: 'owner restarted after dispatch',
      });
    };
    await assert.rejects(
      new LogicalServiceTransactions('http://aggregator.test').request('pulse-data-librarian', {
        method: 'GET', path: '/api/librarian/schemas',
      }),
      /Transaction uncertain-1 uncertain: owner restarted after dispatch/,
    );
    assert.equal(transactionPosts, 1, 'uncertain operations are reported, never replayed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live Aggregator publish/update/PL0 run and stale-local prevention', {
  skip: !process.env.PULSE_MAPPER_TEST_URL,
}, async () => {
  const api = new DataMapperBackend(process.env.PULSE_MAPPER_TEST_URL);
  const id = `vscode-designer-test-${randomUUID()}`;
  let created = false;
  let map = { ...prototypeMapping(), id, name: 'Temporary VS Code designer acceptance test' };
  try {
    let saved = await api.publish(map);
    created = true;
    assert.equal((await api.maps()).some(entry => entry.id === id), true);
    assert.equal((await api.map(id)).id, id);
    const input = { reference: '  PAY-42  ', amount: 12.5 };
    assert.deepEqual((await api.run(map, { payload: input })).output, { transfer: { id: '  PAY-42  ' } });
    map = applyMappingAction(map, { type: 'connect', sourcePath: 'amount', targetPath: 'transfer.instructedAmount' });
    map = applyMappingAction(map, { type: 'conversion', index: 0, conversionRule: 'output := trim(src);' });
    await assert.rejects(api.run(map, { payload: input }), /not published/);
    saved = await api.publish(map, saved);
    const result = await api.run(map, { payload: input });
    assert.deepEqual(result.output, { transfer: { id: 'PAY-42', instructedAmount: 12.5 } });
    assert.equal(result.diagnostics.some(item => item.level === 'info'), true);
    assert.equal(publicationPayload(parseMapping(JSON.stringify(saved))).rules.length, 2);
  } finally {
    if (created) {
      const response = await fetch(`${api.baseUrl}/api/mapper/maps/${encodeURIComponent(id)}`, { method: 'DELETE' });
      assert.equal(response.ok, true, 'temporary acceptance map must be removed');
    }
  }
});
