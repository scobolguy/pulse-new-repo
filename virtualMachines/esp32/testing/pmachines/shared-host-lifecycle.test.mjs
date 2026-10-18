import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

test('shared-listener hosted services report installation metadata and cannot omit intrinsic requirements', async t => {
  const reports = [];
  const collector = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    reports.push(JSON.parse(Buffer.concat(chunks)));
    res.setHeader('content-type', 'application/json');
    res.end('{}');
  });
  collector.listen(0, '127.0.0.1');
  await once(collector, 'listening');
  const machine = createJsPmachineNodeServer({
    name: 'shared-listener-proof', logger: { log() {}, warn() {}, error() {} },
  });
  machine.listen(0, '127.0.0.1');
  await once(machine, 'listening');
  const origin = `http://127.0.0.1:${machine.address().port}`;
  async function post(route, body) {
    const response = await fetch(`${origin}${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, await response.clone().text());
    return response;
  }
  t.after(async () => {
    await post('/pmachine/service_host/stop', {});
    machine.closeAllConnections();
    collector.closeAllConnections();
    await Promise.all([machine, collector].map(server => new Promise(resolve => server.close(resolve))));
  });
  const compiled = compilePascalishProgramWithAntlr(`service 'shared-report-proof';
    requires service 'pulse-needed';
    get '/health'; begin return '{"alive":true}' end
    get '/data'; begin return '{}' end
    end.`, { hostServices: true });
  await post('/ffs/upload', { file: '/proof.pcode', body: compiled.pcodeText });
  await post('/ffs/upload', { file: '/proof.program.json',
    body: JSON.stringify(attachPcodeSignature(compiled.programMap, compiled.pcodeText)) });
  const installed = await (await post('/pmachine/service_host/install', {
    serviceFile: '/proof.pcode', serviceMap: '/proof.program.json',
    collectorId: 'shared-instance', udpPort: '0', instanceId: 'shared-instance',
    ownerAggregatorId: 'test-owner', reportTarget: { endpoint: `http://127.0.0.1:${collector.address().port}` },
    serviceLifecycle: { version: 1, requires: [], bindings: {} },
  })).json();
  assert.deepEqual(installed.serviceLifecycle.requires, ['pulse-needed']);
  const deadline = Date.now() + 3000;
  while (!reports.length) {
    if (Date.now() > deadline) assert.fail('Installed hosted service did not report');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(reports[0].instanceId, 'shared-instance');
  assert.equal(reports[0].nodeId, 'shared-listener-proof');
  assert.equal(reports[0].ownerAggregatorId, 'test-owner');
  assert.equal(reports[0].listeners[0].port, machine.address().port);
  assert.equal((await fetch(`${origin}/ready`)).status, 503);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  assert.equal((await fetch(`${origin}/data`)).status, 503);
});
