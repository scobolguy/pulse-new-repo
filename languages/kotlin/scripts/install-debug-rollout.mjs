import fs from 'node:fs/promises';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { applyCacheSchemas } from '../src/cache-schema.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const origin = new URL(process.argv[2] || '');
if (origin.protocol !== 'http:' || origin.pathname !== '/' || origin.search || origin.hash)
  throw new Error('Usage: node install-debug-rollout.mjs http://ESP32-IP');

async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, origin), { timeoutMs: 120000, ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function artifact(unit, prefix, hosted = true) {
  const image = hosted ? encodeHostedImage(unit.pcodeText) : unit.pcodeText;
  const map = hosted
    ? attachPcodeSignature({
      ...compactServiceHostProgramMap(unit.programMap), hostImageFormat: 'PHI1'
    }, image)
    : attachPcodeSignature(unit.programMap, image);
  return [
    { path: `${prefix}.phi`, base64: Buffer.from(image).toString('base64') },
    { path: `${prefix}.json`, base64: Buffer.from(JSON.stringify(map)).toString('base64') }
  ];
}

async function source(file) {
  return fs.readFile(new URL(`../examples/${file}`, import.meta.url), 'utf8');
}

async function compile(file, options = {}) {
  return compileKotlinToPcode(await source(file), { fileName: file, target: 'esp32', ...options });
}

async function installProgram(name, unit, networkPeers = []) {
  const manifest = {
    name, version: '1', type: 'resident', entry: 'p.pcode', programMap: 'p.json',
    networkPeers
  };
  const files = artifact(unit, 'p', false);
  files[0].path = 'p.pcode';
  await request('/api/pmachine/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, manifest, files })
  });
  const result = await request(`/api/pmachine/programs/${name}/start`, { method: 'POST' });
  console.log(`[PROGRAM] ${name}: ${JSON.stringify(result)}`);
}

async function installService(name, daemon, service, serviceIndex, udpPort, cacheName, fields) {
  const schemas = [{ name: cacheName, capacity: 50, fields: fields.map(field => ({ name: field, type: 'string' })) }];
  applyCacheSchemas(daemon, schemas);
  applyCacheSchemas(service, schemas);
  const manifest = {
    name, version: '1', type: 'daemon', serviceIndex, entry: 'd.phi', programMap: 'd.json',
    serviceEntry: 's.phi', serviceProgramMap: 's.json', udpPort, networkPeers: []
  };
  await request('/api/pmachine/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, manifest,
      files: [...artifact(daemon, 'd'), ...artifact(service, 's')]
    })
  });
  const result = await request(`/api/pmachine/programs/${name}/start`, { method: 'POST' });
  console.log(`[SERVICE] ${name}: ${JSON.stringify(result)}`);
}

if (process.env.SKIP_RESET !== '1') {
  console.log('[RESET] Removing all hosted ESP32 program bundles');
  const existing = await request('/api/pmachine/programs');
  for (const program of existing.programs) {
    console.log(JSON.stringify(await request(`/api/pmachine/programs/${program.name}`, { method: 'DELETE' })));
  }
}

const aggregatorProgram = await compile('debug-aggregator-program.kt');
const tuyaProgram = await compile('tuya-program.kt');
if (process.env.SKIP_PROGRAMS !== '1') {
  await installProgram('debug-aggregator-program', aggregatorProgram);
  await installProgram('tuya-program', tuyaProgram, [
    { ip: '255.255.255.255', port: 6666 },
    { ip: '255.255.255.255', port: 6667 }
  ]);
}

const aggregatorDaemon = await compile('debug-aggregator-daemon.kt', {
  daemonId: 'debug-aggregator', daemonRefreshMs: 180000
});
const aggregatorService = await compile('debug-aggregator-service.kt', {
  serviceId: 'debug-aggregator-service'
});
const tuyaDaemon = await compile('tuya-discovery-daemon.kt', {
  daemonId: 'tuya-collector', daemonRefreshMs: 180000
});
const tuyaService = await compile('tuya-device-service.kt', {
  serviceId: 'tuya-device-service'
});
if (process.env.SKIP_SERVICES !== '1') {
  if (process.env.SKIP_AGGREGATOR_SERVICE !== '1') {
    await installService('debug-aggregator-service', aggregatorDaemon, aggregatorService, 1, 4210,
      'aggregator-debug', ['message', 'address', 'port', 'method', 'payloadHex']);
  }
  if (process.env.SKIP_TUYA_SERVICE !== '1') {
    await installService('tuya-service', tuyaDaemon, tuyaService, 2, 6667,
      'tuya-devices', ['name', 'protocol', 'address', 'port', 'deviceType', 'payloadHex']);
  }
}
