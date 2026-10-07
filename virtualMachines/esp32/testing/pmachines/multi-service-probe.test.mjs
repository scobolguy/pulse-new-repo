import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const compile = async name => compilePascalishProgramWithAntlr(
  await fs.readFile(new URL(`./fixtures/${name}.pas`, import.meta.url), 'utf8'), { hostServices: true });
const compiled = await compile('second-service-probe');
const daemon = await compile('second-service-daemon');

test('second-service fixture has bounded signed-image metadata and exact endpoint declarations', () => {
  const metadata = compactServiceHostProgramMap(compiled.programMap);
  assert.deepEqual(metadata.serviceEndpoints, [
    { verb: 'GET', path: '/api/service-probe/state' },
    { verb: 'POST', path: '/api/service-probe/put' },
    { verb: 'GET', path: '/api/service-probe/blocked' },
    { verb: 'GET', path: '/api/service-probe/slow' },
    { verb: 'POST', path: '/events/udp' }
  ]);
  for (const unit of [compiled, daemon]) {
    const image = encodeHostedImage(unit.pcodeText);
    assert.ok(Number.parseInt(image.slice(4, 12), 16) <= 512);
  }
});

test('second-service probe preserves identity, isolated state and explicit denied-network errors', async t => {
  const hosts = await Promise.all(['first', 'second'].map(collectorId => createPascalishServiceHost({
    compiled, daemons: [daemon], collectorId, httpPort: null, udpPort: 0,
    bindings: { 'host.observation_ttl': () => 180000 },
    logger: { warn() {}, error() {} }
  })));
  for (const host of hosts) await host.start();
  t.after(async () => { for (const host of hosts) await host.stop(); });
  const dispatch = (host, method, path, body = '') => host.dispatch({ method, path, body, query: {} });
  const first = await dispatch(hosts[0], 'POST', '/api/service-probe/put', '{"marker":"first-only"}');
  const second = await dispatch(hosts[1], 'GET', '/api/service-probe/state');
  assert.equal(first.body.collectorId, 'first');
  assert.equal(second.body.collectorId, 'second');
  assert.notEqual(first.body.bootId, second.body.bootId);
  assert.ok(!second.body.devices.nodes.some(node => node.marker === 'first-only'));
  const state = await dispatch(hosts[0], 'GET', '/api/service-probe/state');
  assert.ok(state.body.devices.nodes.some(node => node.marker === 'first-only'));
  assert.equal(state.body.sequence, first.body.sequence + 1);
  await assert.rejects(dispatch(hosts[1], 'GET', '/api/service-probe/blocked'), /Network peer is not allowed/);
});
