import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { createPascalishPulseNodeCollector } from '../../pmachines/javascript/discovery-collector.mjs';
import { createDiscoveryProvider } from '../../aggregator/src/backend/modules/discoveryProvider.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';

const logger = { warn() {}, error() {}, log() {} };
const beacon = (id, extras = {}) => ({
  kind: 'nodeBeacon', nodeId: id, nodeName: id, ip: '127.0.0.1',
  port: 4111, available: true, ...extras
});

async function start(t, options = {}) {
  const host = await createPascalishPulseNodeCollector({
    httpPort: 0, udpPort: 0, logger, ...options
  });
  t.after(() => host.stop());
  await host.start();
  const socket = dgram.createSocket('udp4');
  await new Promise(resolve => socket.bind(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => socket.close(resolve)));
  const send = async payload => {
    const diagnostics = () => host.getStatus().daemonDiagnostics[0];
    const before = diagnostics().udpEvents;
    const bytes = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
    await new Promise((resolve, reject) => socket.send(bytes, diagnostics().udpPort,
      '127.0.0.1', error => error ? reject(error) : resolve()));
    const deadline = Date.now() + 5000;
    while (diagnostics().udpEvents === before) {
      if (Date.now() >= deadline) throw new Error('Pulse announcement was not processed');
      await delay(5);
    }
  };
  const snapshot = async (cursor = '') => {
    const response = await host.dispatch({
      method: 'GET', path: '/api/discovery/snapshot', query: { cursor }
    });
    assert.equal(response.status, 200);
    return response.body;
  };
  return { host, send, snapshot };
}

test('Pulse collector is a distinct bounded Pascalish daemon', async () => {
  const source = await fs.readFile(new URL('../../src/pulse-node-collector-daemon.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
  assert.equal(compiled.programMap.runtimeUnit.kind, 'daemon');
  assert.equal(compiled.programMap.runtimeUnit.id, 'pulse-node-collector');
  assert.ok(Number.parseInt(encodeHostedImage(compiled.pcodeText).slice(4, 12), 16) <= 512);
});

test('UDP observations merge stable identities, preserve details and expire without polling renewal', async t => {
  let time = 1000;
  const { host, send, snapshot } = await start(t, { clock: () => time });
  assert.equal(host.getStatus().udpPort, null);
  await send(beacon('board', { hardware: 'ESP32', runtime: 'esp32', services: ['pmachine'] }));
  time += 1000;
  await send(beacon('board', { nodeName: 'Updated board' }));
  await send(beacon('js-1'));
  await send(beacon('js-2', { kind: 'machineAvailability', port: 4112 }));
  const first = await snapshot();
  assert.equal(first.nodes.length, 3, 'same-IP p-machines remain distinct');
  const board = first.nodes.find(node => node.nodeId === 'board');
  assert.equal(board.nodeName, 'Updated board');
  assert.equal(board.details.hardware, 'ESP32');
  assert.equal(board.remainingTtlMs, 180000);
  const pulseDevices = await host.dispatch({
    method: 'GET', path: '/api/devices/snapshot', query: {}
  });
  assert.equal(pulseDevices.status, 200);
  assert.equal(pulseDevices.body.total, 3);
  const pulseDevice = pulseDevices.body.records.find(record => record.key === 'board');
  assert.deepEqual(pulseDevice.device, {
    name: 'Updated board', protocol: 'pulse', address: '127.0.0.1', deviceType: 'pmachine'
  });
  time += 179999;
  assert.ok((await snapshot()).nodes.every(node => node.remainingTtlMs === 1));
  const almostExpired = await host.dispatch({
    method: 'GET', path: '/api/devices/snapshot', query: {}
  });
  assert.ok(almostExpired.body.records.every(record => record.remainingTTLms === 1));
  time += 1;
  assert.deepEqual((await snapshot()).nodes, []);
  assert.equal((await host.dispatch({
    method: 'GET', path: '/api/devices/snapshot', query: {}
  })).body.total, 0);
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0);
});

test('unrelated packets are ignored and malformed announcements surface daemon errors', async t => {
  const { host, send, snapshot } = await start(t);
  await send(beacon('valid'));
  await send({ kind: 'nodeBeaconAck', nodeId: 'ignored' });
  await send('{invalid');
  await send(beacon('invalid', { nodeName: '' }));
  assert.deepEqual((await snapshot()).nodes.map(node => node.nodeId), ['valid']);
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 2);
  assert.match(host.getStatus().daemonDiagnostics[0].lastError, /Invalid announcement nodeName/);
});

test('local JS PMachines reach the Pulse device cache without a backend or usual LAN', async t => {
  let time = 1000;
  const { host } = await start(t, { clock: () => time, udpHost: '0.0.0.0' });
  const machines = [];
  t.after(async () => {
    await Promise.all(machines.filter(machine => machine.listening)
      .map(machine => new Promise(resolve => machine.close(resolve))));
  });
  for (const name of ['local-js-1', 'local-js-2']) {
    const machine = createJsPmachineNodeServer({
      name, udpAnnouncePort: host.getStatus().daemonDiagnostics[0].udpPort,
      announceIntervalMs: 25, logger
    });
    machines.push(machine);
    await new Promise(resolve => machine.listen(0, '127.0.0.1', resolve));
  }
  const snapshot = async () => (await host.dispatch({
    method: 'GET', path: '/api/devices/snapshot', query: {}
  })).body;
  const deadline = Date.now() + 5000;
  while ((await snapshot()).total !== 2) {
    if (Date.now() >= deadline) assert.fail('Both local JS PMachines must enter the distributed device cache');
    await delay(10);
  }
  assert.deepEqual((await snapshot()).records.map(record => record.key).sort(), ['local-js-1', 'local-js-2']);
  for (const record of (await snapshot()).records) {
    assert.deepEqual(record.device, {
      name: record.key, protocol: 'pulse', address: '127.0.0.1', deviceType: 'pmachine'
    });
  }
  const before = host.getStatus().daemonDiagnostics[0].udpEvents;
  time += 100000;
  while (host.getStatus().daemonDiagnostics[0].udpEvents < before + 2) {
    if (Date.now() >= deadline) assert.fail('Local UDP heartbeats must repeat');
    await delay(10);
  }
  assert.ok((await snapshot()).records.every(record => record.remainingTTLms === 180000));
  await Promise.all(machines.map(machine => new Promise(resolve => machine.close(resolve))));
  await delay(50);
  const stopped = host.getStatus().daemonDiagnostics[0].udpEvents;
  await delay(75);
  assert.equal(host.getStatus().daemonDiagnostics[0].udpEvents, stopped);
  time += 180000;
  assert.equal((await snapshot()).total, 0, 'Stopped JS PMachines expire rather than remaining falsely available');
});

test('Network discovery provider reads all snapshot pages and removes expired nodes', async t => {
  let time = 1000;
  const { host, send } = await start(t, { clock: () => time });
  for (let index = 0; index < 7; index++) await send(beacon(`pulse-${index}`));
  const discoveredNodes = new Map();
  const provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: [`http://127.0.0.1:${host.getStatus().httpPort}`],
      timeoutMs: 2000, pollIntervalMs: 60000 },
    discoveredNodes, now: () => time, logger
  });
  t.after(() => provider.stop());
  await provider.refresh();
  assert.equal(provider.getNodes().length, 7);
  assert.equal(discoveredNodes.size, 7);
  assert.equal(provider.getStatus().status, 'healthy');
  time += 180000;
  await provider.refresh();
  assert.deepEqual(provider.getNodes(), []);
  assert.equal(discoveredNodes.size, 0);
});
