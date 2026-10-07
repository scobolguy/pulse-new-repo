import fs from 'node:fs/promises';
import net from 'node:net';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}
const target = option('--target', 'js');
if (!['js', 'esp32'].includes(target)) throw new Error('Expected --target js or esp32');
const timeoutMs = Number(option('--timeout-ms', '60000'));
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Expected a positive integer for --timeout-ms');
const devices = option('--devices', '').split(',').filter(Boolean);
if (!devices.length || devices.length > 8 || devices.some(ip => net.isIP(ip) !== 4)) {
  throw new Error('Provide --devices with 1-8 comma-separated literal IPv4 addresses');
}
const peers = devices.map(ip => ({ ip, port: 9999 }));
const units = {};
for (const [kind, name] of [['service', 'kasa-legacy-service'], ['daemon', 'kasa-maintenance-daemon']]) {
  const source = await fs.readFile(new URL(`../../src/${name}.pas`, import.meta.url), 'utf8');
  units[kind] = compilePascalishProgramWithAntlr(source, { hostServices: true });
}
let host;
if (target === 'js') {
  const port = Number(option('--port', '4303'));
  host = await createPascalishServiceHost({
    compiled: units.service, daemons: [units.daemon], collectorId: 'kasa-legacy',
    httpPort: args.includes('--check') ? null : port, udpPort: 0,
    networkPeers: peers, maxExecutionMs: 8000,
    bindings: { 'host.observation_ttl': () => 180000 }
  });
  await host.start();
} else {
  const origin = option('--esp32', '');
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Provide --esp32 with an HTTP(S) origin');
  }
  async function request(path, values) {
    console.log(`${values ? 'POST' : 'GET'} ${path}`);
    let response;
    try {
      response = await requestEsp32(new URL(path, url), {
        ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
        timeoutMs
      });
    } catch (error) {
      throw new Error(`${path}: ${error.message}`, { cause: error });
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
    return text;
  }
  const status = JSON.parse(await request('/pmachine/service_host/status'));
  if (status.running) throw new Error('Stop the existing hosted service explicitly before installing Kasa');
  async function uploadImage(file, image) {
    const path = `/ffs/upload_stream?file=${encodeURIComponent(file)}`;
    console.log(`POST ${path}`);
    const response = await requestEsp32(new URL(path, url), {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image,
      timeoutMs
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  }
  for (const [kind, unit] of Object.entries(units)) {
    const name = kind === 'service' ? 'kasa' : 'kasad';
    const image = encodeHostedImage(unit.pcodeText);
    await uploadImage(`/${name}.phi`, image);
    await request('/ffs/upload', { file: `/${name}.map.json`, body: JSON.stringify(
      attachPcodeSignature({ ...compactServiceHostProgramMap(unit.programMap), hostImageFormat: 'PHI1' }, image)) });
  }
  console.log(await request('/pmachine/service_host/install', {
    serviceFile: '/kasa.phi', serviceMap: '/kasa.map.json',
    daemonFile: '/kasad.phi', daemonMap: '/kasad.map.json',
    collectorId: 'kasa-legacy', udpPort: '44211',
    observationTtlMs: '180000', announcementIntervalMs: '60000',
    networkPeers: JSON.stringify(peers)
  }));
  host = {
    dispatch: async event => {
      const text = await request(`${event.path}?ip=${encodeURIComponent(event.query.ip)}`);
      return { status: 200, body: JSON.parse(text) };
    }
  };
}
try {
  for (const ip of devices) {
    for (const path of ['/api/kasa/status', '/api/kasa/discover']) {
      const result = await host.dispatch({ method: 'GET', path, query: { ip } });
      const valid = path.endsWith('/discover')
        ? result.body.ipAddress === ip && typeof result.body.deviceName === 'string'
          && ['wallSwitch', 'smartPlug', 'unknown'].includes(result.body.deviceType)
          && Object.keys(result.body).sort().join(',') === 'deviceName,deviceType,ipAddress'
        : result.body.status === 'ok';
      if (result.status !== 200 || !valid) throw new Error(`${path}: ${JSON.stringify(result)}`);
      console.log(`${ip} ${path}: ${JSON.stringify(result.body)}`);
    }
  }
} catch (error) {
  if (target === 'js') await host.stop();
  throw error;
}
if (target === 'js') {
  if (args.includes('--check')) await host.stop();
  else {
    console.log(`Pascalish Kasa service: http://127.0.0.1:${host.getStatus().httpPort}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      host.stop().catch(error => { console.error(error); process.exitCode = 1; });
    });
  }
}
