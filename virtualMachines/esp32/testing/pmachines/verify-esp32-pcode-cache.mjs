import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { requestEsp32 } from './esp32-http.mjs';

const [origin, collectorId, endpoint, reservation] = process.argv.slice(2);
const expectedBytes = Number(reservation);
if (!origin || !collectorId || !endpoint?.startsWith('/') || reservation === undefined
    || !Number.isSafeInteger(expectedBytes) || expectedBytes < 0) {
  throw new Error('Usage: node verify-esp32-pcode-cache.mjs <origin> <collectorId> <GET endpoint> <expected reserved bytes>');
}
async function get(path) {
  const response = await requestEsp32(new URL(path, origin), { timeoutMs: 30000 });
  const text = await response.text();
  assert.equal(response.status, 200, `${path}: ${response.status} ${text}`);
  return text;
}
async function stats() {
  for (let attempt = 0; attempt < 20; ++attempt) {
    const status = JSON.parse(await get('/pmachine/service_host/status'));
    if (!status.busy) {
      const service = status.services?.find(item => item.collectorId === collectorId);
      assert.ok(service, `Service ${collectorId} not found`);
      return service;
    }
    await sleep(250);
  }
  throw new Error('Service host status remained busy');
}
await get(endpoint);
const before = await stats();
for (let i = 0; i < 3; ++i) await get(endpoint);
const after = await stats();
assert.equal(after.instructionStorage, 'ffs-paged');
assert.equal(after.instructionCacheStorage, expectedBytes ? 'psram' : 'internal');
assert.equal(after.instructionCacheReservedBytes, expectedBytes);
if (expectedBytes) assert.ok(after.instructionCacheCapacityPages > 4);
else assert.equal(after.instructionCacheCapacityPages, 4);
assert.ok(after.instructionCacheHits > before.instructionCacheHits, 'Expected cache hits to increase');
assert.ok(after.instructionPageReads >= before.instructionPageReads);
console.log(`PASS: ${after.instructionCacheStorage} cache, ${after.instructionCacheReservedBytes} bytes, `
  + `${after.instructionCacheCapacityPages} pages, ${after.instructionCacheHits - before.instructionCacheHits} new hits, `
  + `${after.instructionPageReads - before.instructionPageReads} new FFS reads`);
