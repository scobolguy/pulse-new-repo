import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const origin = process.argv[2];
if (!origin) throw new Error('Usage: node verify-esp32-cache.mjs <origin> [--report <path>]');
const base = new URL(origin);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { origin, startedAt: new Date().toISOString(), checks: [] };
const files = ['/cacheprobe.phi', '/cacheprobe.map.json', '/cachetick.phi', '/cachetick.map.json'];
async function request(path, options = {}) {
  console.log(`${options.method ?? 'GET'} ${path}`);
  const response = await requestEsp32(new URL(path, base), { timeoutMs: 20000, ...options });
  return { status: response.status, text: await response.text() };
}
async function status(id = 'cache-probe') {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const result = await request(`/pmachine/service_host/status${id ? `?collectorId=${encodeURIComponent(id)}` : ''}`);
    if (result.status === 503 && result.text.includes('"busy":true')) {
      if (attempt === 3) throw new Error('Status busy; try again later');
      await wait(250 + Math.floor(Math.random() * 751)); continue;
    }
    assert.equal(result.status, 200, result.text);
    return JSON.parse(result.text);
  }
}
const before = await status('');
assert.equal(before.running, false, 'Stop existing services explicitly before running this standalone cache proof');
let installed = false;
let failure;
const check = name => { report.checks.push(name); console.log(`PASS: ${name}`); };
const key = n => JSON.stringify({ n });
const jsonRequest = (path, value) => request(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
});
async function put(k, count, ttl = 180000) {
  const result = await jsonRequest('/api/cache-probe/put', { key: k, count, label: 'typed', ttl });
  assert.equal(result.status, 200, result.text);
}
async function read(k, expected) {
  const result = await request(`/api/cache-probe/get?key=${encodeURIComponent(k)}`);
  assert.equal(result.status, 200, result.text);
  assert.equal(JSON.parse(result.text).count, expected);
}
async function missing(k) {
  const result = await request(`/api/cache-probe/get?key=${encodeURIComponent(k)}`);
  assert.ok(result.status >= 400, result.text);
  assert.match(result.text, /missing or expired/);
}
try {
  const sources = [
    await fs.readFile(new URL('./fixtures/cache-probe.pas', import.meta.url), 'utf8'),
    "daemon 'cache-tick' every 1 second; begin end."
  ];
  for (let index = 0; index < sources.length; index++) {
    const compiled = compilePascalishProgramWithAntlr(sources[index], { hostServices: true });
    const image = encodeHostedImage(compiled.pcodeText);
    assert.ok(Number.parseInt(image.slice(4, 12), 16) <= 512);
    const map = attachPcodeSignature({
      ...compactServiceHostProgramMap(compiled.programMap), hostImageFormat: 'PHI1'
    }, image);
    let result = await request(`/ffs/upload_stream?file=${files[index * 2]}`, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image
    });
    assert.equal(result.status, 200, result.text);
    result = await request('/ffs/upload', {
      method: 'POST', body: new URLSearchParams({ file: files[index * 2 + 1], body: JSON.stringify(map) })
    });
    assert.equal(result.status, 200, result.text);
  }
  const install = await request('/pmachine/service_host/install', {
    method: 'POST', body: new URLSearchParams({
      serviceFile: files[0], serviceMap: files[1], daemonFile: files[2], daemonMap: files[3],
      collectorId: 'cache-probe', udpPort: '44213',
      observationTtlMs: '180000', announcementIntervalMs: '60000'
    })
  });
  assert.equal(install.status, 200, install.text); installed = true;
  const boot = (await status()).bootId;
  const seed = await jsonRequest('/api/cache-probe/seed', {});
  assert.equal(seed.status, 200, seed.text);
  assert.equal(JSON.parse(seed.text).sum, 1225);
  check('50 typed records retained and read back on ESP32');
  await read(key(0), 0);
  await put('new', 50);
  await missing(key(0));
  await read(key(1), 1);
  check('51st insertion evicts oldest observation; reading does not refresh it');
  await put(key(1), 101);
  await put('newer', 51);
  await missing(key(2));
  await read(key(1), 101);
  check('updating a record refreshes its eviction order and preserves typed value');
  const removed = await jsonRequest('/api/cache-probe/remove', { key: 'new' });
  assert.equal(removed.status, 200, removed.text);
  assert.equal(JSON.parse(removed.text).removed, 1);
  await missing('new');
  const again = await jsonRequest('/api/cache-probe/remove', { key: 'new' });
  assert.equal(again.status, 200, again.text);
  assert.equal(JSON.parse(again.text).removed, 0);
  check('explicit removal and missing-key errors');
  await put('expires', 77, 8000);
  await wait(5000);
  await read('expires', 77);
  await wait(3500);
  await put('replacement', 78);
  await missing('expires');
  await read(key(3), 3);
  check('TTL expiry does not refresh on read; expired slot reclaimed before live eviction');
  const invalid = await jsonRequest('/api/cache-probe/put', { key: 'bad', count: 1, label: 'bad', ttl: 0 });
  assert.ok(invalid.status >= 400, invalid.text);
  await missing('bad');
  await read(key(1), 101);
  check('invalid TTL rejected without changing existing records');
  report.host = await status();
  assert.equal(report.host.bootId, boot, 'ESP32 rebooted during cache proof');
  assert.equal(report.host.lastError, 'Cache key missing or expired');
  check('same host boot throughout cache test');
} catch (error) {
  failure = error;
  report.error = error.message;
} finally {
  if (installed) {
    try {
      const result = await request('/pmachine/service_host/stop?collectorId=cache-probe', { method: 'POST' });
      assert.equal(result.status, 200, result.text);
    } catch (error) { report.cleanupError = error.message; failure ??= error; }
  }
  report.finishedAt = new Date().toISOString();
  const index = process.argv.indexOf('--report');
  if (index >= 0) {
    if (!process.argv[index + 1]) throw new Error('Missing report path');
    await fs.writeFile(process.argv[index + 1], JSON.stringify(report, null, 2) + '\n');
  }
}
if (failure) throw failure;
console.log('PASS: ESP32 typed cache proof completed.');
