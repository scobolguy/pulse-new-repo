import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileCobolishToPcode } from '../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { compileScreenCobol } from '../../../languages/screencobol/src/compiler.mjs';
import { createNodeAdapter, nodeRequest } from './src/node-adapter.mjs';
import { runRequester } from './src/requester.mjs';

const index = process.argv.indexOf('--url');
const origin = process.argv[index + 1];
if (index < 0 || !origin || !process.argv.includes('--confirm-test')) {
  throw new Error('Provide --url http://board-address --confirm-test; the board must have no active hosted service');
}
const url = new URL(origin);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Provide an HTTP(S) URL');
const node = { origin, runtime: 'esp32' };
const adapter = createNodeAdapter({ timeoutMs: 10000 });
assert.deepEqual(await adapter.describe(node), { runtime: 'esp32' });
assert.equal((await adapter.inspect(node)).running, false, 'Stop the existing hosted service explicitly before testing');
const artifact = compileCobolishToPcode(await fs.readFile(new URL('./examples/echo.cob', import.meta.url), 'utf8'), { hostServices: true });
const requester = compileScreenCobol(await fs.readFile(new URL('./examples/echo.scob', import.meta.url), 'utf8'));
const collectorId = `pw-check-${Date.now().toString(36)}`;
try {
  await adapter.install(node, { artifact }, collectorId);
  for (const value of ['Native COBOL server', 'second request', 'quotes " and slash \\']) {
    const reply = await runRequester(requester, { 'REQUEST-TEXT': value },
      (_name, record) => adapter.send(node, { path: '/api/pathway/echo' }, record));
    assert.equal(reply.values['REPLY-TEXT'], value.padEnd(40));
    console.log(JSON.stringify({ reply: reply.values['REPLY-TEXT'] }));
  }
  console.log('ESP32 requester/server verification passed');
} finally {
  const status = await adapter.inspect(node);
  if (status.running && status.collectorId === collectorId) {
    await nodeRequest(origin, '/pmachine/service_host/stop', { values: {}, timeoutMs: 10000 });
  }
  for (const suffix of ['service.pcode', 'service.json', 'daemon.pcode', 'daemon.json']) {
    await nodeRequest(origin, '/ffs/delete', {
      values: { file: `/pw-${collectorId}-${suffix}` }, timeoutMs: 10000,
    });
  }
}
