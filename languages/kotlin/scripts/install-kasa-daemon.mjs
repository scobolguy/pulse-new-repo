import net from 'node:net';
import { compileKasaCollector } from '../src/kasa-artifacts.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const [origin, broadcast, slot = '7', ...extra] = process.argv.slice(2);
const target = origin && new URL(origin);
if (!target || target.protocol !== 'http:' || target.username || target.password ||
    target.pathname !== '/' || target.search || target.hash || net.isIP(broadcast) !== 4 ||
    !/^(?:[1-9]|1[0-5])$/.test(slot) || extra.length) {
  throw new Error('Usage: node install-kasa-daemon.mjs http://ESP32-IP <subnet-broadcast-ip> [service-slot 1..15]');
}
const name = 'kasa-discovery';
const collectorId = `bundle-${name}`;
async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, target), { timeoutMs: 60000, ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return JSON.parse(text);
}
const inventory = await request('/api/pmachine/programs');
if (inventory.programs.some(program => program.name === name))
  throw new Error(`${name} already exists; refusing to overwrite it`);
const slots = await request('/pmachine/process-slots');
const slotName = `service-${slot.padStart(2, '0')}`;
if (!slots.slots.some(item => item.slot === slotName && item.occupied === false))
  throw new Error(`${slotName} is unavailable; refusing to replace an existing process`);

const { daemon, service } = await compileKasaCollector('esp32');
function artifacts(unit, prefix) {
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
  serviceEntry: 's.phi', serviceProgramMap: 's.json', udpPort: 9999,
  networkPeers: [{ ip: broadcast, port: 9999 }]
};
await request('/api/pmachine/programs', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, manifest, files: [...artifacts(daemon, 'd'), ...artifacts(service, 's')] })
});
const started = await request(`/api/pmachine/programs/${name}/start`, { method: 'POST' });
if (started.collectorId !== collectorId || started.status !== 'running')
  throw new Error(`Unexpected daemon start result: ${JSON.stringify(started)}`);
console.log(`Installed ${collectorId} in ${slotName}; configure the federation source as ${target.origin}.`);
