import { compileTapoCollector } from '../src/tapo-artifacts.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const [origin, slot = '8', ...extra] = process.argv.slice(2);
const target = origin && new URL(origin);
if (!target || target.protocol !== 'http:' || target.username || target.password ||
    target.pathname !== '/' || target.search || target.hash ||
    !/^(?:[1-9]|1[0-5])$/.test(slot) || extra.length) {
  throw new Error('Usage: node install-tapo-camera-daemon.mjs http://ESP32-IP [scheduler-slot 1..15]');
}
const name = 'tapo-camera-discovery';
const manifestPath = `/pmachine/programs/${name}/manifest.json`;

async function request(path, options = {}) {
  for (let attempt = 0; ; attempt++) {
    const response = await requestEsp32(new URL(path, target), { timeoutMs: 120000, ...options });
    const text = await response.text();
    if (response.ok) return text ? JSON.parse(text) : {};
    if (attempt < 5 && ((response.status === 503 && text === 'Service host busy') ||
        (response.status === 409 && text.includes('"error":"Service host busy or unavailable"')))) {
      await new Promise(resolve => setTimeout(resolve, 300 + 113 * attempt));
      continue;
    }
    throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  }
}

const { slots } = await request('/api/pmachine/scheduler');
const selected = slots.find(item => item.slot === Number(slot));
if (selected?.state === 'running' && selected.manifestPath === manifestPath) {
  console.log(`${name} is already running in scheduler slot ${slot}.`);
  process.exit(0);
}
if (selected?.state !== 'empty' || slots.some(item => item.manifestPath === manifestPath))
  throw new Error(`${name} or scheduler slot ${slot} is already in use`);
const { programs } = await request('/api/pmachine/programs');
const installed = programs.find(program => program.name === name);
if (installed?.running) throw new Error(`${name} is running outside the scheduler`);

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
const post = (path, body) => request(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
if (!installed) {
  const { daemon, service } = await compileTapoCollector('esp32');
  await post('/api/pmachine/programs', { name, manifest, files: [...artifact(daemon, 'd'), ...artifact(service, 's')] });
}
const started = await post('/api/pmachine/scheduler/load', { manifestPath, slot: Number(slot) });
if (started.slot !== Number(slot) || started.manifestPath !== manifestPath || started.state !== 'running')
  throw new Error(`Unexpected daemon start result: ${JSON.stringify(started)}`);
console.log(`Installed scheduler-slot-${slot}; ONVIF snapshot at ${target.origin}/api/cameras/snapshot.`);
