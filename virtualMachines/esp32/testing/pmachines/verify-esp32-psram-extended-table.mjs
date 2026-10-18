import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { requestEsp32 } from './esp32-http.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

const origin = process.argv[2] || process.env.PULSE_ESP32_TEST_URL;
if (!origin) {
  throw new Error('Usage: node verify-esp32-psram-extended-table.mjs <ESP32 origin> [--elements <count>]');
}

const elementsIndex = process.argv.indexOf('--elements');
const elementCount = elementsIndex < 0 ? 32768 : Number(process.argv[elementsIndex + 1]);
if (!Number.isSafeInteger(elementCount) || elementCount < 1024 || elementCount > 1_000_000) {
  throw new Error('Expected --elements to be an integer from 1024 through 1000000');
}

const base = new URL(origin);
const timeoutMs = 60000;
const runId = randomBytes(6).toString('hex');
const pcodeFile = `/p${runId}.pcode`;
const mapFile = `/m${runId}.json`;
const uploadedFiles = [];
let failure;

async function request(path, options = {}) {
  console.log(`${options.method ?? 'GET'} ${path}`);
  const response = await requestEsp32(new URL(path, base), { timeoutMs, ...options });
  return { status: response.status, text: await response.text() };
}

async function upload(file, body) {
  console.log(`Uploading ${file} (${Buffer.byteLength(body)} bytes)`);
  uploadedFiles.push(file);
  const result = await request('/ffs/upload', {
    method: 'POST',
    body: new URLSearchParams({ file, body })
  });
  assert.equal(result.status, 200, `${file}: ${result.text}`);
}

try {
  const middleIndex = Math.floor(elementCount / 2);
  const lastIndex = elementCount - 1;
  const pcode = [
    `PUSH_INT 0`, `PUSH_INT 13579`, `ARR_SET table ${elementCount}`,
    `PUSH_INT ${middleIndex}`, `PUSH_INT 24680`, `ARR_SET table ${elementCount}`,
    `PUSH_INT ${lastIndex}`, `PUSH_INT 97531`, `ARR_SET table ${elementCount}`,
    'PUSH_INT 0', `ARR_GET table ${elementCount}`, 'STORE firstValue',
    `PUSH_INT ${middleIndex}`, `ARR_GET table ${elementCount}`, 'STORE middleValue',
    `PUSH_INT ${lastIndex}`, `ARR_GET table ${elementCount}`, 'STORE lastValue',
    'HALT'
  ].join('\n') + '\n';
  const programMap = attachPcodeSignature({
    version: 1,
    extendableDeclarations: [{ name: 'table', elementCount }]
  }, pcode);

  await upload(pcodeFile, pcode);
  await upload(mapFile, JSON.stringify(programMap));

  const execution = await request('/pmachine/execute_file', {
    method: 'POST',
    body: new URLSearchParams({ file: pcodeFile, programMap: mapFile, max: '4096' })
  });
  assert.equal(execution.status, 200, execution.text);
  const result = JSON.parse(execution.text);
  assert.equal(result.runtimeError, undefined, JSON.stringify(result));
  assert.deepEqual(
    { firstValue: result.globals.firstValue, middleValue: result.globals.middleValue, lastValue: result.globals.lastValue },
    { firstValue: 13579, middleValue: 24680, lastValue: 97531 }
  );

  const allocation = result.extendedStorage;
  assert.ok(allocation, 'Execution response must report extended-storage allocation details');
  assert.equal(allocation.declarationCount, 1);
  assert.equal(allocation.elementCount, elementCount);
  assert.ok(allocation.allocatedBytes > 0, 'Extended table must allocate memory');
  assert.equal(allocation.psramBytes, allocation.allocatedBytes,
    'All allocations for this integer table must be in PSRAM, not internal heap');
  assert.equal(allocation.heapBytes, 0);
  assert.equal(allocation.globalsSnapshotOmittedElements, elementCount,
    'Large table cells should not be duplicated into the internal-heap globals snapshot');
  console.log(`PASS: ${elementCount} extended-table elements allocated in PSRAM (${allocation.psramBytes} bytes); boundary and midpoint values round-tripped.`);
} catch (error) {
  failure = error;
} finally {
  const cleanupErrors = [];
  for (const file of uploadedFiles) {
    try {
      const existing = await request(`/ffs/get?file=${encodeURIComponent(file)}`);
      if (existing.status === 404) continue;
      assert.equal(existing.status, 200, `${file}: ${existing.text}`);
      const result = await request('/ffs/delete', {
        method: 'POST',
        body: new URLSearchParams({ file })
      });
      assert.equal(result.status, 200, result.text);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    failure = failure
      ? new AggregateError([failure, ...cleanupErrors], 'PSRAM test and file cleanup failed')
      : new AggregateError(cleanupErrors, 'PSRAM test file cleanup failed');
  }
}

if (failure) throw failure;
