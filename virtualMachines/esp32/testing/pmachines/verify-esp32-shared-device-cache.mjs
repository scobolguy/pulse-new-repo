// Hardware proof and installer for the shared device cache context on an ESP32.
// Uploads signed PHI1 images (no uploadfs), proves the 50-name boundary in a temporary probe context,
// selectively stops only the legacy Kasa context, installs one "shared-devices" context
// (names service + Kasa/Tuya, optionally passive SSDP) and leaves it running on success.
// On failure the shared context is stopped and the retained legacy Kasa install is restored.
// Usage: node verify-esp32-shared-device-cache.mjs http://192.168.2.115/ [--ssdp] [--report path] [--soak-ms 180000]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import dgram from 'node:dgram';
import os from 'node:os';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const origin = args[0];
if (!origin || origin.startsWith('--')) throw new Error('Usage: node verify-esp32-shared-device-cache.mjs <origin> [--report path] [--soak-ms n]');
const url = new URL(origin);
const reportPath = option('--report', '');
const soakMs = Number(option('--soak-ms', '180000'));
const labelDeadlineMs = Number(option('--label-timeout-ms', '150000'));
const withSsdp = args.includes('--ssdp');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const KASA_PEERS = [{ ip: '192.168.2.28', port: 9999 }, { ip: '192.168.2.29', port: 9999 }];
const SHARED_ID = 'shared-devices', PROBE_ID = 'cache-boundary-probe', KASA_ID = 'kasa-legacy';
const KASA_INSTALL = {
  serviceFile: '/kasa.phi', serviceMap: '/kasa.map.json', daemonFile: '/kasad.phi', daemonMap: '/kasad.map.json',
  collectorId: KASA_ID, udpPort: '44211', observationTtlMs: '180000', announcementIntervalMs: '60000',
  networkPeers: JSON.stringify(KASA_PEERS)
};
const report = { origin, startedAt: new Date().toISOString(), checks: [], warnings: [], samples: [] };
report.requests = { busyRetries: 0, busyResponses: 0, transportFailures: 0 };
const check = name => { report.checks.push(name); console.log(`PASS: ${name}`); };
const warn = text => { report.warnings.push(text); console.warn(`WARN: ${text}`); };

async function request(path, values) {
  const method = values ? 'POST' : 'GET';
  let response;
  try {
    response = await requestEsp32(new URL(path, url), {
      ...(values ? { method, body: new URLSearchParams(values) } : {}), timeoutMs: 60000 });
  } catch (error) {
    report.requests.transportFailures++;
    throw new Error(`${method} ${path}: ${error.message}`, { cause: error });
  }
  return { status: response.status, text: await response.text() };
}
async function idleRequest(path, values) {
  for (let attempt = 0; ; attempt++) {
    const result = await request(path, values);
    const busy = result.status === 503 && (
      /^Service host(?: ingress)? busy(?: or unavailable)?$/.test(result.text)
      || /"busy"\s*:\s*true/.test(result.text));
    if (!busy) return result;
    report.requests.busyResponses++;
    if (attempt === 3) return result;
    report.requests.busyRetries++;
    await wait(250 + Math.floor(Math.random() * 751));
  }
}
async function status(id = '') {
  const result = await idleRequest(`/pmachine/service_host/status${id ? `?collectorId=${encodeURIComponent(id)}` : ''}`);
  if (id && result.status === 404) return null;
  assert.equal(result.status, 200, result.text);
  return JSON.parse(result.text);
}
async function getJson(path) {
  const started = Date.now();
  const result = await idleRequest(path);
  assert.equal(result.status, 200, `${path}: HTTP ${result.status} ${result.text}`);
  return { body: JSON.parse(result.text), ms: Date.now() - started, bytes: Buffer.byteLength(result.text) };
}
// The names endpoint is paged (<= 10 names per page); aggregate every page by following nextCursor.
async function getNames() {
  const pages = [];
  let cursor = '';
  do {
    const page = await getJson(`/api/devices/names${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    assert.ok(page.body.names.length <= 10 && (page.body.continuation === 'end') === (page.body.nextCursor === ''), JSON.stringify(page.body));
    pages.push(page);
    cursor = page.body.nextCursor;
    assert.ok(pages.length <= 10, 'names pagination must terminate within 10 pages');
  } while (cursor);
  return { body: { count: pages[0].body.count, names: pages.flatMap(page => page.body.names) },
    pages: pages.map(page => ({ names: page.body.names.length, continuation: page.body.continuation, bytes: page.bytes, ms: page.ms })),
    ms: pages.reduce((sum, page) => sum + page.ms, 0), bytes: Math.max(...pages.map(page => page.bytes)) };
}
async function upload(file, body) {
  const response = file.endsWith('.phi')
    ? await requestEsp32(new URL(`/ffs/upload_stream?file=${encodeURIComponent(file)}`, url), {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body, timeoutMs: 60000 })
    : await requestEsp32(new URL('/ffs/upload', url), {
      method: 'POST', body: new URLSearchParams({ file, body }), timeoutMs: 60000 });
  assert.equal(response.status, 200, `${file}: ${await response.text()}`);
}
async function stop(id) {
  const result = await idleRequest(`/pmachine/service_host/stop?collectorId=${encodeURIComponent(id)}`, {});
  assert.equal(result.status, 200, `stop ${id}: ${result.text}`);
}
async function compileUnit(path, file, adjust = source => source) {
  const compiled = compilePascalishProgramWithAntlr(adjust(await fs.readFile(new URL(path, import.meta.url), 'utf8')), { hostServices: true });
  const image = encodeHostedImage(compiled.pcodeText);
  const map = attachPcodeSignature({ ...compactServiceHostProgramMap(compiled.programMap), hostImageFormat: 'PHI1' }, image);
  return { file, mapFile: file.replace(/\.phi$/, '.map.json'), image, map, instructions: Number.parseInt(image.slice(4, 12), 16),
    hostCaches: compiled.programMap.hostCaches };
}
const units = {
  service: await compileUnit('../../src/device-cache-service.pas', '/dcs.phi'),
  kasa: await compileUnit('../../src/kasa-collector-daemon.pas', '/kcd.phi'),
  tuya: await compileUnit('../../src/tuya-collector-daemon.pas', '/tcd.phi'),
  ...(withSsdp ? { ssdp: await compileUnit('../../src/ssdp-collector-daemon.pas', '/scd.phi') } : {}),
  // Each native filler turn lasts ~200 ms; leave an idle window for status instead of exhausting busy retries.
  filler: await compileUnit('./fixtures/device-cache-filler-daemon.pas', '/dcf.phi', source => {
    const adjusted = source.replace(/refresh\s+20\s+ms/i, 'refresh 1000 ms');
    assert.notEqual(adjusted, source, 'filler refresh clause not found');
    return adjusted;
  })
};
report.units = Object.fromEntries(Object.entries(units).map(([name, unit]) => [name, { file: unit.file, instructions: unit.instructions }]));
for (const unit of Object.values(units)) assert.deepEqual(unit.hostCaches, units.service.hostCaches);
check('service, selected collectors and probe filler declare one identical cache of Device (capacity 50)');

const before = await status();
report.before = { serviceCount: before.serviceCount, services: (before.services || []).map(item => item.collectorId),
  freeHeapBytes: before.freeHeapBytes, largestFreeBlockBytes: before.largestFreeBlockBytes };
const runningIds = new Set((before.services || []).map(item => item.collectorId));
if (runningIds.has(SHARED_ID) && !args.includes('--replace')) throw new Error(`${SHARED_ID} is already running; pass --replace to reinstall`);
const kasaWasRunning = runningIds.has(KASA_ID);
let kasaStopped = false, sharedInstalled = false, failure = null;
try {
  for (const unit of Object.values(units)) {
    await upload(unit.file, unit.image);
    await upload(unit.mapFile, JSON.stringify(unit.map));
  }
  check('signed PHI1 images and maps uploaded through FFS (no uploadfs)');
  if (runningIds.has(SHARED_ID)) await stop(SHARED_ID);
  if (kasaWasRunning) { await stop(KASA_ID); kasaStopped = true; check('selectively stopped only the legacy Kasa context'); }

  // Boundary proof in a temporary context; its cache dies with the context, so no test records reach shared-devices.
  if (!args.includes('--skip-boundary')) {
  let probe = await idleRequest('/pmachine/service_host/install', {
    serviceFile: units.service.file, serviceMap: units.service.mapFile,
    daemons: JSON.stringify([{ file: units.filler.file, map: units.filler.mapFile }]),
    collectorId: PROBE_ID, observationTtlMs: '180000', announcementIntervalMs: '60000' });
  assert.equal(probe.status, 200, `probe install: ${probe.text}`);
  try {
    // The filler stops writes at 75. Observe it after that bounded write phase instead of
    // repeatedly racing the worker mutex (without extending the approved busy retry limit).
    await wait(82000);
    const deadline = Date.now() + 120000;
    let probeStatus;
    do { await wait(1000); probeStatus = await status(PROBE_ID); }
    while (probeStatus.daemons[0].timerRuns < 80 && Date.now() < deadline);
    const boundary = await getNames();
    report.boundary = { count: boundary.body.count, names: boundary.body.names.length, distinct: new Set(boundary.body.names).size,
      pages: boundary.pages, maxPageBytes: boundary.bytes, totalMs: boundary.ms, fillerRuns: probeStatus.daemons[0].timerRuns,
      fillerPuts: Math.min(probeStatus.daemons[0].timerRuns, 75),
      cacheEntries: probeStatus.cacheEntries, cacheBytes: probeStatus.cacheBytes, failures: probeStatus.daemons[0].failures,
      freeHeapBytes: probeStatus.freeHeapBytes, largestFreeBlockBytes: probeStatus.largestFreeBlockBytes };
    assert.equal(boundary.body.count, 50, JSON.stringify(report.boundary));
    assert.equal(boundary.body.names.length, 50);
    assert.equal(new Set(boundary.body.names).size, 50);
    assert.ok(probeStatus.daemons[0].timerRuns > 50, 'filler must exceed capacity so eviction is exercised');
    assert.deepEqual(boundary.pages.map(page => page.continuation), ['continue', 'continue', 'continue', 'continue', 'end']);
    check(`ESP32 returned all 50 names in ${boundary.pages.length} pages (max ${boundary.bytes} bytes) after ${report.boundary.fillerPuts} puts (${probeStatus.daemons[0].timerRuns} timer turns)`);
  } finally {
    await stop(PROBE_ID);
    await wait(5000); // Allow the bounded response's final ACK to release transport-owned page storage.
    probe = null;
  }
  }

  const installed = await idleRequest('/pmachine/service_host/install', {
    serviceFile: units.service.file, serviceMap: units.service.mapFile,
    daemons: JSON.stringify([{ file: units.kasa.file, map: units.kasa.mapFile },
      { file: units.tuya.file, map: units.tuya.mapFile, udpPort: 6667 },
      ...(withSsdp ? [{ file: units.ssdp.file, map: units.ssdp.mapFile, udpPort: 1900, multicastGroup: '239.255.255.250' }] : [])]),
    collectorId: SHARED_ID, observationTtlMs: '180000', announcementIntervalMs: '60000',
    networkPeers: JSON.stringify(KASA_PEERS) });
  assert.equal(installed.status, 200, `shared install: ${installed.text}`);
  sharedInstalled = true;
  check('installed one shared-devices context: service + Kasa daemon + Tuya daemon (UDP 6667)');
  if (withSsdp) check('installed third passive SSDP daemon, owning multicast 239.255.255.250:1900');

  const labelDeadline = Date.now() + labelDeadlineMs;
  let names;
  for (;;) {
    names = (await getNames()).body;
    const tuyaLabels = names.names.filter(name => name.startsWith('Tuya '));
    const kasaLabels = names.names.filter(name => !name.startsWith('Tuya ') && !name.startsWith('SSDP '));
    if ((kasaLabels.length >= 2 && tuyaLabels.length >= 1) || Date.now() > labelDeadline) break;
    await wait(5000);
  }
  report.labels = { kasa: names.names.filter(name => !name.startsWith('Tuya ') && !name.startsWith('SSDP ')),
    tuya: names.names.filter(name => name.startsWith('Tuya ')), ssdp: names.names.filter(name => name.startsWith('SSDP ')) };
  assert.ok(report.labels.kasa.length >= 1, `no Kasa label: ${JSON.stringify(names)}`);
  assert.ok(report.labels.tuya.length >= 1, `no Tuya label: ${JSON.stringify(names)}`);
  if (report.labels.kasa.length < 2) warn(`only ${report.labels.kasa.length} of 2 configured Kasa devices cached`);
  assert.equal(names.count, names.names.length);
  check(`real labels cached: Kasa ${JSON.stringify(report.labels.kasa)}, Tuya ${JSON.stringify(report.labels.tuya)}`);

  if (withSsdp) {
    const localAddress = Object.values(os.networkInterfaces()).flat().find(item =>
      item.family === 'IPv4' && !item.internal && item.address.startsWith('192.168.2.'))?.address;
    assert.ok(localAddress, 'physical multicast proof requires a local LAN IPv4 interface');
    const socket = dgram.createSocket('udp4');
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(0, localAddress, resolve); });
    socket.setMulticastInterface(localAddress);
    socket.setMulticastTTL(1);
    const synthetic = ['ff000000-0000-4000-8000-000000000001', 'ff000000-0000-4000-8000-000000000002'];
    const notify = (id, nts) => Buffer.from(`NOTIFY * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nNT: upnp:rootdevice\r\nNTS: ${nts}\r\nUSN: uuid:${id}::upnp:rootdevice\r\nCACHE-CONTROL: max-age=30\r\nSERVER: Synthetic ESP32 proof (not a real device)\r\n\r\n`);
    const send = (id, nts, address) => new Promise((resolve, reject) =>
      socket.send(notify(id, nts), 1900, address, error => error ? reject(error) : resolve()));
    const awaitName = async (label, present) => {
      const deadline = Date.now() + 45000;
      do {
        const current = (await getNames()).body.names;
        if (current.includes(label) === present) return;
        await wait(1000);
      } while (Date.now() < deadline);
      throw new Error(`synthetic SSDP label ${label}: expected present=${present}`);
    };
    report.ssdpSynthetic = { synthetic: true, interface: localAddress, multicast: false, unicast: false, removed: false };
    try {
      const beforeSsdp = await status(SHARED_ID);
      report.ssdpSynthetic.beforeStatus = beforeSsdp;
      assert.equal(beforeSsdp.daemons[2].multicastGroup, '239.255.255.250');
      assert.equal(beforeSsdp.daemons[2].multicastInterface, url.hostname);
      await send(synthetic[0], 'ssdp:alive', '239.255.255.250');
      await awaitName(`SSDP ${synthetic[0]}`, true);
      report.ssdpSynthetic.multicast = true;
      check('ESP32 natively received one explicitly synthetic multicast NOTIFY');
      await send(synthetic[1], 'ssdp:alive', url.hostname);
      await awaitName(`SSDP ${synthetic[1]}`, true);
      report.ssdpSynthetic.unicast = true;
      check('separate synthetic unicast NOTIFY reached the same native UDP intake');
    } finally {
      for (const id of synthetic) await send(id, 'ssdp:byebye', url.hostname);
      socket.close();
      for (const id of synthetic) await awaitName(`SSDP ${id}`, false);
      report.ssdpSynthetic.removed = true;
    }
    report.labels.ssdp = (await getNames()).body.names.filter(name => name.startsWith('SSDP '));
    if (!report.labels.ssdp.length) warn('No real LAN SSDP device observed; multicast reception was proved with explicitly synthetic frames, removed afterwards');
    else check(`real passive SSDP UUID labels: ${JSON.stringify(report.labels.ssdp)}`);
  }

  const soakStarted = Date.now(), soakEnd = soakStarted + soakMs, initialBusyRetries = report.requests.busyRetries;
  let httpErrors = 0, transientErrors = 0;
  do {
    const sample = { at: new Date().toISOString() }, beforeBusyRetries = report.requests.busyRetries;
    try {
      const listed = await getNames();
      const health = await getJson('/health');
      const current = await status(SHARED_ID);
      Object.assign(sample, { count: listed.body.count, names: listed.body.names.length, namesPages: listed.pages.length,
        namesMs: listed.ms, namesMaxPageBytes: listed.bytes, healthMs: health.ms,
        cacheEntries: current.cacheEntries, cacheBytes: current.cacheBytes, freeHeapBytes: current.freeHeapBytes,
        largestFreeBlockBytes: current.largestFreeBlockBytes, workerStackHighWaterBytes: current.workerStackHighWaterBytes,
        daemons: current.daemons.map(({ index, timerRuns, udpEvents, failures, droppedDatagrams, shedDatagrams, lastError }) =>
          ({ index, timerRuns, udpEvents, failures, droppedDatagrams, shedDatagrams, lastError })) });
      assert.equal(sample.count, sample.cacheEntries);
      assert.equal(sample.names, sample.count);
      delete sample.error;
    } catch (error) {
      httpErrors += 1; sample.error = error.message;
    }
    sample.busyRetries = report.requests.busyRetries - beforeBusyRetries;
    report.samples.push(sample);
    console.log(JSON.stringify(sample));
    if (Date.now() < soakEnd) await wait(15000);
  } while (Date.now() < soakEnd);
  report.soak = { requestedMs: soakMs, durationMs: Date.now() - soakStarted, samples: report.samples.length,
    busyRetries: report.requests.busyRetries - initialBusyRetries, transientErrors, failedSamples: httpErrors };
  if (transientErrors) warn(`${transientErrors} soak sample(s) needed a retry (see samples[].transientError)`);
  assert.equal(httpErrors, 0, `${httpErrors} soak sample(s) failed (transport failures are not retried)`);
  check(`soak ${Math.round(soakMs / 1000)} s: names, health and status responsive in every sample`);

  const final = await status(SHARED_ID);
  const finalNames = (await getNames()).body;
  report.final = { names: finalNames, status: final };
  const [kasaStats, tuyaStats] = final.daemons;
  assert.equal(final.daemons.length, withSsdp ? 3 : 2);
  assert.ok(kasaStats.timerRuns >= 2, 'Kasa daemon ran on its own schedule');
  assert.ok(tuyaStats.udpEvents >= 1 && tuyaStats.udpPort === 6667, 'Tuya daemon received owned UDP datagrams');
  assert.equal(kasaStats.failures, 0, `Kasa daemon failures: ${kasaStats.failures} (last: ${kasaStats.lastError})`);
  if (withSsdp) {
    assert.equal(final.daemons[2].failures, 0, final.daemons[2].lastError);
    assert.ok(final.daemons[2].udpEvents >= 2, 'SSDP native multicast and unicast intake observed');
    assert.equal(report.ssdpSynthetic.removed, true);
  }
  if (tuyaStats.failures) warn(`Tuya daemon failures: ${tuyaStats.failures} (last: ${tuyaStats.lastError})`);
  if (tuyaStats.droppedDatagrams || tuyaStats.shedDatagrams) {
    warn(`Tuya datagrams dropped=${tuyaStats.droppedDatagrams} shed=${tuyaStats.shedDatagrams}`);
  }
  check('both daemons report independent schedules and counters in one context');
  report.result = 'pass';
} catch (error) {
  failure = error;
  report.result = 'fail';
  report.error = error.message;
  console.error(`FAIL: ${error.message}`);
  try {
    const current = await status();
    const ids = new Set((current.services || []).map(item => item.collectorId));
    if (ids.has(SHARED_ID)) report.failedStatus = await status(SHARED_ID);
    for (const id of [PROBE_ID, SHARED_ID]) if (ids.has(id)) await stop(id);
    // Kasa is restored from its retained FFS files whenever it is not running (it may predate a reflash).
    if (!ids.has(KASA_ID) && !args.includes('--no-kasa-restore')) {
      const restored = await idleRequest('/pmachine/service_host/install', KASA_INSTALL);
      report.kasaRestore = { status: restored.status, text: restored.text };
      console.log(`Kasa restore: HTTP ${restored.status} ${restored.text}`);
    }
  } catch (restoreError) { report.restoreError = restoreError.message; console.error(`Restore failed: ${restoreError.message}`); }
} finally {
  try { await idleRequest('/ffs/delete', { file: units.filler.file }); await idleRequest('/ffs/delete', { file: units.filler.mapFile }); }
  catch (error) { report.warnings.push(`probe file cleanup: ${error.message}`); }
  report.finishedAt = new Date().toISOString();
  report.sharedInstalled = sharedInstalled && report.result === 'pass';
  if (reportPath) await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
if (failure) process.exitCode = 1;