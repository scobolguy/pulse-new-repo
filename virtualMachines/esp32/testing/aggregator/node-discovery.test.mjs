import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { test } from 'node:test';
import { bindNodeDiscoverySocket, enrichDiscoveredNode } from '../../aggregator/src/backend/modules/nodeDiscovery.mjs';
import { DISCOVERY_NODE_MAX_AGE_MS, isFreshDiscoveryNode, pruneDiscoveryNodes } from '../../aggregator/src/discovery-topology.mjs';

const ip = '192.0.2.115';
const response = (payload) => ({ ok: true, json: async () => payload });

test('discovery drops nodes exactly three minutes after the last announcement', () => {
  assert.equal(DISCOVERY_NODE_MAX_AGE_MS, 180_000);
  const now = 1_000_000;
  const nodes = new Map([
    ['fresh', { lastSeen: now - 179_999 }],
    ['boundary', { lastSeen: now - 180_000 }],
    ['stale-beacon', { lastSeen: now, beacon: { seenAt: now - 180_000 } }],
    ['missing', {}],
    ['invalid', { lastSeen: 'invalid' }]
  ]);
  const removed = [];
  pruneDiscoveryNodes(nodes, now, { log: (message) => removed.push(message) });
  assert.deepEqual([...nodes.keys()], ['fresh']);
  assert.equal(removed.length, 4);
  assert.equal(isFreshDiscoveryNode(nodes.get('fresh'), undefined, now), true);
  nodes.set('boundary', { lastSeen: now });
  pruneDiscoveryNodes(nodes, now, { log() {} });
  assert.equal(nodes.has('boundary'), true, 'A new announcement restores an expired node');
});

test('status capabilities become visible while service description is still pending', async () => {
  const discoveredNodes = new Map([[ip, { httpPort: 8080, beacon: { seenAt: 123 }, details: { capabilityHash: 'original' } }]]);
  const warnings = [];
  const requests = [];
  let failDescription;
  const finished = enrichDiscoveredNode({
    ip,
    discoveredNodes,
    logger: { warn: (message) => warnings.push(message) },
    fetchImpl: async (url, options) => {
      requests.push(url);
      assert.ok(options.signal instanceof AbortSignal);
      if (url.endsWith('/status')) return response({ nodeName: 'test-board', services: ['FFS', 'pmachine'] });
      return new Promise((resolve, reject) => { failDescription = reject; });
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(discoveredNodes.get(ip).details.services, ['FFS', 'pmachine']);
  assert.equal(discoveredNodes.get(ip).details.capabilityHash, 'original');
  assert.equal(discoveredNodes.get(ip).beacon.seenAt, 123);
  assert.deepEqual(requests.sort(), [`http://${ip}:8080/services/describe`, `http://${ip}:8080/status`]);
  failDescription(new Error('description timed out'));
  await finished;
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /description timed out/);
  assert.deepEqual(discoveredNodes.get(ip).details.services, ['FFS', 'pmachine']);
});

test('an empty service description does not erase status capabilities', async () => {
  const discoveredNodes = new Map([[ip, { details: {} }]]);
  await enrichDiscoveredNode({
    ip,
    discoveredNodes,
    fetchImpl: async (url) => response(url.endsWith('/status')
      ? { services: ['pmachine'] }
      : { services: [], hardware: 'ESP32' })
  });
  assert.deepEqual(discoveredNodes.get(ip).details.services, ['pmachine']);
  assert.equal(discoveredNodes.get(ip).details.hardware, 'ESP32');
});

test('service descriptions retain their richer service objects', async () => {
  const discoveredNodes = new Map([[ip, { details: {} }]]);
  const services = [{ name: 'pmachine', commands: ['run'] }];
  await enrichDiscoveredNode({
    ip,
    discoveredNodes,
    fetchImpl: async (url) => response(url.endsWith('/status') ? { services: ['pmachine'] } : { services })
  });
  assert.deepEqual(discoveredNodes.get(ip).details.services, services);
});

test('HTTP failures and invalid payloads are logged without erasing discovery metadata', async () => {
  const discoveredNodes = new Map([[ip, { details: { capabilityHash: 'original' } }]]);
  const warnings = [];
  await enrichDiscoveredNode({
    ip,
    discoveredNodes,
    logger: { warn: (message) => warnings.push(message) },
    fetchImpl: async (url) => url.endsWith('/status') ? { ok: false, status: 503 } : response([])
  });
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((message) => message.includes('HTTP 503')));
  assert.ok(warnings.some((message) => message.includes('Expected a JSON object')));
  assert.deepEqual(discoveredNodes.get(ip).details, { capabilityHash: 'original' });
});

test('enrichment does not resurrect a node removed during a request', async () => {
  const discoveredNodes = new Map([[ip, { details: {} }]]);
  await enrichDiscoveredNode({
    ip,
    discoveredNodes,
    fetchImpl: async () => {
      discoveredNodes.delete(ip);
      return response({ services: ['pmachine'] });
    }
  });
  assert.equal(discoveredNodes.has(ip), false);
});

test('UDP discovery bind conflicts reject instead of reporting successful startup', async () => {
  const first = dgram.createSocket('udp4');
  const second = dgram.createSocket('udp4');
  try {
    await bindNodeDiscoverySocket(first, 0);
    await assert.rejects(bindNodeDiscoverySocket(second, first.address().port), { code: 'EADDRINUSE' });
  } finally {
    first.close();
    second.close();
  }
});
