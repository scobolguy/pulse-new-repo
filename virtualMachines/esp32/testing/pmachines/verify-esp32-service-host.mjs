import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import dgram from 'node:dgram';
import { setTimeout as delay } from 'node:timers/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { createDiscoveryProvider } from '../../aggregator/src/backend/modules/discoveryProvider.mjs';

// Explicit opt-in: this test installs and stops units on real hardware.
const target = process.env.PULSE_ESP32_TEST_URL;
if (!target) throw new Error('Set PULSE_ESP32_TEST_URL to the ESP32 HTTP origin');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash)
  throw new Error('PULSE_ESP32_TEST_URL must be an HTTP(S) origin');

async function request(path, values, expected = 200, json = false) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt === 0) console.log(`${values === undefined ? 'GET' : 'POST'} ${path}`);
    const response = await fetch(new URL(path, origin), {
      ...(values === undefined ? {} : {
        method: 'POST',
        body: json ? JSON.stringify(values) : new URLSearchParams(values),
        ...(json ? { headers: { 'Content-Type': 'application/json' } } : {})
      }),
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.text();
    if (response.status === 503 && expected === 200 && /busy/i.test(body) && attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      continue;
    }
    assert.equal(response.status, expected, `${path}: ${body}`);
    return body;
  }
  throw new Error(`${path}: service remained busy`);
}

const previous = JSON.parse(await request('/pmachine/service_host/status'));
assert.equal(previous.running, false, 'Stop the existing host explicitly before running this hardware test');
const prefix = `/sh${Date.now().toString(36)}`;
const udpPort = 44210;
const files = [];
const units = {};
const socket = dgram.createSocket('udp4');
await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.bind(0, () => { socket.removeListener('error', reject); resolve(); });
});
let installed = false;
let heartbeat;
let provider;
let udpError;
socket.on('error', error => { udpError = error; });
try {
  for (const [kind, name] of [['service', 'discovery-collector-service'], ['daemon', 'discovery-maintenance-daemon']]) {
    const source = await fs.readFile(new URL(`../../src/${name}.pas`, import.meta.url), 'utf8');
    const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
    const suffix = kind === 'service' ? 's' : 'd';
    units[kind] = { file: `${prefix}-${suffix}.pcode`, map: `${prefix}-${suffix}.map.json` };
    for (const [file, body] of [
      [units[kind].file, compiled.pcodeText],
      [units[kind].map, JSON.stringify(attachPcodeSignature(compactServiceHostProgramMap(compiled.programMap), compiled.pcodeText))]
    ]) {
      await request('/ffs/upload', { file, body });
      files.push(file);
    }
  }
  const parameters = {
    serviceFile: units.service.file, serviceMap: units.service.map,
    daemonFile: units.daemon.file, daemonMap: units.daemon.map,
    collectorId: 'esp32-hardware-proof', udpPort: String(udpPort),
    observationTtlMs: '30000', announcementIntervalMs: '200'
  };
  await request('/pmachine/service_host/install', { ...parameters, observationTtlMs: '200' }, 400);
  const install = JSON.parse(await request('/pmachine/service_host/install', parameters));
  installed = true;
  assert.equal(install.running, true);
  const snapshot = async () => {
    let cursor = '';
    let first;
    const nodes = [];
    for (let pageNumber = 0; pageNumber < 52; pageNumber += 1) {
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const page = JSON.parse(await request(`/api/discovery/snapshot${suffix}`));
      first ??= page;
      nodes.push(...page.nodes);
      if (page.continuation === 'end') return { ...first, nodes, continuation: 'end', nextCursor: '' };
      assert.equal(page.continuation, 'continue');
      assert.ok(page.nextCursor);
      cursor = page.nextCursor;
    }
    throw new Error('Hardware snapshot pagination did not terminate');
  };
  assert.equal((await snapshot()).protocolVersion, 1);
  const beacon = {
    kind: 'nodeBeacon', nodeId: 'udp-hardware-proof', nodeName: 'udp-hardware-proof',
    ip: '127.0.0.1', httpPort: 4101, status: 'here'
  };
  const ack = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.removeListener('message', receive); reject(new Error('UDP ACK timeout')); }, 5000);
    const receive = bytes => { clearTimeout(timeout); resolve(JSON.parse(bytes)); };
    socket.once('message', receive);
    socket.send(JSON.stringify(beacon), udpPort, origin.hostname, error => {
      if (error) { clearTimeout(timeout); socket.removeListener('message', receive); reject(error); }
    });
  });
  assert.equal(ack.kind, 'nodeBeaconAck');
  assert.equal(ack.nodeId, beacon.nodeId);
  const announce = { nodeId: 'http-hardware-proof', nodeName: 'http-hardware-proof',
    ip: '127.0.0.1', port: 4102, runtime: 'js-pmachine', services: [{ name: 'PMachine Runtime' }] };
  await request('/api/pmachine/announce', announce, 200, true);
  const httpNode = (await snapshot()).nodes.find(node => node.nodeId === announce.nodeId);
  assert.equal(httpNode?.details.runtime, 'js-pmachine');
  assert.equal(httpNode?.details.services[0]?.name, 'PMachine Runtime');
  assert.deepEqual(httpNode?.availability, { available: true, draining: false, status: 'available' });
  for (let index = 0; index < 17; index += 1) {
    const id = `capacity-page-proof-${String(index).padStart(2, '0')}`;
    await request('/api/pmachine/announce', {
      nodeId: id, nodeName: id, ip: '127.0.0.1', port: 4103, runtime: 'capacity-page-proof'
    }, 200, true);
  }
  const pagedNodes = await snapshot();
  assert.equal(pagedNodes.nodes.length, 19);
  assert.equal(pagedNodes.continuation, 'end');
  await request('/api/pmachine/announce', { nodeId: '' }, 400, true);
  await request('/api/pmachine/announce', { nodeId: 'large', padding: 'x'.repeat(3000) }, 413, true);
  await request('/pmachine/service_host/stop', {});
  installed = false;
  await request('/pmachine/service_host/install', { ...parameters, observationTtlMs: '2000' });
  installed = true;
  heartbeat = setInterval(() => socket.send(JSON.stringify(beacon), udpPort, origin.hostname), 200);
  await delay(2500);
  if (udpError) throw udpError;
  const active = (await snapshot()).nodes.find(node => node.nodeId === beacon.nodeId);
  assert.ok(active && active.remainingTtlMs > 0 && active.remainingTtlMs <= 2000);
  provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: [origin.origin], timeoutMs: 3000, pollIntervalMs: 60000 },
    discoveredNodes: new Map(), logger: console,
    createLocalRuntime: () => { throw new Error('Unexpected local runtime'); }
  });
  await provider.refresh();
  assert.ok(provider.getNodes().some(node => node.nodeId === beacon.nodeId));
  clearInterval(heartbeat);
  heartbeat = undefined;
  // No snapshot request during this wait: the Pascalish daemon must remove entries itself.
  await delay(3300);
  const expired = JSON.parse(await request('/pmachine/service_host/status'));
  assert.equal(expired.entries, 0);
  assert.equal(expired.lastError, '');
  assert.equal((await snapshot()).nodes.length, 0);
  await provider.refresh();
  assert.equal(provider.getNodes().length, 0);
  console.log('ESP32 hosted Pascalish HTTP, UDP ACK/heartbeat, daemon expiry and Aggregator snapshot tests passed');
} finally {
  if (heartbeat) clearInterval(heartbeat);
  if (provider) await provider.stop();
  await new Promise(resolve => socket.close(resolve));
  if (installed) {
    await request('/pmachine/service_host/stop', {});
    await request('/api/discovery/snapshot', undefined, 503);
  }
  for (const file of files) await request('/ffs/delete', { file });
}
