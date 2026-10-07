import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const origin = process.argv[2];
if (!origin) throw new Error('Usage: node run-tuya-discovery.mjs <ESP32 origin> [--observe-only] [--report <path>]');
const observeOnly = process.argv.includes('--observe-only');
const url = new URL(origin);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, url), options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text;
}
async function status(id = '') {
  const path = `/pmachine/service_host/status${id ? `?collectorId=${encodeURIComponent(id)}` : ''}`;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const response = await requestEsp32(new URL(path, url));
    const text = await response.text();
    if (response.status === 503 && text === '{"busy":true,"hostBindingsVersion":1,"executionModel":"single-worker"}') {
      if (attempt === 3) throw new Error('ESP32 status busy after three retries; try again later');
      await wait(250 + Math.floor(Math.random() * 751));
      continue;
    }
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
    return JSON.parse(text);
  }
}
const before = await status(observeOnly ? 'tuya-discovery' : '');
const existing = before.services ?? (before.running ? [before] : []);
if (observeOnly && (!before.running || before.collectorId !== 'tuya-discovery')) {
  throw new Error('Tuya discovery is not installed');
}
if (!observeOnly && existing.some(service => service.collectorId === 'tuya-discovery')) {
  throw new Error('Tuya discovery already installed; stop it explicitly before replacing its open images');
}
if (!observeOnly && existing.length >= 2) throw new Error('No hosted service slot available; existing services were not changed');
if (!observeOnly) {
  for (const [kind, source, name] of [
    ['service', 'tuya-discovery-service', 'tuya'],
    ['daemon', 'tuya-maintenance-daemon', 'tuyad']
  ]) {
    const compiled = compilePascalishProgramWithAntlr(
      await fs.readFile(new URL(`../../src/${source}.pas`, import.meta.url), 'utf8'), { hostServices: true });
    const image = encodeHostedImage(compiled.pcodeText);
    const map = attachPcodeSignature({
      ...compactServiceHostProgramMap(compiled.programMap),
      ...(kind === 'service' ? { hostTables: [{ name: 'devices', capacity: 16 }] } : {}),
      hostImageFormat: 'PHI1'
    }, image);
    await request(`/ffs/upload_stream?file=/${name}.phi`, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image
    });
    await request('/ffs/upload', {
      method: 'POST', body: new URLSearchParams({ file: `/${name}.map.json`, body: JSON.stringify(map) })
    });
  }
  await request('/pmachine/service_host/install', {
    method: 'POST', body: new URLSearchParams({
      serviceFile: '/tuya.phi', serviceMap: '/tuya.map.json',
      daemonFile: '/tuyad.phi', daemonMap: '/tuyad.map.json',
      collectorId: 'tuya-discovery', udpPort: '6667',
      observationTtlMs: '180000', announcementIntervalMs: '60000'
    })
  });
}
console.log('Observing passive Tuya discovery on ESP32 UDP 6667; waiting for device broadcasts.');
await wait(45000);
const nodes = [];
let cursor = '';
do {
  const page = JSON.parse(await request(`/api/tuya/devices?cursor=${encodeURIComponent(cursor)}`));
  nodes.push(...page.nodes);
  cursor = page.continuation === 'continue' ? page.nextCursor : '';
} while (cursor);
console.log(JSON.stringify(nodes, null, 2));
const after = await status('tuya-discovery');
const retainedServices = [];
for (const service of existing) {
  const retained = service.collectorId === 'tuya-discovery' ? after : await status(service.collectorId);
  assert.ok(retained.running, `Existing service ${service.collectorId} was lost`);
  assert.equal(retained.bootId, service.bootId);
  retainedServices.push(retained);
}
const report = { origin, observedAt: new Date().toISOString(), source: 'esp32-passive-udp-6667',
  devices: nodes, host: after, retainedServices };
const reportIndex = process.argv.indexOf('--report');
if (reportIndex >= 0) {
  if (!process.argv[reportIndex + 1]) throw new Error('Missing --report path');
  await fs.writeFile(process.argv[reportIndex + 1], JSON.stringify(report, null, 2) + '\n');
}
assert.ok(nodes.length > 0, 'ESP32 did not observe any Tuya devices within 45 seconds; service left running for inspection');
console.log(`PASS: ESP32 directly observed ${nodes.length} Tuya devices; existing service identities retained.`);
