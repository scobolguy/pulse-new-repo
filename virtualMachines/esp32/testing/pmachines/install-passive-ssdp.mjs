import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const origin = process.argv[2];
if (!origin) throw new Error('Usage: node install-passive-ssdp.mjs <ESP32 origin>');
const base = new URL(origin);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, values, options = {}) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const response = await requestEsp32(new URL(path, base), {
      ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}), ...options
    });
    const text = await response.text();
    if (response.status === 503 && /"busy":true|^Service host busy/.test(text)) {
      if (attempt === 3) throw new Error(`${path}: busy; try again later`);
      await wait(250 + Math.floor(Math.random() * 751));
      continue;
    }
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
    return text;
  }
}
const before = JSON.parse(await request('/pmachine/service_host/status?collectorId=shared-devices'));
if (!before.running) throw new Error('Expected existing shared-devices host');
if (before.daemons?.some(daemon => daemon.udpPort === 1900)) {
  throw new Error('SSDP already installed; no changes made');
}
const prefix = `/ss${Date.now().toString(36)}`;
const units = [];
for (const [index, name] of [
  'device-cache-service', 'kasa-collector-daemon', 'tuya-collector-daemon', 'ssdp-collector-daemon'
].entries()) {
  const compiled = compilePascalishProgramWithAntlr(
    await fs.readFile(new URL(`../../src/${name}.pas`, import.meta.url), 'utf8'), { hostServices: true });
  const image = encodeHostedImage(compiled.pcodeText);
  const file = `${prefix}${index}.phi`, map = `${prefix}${index}.map.json`;
  await request(`/ffs/upload_stream?file=${encodeURIComponent(file)}`, null, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image
  });
  await request('/ffs/upload', { file: map, body: JSON.stringify(attachPcodeSignature({
    ...compactServiceHostProgramMap(compiled.programMap), hostImageFormat: 'PHI1'
  }, image)) });
  units.push({ file, map });
}
await request('/pmachine/service_host/stop?collectorId=shared-devices', {});
await request('/pmachine/service_host/install', {
  serviceFile: units[0].file, serviceMap: units[0].map,
  daemons: JSON.stringify([
    units[1], { ...units[2], udpPort: 6667 },
    { ...units[3], udpPort: 1900, multicastGroup: '239.255.255.250' }
  ]),
  collectorId: 'shared-devices', observationTtlMs: '180000', announcementIntervalMs: '60000',
  networkPeers: JSON.stringify([{ ip: '192.168.2.28', port: 9999 }, { ip: '192.168.2.29', port: 9999 }])
});
console.log('Installed Kasa, Tuya and real passive SSDP; no synthetic notifications sent.');
await wait(60000);
console.log(await request('/pmachine/service_host/status?collectorId=shared-devices'));
let cursor = '';
const names = [];
do {
  const page = JSON.parse(await request(`/api/devices/names?cursor=${encodeURIComponent(cursor)}`));
  names.push(...page.names);
  cursor = page.nextCursor;
} while (cursor);
console.log(JSON.stringify({ names, realSsdpNames: names.filter(name => name.startsWith('SSDP ')) }, null, 2));
