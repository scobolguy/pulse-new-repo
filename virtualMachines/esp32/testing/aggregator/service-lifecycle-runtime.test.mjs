import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  createServiceLifecycleRuntime, readServiceLifecycleConfig, describeBoundHttpListener,
} from '../../aggregator/src/service-lifecycle-runtime.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createFilesystemService } from '../../aggregator/filesystem-service.mjs';
import { createFilesystemServiceClient } from '../../aggregator/src/librarian/filesystem-service-client.mjs';
import { createLogicalServiceTransport } from '../../aggregator/src/service-lifecycle/transaction-transport.mjs';

async function server(t, handler) {
  const service = http.createServer(handler);
  await new Promise(resolve => service.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    service.closeAllConnections();
    service.close(resolve);
  }));
  return `http://127.0.0.1:${service.address().port}`;
}

test('transport reports while blocked, recovers without restart, and probes the explicitly bound useful endpoint', async t => {
  let ready = false;
  let useful = false;
  const received = [];
  const calls = [];
  const transactions = new Map();
  const dependency = await server(t, (req, res) => {
    calls.push(req.url);
    res.setHeader('content-type', 'application/json');
    res.statusCode = req.url === '/ready' ? (ready ? 200 : 503) : (useful ? 200 : 503);
    res.end(JSON.stringify(req.url === '/ready' ? { ready, instanceId: 'dep-1' } : { result: 'catalog' }));
  });
  const aggregator = await server(t, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/api/runtime/services/')) {
      const id = `tx-${transactions.size}`;
      transactions.set(id, JSON.parse(Buffer.concat(chunks)));
      res.statusCode = 202;
      res.end(JSON.stringify({ transactionId: id, status: 'allocated', statusUrl: `/api/runtime/transactions/${id}` }));
      return;
    }
    if (req.url.startsWith('/api/runtime/transactions/')) {
      const id = req.url.split('/').at(-1);
      const request = transactions.get(id);
      const upstream = await fetch(`${dependency}${request.path}`);
      res.end(JSON.stringify({ transactionId: id, status: 'completed', result: {
        status: upstream.status, body: await upstream.json(),
      } }));
      return;
    }
    received.push({ path: req.url, authorization: req.headers.authorization, report: JSON.parse(Buffer.concat(chunks)) });
    res.end('{}');
  });
  const config = readServiceLifecycleConfig({
    serviceId: 'pulse-data-mapper', requires: ['pulse-data-librarian'],
    env: {
      PULSE_SERVICE_BINDINGS: JSON.stringify({
        'pulse-data-librarian': { instanceId: 'dep-1', endpoint: dependency, readinessUrl: `${dependency}/ready` },
      }),
      PULSE_AGGREGATOR_URLS: JSON.stringify([aggregator]),
      PULSE_SERVICE_INSTANCE_ID: 'mapper-1', PULSE_OWNER_AGGREGATOR_ID: 'owner-1',
      PULSE_RUNTIME_REPORT_TOKEN: 'test-only-token',
    },
  });
  const runtime = await createServiceLifecycleRuntime({
    config, usefulOperations: { 'pulse-data-librarian': { path: '/catalog' } },
    logger: { warn() {}, error() {} },
  });
  t.after(() => runtime.stop());
  await runtime.start('http://127.0.0.1:12345', [
    { protocol: 'http', host: '127.0.0.1', port: 12345, endpoint: 'http://127.0.0.1:12345' },
  ]);
  await runtime.reportNow();
  assert.equal(runtime.getReadiness().ready, false);
  assert.equal((await runtime.gate('/work')).status, 503);
  for (const route of ['/health', '/ready', '/api/runtime/instances/report', '/pmachine/service_host/status']) {
    assert.equal((await runtime.gate(route)).allowed, true);
  }
  assert.ok(received.length > 0);
  assert.equal(received[0].report.readiness.ready, false);
  assert.equal(received[0].authorization, 'Bearer test-only-token');
  assert.equal(received[0].report.dependencies['pulse-data-librarian'].endpoint, dependency);
  assert.equal(received[0].report.listeners[0].port, 12345);
  ready = true;
  await runtime.refresh();
  assert.equal(runtime.getReadiness().ready, false);
  assert.equal(runtime.getReadiness().blockedBy[0].reason, 'useful-operation-failed');
  useful = true;
  await runtime.refresh();
  assert.equal(runtime.getReadiness().ready, true);
  ready = false;
  await runtime.refresh();
  assert.equal(runtime.getReadiness().ready, false);
  await runtime.reportNow();
  assert.ok(calls.includes('/ready') && calls.includes('/catalog'));
  assert.equal(received.at(-1).report.instanceId, 'mapper-1');
  assert.equal(received.at(-1).report.ttlMs, 30000);
  await runtime.stop();
  const stoppedCount = received.length;
  await runtime.reportNow();
  assert.equal(received.length, stoppedCount);
});

test('generic JavaScript host lifecycle is opt-in, exposes readiness, and gates work without blocking health/control', async t => {
  let dependencyReady = false;
  const dependency = await server(t, (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.statusCode = dependencyReady ? 200 : 503;
    res.end(JSON.stringify({ ready: dependencyReady, instanceId: 'dep-1' }));
  });

  const source = requirement => `service 'test-service'; ${requirement}
get '/health'; begin return '{"status":"ok"}' end
get '/work'; begin return '{"value":1}' end
end.`;
  const managed = await createPascalishServiceHost({
    compiled: compilePascalishProgramWithAntlr(source("requires service 'pulse-required';"), { hostServices: true }),
    collectorId: 'test-service', httpPort: 0, udpPort: null,
    lifecycle: {
      env: { PULSE_SERVICE_BINDINGS: JSON.stringify({
        'pulse-required': { instanceId: 'dep-1', endpoint: dependency, readinessUrl: `${dependency}/ready` },
      }) },
    },
    logger: { warn() {}, error() {} },
  });
  t.after(() => managed.stop());
  await managed.start();
  const origin = `http://127.0.0.1:${managed.getStatus().httpPort}`;
  assert.equal((await fetch(`${origin}/ready`)).status, 503);
  assert.equal((await fetch(`${origin}/work`)).status, 503);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  assert.equal((await fetch(`${origin}/pmachine/service_host/status`)).status, 200);
  assert.ok(Object.isFrozen(managed.getStatus().serviceLifecycle.bindings));

  const legacy = await createPascalishServiceHost({
    compiled: compilePascalishProgramWithAntlr(source(''), { hostServices: true }),
    collectorId: 'legacy-test', httpPort: 0, udpPort: null, logger: { warn() {}, error() {} },
  });
  t.after(() => legacy.stop());
  await legacy.start();
  assert.equal((await fetch(`http://127.0.0.1:${legacy.getStatus().httpPort}/work`)).status, 200);
  assert.equal(legacy.getStatus().serviceLifecycle, undefined);
});

test('filesystem readiness performs a read-only schema root operation and detects its loss', async t => {
  const dataRoot = await fs.mkdtemp(path.join(process.cwd(), 'testing', 'aggregator', 'lifecycle-fixture-'));
  const service = await createFilesystemService({
    dataRoot, httpPort: 0, host: '127.0.0.1', httpAllowedPeers: [], lifecycleEnv: {},
    logger: { warn() {}, error() {}, log() {} },
  });
  t.after(async () => {
    await service.stop();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${service.getStatus().httpPort}`;
  assert.equal((await fetch(`${origin}/ready`)).status, 200);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  await fs.rm(path.join(dataRoot, 'services', 'librarian', 'schemas'), { recursive: true });
  // The host refreshes by its Pascalish-owned probe interval.
  await new Promise(resolve => setTimeout(resolve, 3300));
  assert.equal((await fetch(`${origin}/ready`)).status, 503);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
});

test('Node service wrappers report ephemeral listening ports and Librarian probes its configured external filesystem', async t => {
  const fixture = await fs.mkdtemp(path.join(process.cwd(), 'testing', 'aggregator', 'lifecycle-wrapper-'));
  const reports = [];
  const calls = [];
  const transactions = new Map();
  const filesystem = await server(t, async (req, res) => {
    calls.push(req.url);
    for await (const chunk of req) { /* Drain the transport request. */ }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url === '/ready' ? { ready: true, instanceId: 'external-fs-1' } :
      req.url === '/exists' ? { exists: false } : { items: [], hasMore: false }));
  });

  const aggregator = await server(t, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/api/runtime/services/')) {
      const id = `wrapper-tx-${transactions.size}`;
      transactions.set(id, JSON.parse(Buffer.concat(chunks)));
      res.statusCode = 202;
      res.end(JSON.stringify({ transactionId: id, status: 'allocated', statusUrl: `/api/runtime/transactions/${id}` }));
      return;
    }
    if (req.url.startsWith('/api/runtime/transactions/')) {
      const id = req.url.split('/').at(-1);
      const request = transactions.get(id);
      const response = await fetch(`${filesystem}${request.path}`, {
        method: request.method, headers: { 'content-type': 'application/json' },
        ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
      });
      res.end(JSON.stringify({ transactionId: id, status: 'completed', result: {
        status: response.status, body: await response.json(),
      } }));
      return;
    }
    reports.push(JSON.parse(Buffer.concat(chunks)));
    res.end('{}');
  });
  const children = [];
  t.after(async () => {
    await Promise.all(children.map(({ child }) => new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill();
    })));
    await fs.rm(fixture, { recursive: true, force: true });
  });
  for (const [entry, serviceId, binding] of [
    ['data-librarian.mjs', 'pulse-data-librarian', {
      'pulse-filesystem': { instanceId: 'external-fs-1', endpoint: filesystem, readinessUrl: `${filesystem}/ready` },
    }],
    ['data-mapper.mjs', 'pulse-data-mapper', {
      'pulse-data-librarian': { instanceId: 'unavailable-1', endpoint: filesystem, readinessUrl: `${filesystem}/unavailable` },
    }],
    ['broker-service.mjs', 'pulse-broker', {}],
    ['src/mcp/pulseMcpServer.mjs', 'pulse-local-mcp', {}],
    ['queue-manager-node.mjs', 'pulse-queue-manager', {}],
  ]) {
    const args = entry === 'queue-manager-node.mjs'
      ? ['--port=0', '--advertise-ip=127.0.0.1', `--aggregator=${aggregator}`] : [];
    const child = spawn(process.execPath, [fileURLToPath(new URL(`../../aggregator/${entry}`, import.meta.url)), ...args], {
      cwd: fixture,
      env: {
        ...process.env, LIBRARIAN_PORT: '0', MAPPER_PORT: '0', LIBRARIAN_SEED: 'false',
        LIBRARIAN_DATA_ROOT: fixture, PULSE_OPERATIONAL_DATA_ROOT: fixture,
        LIBRARIAN_FILESYSTEM_SERVICE_URL: filesystem,
        PULSE_SERVICE_BINDINGS: JSON.stringify(binding), PULSE_AGGREGATOR_URLS: JSON.stringify([aggregator]),
        PULSE_SERVICE_INSTANCE_ID: `${serviceId}-test`, PULSE_OWNER_AGGREGATOR_ID: 'test-owner',
        PULSE_RUNTIME_REPORT_TOKEN: '', PULSE_SERVICE_ENDPOINT: '',
        BROKER_PORT: '0', BROKER_PROVIDER: 'legacy', PULSE_MCP_PORT: '0', PULSE_QUEUE_PERSISTENCE: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const state = { child, output: '' };
    child.stdout.on('data', chunk => { state.output += chunk; });
    child.stderr.on('data', chunk => { state.output += chunk; });
    children.push(state);
    const deadline = Date.now() + 20000;
    while (!reports.some(report => report.serviceId === serviceId)) {
      if (child.exitCode !== null || Date.now() > deadline) assert.fail(`Wrapper failed to report: ${state.output}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const report = reports.find(report => report.serviceId === serviceId);
    const checkedFetch = async url => {
      try { return await fetch(url); }
      catch (error) { assert.fail(`Wrapper request failed (${url}): ${error.message}; ${state.output}`); }
    };
    assert.ok(report.listeners[0].port > 0);
    assert.equal(new URL(report.endpoint).port, String(report.listeners[0].port));
    assert.equal((await checkedFetch(`${report.endpoint}/health`)).status, 200);
    if (serviceId === 'pulse-data-librarian') {
      const deadline = Date.now() + 5000;
      while ((await checkedFetch(`${report.endpoint}/ready`)).status !== 200) {
        if (Date.now() > deadline) assert.fail(`Librarian did not become ready: ${state.output}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.ok(calls.includes('/ready') && calls.includes('/schemas/page'));
    } else if (serviceId === 'pulse-data-mapper') {
      assert.equal((await checkedFetch(`${report.endpoint}/ready`)).status, 503);
      assert.equal((await checkedFetch(`${report.endpoint}/api/mapper/llm/base`)).status, 503);
    } else {
      const deadline = Date.now() + 5000;
      while ((await checkedFetch(`${report.endpoint}/ready`)).status !== 200) {
        if (Date.now() > deadline) assert.fail(`Service did not become ready: ${state.output}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }
});

test('managed filesystem client submits logical-service transactions while legacy explicit endpoints remain unchanged', async t => {
  let directCalls = 0;
  const envelopes = [];
  const direct = await server(t, (req, res) => {
    directCalls += 1;
    res.setHeader('content-type', 'application/json');
    res.end('{"exists":false}');
  });
  const aggregator = await server(t, async (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      envelopes.push({ path: req.url, payload: JSON.parse(Buffer.concat(chunks)) });
      res.statusCode = 202;
      res.end('{"transactionId":"fs-tx-1","status":"allocated","statusUrl":"/api/runtime/transactions/fs-tx-1"}');
    } else {
      res.end('{"transactionId":"fs-tx-1","status":"completed","result":{"status":200,"body":{"value":"remote content"}}}');
    }
  });
  const managed = createFilesystemServiceClient(direct, {
    env: { PULSE_SERVICE_BINDINGS: '{}', PULSE_AGGREGATOR_URLS: JSON.stringify([aggregator]) },
  });
  t.after(() => managed.stop());
  assert.equal(await managed.readText('schemas', 'sample.xsd'), 'remote content');
  assert.deepEqual(envelopes, [{
    path: '/api/runtime/services/pulse-filesystem/transactions',
    payload: { method: 'POST', path: '/read', body: { root: 'schemas', path: 'sample.xsd' } },
  }]);
  assert.equal(directCalls, 0);
  const legacy = createFilesystemServiceClient(direct, { env: {} });
  assert.equal(await legacy.exists('schemas', 'absent.xsd'), 0);
  assert.equal(directCalls, 1);
  assert.throws(() => createFilesystemServiceClient(direct, { env: { PULSE_SERVICE_BINDINGS: '{}' } }),
    /require configured PULSE_AGGREGATOR_URLS/);
});

test('uncertain logical transaction outcomes carry tracking ids and are never automatically resubmitted', async t => {
  let submissions = 0;
  const aggregator = await server(t, async (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST') {
      submissions += 1;
      for await (const chunk of req) {}
      res.statusCode = 202;
      res.end('{"transactionId":"uncertain-1","status":"allocated","statusUrl":"/api/runtime/transactions/uncertain-1"}');
    } else {
      res.end('{"transactionId":"uncertain-1","status":"uncertain","transportError":"connection lost"}');
    }
  });

  const transport = createLogicalServiceTransport({ aggregatorUrls: [aggregator], serviceId: 'pulse-filesystem' });
  t.after(() => transport.stop());
  await assert.rejects(transport.request({ method: 'POST', path: '/write', body: {} }), error =>
    error.transactionId === 'uncertain-1' && error.uncertain === true && /connection lost/.test(error.message));
  assert.equal(submissions, 1);
});

test('listener reports use actual bound ports and require a reachable advertised host for remote aggregators', () => {
  const remote = readServiceLifecycleConfig({
    serviceId: 'pulse-test',
    env: { PULSE_AGGREGATOR_URLS: '["https://aggregator.example"]' },
  });
  assert.throws(() => describeBoundHttpListener({ address: '0.0.0.0', port: 45678 }, remote),
    /PULSE_SERVICE_ADVERTISE_HOST/);
  const configured = readServiceLifecycleConfig({
    serviceId: 'pulse-test',
    env: {
      PULSE_AGGREGATOR_URLS: '["https://aggregator.example"]',
      PULSE_SERVICE_ADVERTISE_HOST: '192.0.2.10',
      PULSE_SERVICE_ENDPOINT: 'http://192.0.2.10:9999',
    },
  });
  assert.deepEqual(describeBoundHttpListener({ address: '0.0.0.0', port: 45678 }, configured),
    { protocol: 'http', host: '192.0.2.10', port: 45678, endpoint: 'http://192.0.2.10:45678' });
  const managed = readServiceLifecycleConfig({
    serviceId: 'pulse-test', requires: ['pulse-filesystem'],
    intrinsicBindings: { 'pulse-filesystem': {
      instanceId: 'legacy-default', endpoint: 'http://localhost:4302', readinessUrl: 'http://localhost:4302/ready',
    } },
    env: { PULSE_AGGREGATOR_URLS: '["http://127.0.0.1:4000"]' },
  });
  assert.equal(managed.managed, true);
  assert.deepEqual(managed.requires, ['pulse-filesystem']);
  assert.deepEqual(managed.bindings, {});
});

test('bounded reporting retries are independent of a timed-out readiness probe and stop releases all transport work', async t => {
  let attempts = 0;
  const logs = [];
  const runtime = await createServiceLifecycleRuntime({
    config: readServiceLifecycleConfig({
      serviceId: 'pulse-test', requires: ['pulse-dependency'],
      env: {
        PULSE_SERVICE_BINDINGS: JSON.stringify({
          'pulse-dependency': {
            instanceId: 'dep-1', endpoint: 'http://dependency.invalid', readinessUrl: 'http://dependency.invalid/ready',
          },
        }),
        PULSE_AGGREGATOR_URLS: '["http://aggregator.invalid"]',
        PULSE_OWNER_AGGREGATOR_ID: 'owner-1',
      },
    }),
    logger: { warn: message => logs.push(message), error: message => logs.push(message) },
    fetchImpl: async (url, options) => {
      if (url.endsWith('/ready')) {
        return new Promise((resolve, reject) => options.signal.addEventListener('abort',
          () => reject(new Error('Readiness transport timeout')), { once: true }));
      }
      attempts += 1;
      return new Response('{"error":"report rejected"}', { status: 503 });
    },
  });
  t.after(() => runtime.stop());
  await runtime.start('http://127.0.0.1:12345', [{ protocol: 'http', host: '127.0.0.1', port: 12345 }]);
  await runtime.reportNow();
  assert.equal(attempts, 4);
  assert.equal(runtime.getReadiness().ready, false);
  assert.ok(logs.some(message => message.includes('Report to') && message.includes('(2/2)')));
  assert.ok(logs.some(message => message.includes('Probe pulse-dependency failed')));
  await runtime.stop();
  await runtime.reportNow();
  assert.equal(attempts, 4);
});
