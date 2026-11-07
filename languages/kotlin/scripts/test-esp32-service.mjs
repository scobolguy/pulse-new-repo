import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { compilePascalishProgramWithAntlr } from '../../pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';

const target = process.env.PULSE_ESP32_TEST_URL;
if (!target) throw new Error('Set PULSE_ESP32_TEST_URL to the ESP32 HTTP origin');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash)
  throw new Error('PULSE_ESP32_TEST_URL must be an HTTP(S) origin');

async function request(path, values, expected = 200) {
  const response = await fetch(new URL(path, origin), {
    ...(values === undefined ? {} : { method: 'POST', body: new URLSearchParams(values) }),
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}: ${text}`);
  return text;
}

const previous = JSON.parse(await request('/pmachine/service_host/status'));
assert.equal(previous.running, false, 'Stop the existing host explicitly before running this hardware test');
const source = 'import pulse.http.requestQuery\n' + (await fs.readFile(new URL('../examples/http-service.kt', import.meta.url), 'utf8')) + `
@HttpGet("/api/kotlin/query")
fun getQuery(): String = requestQuery("value")
`;
const service = compileKotlinToPcode(source, { fileName: 'kotlin_service.kt', target: 'esp32' });
const daemon = compilePascalishProgramWithAntlr(
  "daemon 'kotlin-idle' every 60000 ms; begin end.", { hostServices: true });
const prefix = `/kt${Date.now().toString(36)}`;
const files = [];
let installed = false;
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
  const result = JSON.parse(await request('/pmachine/service_host/install', {
    serviceFile: `${prefix}-service.phi`,
    serviceMap: `${prefix}-service.map.json`,
    daemons: JSON.stringify([{ file: `${prefix}-daemon.phi`, map: `${prefix}-daemon.map.json`, udpPort: 0 }]),
    collectorId: 'kotlin-http-test'
  }));
  installed = result.running === true;
  assert.equal(installed, true, 'ESP32 did not start the test service');
  for (const [path, expected] of [
    ['/api/kotlin/status', { status: 'ok' }],
    ['/api/kotlin/version', { version: 1 }],
    ['/api/kotlin/query?value=%7B%22request%22%3A%22ok%22%7D', { request: 'ok' }]
  ]) {
    assert.deepEqual(JSON.parse(await request(path)), expected);
    console.log(`PASS GET ${path}`);
  }
  await request('/api/kotlin/missing', undefined, 404);
  console.log(`Kotlin HTTP service passed on ${origin.origin}`);
} finally {
  if (installed) await request('/pmachine/service_host/stop', {});
  for (const file of files) await request('/ffs/delete', { file });
}
