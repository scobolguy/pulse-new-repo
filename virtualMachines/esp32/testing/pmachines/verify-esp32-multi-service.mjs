import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const origin = process.argv[2];
if (!origin) throw new Error('Usage: node verify-esp32-multi-service.mjs <origin> [--report <path>]');
const url = new URL(origin);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const files = ['/msp.phi', '/msp.map.json', '/msd.phi', '/msd.map.json', '/msb.phi'];
const report = { origin, startedAt: new Date().toISOString(), checks: [], samples: [] };
const check = name => { report.checks.push(name); console.log(`PASS: ${name}`); };
async function request(path, values, jsonBody) {
  const method = values || jsonBody !== undefined ? 'POST' : 'GET';
  console.log(`${method} ${path}`);
  let response;
  try {
    response = await requestEsp32(new URL(path, url), {
      ...(values ? { method: 'POST', body: new URLSearchParams(values) }
        : jsonBody !== undefined ? { method: 'POST', body: JSON.stringify(jsonBody),
          headers: { 'Content-Type': 'application/json' } } : {}),
      timeoutMs: 60000
    });
  } catch (error) {
    throw new Error(`${method} ${path}: ${error.message}`, { cause: error });
  }
  return { status: response.status, text: await response.text() };
}
async function idleRequest(path, values) {
  const deadline = Date.now() + 30000;
  for (;;) {
    const result = await request(path, values);
    if (result.status !== 503 || !/busy/i.test(result.text) || Date.now() >= deadline) return result;
    await wait(40);
  }
}
async function status(id = '') {
  const result = await idleRequest(`/pmachine/service_host/status${id ? `?collectorId=${encodeURIComponent(id)}` : ''}`);
  assert.equal(result.status, 200, result.text);
  return JSON.parse(result.text);
}
async function get(path) {
  const result = await request(path);
  assert.equal(result.status, 200, `${path}: ${result.text}`);
  return JSON.parse(result.text);
}
async function upload(file, body) {
  const response = file.endsWith('.phi')
    ? await requestEsp32(new URL(`/ffs/upload_stream?file=${encodeURIComponent(file)}`, url), {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body, timeoutMs: 60000 })
    : await requestEsp32(new URL('/ffs/upload', url), {
      method: 'POST', body: new URLSearchParams({ file, body }), timeoutMs: 60000 });
  assert.equal(response.status, 200, await response.text());
}
const units = {};
for (const [kind, name, index] of [['service', 'second-service-probe', 0], ['daemon', 'second-service-daemon', 2]]) {
  const compiled = compilePascalishProgramWithAntlr(
    await fs.readFile(new URL(`./fixtures/${name}.pas`, import.meta.url), 'utf8'), { hostServices: true });
  const image = encodeHostedImage(compiled.pcodeText);
  units[kind] = { image, map: attachPcodeSignature({
    ...compactServiceHostProgramMap(compiled.programMap), hostImageFormat: 'PHI1'
  }, image), index };
}
const install = overrides => idleRequest('/pmachine/service_host/install', {
  serviceFile: files[0], serviceMap: files[1], daemonFile: files[2], daemonMap: files[3],
  collectorId: 'second-probe', udpPort: '44212', observationTtlMs: '180000',
  announcementIntervalMs: '60000', ...overrides
});
async function udpAck(body) {
  const socket = dgram.createSocket('udp4');
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Second-service UDP ACK deadline exceeded')), 5000);
      socket.once('error', error => { clearTimeout(timer); reject(error); });
      socket.once('message', (bytes, peer) => {
        clearTimeout(timer);
        if (peer.address !== url.hostname || peer.port !== 44212) {
          reject(new Error('Unexpected UDP ACK sender')); return;
        }
        try { resolve(JSON.parse(bytes.toString('utf8'))); } catch (error) { reject(error); }
      });
      socket.send(Buffer.from(JSON.stringify(body)), 44212, url.hostname);
    });
  } finally { socket.close(); }
}

const before = await status();
assert.equal(before.serviceCount, 1, 'Install only Kasa before running this probe');
assert.equal(before.collectorId, 'kasa-legacy');
const kasaBoot = before.bootId;
let installed = false, attempted = false, failure;
try {
  attempted = true;
  for (const unit of Object.values(units)) {
    await upload(files[unit.index], unit.image);
    await upload(files[unit.index + 1], JSON.stringify(unit.map));
  }
  await upload(files[4], units.service.image.slice(0, -1) + (units.service.image.endsWith('0') ? '1' : '0'));
  const corrupt = await install({ serviceFile: files[4] });
  assert.equal(corrupt.status, 400, corrupt.text);
  assert.match(corrupt.text, /signature/i);
  assert.equal((await status()).bootId, kasaBoot);
  assert.equal((await get('/health')).service, 'kasa-legacy');
  check('corrupt second image rejected without stopping Kasa');

  for (const overrides of [{ collectorId: 'kasa-legacy' }, { udpPort: '44211' }]) {
    const duplicate = await install(overrides);
    assert.equal(duplicate.status, 409, duplicate.text);
    assert.match(duplicate.text, /Duplicate/i);
    assert.equal((await status()).serviceCount, 1);
  }
  const routeMap = { ...units.service.map, serviceEndpoints: [
    ...units.service.map.serviceEndpoints, { verb: 'GET', path: '/api/kasa/devices' }
  ] };
  await upload(files[1], JSON.stringify(routeMap));
  const duplicateRoute = await install();
  assert.equal(duplicateRoute.status, 409, duplicateRoute.text);
  assert.match(duplicateRoute.text, /Duplicate/i);
  await upload(files[1], JSON.stringify(units.service.map));
  check('duplicate IDs, UDP ports and HTTP routes rejected transactionally');

  const added = await install();
  assert.equal(added.status, 200, added.text);
  installed = true;
  const both = await status();
  assert.equal(both.serviceCapacity, 2);
  assert.equal(both.serviceCount, 2);
  assert.equal(both.workerTaskCount, 1);
  assert.equal(both.httpEventCapacity, 3);
  assert.equal(both.bootId, kasaBoot);
  const second = await status('second-probe');
  assert.equal(second.collectorId, 'second-probe');
  assert.notEqual(second.bootId, kasaBoot);
  assert.equal(second.network.allowedPeers, 0);
  report.installed = both;
  check('two services share one worker with separate boot identities and network sessions');

  const third = await install({ collectorId: 'third-probe', udpPort: '44213' });
  assert.equal(third.status, 409, third.text);
  assert.match(third.text, /capacity/i);
  assert.equal((await status()).serviceCount, 2);
  check('third install rejected without disturbing installed services');

  const kasaDevices = await get('/api/kasa/devices');
  const put = await request('/api/service-probe/put', undefined, { marker: 'second-only' });
  assert.equal(put.status, 200, put.text);
  assert.equal(JSON.parse(put.text).collectorId, 'second-probe');
  assert.deepEqual(await get('/api/kasa/devices'), kasaDevices);
  const probeState = await get('/api/service-probe/state');
  assert.ok(probeState.devices.nodes.some(node => node.marker === 'second-only'));
  check('dynamic POST/GET routes keep identically named tables and keys isolated');

  const kasaError = (await status('kasa-legacy')).lastError;
  const blocked = await request('/api/service-probe/blocked');
  assert.ok(blocked.status >= 400, blocked.text);
  assert.match(blocked.text, /Network peer is not allowed/);
  assert.match((await status('second-probe')).lastError, /Network peer is not allowed/);
  assert.equal((await status('kasa-legacy')).lastError, kasaError);
  assert.equal((await get('/health')).service, 'kasa-legacy');
  check('second service cannot inherit Kasa peers or overwrite its last error');

  const ack = await udpAck({ marker: 'second-udp' });
  assert.equal(ack.collectorId, 'second-probe');
  assert.equal(ack.bootId, second.bootId);
  assert.equal(ack.status, 'ack');
  const received = await get('/api/service-probe/state');
  assert.ok(received.devices.nodes.some(node => node.marker === 'second-udp'));
  assert.deepEqual(await get('/api/kasa/devices'), kasaDevices);
  const initialTicks = received.ticks.count;
  await wait(2300);
  assert.ok((await get('/api/service-probe/state')).ticks.count > initialTicks);
  const scheduled = await status();
  assert.ok(scheduled.services.every(service => service.daemonInvocations > 0));
  check('separate UDP sockets dispatch replies and both daemon schedules advance');

  const overloaded = await Promise.all(Array.from({ length: 6 }, () => request('/api/service-probe/slow')));
  assert.ok(overloaded.some(result => result.status === 429), JSON.stringify(overloaded));
  assert.ok(overloaded.every(result => [200, 429].includes(result.status)), JSON.stringify(overloaded));
  const accepted = overloaded.filter(result => result.status === 200).map(result => JSON.parse(result.text).count).sort((a, b) => a - b);
  assert.deepEqual(accepted, Array.from({ length: accepted.length }, (_, index) => index + 1));
  const concurrent = await Promise.all([
    request('/api/service-probe/slow'), request('/api/kasa/devices'), request('/api/service-probe/state')
  ]);
  assert.ok(concurrent.every(result => result.status === 200), JSON.stringify(concurrent));
  assert.equal(JSON.parse(concurrent[0].text).count, accepted.length + 1);
  assert.deepEqual(JSON.parse(concurrent[1].text), kasaDevices);
  assert.equal(JSON.parse(concurrent[2].text).collectorId, 'second-probe');
  report.queue = { accepted: accepted.length, rejected: overloaded.length - accepted.length };
  check('global three-slot queue preserves serialized updates and cross-service routing under load');

  // Read-only real-device requests at roughly minute spacing, not an aggressive network soak.
  for (let round = 0; round < 3; ++round) {
    if (round) await wait(60000);
    for (const ip of ['192.168.2.28', '192.168.2.29']) {
      const start = Date.now();
      const [kasa, probe] = await Promise.all([
        request(`/api/kasa/${round === 1 ? 'discover' : 'status'}?ip=${ip}`),
        request('/api/service-probe/state')
      ]);
      report.samples.push({ round, ip, elapsedMs: Date.now() - start, kasa, probe });
      assert.equal(kasa.status, 200, kasa.text);
      assert.equal(probe.status, 200, probe.text);
      const value = JSON.parse(kasa.text);
      assert.equal(round === 1 ? value.ipAddress : value.device.ipAddress, ip);
      assert.equal(JSON.parse(probe.text).collectorId, 'second-probe');
    }
  }
  assert.equal((await status('kasa-legacy')).bootId, kasaBoot);
  check('six live read-only Kasa exchanges pass while second service remains available');

  assert.equal((await idleRequest('/pmachine/service_host/stop?collectorId=second-probe', {})).status, 200);
  installed = false;
  assert.equal((await status()).serviceCount, 1);
  assert.equal((await status()).bootId, kasaBoot);
  assert.equal((await request('/api/service-probe/state')).status, 404);
  const reinstalled = await install();
  assert.equal(reinstalled.status, 200, reinstalled.text);
  installed = true;
  const fresh = await get('/api/service-probe/state');
  assert.notEqual(fresh.bootId, second.bootId);
  assert.ok(!fresh.devices.nodes.some(node => node.marker));
  assert.equal(fresh.sequence, 1);
  assert.equal((await status('kasa-legacy')).bootId, kasaBoot);
  check('selective stop/reinstall clears only second-service state and identity');
  report.final = await status();
} catch (error) {
  failure = error;
  report.error = error.stack;
} finally {
  const cleanupErrors = [];
  if (installed) {
    try {
      const stopped = await idleRequest('/pmachine/service_host/stop?collectorId=second-probe', {});
      assert.equal(stopped.status, 200, stopped.text);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (attempted && !cleanupErrors.length) {
    for (const file of files) {
      try { const deleted = await request('/ffs/delete', { file }); assert.equal(deleted.status, 200, deleted.text); }
      catch (error) { cleanupErrors.push(error); }
    }
    try {
      report.afterCleanup = await status();
      assert.equal(report.afterCleanup.serviceCount, 1);
      assert.equal(report.afterCleanup.bootId, kasaBoot);
    } catch (error) { cleanupErrors.push(error); }
  }
  report.completedAt = new Date().toISOString();
  report.passed = !failure && !cleanupErrors.length;
  const reportIndex = process.argv.indexOf('--report');
  if (reportIndex >= 0) {
    if (!process.argv[reportIndex + 1]) throw new Error('Missing report path');
    await fs.writeFile(process.argv[reportIndex + 1], JSON.stringify(report, null, 2));
  }
  if (cleanupErrors.length) throw new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'Probe cleanup failed');
}
if (failure) throw failure;
console.log('PASS: hardware two-service probe; Kasa left installed, temporary second service removed');
