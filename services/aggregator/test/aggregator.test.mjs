import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { LiveRegistry } from '../src/registry.mjs';
import { createAggregator } from '../src/server.mjs';

const beacon = (overrides = {}) => ({
  kind: 'nodeBeacon', nodeId: 'esp-a', firmwareBuildStamp: 'Oct 31 2026 23:51:13', available: true, draining: false, httpPort: 80, ...overrides
});

test('lists fresh available ESP nodes and expires old ones', () => {
  let now = 1000;
  const registry = new LiveRegistry({ ttlMs: 500, clock: () => now });
  registry.observe(beacon(), '10.0.0.5');
  assert.deepEqual(registry.list().map(n => n.nodeId), ['esp-a']);
  now += 500;
  assert.deepEqual(registry.list(), []);
});

test('rejects non-ESP, spoofed, unavailable, draining and non-beacon messages', () => {
  const registry = new LiveRegistry({ ttlMs: 1000 });
  assert.equal(registry.observe(beacon({ firmwareBuildStamp: undefined }), '10.0.0.5'), null);
  assert.equal(registry.observe(beacon({ firmwareBuildStamp: undefined, hardware: 'ESP32' }), '10.0.0.5')?.nodeId, 'esp-a');
  registry.remove('esp-a');
  assert.equal(registry.observe(beacon({ ip: '10.0.0.9' }), '10.0.0.5'), null);
  assert.equal(registry.observe({ kind: 'pulseDiscoveryRequest', nodeId: 'x' }, '10.0.0.5'), null);
  registry.observe(beacon({ nodeId: 'a', available: false }), '10.0.0.6');
  registry.observe(beacon({ nodeId: 'd', draining: true }), '10.0.0.7');
  assert.deepEqual(registry.list(), []);
});

test('API serves live ESP beacons only, drops unreachable nodes, keeps nothing across restarts', async () => {
  let reachable = true;
  const make = () => createAggregator({
    udpPort: 0, httpPort: 0, host: '127.0.0.1', log: { error() {}, warn() {} },
    fetchImpl: async () => ({ ok: reachable, json: async () => ({}) })
  });
  const aggregator = make();
  const ports = await aggregator.start();
  const sender = dgram.createSocket('udp4');
  const send = async () => {
    const ack = new Promise(resolve => sender.once('message', m => resolve(JSON.parse(m.toString()))));
    sender.send(JSON.stringify(beacon()), ports.udpPort, '127.0.0.1');
    assert.equal((await ack).kind, 'nodeBeaconAck');
  };
  await send();

  const get = async () => {
    const response = await fetch(`http://127.0.0.1:${ports.httpPort}/api/nodes`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  assert.deepEqual((await get()).map(n => n.nodeId), ['esp-a']);
  reachable = false;
  assert.deepEqual(await get(), []);
  await send();
  assert.deepEqual(await get(), []);
  sender.close();
  await aggregator.stop();

  const restarted = make();
  const restartedPorts = await restarted.start();
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${restartedPorts.httpPort}/api/nodes`)).json(), []);
  await restarted.stop();
});
