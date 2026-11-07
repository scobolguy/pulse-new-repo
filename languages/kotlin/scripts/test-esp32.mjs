import assert from 'node:assert/strict';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { kotlinCoreSpecCases } from '../tests/spec-cases.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';

const origin = process.env.PULSE_ESP32_TEST_URL;
if (!origin) throw new Error('Set PULSE_ESP32_TEST_URL to the ESP32 HTTP origin');
const url = new URL('/pmachine/execute_json', origin);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('ESP32 test URL must use HTTP or HTTPS');

for (const testCase of kotlinCoreSpecCases) {
  const artifact = compileKotlinToPcode(testCase.source, { fileName: `${testCase.id}.kt`, target: 'esp32' });
  const programMap = attachPcodeSignature(artifact.programMap, artifact.pcodeText);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pcode: artifact.pcodeText, programMap, max: 65536 }),
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  assert.equal(response.status, 200, `${testCase.id}: HTTP ${response.status}: ${text}`);
  const result = JSON.parse(text);
  assert.equal(result.ok, true, `${testCase.id}: ${text}`);
  assert.equal(result.runtimeError ?? null, null, `${testCase.id}: ${text}`);
  assert.equal(result.stepLimitHit, false, `${testCase.id}: ${text}`);
  assert.deepEqual(result.stdout, testCase.stdout, `${testCase.id}: unexpected ESP32 output`);
  console.log(`PASS ${testCase.id} (${result.stepCount} steps)`);
}
console.log(`Passed ${kotlinCoreSpecCases.length} Kotlin cases on ${url.origin}`);
