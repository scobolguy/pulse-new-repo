import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';
import { test } from 'node:test';
import { compileKasaCollector } from '../../../../languages/kotlin/src/kasa-artifacts.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createDeviceFederation } from '../../pmachines/javascript/src/device-federation.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { installNetworkCollectors } from '../../pmachines/javascript/install-network-collectors.mjs';

const lanIp = process.env.PULSE_KASA_LAN_IP;
const cycles = Number(process.env.PULSE_KASA_CYCLES || 1);
const request = Buffer.from('d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6', 'hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Pulse Kotlin Kasa discovery on a JS PMachine against the local LAN', {
  skip: !lanIp, timeout: cycles === 2 ? 340000 : 30000
}, async t => {
  assert.ok(cycles === 1 || cycles === 2);
  const lan = Object.values(os.networkInterfaces()).flat().find(item => item.address === lanIp && !item.internal);
  assert.ok(lan, 'Configured LAN interface must be active');
  const ip = lan.address.split('.').map(Number), mask = lan.netmask.split('.').map(Number);
  const broadcast = ip.map((part, index) => (part & mask[index]) | (255 ^ mask[index])).join('.');
  const baseline = new Set();
  const probe = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.bind(0, lanIp, resolve);
  });
  probe.on('message', (message, peer) => {
    let key = 171;
    const data = Buffer.from([...message].map(byte => { const plain = key ^ byte; key = byte; return plain; }));
    try {
      if (JSON.parse(data.toString('utf8')).system?.get_sysinfo?.err_code === 0) baseline.add(peer.address);
    } catch (error) { console.warn(`Unrecognized UDP response from ${peer.address}: ${error.message}`); }
  });
  probe.setBroadcast(true);
  await new Promise((resolve, reject) => probe.send(request, 9999, broadcast,
    error => error ? reject(error) : resolve()));
  await sleep(2000);
  await new Promise(resolve => probe.close(resolve));
  assert.ok(baseline.size > 0, 'No legacy Kasa devices responded to the independent broadcast');

  const { daemon, service: compiled } = await compileKasaCollector('js');
  const warnings = [];
  const host = await createPascalishServiceHost({
    compiled, daemons: [{ compiled: daemon, udpPort: 9999, udpBindAddress: lanIp, udpShared: true, udpQueueLimit: 50 }],
    collectorId: 'kasa-js', host: '127.0.0.1', httpPort: 0, udpPort: null,
    networkPeers: [{ ip: broadcast, port: 9999 }],
    maxExecutionMs: 8000, logger: { warn(message) { warnings.push(message); }, error: console.error, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const origin = `http://127.0.0.1:${host.getStatus().httpPort}`;
  const federation = createDeviceFederation({
    sources: [{ protocol: 'kasa', collectorId: 'kasa-js', origin }],
    logger: { warn() {} }
  });
  async function check() {
    await sleep(4000);
    const stats = host.getStatus().daemonDiagnostics[0];
    assert.equal(stats.failures, 0, warnings.join('; '));
    assert.equal(stats.droppedDatagrams, 0);
    assert.equal(stats.shedDatagrams, 0);
    await federation.refresh();
    assert.equal(federation.metadata().completeness, true,
      federation.metadata().sources[0].error);
    const records = [];
    let cursor = '', fence = '';
    do {
      const page = federation.page({ cursor, fence });
      fence = page.revision;
      records.push(...page.records);
      cursor = page.nextCursor;
    } while (cursor);
    const found = new Map(records.map(record => [record.device.address, record]));
    for (const address of baseline) assert.ok(found.has(address),
      `Missing observed Kasa device ${address}; found=${[...found.keys()]}; diagnostics=${JSON.stringify(stats)}`);
    const names = new Set();
    cursor = '';
    do {
      const response = await fetch(`${origin}/api/devices/names?cursor=${encodeURIComponent(cursor)}`);
      assert.equal(response.status, 200);
      const page = await response.json();
      page.names.forEach(name => names.add(name));
      cursor = page.nextCursor;
    } while (cursor);
    for (const record of records) assert.ok(names.has(record.device.name));
    return found;
  }
  const first = await check();
  if (cycles === 2) {
    const deadline = Date.now() + 310000;
    while (host.getStatus().daemonDiagnostics[0].timerRuns < 2 && Date.now() < deadline) await sleep(250);
    assert.equal(host.getStatus().daemonDiagnostics[0].timerRuns, 2, 'Second five-minute scan did not run');
    const second = await check();
    for (const address of baseline) {
      assert.ok(second.get(address).evidence[0].observationSequence >
        first.get(address).evidence[0].observationSequence, `Device ${address} was not refreshed`);
    }
  }
  console.log(`Discovered ${first.size} Kasa device(s); verified ${cycles} scan cycle(s)`);
});

test('network installer deploys Kotlin Kasa to a JS PMachine', {
  skip: !lanIp || !process.env.PULSE_KASA_DEPLOYMENT, timeout: 60000
}, async t => {
  async function freeTcpPort() {
    const listener = net.createServer();
    await new Promise((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolve);
    });
    const port = listener.address().port;
    await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    return port;
  }
  async function freeUdpPort() {
    const socket = dgram.createSocket('udp4');
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(0, resolve); });
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    return port;
  }
  const [kasaHttpPort, tuyaHttpPort, ssdpHttpPort] = await Promise.all(
    Array.from({ length: 3 }, freeTcpPort));
  const [tuyaUdpPort, tuyaLegacyUdpPort, ssdpUdpPort] = await Promise.all(
    Array.from({ length: 3 }, freeUdpPort));
  const server = createJsPmachineNodeServer({ logger: console });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let installed = [];
  t.after(async () => {
    for (const collectorId of installed) {
      const response = await fetch(`${origin}/pmachine/service_host/stop`, {
        method: 'POST', body: new URLSearchParams({ collectorId })
      });
      assert.equal(response.status, 200, `Could not stop ${collectorId}`);
    }
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const result = await installNetworkCollectors({ origin, config: {
    esp32Origin: 'http://127.0.0.1', lanInterface: lanIp, kasaHttpPort, tuyaHttpPort,
    ssdpHttpPort, tuyaUdpPort, tuyaLegacyUdpPort, ssdpUdpPort
  } });
  installed = result.collectorIds;
  const inventory = await (await fetch(`${origin}/api/services`)).json();
  for (const id of ['kasa-service', 'kasa-collector']) {
    assert.equal(inventory.services.find(service => service.serviceId === id)?.provider, 'kotlin');
  }
  await sleep(5000);
  const federation = createDeviceFederation({ sources: [{
    protocol: 'kasa', collectorId: 'kasa-js', origin: `http://127.0.0.1:${kasaHttpPort}`
  }] });
  await federation.refresh();
  assert.equal(federation.metadata().completeness, true, federation.metadata().sources[0].error);
  const page = federation.page();
  assert.ok(page.total > 0, 'No Kasa devices found through the deployed collector');
  console.log(`Installed collector published ${page.total} Kasa device(s) to the Studio cache API`);
});
