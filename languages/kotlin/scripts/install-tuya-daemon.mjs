import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { applyCacheSchemas } from '../src/cache-schema.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const [origin, slot = '9', ...extra] = process.argv.slice(2);
const target = origin && new URL(origin);
if (!target || target.protocol !== 'http:' || target.username || target.password ||
    target.pathname !== '/' || target.search || target.hash ||
    !/^(?:[1-9]|1[0-5])$/.test(slot) || extra.length) {
  throw new Error('Usage: node install-tuya-daemon.mjs http://ESP32-IP [scheduler-slot 1..15]');
}
const name = 'tuya-discovery';
const manifestPath = `/pmachine/programs/${name}/manifest.json`;

async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, target), { timeoutMs: 120000, ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const inventory = await request('/api/pmachine/programs');
const installed = inventory.programs.find(program => program.name === name);
const slots = await request('/api/pmachine/scheduler');
const selected = slots.slots.find(item => item.slot === Number(slot));
if (selected?.state === 'running' && selected.manifestPath === manifestPath) {
  console.log(`${name} is already running in scheduler slot ${slot}.`);
  process.exit(0);
}
if (selected?.state !== 'empty' || slots.slots.some(item => item.manifestPath === manifestPath)
    || installed?.running)
  throw new Error(`${name} or scheduler slot ${slot} is already in use; refusing to replace a process`);

if (!installed) await uploadBundle();
const started = await request('/api/pmachine/scheduler/load', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ manifestPath, slot: Number(slot) })
});
if (started.slot !== Number(slot) || started.manifestPath !== manifestPath || started.state !== 'running')
  throw new Error(`Unexpected daemon start result: ${JSON.stringify(started)}`);
console.log(`Installed ${name} in scheduler slot ${slot}; configure the federation source as ${target.origin}.`);

async function uploadBundle() {
  const daemonSource = await fs.readFile(new URL('../examples/tuya-discovery-daemon.kt', import.meta.url), 'utf8');
  const serviceSource = await fs.readFile(new URL('../examples/tuya-device-service.kt', import.meta.url), 'utf8');
  const daemon = compileKotlinToPcode(daemonSource, {
    fileName: 'tuya-discovery-daemon.kt', target: 'esp32',
    daemonId: 'tuya-collector', daemonRefreshMs: 180000
  });
  const service = compileKotlinToPcode(serviceSource, {
    fileName: 'tuya-device-service.kt', target: 'esp32', serviceId: 'tuya-device-service'
  });
  const schemas = [{ name: 'tuya-devices', capacity: 50,
    fields: ['name', 'protocol', 'address', 'port', 'deviceType', 'payloadHex']
      .map(field => ({ name: field, type: 'string' })) }];
  applyCacheSchemas(daemon, schemas);
  applyCacheSchemas(service, schemas);

  function artifact(unit, prefix) {
    const image = encodeHostedImage(unit.pcodeText);
    const map = attachPcodeSignature({
      ...compactServiceHostProgramMap(unit.programMap), hostImageFormat: 'PHI1'
    }, image);
    return {
      digest: createHash('sha256').update(image).digest('hex'),
      files: [
        { path: `${prefix}.phi`, base64: Buffer.from(image).toString('base64') },
        { path: `${prefix}.json`, base64: Buffer.from(JSON.stringify(map)).toString('base64') }
      ]
    };
  }

  const first = artifact(daemon, 'd6666');
  const second = artifact(daemon, 'd6667');
  const files = [
    ...first.files,
    ...second.files,
    ...artifact(service, 's').files
  ];
  const manifest = {
    name, version: '1', type: 'daemon', serviceIndex: Number(slot),
    entry: 'd6667.phi', programMap: 'd6667.json',
    serviceEntry: 's.phi', serviceProgramMap: 's.json', udpPort: 0, networkPeers: [],
    daemons: [
      { entry: 'd6666.phi', programMap: 'd6666.json', udpPort: 6666, sha256: first.digest },
      { entry: 'd6667.phi', programMap: 'd6667.json', udpPort: 6667, sha256: second.digest }
    ]
  };
  return request('/api/pmachine/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, manifest, files })
  });
}
