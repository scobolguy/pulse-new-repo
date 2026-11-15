import fs from 'node:fs/promises';
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
  throw new Error('Usage: node install-bluetooth-discovery-daemon.mjs http://ESP32-IP [service-slot 1..15]');
}
const name = 'bluetooth-discovery';

async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, target), { timeoutMs: 120000, ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const inventory = await request('/api/pmachine/programs');
if (inventory.programs.some(program => program.name === name))
  throw new Error(`${name} already exists; refusing to overwrite it`);
const slots = await request('/pmachine/process-slots');
const slotName = `service-${slot.padStart(2, '0')}`;
if (!slots.slots.some(item => item.slot === slotName && item.occupied === false))
  throw new Error(`${slotName} is unavailable; refusing to replace an existing process`);

const daemonSource = await fs.readFile(new URL('../examples/bluetooth-discovery-daemon.kt', import.meta.url), 'utf8');
const serviceSource = await fs.readFile(new URL('../examples/bluetooth-device-service.kt', import.meta.url), 'utf8');
const daemon = compileKotlinToPcode(daemonSource, {
  fileName: 'bluetooth-discovery-daemon.kt', target: 'esp32',
  daemonId: 'bluetooth-discovery', daemonRefreshMs: 30000
});
const service = compileKotlinToPcode(serviceSource, {
  fileName: 'bluetooth-device-service.kt', target: 'esp32', serviceId: 'bluetooth-device-service'
});
const schemas = [{ name: 'bluetooth-devices', capacity: 50, fields: [
  'name', 'address', 'protocol', 'rssi', 'serviceUuid', 'manufacturerData', 'deviceType', 'classificationReason'
].map(field => ({ name: field, type: 'string' })) }];
applyCacheSchemas(daemon, schemas);
applyCacheSchemas(service, schemas);

function artifact(unit, prefix) {
  const image = encodeHostedImage(unit.pcodeText);
  const map = attachPcodeSignature({
    ...compactServiceHostProgramMap(unit.programMap), hostImageFormat: 'PHI1'
  }, image);
  return [
    { path: `${prefix}.phi`, base64: Buffer.from(image).toString('base64') },
    { path: `${prefix}.json`, base64: Buffer.from(JSON.stringify(map)).toString('base64') }
  ];
}

const manifest = {
  name, version: '1', type: 'daemon', serviceIndex: Number(slot), entry: 'd.phi', programMap: 'd.json',
  serviceEntry: 's.phi', serviceProgramMap: 's.json', udpPort: 0, networkPeers: []
};
await request('/api/pmachine/programs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, manifest, files: [...artifact(daemon, 'd'), ...artifact(service, 's')] })
});
const started = await request(`/api/pmachine/programs/${name}/start`, { method: 'POST' });
if (started.status !== 'running')
  throw new Error(`Unexpected Bluetooth daemon start result: ${JSON.stringify(started)}`);
console.log(`Installed ${name} in ${slotName} at ${target.origin}.`);
