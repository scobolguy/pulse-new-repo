import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const origin = process.argv[2];
if (!origin) throw new Error('Usage: node verify-esp32-hosted-image.mjs <ESP32 origin>');
const timeoutIndex = process.argv.indexOf('--timeout-ms');
const timeoutMs = timeoutIndex < 0 ? 60000 : Number(process.argv[timeoutIndex + 1]);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Expected a positive integer for --timeout-ms');
async function request(path, values) {
  console.log(`${values ? 'POST' : 'GET'} ${path}`);
  let response;
  try {
    response = await requestEsp32(new URL(path, origin), {
      ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
      timeoutMs
    });
  } catch (error) { throw new Error(`${path}: ${error.message}`, { cause: error }); }
  return { status: response.status, text: await response.text() };
}
async function upload(file, body) {
  if (file.endsWith('.phi')) {
    const response = await requestEsp32(new URL(`/ffs/upload_stream?file=${encodeURIComponent(file)}`, origin), {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body,
      timeoutMs
    });
    assert.equal(response.status, 200, await response.text());
    return;
  }
  const result = await request('/ffs/upload', { file, body });
  assert.equal(result.status, 200, result.text);
}
const before = await request('/pmachine/service_host/status');
assert.equal(before.status, 200, before.text);
assert.equal(JSON.parse(before.text).running, false, 'Stop the existing host explicitly before this test');
const metadata = kind => ({
  version: 1, hostBindingsVersion: 1, hostImageFormat: 'PHI1', targets: ['esp32'],
  runtimeUnit: { kind, ...(kind === 'daemon' ? { refreshMs: 1000 } : {}) }, procedures: {}
});
const text = 'PUSH_STR "{\\"probe\\":true}"\nSTORE result\nMAP_RETURN result\n'
  + 'NOP\n'.repeat(250) + 'HALT\n';
const image = encodeHostedImage(text);
const daemon = encodeHostedImage('HALT');
const files = ['/hip.phi', '/hip.map.json', '/hid.phi', '/hid.map.json'];
const install = () => request('/pmachine/service_host/install', {
  serviceFile: files[0], serviceMap: files[1], daemonFile: files[2], daemonMap: files[3],
  collectorId: 'image-probe', udpPort: '44212', observationTtlMs: '180000',
  announcementIntervalMs: '60000'
});
let probeError;
try {
  await upload(files[2], daemon);
  await upload(files[3], JSON.stringify(attachPcodeSignature(metadata('daemon'), daemon)));
  const rejects = async (content, map, pattern) => {
    await upload(files[0], content);
    await upload(files[1], JSON.stringify(map));
    const result = await install();
    assert.equal(result.status, 400, result.text);
    assert.match(result.text, pattern);
    const state = await request('/pmachine/service_host/status');
    assert.equal(JSON.parse(state.text).running, false);
  };
  await rejects(image.slice(0, -1) + (image.endsWith('0') ? '1' : '0'),
    attachPcodeSignature(metadata('service'), image), /signature/);
  const badOpcode = image.slice(0, 20) + 'fe' + image.slice(22);
  await rejects(badOpcode, attachPcodeSignature(metadata('service'), badOpcode), /Opcode/);
  const badBranch = image.slice(0, 20) + '07000000ffff' + image.slice(32);
  await rejects(badBranch, attachPcodeSignature(metadata('service'), badBranch), /branch/);
  await upload(files[0], image);
  await upload(files[1], JSON.stringify(attachPcodeSignature(metadata('service'), image)));
  const result = await install();
  assert.equal(result.status, 200, result.text);
  const health = await request('/health');
  assert.equal(health.status, 200, health.text);
  assert.deepEqual(JSON.parse(health.text), { probe: true });
  const state = JSON.parse((await request('/pmachine/service_host/status')).text);
  assert.equal(state.instructionStorage, 'ffs-paged');
  assert.equal(state.executionModel, 'single-worker');
  assert.equal(state.httpEventCapacity, 3);
  assert.ok(state.instructionPageReads > 4);
  await upload(files[0], image.slice(0, 20) + 'ff' + image.slice(22));
  const afterReplacement = await request('/health');
  if (afterReplacement.status === 503) assert.match(afterReplacement.text, /changed|storage/);
  else {
    assert.equal(afterReplacement.status, 200, afterReplacement.text);
    assert.deepEqual(JSON.parse(afterReplacement.text), { probe: true },
      'A snapshot file handle may retain the original image, but must never execute replacement bytes');
  }
  console.log('PASS: streaming signatures, rejected opcode/branch, paged execution, pinned image content', state);
  if (process.argv.includes('--single-worker')) {
    assert.equal((await request('/pmachine/service_host/stop', {})).status, 200);
    const source = await fs.readFile(new URL('./fixtures/single-worker-probe.pas', import.meta.url), 'utf8');
    const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
    const workerImage = encodeHostedImage(compiled.pcodeText);
    await upload(files[0], workerImage);
    await upload(files[1], JSON.stringify(attachPcodeSignature({
      ...compactServiceHostProgramMap(compiled.programMap), hostImageFormat: 'PHI1'
    }, workerImage)));
    assert.equal((await install()).status, 200);
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => request('/health')));
    assert.ok(concurrent.some(result => result.status === 429), 'Queue must reject overload');
    const accepted = concurrent.filter(result => result.status === 200);
    assert.ok(accepted.length > 0 && accepted.length <= 3);
    for (const result of concurrent) {
      assert.ok([200, 429].includes(result.status), JSON.stringify(result));
      if (result.status === 429) assert.match(result.text, /queue full/);
    }
    assert.deepEqual(accepted.map(result => JSON.parse(result.text).count).sort((a, b) => a - b),
      Array.from({ length: accepted.length }, (_, index) => index + 1));
    let complete = false;
    const blocker = request('/health').then(result => { complete = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(complete, false, 'Probe must still be executing for the cancellation test');
    const started = Date.now();
    const runtime = await request('/pmachine/status');
    assert.equal(runtime.status, 200, runtime.text);
    assert.ok(Date.now() - started < 1500, 'Web server must remain responsive while VM executes');
    const controller = new AbortController();
    const cancelled = requestEsp32(new URL('/health', origin), { signal: controller.signal, timeoutMs });
    const rejection = assert.rejects(cancelled, /abort/i);
    await new Promise(resolve => setTimeout(resolve, 50));
    controller.abort();
    await rejection;
    assert.equal((await blocker).status, 200);
    const counter = await request('/api/discovery/snapshot');
    assert.equal(counter.status, 200, counter.text);
    assert.equal(JSON.parse(counter.text).count, accepted.length + 1,
      'Disconnected queued request must not execute its action');
    console.log('PASS: single worker serializes requests, rejects overload, keeps HTTP responsive and skips cancelled queued events');
  }
} catch (error) {
  probeError = error;
}
try {
  const stopped = await request('/pmachine/service_host/stop', {});
  assert.equal(stopped.status, 200, stopped.text);
  for (const file of files) {
    const deleted = await request('/ffs/delete', { file });
    assert.equal(deleted.status, 200, deleted.text);
  }
} catch (cleanupError) {
  if (probeError) throw new AggregateError([probeError, cleanupError], 'Hardware probe and cleanup failed');
  throw cleanupError;
}
if (probeError) throw probeError;
