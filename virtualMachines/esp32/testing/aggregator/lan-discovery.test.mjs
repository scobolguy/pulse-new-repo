import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { createDiscoveryPolicy } from '../../aggregator/src/service-lifecycle/discovery-policy.mjs';
import { createServiceLifecycleRuntime, readServiceLifecycleConfig } from '../../aggregator/src/service-lifecycle-runtime.mjs';
import { createInfrastructureAdapter } from '../../aggregator/infrastructure-adapter.mjs';
import { attachDiscoveryResponder, createLanDiscovery } from '../../aggregator/src/service-lifecycle/lan-discovery.mjs';

test('Pascalish discovery correlates replies, learns actual ports and expires targets exactly', async t => {
  const policy = await createDiscoveryPolicy();
  t.after(() => policy.stop());
  const { packet: request, nextAt } = await policy.dispatch('/request', {
    requestId: 'request-1', nodeId: 'node-1', bootId: 'node-boot', nowMs: 1000, jitterMs: 27,
  });
  assert.equal(nextAt, 6027);
  const { packet } = await policy.dispatch('/respond', {
    packet: request, aggregatorId: 'aggregator-1', bootId: 'aggregator-boot',
    peer: '192.0.2.2', listeners: [
      { protocol: 'http', host: '0.0.0.0', port: 4010 },
      { protocol: 'http', host: '127.0.0.1', port: 4010 },
      { protocol: 'http', host: '192.0.2.1', port: 49123 },
    ],
  });
  assert.equal(packet.listeners.length, 1);
  const input = {
    packet, requestId: 'request-1', peer: '192.0.2.1', localAddress: '192.0.2.2',
    targets: [], nowMs: 1000,
  };
  const { targets } = await policy.dispatch('/accept', input);
  assert.equal(targets[0].endpoint, 'http://192.0.2.1:49123');
  assert.equal(targets[0].localAddress, '192.0.2.2');
  const restarted = await policy.dispatch('/accept', {
    ...input, targets, nowMs: 2000,
    packet: { ...packet, bootId: 'restarted-aggregator', listeners: [
      { protocol: 'http', host: '192.0.2.1', port: 50123 },
    ] },
  });
  assert.equal(restarted.changed, true);
  assert.equal(restarted.targets.length, 1);
  assert.equal(restarted.targets[0].bootId, 'restarted-aggregator');
  assert.equal(restarted.targets[0].endpoint, 'http://192.0.2.1:50123');
  assert.equal(restarted.targets[0].expiresAt, 32000);
  await assert.rejects(policy.dispatch('/accept', {
    ...input, targets: Array.from({ length: 16 }, (_, index) => ({
      aggregatorId: `other-${index}`, expiresAt: 31000,
    })),
  }), /Aggregator capacity exceeded/);
  assert.equal((await policy.dispatch('/owner-target', {
    targets, nowMs: 1001, ownerAggregatorId: 'aggregator-1',
  })).endpoint, 'http://192.0.2.1:49123');
  await assert.rejects(policy.dispatch('/owner-target', {
    targets, nowMs: 1001, ownerAggregatorId: 'unknown',
  }), /owner is not discovered/);
  assert.equal((await policy.dispatch('/targets', { targets, nowMs: 30999 })).targets.length, 1);
  assert.equal((await policy.dispatch('/targets', { targets, nowMs: 31000 })).targets.length, 0);
  await assert.rejects(policy.dispatch('/owner-target', {
    targets, nowMs: 31000, ownerAggregatorId: 'aggregator-1',
  }), /owner is not discovered/);
  await assert.rejects(policy.dispatch('/accept', { ...input, requestId: 'different' }), /Uncorrelated/);
  await assert.rejects(policy.dispatch('/accept', { ...input, peer: '192.0.2.3' }), /matching its source/);
  await assert.rejects(policy.dispatch('/accept', {
    ...input, packet: { ...packet, version: 2 },
  }), /Unsupported discovery version/);
  const { clockPeriodMs } = await policy.dispatch('/settings');
  const rolloverStart = clockPeriodMs - 1000;
  const retry = await policy.dispatch('/request', {
    requestId: 'rollover', nodeId: 'node-1', bootId: 'node-boot', nowMs: rolloverStart, jitterMs: 27,
  });
  assert.equal(retry.nextAt, 4027);
  assert.equal((await policy.dispatch('/poll', { nowMs: rolloverStart, nextAt: -1 })).send, true);
  assert.equal((await policy.dispatch('/poll', { nowMs: clockPeriodMs - 1, nextAt: retry.nextAt })).send, false);
  assert.equal((await policy.dispatch('/poll', { nowMs: 4026, nextAt: retry.nextAt })).send, false);
  assert.equal((await policy.dispatch('/poll', { nowMs: 4027, nextAt: retry.nextAt })).send, true);
  const rollover = await policy.dispatch('/accept', { ...input, nowMs: rolloverStart });
  assert.equal(rollover.targets[0].expiresAt, 29000);
  assert.equal((await policy.dispatch('/targets', { targets: rollover.targets, nowMs: 28999 })).targets.length, 1);
  assert.equal((await policy.dispatch('/targets', { targets: rollover.targets, nowMs: 29000 })).targets.length, 0);
});

test('Pascalish filters LAN interfaces and rejects unusable or ambiguous listeners', async t => {
  const policy = await createDiscoveryPolicy();
  t.after(() => policy.stop());
  const { interfaces } = await policy.dispatch('/interfaces', { interfaces: [
    { address: '127.0.0.1', internal: true },
    { address: '0.0.0.0', internal: false },
    { address: '224.0.0.1', internal: false },
    { address: '192.0.2.1', internal: false },
    { address: '192.0.2.999', internal: false },
    { address: '::1', internal: true },
  ] });
  assert.deepEqual(interfaces.map(item => item.address), ['192.0.2.1']);
  const packet = {
    kind: 'pulseDiscoveryReply', version: 1, requestId: 'request',
    aggregatorId: 'owner', bootId: 'boot',
    listeners: [
      { protocol: 'http', host: '192.0.2.1', port: 1234 },
      { protocol: 'http', host: '192.0.2.1', port: 5678 },
    ],
  };
  await assert.rejects(policy.dispatch('/accept', {
    packet, requestId: 'request', peer: '192.0.2.1', localAddress: '192.0.2.2',
    targets: [], nowMs: 0,
  }), /Ambiguous/);
});

test('port-only lifecycle bootstrap advertises real listeners to every discovered aggregator without changing owner', async t => {
  const policy = await createDiscoveryPolicy();
  t.after(() => policy.stop());
  const targets = [
    { endpoint: 'http://192.0.2.1:49123', localAddress: '192.0.2.2', aggregatorId: 'owner' },
    { endpoint: 'http://198.51.100.1:49124', localAddress: '198.51.100.2', aggregatorId: 'observer' },
  ];
  const beacons = [];
  const reports = [];
  const config = readServiceLifecycleConfig({
    serviceId: 'pulse-test',
    env: { UDP_PORT: '54321', PULSE_OWNER_AGGREGATOR_ID: 'owner', PULSE_NODE_ID: 'node' },
  });
  assert.deepEqual(config.reportUrls, []);
  const runtime = await createServiceLifecycleRuntime({
    config, discoveryFactory: async options => {
      assert.equal(options.port, 54321);
      return {
        start: async () => {},
        stop: async () => {},
        getTargets: () => targets,
        advertise: async listeners => {
          for (const target of targets) beacons.push((await policy.dispatch('/advertise', {
            nodeId: config.nodeId, localAddress: target.localAddress, listeners,
          })).packet);
        },
        describeTarget: (target, listeners) => policy.dispatch('/advertise', {
          nodeId: config.nodeId, localAddress: target.localAddress, listeners,
        }),
      };
    },
    fetchImpl: async (url, options) => {
      reports.push({ url, report: JSON.parse(options.body) });
      return new Response('{}');
    },
  });
  t.after(() => runtime.stop());
  await runtime.start('http://0.0.0.0:45678', [{ protocol: 'http', host: '0.0.0.0', port: 45678 }]);
  await runtime.reportNow();
  assert.equal(beacons.length, 2);
  assert.equal(reports.length, 2);
  for (const { report } of reports) {
    assert.equal(report.ownerAggregatorId, 'owner');
    assert.equal(report.listeners[0].port, 45678);
    assert.notEqual(report.listeners[0].host, '0.0.0.0');
    assert.equal(new URL(report.endpoint).hostname, report.listeners[0].host);
  }
  assert.deepEqual(runtime.getReportUrls(), targets.map(target => target.endpoint));
});

test('discovered nodes without an owner advertise but never publish allocation readiness', async t => {
  let advertisements = 0;
  const errors = [];
  const runtime = await createServiceLifecycleRuntime({
    config: readServiceLifecycleConfig({ serviceId: 'pulse-test', env: {} }),
    logger: { warn() {}, error: message => errors.push(message) },
    discoveryFactory: async () => ({
      start: async () => {},
      stop: async () => {},
      advertise: async () => { advertisements++; },
      getTargets: () => [{ endpoint: 'http://192.0.2.1:49123', aggregatorId: 'observer' }],
    }),
    fetchImpl: async () => assert.fail('Unowned node must not publish lifecycle reports'),
  });
  t.after(() => runtime.stop());
  await runtime.start('http://0.0.0.0:45678', [{ protocol: 'http', host: '0.0.0.0', port: 45678 }]);
  await runtime.reportNow();
  assert.ok(advertisements > 0);
  assert.ok(errors.some(message => message.includes('requires an explicit deployment owner')));
});

  test('UDP bootstrap uses interface broadcasts and ephemeral reply sockets, learns both aggregators, and closes its sockets', { timeout: 60000 }, async t => {
    const policy = await createDiscoveryPolicy();
    const policyFactory = async () => ({ dispatch: policy.dispatch, stop: async () => {} });
    const sockets = new Map();
    const responders = [];
    const sent = [];
    const warnings = [];
    let allocatedPort = 55000;
    class Socket extends EventEmitter {
      bind(port, address, callback) {
        this.host = address;
        this.port = port || allocatedPort++;
        sockets.set(`${this.host}:${this.port}`, this);
        callback();
      }
      setBroadcast(value) { assert.equal(value, true); }
      unref() {}
      close() { this.closed = true; sockets.delete(`${this.host}:${this.port}`); }
      send(bytes, port, address, callback) {
        const packet = JSON.parse(bytes.toString());
        sent.push({ packet, address, port, sourcePort: this.port });
        const peers = packet.kind === 'pulseDiscoveryRequest'
          ? responders : [sockets.get(`${address}:${port}`)].filter(Boolean);
        for (const peer of peers) peer.emit('message', bytes, { address: this.host, port: this.port });
        callback();
      }
    }
    const responderRuntimes = [];
    for (const [host, id, httpPort] of [
      ['192.0.2.1', 'owner', 49123], ['192.0.2.3', 'observer', 49124],
    ]) {
      const socket = new Socket();
      socket.bind(54321, host, () => {});
      responders.push(socket);
      responderRuntimes.push(await attachDiscoveryResponder({
        socket, aggregatorId: id, bootId: `${id}-boot`, policyFactory,
        getListeners: () => [{ protocol: 'http', host, port: httpPort }],
        logger: { warn: message => warnings.push(message) },
      }));
    }
    let received;
    const receivedTargets = new Promise(resolve => { received = resolve; });
    const client = await createLanDiscovery({
      nodeId: 'node', bootId: 'boot', port: 54321, policyFactory,
      interfaces: () => [{ address: '192.0.2.2', broadcast: '192.0.2.255', internal: false }],
      socketFactory: () => new Socket(),
      logger: { warn: message => warnings.push(message) },
      onTargets: async targets => { if (targets.length === 2) received(targets); },
    });
    t.after(async () => {
      await client.stop();
      for (const responder of responderRuntimes) await responder.stop();
      for (const socket of responders) socket.close();
      await policy.stop();
    });
    await client.start();
    const targets = await receivedTargets;
    assert.deepEqual(new Set(targets.map(target => target.endpoint)), new Set([
      'http://192.0.2.1:49123', 'http://192.0.2.3:49124',
    ]));
    const request = sent.find(item => item.packet.kind === 'pulseDiscoveryRequest');
    assert.equal(request.address, '192.0.2.255');
    assert.equal(request.port, 54321);
    assert.notEqual(request.sourcePort, 54321);
    await client.advertise([{ protocol: 'http', host: '0.0.0.0', port: 45678 }]);
    assert.equal(sent.filter(item => item.packet.kind === 'nodeBeacon').length, 2);
    assert.deepEqual(warnings, []);
    await client.stop();
    assert.equal(sockets.has('192.0.2.2:55000'), false);
  });

for (const [provider, serviceId] of [['database', 'pulse-database'], ['rabbitmq', 'pulse-rabbitmq']]) {
test(`Pascalish ${provider} adapter probes the host driver primitive without offering HTTP allocation`, async t => {
  let ready = true;
  let calls = 0;
  const reports = [];
  const http = await import('node:http');
  const server = http.createServer(async (req, res) => {
    const bytes = [];
    for await (const chunk of req) bytes.push(chunk);
    reports.push(JSON.parse(Buffer.concat(bytes).toString()));
    res.setHeader('content-type', 'application/json');
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const adapter = await createInfrastructureAdapter({
    env: {
      PULSE_INFRASTRUCTURE_PROVIDER: provider, PULSE_SERVICE_INSTANCE_ID: `${provider}-1`,
      PULSE_OWNER_AGGREGATOR_ID: 'owner',
      PULSE_AGGREGATOR_URLS: JSON.stringify([`http://127.0.0.1:${server.address().port}`]),
      PULSE_ADAPTER_BIND_HOST: '127.0.0.1', PULSE_ADAPTER_PORT: '0',
    },
    probes: { [provider]: async () => {
      calls++;
      if (!ready) throw new Error('driver error containing password=do-not-publish');
    } },
    logger: { warn() {}, error() {} },
  });
  t.after(() => adapter.stop());
  await adapter.start();
  const origin = `http://127.0.0.1:${adapter.getStatus().httpPort}`;
  assert.equal((await fetch(`${origin}/ready`)).status, 200);
  assert.ok(calls > 0);
  const deadline = Date.now() + 3000;
  while (!reports.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(reports[0].serviceId, serviceId);
  assert.deepEqual(reports[0].listeners, []);
  assert.equal(new URL(reports[0].endpoint).pathname, '/ready');
  ready = false;
  const observation = await adapter.dispatch({
    transport: 'internal', method: 'GET', path: '/api/runtime/infrastructure/ready', body: '{}',
  });
  assert.equal(observation.status, 503);
  assert.equal(observation.body.ready, false);
  assert.doesNotMatch(JSON.stringify(observation), /do-not-publish|password/);
});
}
