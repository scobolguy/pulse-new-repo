import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { compilePascalishProgramWithAntlr } from '../../pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';

const target = process.env.PULSE_ESP32_TEST_URL;
if (!target) throw new Error('Set PULSE_ESP32_TEST_URL to the ESP32 HTTP origin');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash)
  throw new Error('PULSE_ESP32_TEST_URL must be an HTTP(S) origin');

async function request(path, values, expected = 200) {
  const response = await requestEsp32(new URL(path, origin), {
    ...(values === undefined ? {} : { method: 'POST', body: new URLSearchParams(values) }),
    timeoutMs: 60000
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}: ${text}`);
  return text;
}

const previous = JSON.parse(await request('/pmachine/service_host/status'));
assert.equal(previous.running, false, 'Stop the existing host explicitly before running this hardware test');
assert.equal(JSON.parse(await request('/pmachine/status')).running, false, 'Do not interrupt an active PMachine');
const source = 'import pulse.http.*\n' + (await fs.readFile(new URL('../examples/http-service.kt', import.meta.url), 'utf8')) + `
fun <T> scalarEcho(value: T, other: T = value): T = other
@HttpGet("/api/kotlin/query")
fun getQuery(): String = requestQuery("value")
@HttpPost("/api/kotlin/echo")
fun postEcho(): String = scalarEcho(requestBody())
@HttpGet("/api/kotlin/header")
fun getHeader(): String = requestHeader("X-Kotlin-Test")
@HttpGet("/api/kotlin/default")
fun getDefault(): String = scalarEcho("{\\"default\\":true}")
`;
const service = compileKotlinToPcode(source, { fileName: 'kotlin_service.kt', target: 'esp32' });
const daemon = compilePascalishProgramWithAntlr(
  "daemon 'kotlin-idle' every 60000 ms; begin end.", { hostServices: true });
const prefix = `/kt${Date.now().toString(36)}`;
const files = [];
let installed = false;
let skipped = false;
try {
  for (const [suffix, artifact] of [['service', service], ['daemon', daemon]]) {
    const image = encodeHostedImage(artifact.pcodeText);
    const map = { ...compactServiceHostProgramMap(artifact.programMap), hostImageFormat: 'PHI1' };
    for (const [file, body] of [
      [`${prefix}-${suffix}.phi`, image],
      [`${prefix}-${suffix}.map.json`, JSON.stringify(attachPcodeSignature(map, image))]
    ]) {
      await request('/ffs/upload', { file, body });
      files.push(file);
    }
  }
  const install = await requestEsp32(new URL('/pmachine/service_host/install', origin), {
    method: 'POST', timeoutMs: 60000, body: new URLSearchParams({
      serviceFile: `${prefix}-service.phi`,
      serviceMap: `${prefix}-service.map.json`,
      daemons: JSON.stringify([{ file: `${prefix}-daemon.phi`, map: `${prefix}-daemon.map.json`, udpPort: 0 }]),
      collectorId: 'kotlin-http-test'
    })
  });
  const installText = await install.text();
  if (/Insufficient heap/.test(installText)) {
    console.log(`SKIP Kotlin HTTP service install on ${origin.origin}: ${installText}`);
    skipped = true;
  }
  if (!skipped) {
    assert.equal(install.status, 200, `/pmachine/service_host/install: HTTP ${install.status}: ${installText}`);
    const result = JSON.parse(installText);
    installed = result.running === true;
    assert.equal(installed, true, 'ESP32 did not start the test service');
    for (const [path, expected] of [
      ['/api/kotlin/status', { status: 'ok' }],
      ['/api/kotlin/version', { version: 1 }],
      ['/api/kotlin/default', { default: true }],
      ['/api/kotlin/query?value=%7B%22request%22%3A%22ok%22%7D', { request: 'ok' }]
    ]) {
      assert.deepEqual(JSON.parse(await request(path)), expected);
      console.log(`PASS GET ${path}`);
    }
    for (const [path, options, expected] of [
      ['/api/kotlin/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"echo":"Kotlin"}' }, { echo: 'Kotlin' }],
      ['/api/kotlin/header', { headers: { 'x-kotlin-test': '{"header":"Kotlin"}' } }, { header: 'Kotlin' }]
    ]) {
      const response = await requestEsp32(new URL(path, origin), { ...options, timeoutMs: 60000 });
      const text = await response.text();
      assert.equal(response.status, 200, text);
      assert.deepEqual(JSON.parse(text), expected);
      console.log(`PASS ${options.method || 'GET'} ${path}`);
    }
    await request('/api/kotlin/missing', undefined, 404);
    console.log(`Kotlin HTTP service passed on ${origin.origin}`);
  }
} finally {
  if (installed) await request('/pmachine/service_host/stop', {});
  for (const file of files) await request('/ffs/delete', { file });
  assert.equal(JSON.parse(await request('/pmachine/service_host/status')).running, false);
  assert.equal(JSON.parse(await request('/pmachine/status')).running, false);
}
