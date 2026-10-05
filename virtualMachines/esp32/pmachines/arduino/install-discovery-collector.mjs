import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../shared/contracts/service-host-bindings.mjs';

const target = process.argv[2];
if (!target) throw new Error('Usage: node pmachines\\arduino\\install-discovery-collector.mjs http://ESP32-IP');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash)
  throw new Error('Expected an HTTP(S) origin');
async function request(path, values) {
  const response = await fetch(new URL(path, origin), {
    ...(values === undefined ? {} : { method: 'POST', body: new URLSearchParams(values) }),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text;
}
const status = JSON.parse(await request('/pmachine/service_host/status'));
if (status.running || status.busy) throw new Error('Host already active; stop it explicitly before replacing units');
const device = JSON.parse(await request('/status'));
const files = {};
for (const [kind, name] of [['service', 'discovery-collector-service'], ['daemon', 'discovery-maintenance-daemon']]) {
  const source = await fs.readFile(new URL(`../../artifactPrograms/${name}.pas`, import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
  files[kind] = { file: `/${name}.pcode`, map: `/${name}.program.json` };
  await request('/ffs/upload', { file: files[kind].file, body: compiled.pcodeText });
  await request('/ffs/upload', { file: files[kind].map,
    body: JSON.stringify(attachPcodeSignature(compactServiceHostProgramMap(compiled.programMap), compiled.pcodeText)) });
}
await request('/pmachine/service_host/install', {
  serviceFile: files.service.file, serviceMap: files.service.map,
  daemonFile: files.daemon.file, daemonMap: files.daemon.map,
  collectorId: process.env.PULSE_DISCOVERY_COLLECTOR_ID || `${device.nodeName}-discovery`,
  udpPort: process.env.UDP_PORT || '4210', observationTtlMs: '180000',
  announcementIntervalMs: '60000'
});
const installed = JSON.parse(await request('/pmachine/service_host/status'));
if (!installed.running) throw new Error(`Host did not start: ${JSON.stringify(installed)}`);
const snapshot = JSON.parse(await request('/api/discovery/snapshot'));
if (snapshot.protocolVersion !== 1 || !Array.isArray(snapshot.nodes)) throw new Error('Invalid collector snapshot');
console.log(JSON.stringify(installed, null, 2));
