import { compileSsdpCollector } from '../src/ssdp-artifacts.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const [origin, slot = '10', ...extra] = process.argv.slice(2);
const target = origin && new URL(origin);
if (!target || target.protocol !== 'http:' || target.username || target.password ||
    target.pathname !== '/' || target.search || target.hash ||
    !/^(?:[1-9]|1[0-5])$/.test(slot) || extra.length) {
  throw new Error('Usage: node install-ssdp-daemon.mjs http://ESP32-IP [scheduler-slot 1..15]');
}
const name = 'ssdp-discovery';
const manifestPath = `/pmachine/programs/${name}/manifest.json`;
async function request(path, body) {
  const response = await requestEsp32(new URL(path, target), {
    timeoutMs: 60000,
    ...(body && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}
const { slots } = await request('/api/pmachine/scheduler');
const selected = slots.find(item => item.slot === Number(slot));
if (selected?.state === 'running' && selected.manifestPath === manifestPath) {
  console.log(`${name} is already running in scheduler slot ${slot}.`);
} else {
  if (selected?.state !== 'empty' || slots.some(item => item.manifestPath === manifestPath))
    throw new Error(`${name} or scheduler slot ${slot} is already in use`);
  const { programs } = await request('/api/pmachine/programs');
  const installed = programs.find(program => program.name === name);
  if (installed?.running) throw new Error(`${name} is already running outside the scheduler`);
  if (!installed) {
    const { daemon, service } = await compileSsdpCollector('esp32');
    const files = [];
    for (const [prefix, unit] of [['d', daemon], ['s', service]]) {
      const image = encodeHostedImage(unit.pcodeText);
      const map = attachPcodeSignature({
        ...compactServiceHostProgramMap(unit.programMap), hostImageFormat: 'PHI1'
      }, image);
      files.push({ path: `${prefix}.phi`, base64: Buffer.from(image).toString('base64') },
        { path: `${prefix}.json`, base64: Buffer.from(JSON.stringify(map)).toString('base64') });
    }
    const manifest = {
      name, version: '1', type: 'daemon', serviceIndex: Number(slot), entry: 'd.phi', programMap: 'd.json',
      serviceEntry: 's.phi', serviceProgramMap: 's.json', udpPort: 1900,
      multicastGroup: '239.255.255.250', networkPeers: []
    };
    await request('/api/pmachine/programs', { name, manifest, files });
  }
  const started = await request('/api/pmachine/scheduler/load', { manifestPath, slot: Number(slot) });
  if (started.slot !== Number(slot) || started.manifestPath !== manifestPath || started.state !== 'running')
    throw new Error(`Unexpected daemon start result: ${JSON.stringify(started)}`);
  console.log(`Installed ${name} in scheduler slot ${slot}.`);
}
