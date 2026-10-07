import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { test } from 'node:test';
import { createDiscoveryProvider, readDiscoveryProviderConfig } from '../../aggregator/src/backend/modules/discoveryProvider.mjs';
import { createDiscoverySnapshotSource, normalizeNodeAnnouncement, recordNodeAnnouncement } from '../../aggregator/src/backend/modules/discoveryCollector.mjs';
import { createLocalDiscoveryRuntime } from '../../aggregator/src/backend/modules/localDiscoveryRuntime.mjs';

const logger = { log() {}, warn() {}, error() {} };
const observation = (id, remainingTtlMs = 180000) => ({
  nodeId: id, ip: '192.0.2.10', port: 80, remainingTtlMs,
  details: { hardware: 'ESP32', services: ['pmachine'] }
});
const snapshot = (collectorId, nodes, sequence = 1, bootId = 'boot-1') => ({
  protocolVersion: 1, collectorId, bootId, sequence, nodes
});

function harness(urls = ['http://collector-a', 'http://collector-b']) {
  let time = 1000;
  const sources = new Map();
  const calls = [];
  const discoveredNodes = new Map();
  const provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: urls, timeoutMs: 100, pollIntervalMs: 60000 },
    discoveredNodes, now: () => time, wallNow: () => 5_000_000 + time, logger,
    createLocalRuntime: () => { throw new Error('Remote provider must not create a local listener'); },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const source = sources.get(new URL(url).origin);
      if (source instanceof Error) throw source;
      const payload = typeof source === 'function' ? await source(url, options) : source;
      if (payload instanceof Error) throw payload;
      if (payload instanceof Response) return payload;
      return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
    }
  });
  return { provider, sources, calls, discoveredNodes, advance: (ms) => { time += ms; } };
}

test('local is the default and remote configuration fails explicitly when invalid', () => {
  assert.equal(readDiscoveryProviderConfig({}).mode, 'local');
  assert.throws(() => readDiscoveryProviderConfig({ PULSE_DISCOVERY_MODE: 'gossip' }), /local, remote or hybrid/);
  assert.throws(() => readDiscoveryProviderConfig({ PULSE_DISCOVERY_MODE: 'hybrid' }), /Hybrid discovery requires/);
  assert.equal(readDiscoveryProviderConfig({ PULSE_DISCOVERY_MODE: 'hybrid', PULSE_DISCOVERY_COLLECTOR_URLS: 'http://a' }).mode, 'hybrid');
  assert.throws(() => readDiscoveryProviderConfig({ PULSE_DISCOVERY_MODE: 'remote' }), /requires/);
  assert.throws(() => readDiscoveryProviderConfig({ PULSE_DISCOVERY_COLLECTOR_URLS: 'ftp://host' }), /HTTP/);
  assert.throws(() => readDiscoveryProviderConfig({ PULSE_DISCOVERY_COLLECTOR_URLS: 'http://user:password@host' }), /credentials/);
  assert.throws(() => readDiscoveryProviderConfig({ PULSE_DISCOVERY_TIMEOUT_MS: '-1' }), /positive integer/);
  assert.deepEqual(readDiscoveryProviderConfig({
    PULSE_DISCOVERY_MODE: 'remote',
    PULSE_DISCOVERY_COLLECTOR_URLS: 'http://a/,http://b,http://a'
  }).collectorUrls, ['http://a', 'http://b']);
});

test('snapshot producer reports remaining lifetime and does not renew nodes when polled', () => {
  let time = 1_000_000;
  const nodes = new Map();
  recordNodeAnnouncement(nodes, normalizeNodeAnnouncement({
    nodeId: 'js-1', ip: '127.0.0.1', port: 4111, services: ['pmachine']
  }), time);
  nodes.set('configured', { nodeId: 'configured', ip: '192.0.2.15', lastSeen: time, details: { configured: true } });
  const read = createDiscoverySnapshotSource({ discoveredNodes: nodes, collectorId: 'a', bootId: 'boot', now: () => time });
  const first = read();
  assert.equal(first.nodes.length, 1);
  assert.equal(first.nodes[0].remainingTtlMs, 180000);
  time += 100000;
  const second = read();
  assert.equal(second.nodes[0].remainingTtlMs, 80000);
  assert.equal(second.sequence, first.sequence + 1);
  time += 80000;
  assert.deepEqual(read().nodes, []);
});

test('two collectors merge by stable node ID and retain independent same-IP nodes', async () => {
  const h = harness();
  h.sources.set('http://collector-a', snapshot('a', [observation('board'), { ...observation('js-1'), ip: '127.0.0.1', port: 4111 }]));
  h.sources.set('http://collector-b', snapshot('b', [observation('board', 120000), { ...observation('js-2'), ip: '127.0.0.1', port: 4112 }]));
  await h.provider.start();
  try {
    assert.equal(h.discoveredNodes.size, 3);
    assert.equal(h.provider.getStatus().status, 'healthy');
    h.sources.set('http://collector-a', new Error('offline'));
    h.sources.set('http://collector-b', snapshot('b', [observation('board', 180000)], 2));
    h.advance(100000);
    await h.provider.refresh();
    assert.equal(h.provider.getStatus().status, 'degraded');
    h.advance(80000);
    assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['board']);
    h.sources.set('http://collector-b', new Error('offline'));
    await h.provider.refresh();
    assert.equal(h.provider.getStatus().status, 'unavailable');
    h.advance(100000);
    assert.deepEqual(h.provider.getNodes(), []);
    assert.equal(h.discoveredNodes.size, 0);
    h.sources.set('http://collector-a', snapshot('a', [observation('recovered')], 2));
    await h.provider.refresh();
    assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['recovered']);
    assert.equal(h.provider.getStatus().status, 'degraded');
  } finally {
    await h.provider.stop();
  }
});

test('remote provider follows snapshot pages and retries transient collector failures', async () => {
  const h = harness(['http://collector-a']);
  const pages = [
    { ...snapshot('a', Array.from({ length: 5 }, (_, index) => observation(`board-${index}`)), 10),
      continuation: 'continue', nextCursor: 'board-4' },
    { ...snapshot('a', [observation('board-5'), observation('board-6')], 11),
      continuation: 'end', nextCursor: '' }
  ];
  let continuationAttempts = 0;
  h.sources.set('http://collector-a', url => {
    const cursor = new URL(url).searchParams.get('cursor');
    if (cursor === null) return pages[0];
    if (cursor !== 'board-4') return new Error('Unexpected cursor');
    continuationAttempts += 1;
    if (continuationAttempts === 1) return new TypeError('fetch failed');
    return continuationAttempts === 2
      ? new Response('JSON response serialization failed', { status: 503 })
      : pages[1];
  });
  await h.provider.refresh();
  assert.equal(h.provider.getNodes().length, 7);
  assert.equal(h.provider.getStatus().status, 'healthy');
  assert.deepEqual(h.calls.map(({ url }) => new URL(url).searchParams.get('cursor')),
    [null, 'board-4', 'board-4', 'board-4']);
});

test('snapshot polling, clock skew and replay cannot extend a cached observation', async () => {
  const h = harness(['http://collector-a']);
  h.sources.set('http://collector-a', snapshot('a', [{ ...observation('board'), lastSeen: 9_999_999_999_999 }]));
  await h.provider.refresh();
  h.advance(100000);
  await h.provider.refresh();
  assert.match(h.provider.getStatus().collectors[0].error, /Replayed/);
  assert.equal(h.provider.getNodes()[0].discovery.remainingTtlMs, 80000);
  h.advance(80000);
  assert.deepEqual(h.provider.getNodes(), []);
});

test('collector reboot replaces its snapshot and retired boot snapshots are rejected', async () => {
  const h = harness(['http://collector-a']);
  h.sources.set('http://collector-a', snapshot('a', [observation('old')], 5, 'old-boot'));
  await h.provider.refresh();
  h.sources.set('http://collector-a', snapshot('a', [observation('new')], 1, 'new-boot'));
  await h.provider.refresh();
  assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['new']);
  h.sources.set('http://collector-a', snapshot('a', [observation('old')], 6, 'old-boot'));
  await h.provider.refresh();
  assert.match(h.provider.getStatus().collectors[0].error, /Replayed/);
  assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['new']);
});

test('invalid snapshots are rejected atomically and collector identities must be distinct', async () => {
  const h = harness();
  h.sources.set('http://collector-a', snapshot('a', [observation('board')]));
  h.sources.set('http://collector-b', snapshot('a', [observation('duplicate-collector')]));
  await h.provider.refresh();
  assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['board']);
  assert.match(h.provider.getStatus().collectors[1].error, /unique/);
  h.sources.set('http://collector-a', snapshot('a', [observation('new'), observation('invalid', 180001)], 2));
  await h.provider.refresh();
  assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['board']);
  assert.match(h.provider.getStatus().collectors[0].error, /Invalid/);
});

test('a fresh empty snapshot removes one collector observation without removing another', async () => {
  const h = harness();
  h.sources.set('http://collector-a', snapshot('a', [observation('board')]));
  h.sources.set('http://collector-b', snapshot('b', [observation('board')]));
  await h.provider.refresh();
  h.sources.set('http://collector-a', snapshot('a', [], 2));
  await h.provider.refresh();
  assert.equal(h.provider.getNodes().length, 1);
  h.sources.set('http://collector-b', snapshot('b', [], 2));
  await h.provider.refresh();
  assert.deepEqual(h.provider.getNodes(), []);
});

test('announcements fan out, report partial delivery and fail when all collectors fail', async () => {
  const h = harness();
  h.sources.set('http://collector-a', { status: 'ok' });
  h.sources.set('http://collector-b', new Error('offline'));
  const body = { nodeId: 'board', ip: '192.0.2.10', services: ['pmachine'] };
  const result = await h.provider.announce(body);
  assert.equal(result.degraded, true);
  assert.deepEqual(result.collectors.map((collector) => collector.delivered), [true, false]);
  assert.ok(h.calls.every((call) => call.options.method === 'POST'));
  assert.equal(h.discoveredNodes.size, 0, 'Forwarding must not create local authoritative presence');
  h.sources.set('http://collector-a', new Error('offline'));
  await assert.rejects(h.provider.announce(body), /No discovery collector/);
});

test('network timeout is visible and stop cancels in-flight requests', async () => {
  const nodes = new Map();
  const provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: ['http://unreachable'], timeoutMs: 15, pollIntervalMs: 1000 },
    discoveredNodes: nodes, logger,
    fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
    })
  });
  await provider.start();
  assert.match(provider.getStatus().collectors[0].error, /aborted/);
  const pending = provider.refresh();
  await provider.stop();
  await pending;
  assert.equal(provider.getStatus().running, false);
  assert.equal(nodes.size, 0);
});

test('local runtime owns UDP receipt, acknowledgements and port-aware bounded enrichment', async () => {
  let received;
  const announced = new Promise((resolve) => { received = resolve; });
  const nodes = new Map();
  const requests = [];
  const runtime = createLocalDiscoveryRuntime({
    discoveredNodes: nodes, udpPort: 0, nodeId: 'aggregator', probeEnabled: false, logger,
    onNode: received,
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response(JSON.stringify({ services: ['pmachine'] }));
    }
  });
  const sender = dgram.createSocket('udp4');
  try {
    await runtime.start();
    const acknowledgement = new Promise((resolve) => sender.once('message', (message, info) => resolve({ ...JSON.parse(message.toString()), from: info.port })));
    const data = Buffer.from(JSON.stringify({ kind: 'nodeBeacon', nodeId: 'board', port: 8080, available: true }));
    sender.send(data, runtime.getStatus().udpPort, '127.0.0.1');
    const node = await announced;
    assert.equal(node.nodeId, 'board');
    assert.equal(node.beacon.kind, 'nodeBeacon');
    const ack = await acknowledgement;
    assert.equal(ack.kind, 'nodeBeaconAck');
    assert.equal(ack.from, runtime.getStatus().replyPort, 'Replies leave from the private socket, not the shared port');
    assert.equal(requests.length, 2);
    assert.ok(requests.every((url) => url.startsWith('http://127.0.0.1:8080/')));
  } finally {
    sender.close();
    await runtime.stop();
  }
});

test('local discovery shares its UDP port and every listener hears broadcasts', async () => {
  const heard = [[], []];
  const fetchImpl = async () => new Response('{}');
  const first = createLocalDiscoveryRuntime({ discoveredNodes: new Map(), udpPort: 0, probeEnabled: false, logger, fetchImpl, onNode: (node) => heard[0].push(node.nodeId) });
  await first.start();
  const second = createLocalDiscoveryRuntime({ discoveredNodes: new Map(), udpPort: first.getStatus().udpPort, probeEnabled: false, logger, fetchImpl, onNode: (node) => heard[1].push(node.nodeId) });
  try {
    await second.start();
    assert.equal(second.getStatus().udpPort, first.getStatus().udpPort);
    assert.notEqual(first.getStatus().replyPort, second.getStatus().replyPort);
    await first.announce({ kind: 'nodeBeacon', nodeId: 'board', available: true });
    for (let attempt = 0; attempt < 50 && heard.some((ids) => ids.length === 0); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.deepEqual(heard, [['board'], ['board']]);
  } finally {
    await Promise.all([first.stop(), second.stop()]);
  }
});

function hybridHarness() {
  const discoveredNodes = new Map();
  const beacons = [];
  let localRunning = false;
  let collector = snapshot('a', [observation('board'), { ...observation('js-1'), ip: '127.0.0.1', port: 4111 }]);
  const provider = createDiscoveryProvider({
    config: { mode: 'hybrid', collectorUrls: ['http://collector-a'], timeoutMs: 100, pollIntervalMs: 60000 },
    discoveredNodes, logger,
    createLocalRuntime: () => ({
      start: async () => { localRunning = true; },
      stop: async () => { localRunning = false; },
      announce: async (payload) => { beacons.push(payload); },
      getStatus: () => ({ running: localRunning, status: localRunning ? 'healthy' : 'unavailable', udpPort: 4210 })
    }),
    fetchImpl: async () => {
      if (collector instanceof Error) throw collector;
      return new Response(JSON.stringify(collector), { headers: { 'content-type': 'application/json' } });
    }
  });
  return { provider, discoveredNodes, beacons, setCollector: (value) => { collector = value; } };
}

test('hybrid prefers locally heard nodes and adds collector-only nodes', async () => {
  const h = hybridHarness();
  h.discoveredNodes.set('192.0.2.10', { nodeId: 'board', ip: '192.0.2.10', lastSeen: Date.now(), beacon: { seenAt: Date.now() } });
  await h.provider.start();
  try {
    const nodes = h.provider.getNodes();
    assert.deepEqual(nodes.map((node) => node.nodeId).sort(), ['board', 'js-1']);
    assert.equal(nodes.find((node) => node.nodeId === 'board').discovery, undefined, 'Local observation wins');
    assert.equal(nodes.find((node) => node.nodeId === 'js-1').discovery.provider, 'remote');
    const status = h.provider.getStatus();
    assert.equal(status.mode, 'hybrid');
    assert.equal(status.status, 'healthy');
    assert.equal(status.local.udpPort, 4210);
    await h.provider.broadcastBeacon({ kind: 'nodeBeacon', nodeId: 'aggregator' });
    assert.equal(h.beacons.length, 1);
  } finally {
    await h.provider.stop();
  }
});

test('hybrid keeps local discovery when collectors are unreachable', async () => {
  const h = hybridHarness();
  h.setCollector(new Error('offline'));
  h.discoveredNodes.set('192.0.2.20', { nodeId: 'local-board', ip: '192.0.2.20', lastSeen: Date.now(), beacon: { seenAt: Date.now() } });
  await h.provider.start();
  try {
    assert.deepEqual(h.provider.getNodes().map((node) => node.nodeId), ['local-board']);
    assert.equal(h.provider.getStatus().status, 'degraded');
    await assert.rejects(h.provider.announce({ nodeId: 'js-2', ip: '127.0.0.1', port: 4112 }), /No discovery collector/);
  } finally {
    await h.provider.stop();
  }
});
