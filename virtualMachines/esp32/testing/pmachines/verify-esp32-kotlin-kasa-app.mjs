import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import dgram from 'node:dgram';
import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { compileKotlinToPcode } from '../../../../languages/kotlin/src/compile-kotlin-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const [origin, peerIp] = process.argv.slice(2);
if (!origin || !peerIp || process.argv.length !== 4)
  throw new Error('Usage: node verify-esp32-kotlin-kasa-app.mjs <origin> <local-ipv4>');
const tag = randomBytes(4).toString('hex');
const collectorId = `app-probe-${tag}`;
const files = [`/kp-${tag}-s.phi`, `/kp-${tag}-s.json`,
  `/kp-${tag}-d.phi`, `/kp-${tag}-d.json`];
const uploaded = [];
const socket = dgram.createSocket('udp4');
let bound = false, installed = false, installAttempted = false, installResolved = false, primaryError;
async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, origin), { ...options, timeoutMs: 60000 });
  return { status: response.status, text: await response.text() };
}
async function retryBusy(path, options = {}) {
  for (let attempt = 0; attempt < 30; ++attempt) {
    const result = await request(path, options);
    if (result.status !== 503 || !/busy/i.test(result.text)) return result;
    await sleep(250);
  }
  throw new Error(`${path}: service host remained busy`);
}
try {
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(0, peerIp, resolve);
  });
  bound = true;
  const port = socket.address().port;
  const packets = [];
  socket.on('message', (message, peer) => {
    packets.push(message.toString('hex'));
    socket.send(Buffer.from('1234', 'hex'), peer.port, peer.address);
  });
  const existing = await retryBusy('/pmachine/service_host/status');
  assert.equal(existing.status, 200, existing.text);
  assert.ok(!(JSON.parse(existing.text).services ?? []).some(item => item.collectorId === collectorId));
  assert.equal((await request(`/api/kasa/discover?ip=${peerIp}`)).status, 404,
    'Refusing to replace an existing Kasa application');
  for (const file of files) {
    assert.equal((await request(`/ffs/get?file=${encodeURIComponent(file)}`)).status, 404,
      `Refusing to overwrite ${file}`);
  }
  const example = await fs.readFile(new URL('../../../../languages/kotlin/examples/kasa-discovery-daemon.kt', import.meta.url), 'utf8');
  const serviceSource = example.replace('const val KASA_DISCOVERY_PORT = 9999', `const val KASA_DISCOVERY_PORT = ${port}`)
    + '\n@HttpPost("/api/kasa/action")\nfun testAction(): String = requestBody()\n';
  const units = [
    compileKotlinToPcode(serviceSource, { target: 'esp32', serviceId: collectorId }),
    compileKotlinToPcode('fun main() {}', { target: 'esp32', daemonId: `${collectorId}-daemon`, daemonRefreshMs: 60000 })
  ];
  for (let index = 0; index < units.length; ++index) {
    const image = encodeHostedImage(units[index].pcodeText);
    const map = attachPcodeSignature({
      ...compactServiceHostProgramMap(units[index].programMap), hostImageFormat: 'PHI1'
    }, image);
    for (const [file, body] of [[files[index * 2], image], [files[index * 2 + 1], JSON.stringify(map)]]) {
      uploaded.push(file);
      const result = await request(`/ffs/upload_stream?file=${encodeURIComponent(file)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body
      });
      assert.equal(result.status, 200, result.text);
    }
  }
  installAttempted = true;
  const installation = await retryBusy('/pmachine/service_host/install', {
    method: 'POST',
    body: new URLSearchParams({
      collectorId, serviceFile: files[0], serviceMap: files[1],
      daemons: JSON.stringify([{ file: files[2], map: files[3], udpPort: 0 }]),
      networkPeers: JSON.stringify([{ ip: peerIp, port }])
    })
  });
  installResolved = true;
  assert.equal(installation.status, 200, installation.text);
  installed = true;
  const response = await request(`/api/kasa/discover?ip=${peerIp}`);
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(JSON.parse(response.text), { address: peerIp, responseHex: '1234' });
  assert.deepEqual(packets, ['d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6']);
  const action = await request('/api/kasa/action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"test"}'
  });
  assert.equal(action.status, 200, action.text);
  assert.deepEqual(JSON.parse(action.text), { action: 'test' });
  const denied = await request('/api/kasa/discover?ip=127.0.0.1');
  assert.notEqual(denied.status, 200, denied.text);
  assert.match(denied.text, /Network peer is not allowed/);
  console.log('PASS: Kotlin application owns Kasa GET/POST routes and uses allowlisted generic UDP');
} catch (error) {
  primaryError = error;
}
const cleanupErrors = [];
try {
  if (installAttempted && !installResolved) {
    throw new Error(`Installation outcome is uncertain; inspect ${collectorId} and ${files.join(', ')} before cleanup`);
  }
  if (!installed) {
    const status = await retryBusy(`/pmachine/service_host/status?collectorId=${encodeURIComponent(collectorId)}`);
    if (status.status === 200) installed = true;
    else if (status.status !== 404) throw new Error(`Unable to check test service: ${status.status} ${status.text}`);
  }
  if (installed) {
    const stopped = await retryBusy(`/pmachine/service_host/stop?collectorId=${encodeURIComponent(collectorId)}`,
      { method: 'POST' });
    if (stopped.status !== 200) throw new Error(`Unable to stop test service: ${stopped.status} ${stopped.text}`);
    installed = false;
  }
  for (const file of uploaded) {
    const existing = await request(`/ffs/get?file=${encodeURIComponent(file)}`);
    if (existing.status === 404) continue;
    if (existing.status !== 200) {
      cleanupErrors.push(new Error(`Unable to inspect ${file}: ${existing.status} ${existing.text}`));
      continue;
    }
    const result = await request('/ffs/delete', { method: 'POST', body: new URLSearchParams({ file }) });
    if (result.status !== 200 && result.status !== 404)
      cleanupErrors.push(new Error(`Unable to delete ${file}: ${result.status} ${result.text}`));
  }
} catch (error) {
  cleanupErrors.push(error);
}
if (bound) socket.close();
if (primaryError || cleanupErrors.length)
  throw new AggregateError([primaryError, ...cleanupErrors].filter(Boolean), 'Kotlin Kasa probe or cleanup failed');
