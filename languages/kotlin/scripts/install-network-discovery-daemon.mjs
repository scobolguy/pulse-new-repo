import fs from 'node:fs/promises';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { compilePascalishProgramWithAntlr } from '../../pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const target = process.argv[2];
if (!target) throw new Error('Usage: node install-network-discovery-daemon.mjs http://ESP32-IP');
const origin = new URL(target);

async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, origin), { timeoutMs: 60000, ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text;
}

const status = JSON.parse(await request('/pmachine/service_host/status'));
if (status.running || status.busy) throw new Error('Service host must be stopped before installation');

const tuyaSource = await fs.readFile(new URL('../../../virtualMachines/esp32/src/tuya-discovery-service.pas', import.meta.url), 'utf8');
const tuya = compilePascalishProgramWithAntlr(tuyaSource, { hostServices: true });
const daemonSource = await fs.readFile(new URL('../examples/network-discovery-daemon.kt', import.meta.url), 'utf8');
const daemon = compileKotlinToPcode(daemonSource, {
  fileName: 'network-discovery-daemon.kt', target: 'esp32',
  daemonId: 'network-discovery', daemonRefreshMs: 1000
});

for (const [file, body] of [
  ['/network-tuya.phi', encodeHostedImage(tuya.pcodeText)],
  ['/network-tuya.map.json', JSON.stringify(attachPcodeSignature({
    ...compactServiceHostProgramMap(tuya.programMap),
    hostTables: [{ name: 'devices', capacity: 16 },
      { name: 'nodes', capacity: 255 }],
    hostImageFormat: 'PHI1'
  }, encodeHostedImage(tuya.pcodeText)))],
  ['/network-kotlin.phi', encodeHostedImage(daemon.pcodeText)],
  ['/network-kotlin.map.json', JSON.stringify(attachPcodeSignature({
    ...compactServiceHostProgramMap(daemon.programMap), hostImageFormat: 'PHI1'
  }, encodeHostedImage(daemon.pcodeText)))]
]) {
  await request(`/ffs/upload_stream?file=${encodeURIComponent(file)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body
  });
}

const installed = JSON.parse(await request('/pmachine/service_host/install', {
  method: 'POST',
  body: new URLSearchParams({
    serviceFile: '/network-tuya.phi',
    serviceMap: '/network-tuya.map.json',
    daemons: JSON.stringify([{
      file: '/network-kotlin.phi',
      map: '/network-kotlin.map.json',
      udpPort: 0
    }]),
    collectorId: 'network-discovery',
    udpPort: '6667',
    observationTtlMs: '180000',
    announcementIntervalMs: '60000'
  })
}));
if (!installed.running) throw new Error(`Network discovery host did not start: ${JSON.stringify(installed)}`);
console.log(JSON.stringify(installed, null, 2));
