import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr as compile } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { assertHostCapabilities } from '../../pmachines/shared/contracts/host-capabilities.mjs';
import { parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { deployBluetoothCollector } from '../../pmachines/javascript/deploy-bluetooth-collector.mjs';

const logger = { log() {}, warn() {}, error() {} };
const service = compile(await fs.readFile(new URL('../../src/bluetooth-collector-service.pas', import.meta.url), 'utf8'), { hostServices: true });
service.programMap.hostTables = [{ name: 'bluetooth-devices', capacity: 255 }, { name: 'bluetooth-endpoints', capacity: 255 }];
const daemon = compile(await fs.readFile(new URL('../../src/bluetooth-collector-daemon.pas', import.meta.url), 'utf8'), { hostServices: true });
const advertisement = (address, name = '', rssi = -60) => ({
  kind: 'advertisement', transport: 'ble', address, addressType: 'Random', name, rssi
});
const endpoint = (id, address, fields = {}, action = 'added', transport = 'ble') => ({
  kind: 'endpoint', transport, id, action,
  fields: { ...(address ? { address } : {}), ...fields }
});

function source(events = []) {
  return {
    events, stopped: false, lastError: '',
    read(limit) {
      if (this.lastError) throw new Error(this.lastError);
      return JSON.stringify(this.events.splice(0, limit));
    },
    status() { return JSON.stringify({ running: !this.stopped, lastError: this.lastError, overflow: 0 }); },
    async stop() { this.stopped = true; }
  };
}
async function fixture(t, events) {
  let clock = 1000;
  const bridge = source(events);
  const host = await createPascalishServiceHost({
    compiled: service, daemons: [daemon], collectorId: 'bluetooth-test', logger,
    httpPort: null, udpPort: null, clock: () => clock,
    bluetoothSourceFactory: async () => bridge
  });
  t.after(() => host.stop());
  await host.start();
  async function devices() {
    const result = [];
    let cursor = '';
    do {
      const response = await host.dispatch({ method: 'GET', path: '/api/bluetooth/devices', query: { cursor } });
      result.push(...response.body.nodes);
      cursor = response.body.nextCursor;
    } while (cursor);
    return result;
  }
  async function update(events, time = clock) {
    clock = time;
    const before = host.getStatus().daemonDiagnostics[0].timerRuns;
    bridge.events.push(...events);
    const deadline = Date.now() + 5000;
    while (host.getStatus().daemonDiagnostics[0].timerRuns === before) {
      if (Date.now() > deadline) throw new Error('Bluetooth daemon did not run');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0, host.getStatus().daemonDiagnostics[0].lastError);
  }
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0, host.getStatus().daemonDiagnostics[0].lastError);
  return { bridge, host, devices, update, setClock(time) { clock = time; } };
}

test('Bluetooth collection compiles only to JS and requires explicit native discovery grants', async () => {
  assert.deepEqual(daemon.programMap.requiredHostCapabilities, ['bluetooth.discovery']);
  assert.deepEqual(service.programMap.targets, ['js']);
  assert.throws(() => assertHostCapabilities(daemon.programMap, parsePcode(daemon.pcodeText), []), /bluetooth.discovery/);
  await assert.rejects(createPascalishServiceHost({
    compiled: service, daemons: [daemon], collectorId: 'no-grant', httpPort: null, udpPort: null
  }), /bluetooth.discovery/);
});

test('Pascalish discovers every protocol, merges addresses/names and pages beyond five entries without filtering unnamed devices', async t => {
  const events = [
    endpoint('win-ble', 'aa:bb:cc:dd:ee:01', { name: 'Named mouse', paired: 1, present: 1, connected: 0 }),
    advertisement('AABBCCDDEE01', '', -51),
    advertisement('AABBCCDDEE01', '', -45),
    endpoint('win-classic', 'AA-BB-CC-DD-EE-02', { name: 'Classic keyboard', paired: 1, present: 0 }, 'added', 'classic'),
    ...Array.from({ length: 12 }, (_, i) => advertisement(`1234567890${i.toString(16).padStart(2, '0')}`))
  ];
  const f = await fixture(t, events);
  const records = await f.devices();
  assert.equal(records.length, 14);
  const mouse = records.find(record => record.id === 'bluetooth:ble:AABBCCDDEE01');
  assert.equal(mouse.name, 'Named mouse');
  assert.equal(mouse.rssi, -45);
  assert.equal(mouse.addressType, 'random');
  assert.equal(mouse.paired, 1);
  assert.equal(mouse.visibility, 'advertising');
  assert.ok(records.some(record => record.name === 'Unnamed Bluetooth device'));
  assert.equal(records.find(record => record.transport === 'classic').visibility, 'known');
});

test('endpoint updates merge partial OS state; removals cannot erase a recently advertising device', async t => {
  const f = await fixture(t, [
    endpoint('windows', 'aa:bb:cc:dd:ee:01', { name: 'Mouse', paired: 1, present: 1 }),
    advertisement('AABBCCDDEE01', 'Mouse advertisement')
  ]);
  await f.update([endpoint('windows', '', { connected: 1 }, 'updated')]);
  let records = await f.devices();
  assert.equal(records.length, 1);
  assert.equal(records[0].connected, 1);
  assert.equal(records[0].name, 'Mouse');
  await f.update([endpoint('windows', '', {}, 'removed')], 1100);
  records = await f.devices();
  assert.equal(records.length, 1);
  assert.equal(records[0].visibility, 'advertising');
  assert.equal(records[0].connected, 0);
  f.setClock(121000);
  assert.equal((await f.devices()).length, 0);
});

test('known/paired inventory never implies advertising, and expired advertisements lose their live visibility', async t => {
  const f = await fixture(t, [
    advertisement('AABBCCDDEE01', 'BLE signal'),
    endpoint('win', 'aa:bb:cc:dd:ee:01', { name: 'Known BLE', paired: 1, connected: 0, present: 0 }),
    endpoint('classic', 'aa:bb:cc:dd:ee:02', { name: 'Connected classic', connected: 1 }, 'added', 'classic')
  ]);
  assert.equal((await f.devices()).find(record => record.transport === 'classic').visibility, 'connected');
  f.setClock(121000);
  assert.equal((await f.devices()).find(record => record.transport === 'ble').visibility, 'known');
  f.setClock(181000);
  assert.equal((await f.devices()).length, 0);
});

test('duplicate Windows endpoints share an address without a removed or historical endpoint hiding a current device', async t => {
  const f = await fixture(t, [
    endpoint('live-radio', 'aa:bb:cc:dd:ee:01', { name: 'Mouse', paired: 1, connected: 1, present: 1 }),
    endpoint('old-radio', 'aa:bb:cc:dd:ee:01', { name: 'Mouse', paired: 1, connected: 0, present: 0 })
  ]);
  assert.equal((await f.devices()).length, 1);
  assert.equal((await f.devices())[0].visibility, 'connected');
  await f.update([endpoint('old-radio', '', {}, 'removed')]);
  assert.equal((await f.devices())[0].visibility, 'connected');
  assert.equal(Object.hasOwn((await f.devices())[0], 'endpointStates'), false);
});

test('removed endpoints delete known-only devices immediately without racing a one-millisecond tombstone TTL', async t => {
  const f = await fixture(t, [endpoint('old', 'aa:bb:cc:dd:ee:01', { name: 'Removed', paired: 1, present: 0 })]);
  assert.equal((await f.devices()).length, 1);
  await f.update([endpoint('old', '', {}, 'removed')], 1100);
  assert.equal((await f.devices()).length, 0);
});

test('radio/bridge failures are visible in health and daemon diagnostics; stopping the host closes discovery', async t => {
  const f = await fixture(t, []);
  f.bridge.lastError = 'Bluetooth radio disabled';
  assert.equal((await f.host.dispatch({ method: 'GET', path: '/health' })).status, 503);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.ok(f.host.getStatus().daemonDiagnostics[0].failures > 0);
  assert.match(f.host.getStatus().daemonDiagnostics[0].lastError, /radio disabled/);
  await f.host.stop();
  assert.equal(f.bridge.stopped, true);
});

test('installer uses signed Pascalish service and daemon over real PMachine HTTP and grants remain deployment-owned', async t => {
  const bridge = source([advertisement('AABBCCDDEE01', 'HTTP proof')]);
  const runtime = await deployBluetoothCollector({ port: 0, logger, bluetoothSourceFactory: async () => bridge });
  t.after(() => runtime.stop());
  const response = await fetch(`${runtime.origin}/api/bluetooth/devices`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).nodes[0].name, 'HTTP proof');
  const status = await (await fetch(`${runtime.origin}/pmachine/service_host/status`)).json();
  assert.equal(status.daemonDiagnostics[0].failures, 0);
  assert.ok(status.capabilities.supported.includes('bluetooth.discovery'));
});

test('failed initial collection shuts down the installed context and its native intake', async () => {
  const bridge = source([]);
  bridge.lastError = 'Intake failed during startup';
  await assert.rejects(deployBluetoothCollector({
    port: 0, logger, bluetoothSourceFactory: async () => bridge
  }), /did not start cleanly/);
  assert.equal(bridge.stopped, true);
});
