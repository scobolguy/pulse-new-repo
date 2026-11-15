import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { runPcodeOnEsp32 } from '../../aggregator/scripts/run-pascal-on-esp32-node.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { parseCacheQuery } from '../../../../languages/dotnet/cache-query.mjs';

const logger = { log() {}, warn() {}, error() {} };

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  if (!server.listening) return;
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('hosted JS services resolve virtual cache sources through their configured Aggregator', async t => {
  let resolutions = 0;
  let snapshots = 0;
  const source = http.createServer((req, res) => {
    snapshots += 1;
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      version: 1, revision: '7', sequence: 7, sampledAtMs: 100, total: 1,
      records: [{
        key: 'camera-1', device: { id: 'camera-1' }, observationMs: 90,
        observationSequence: 4, remainingTTLms: 500
      }],
      nextCursor: '', collectorId: 'camera-node', bootId: 'boot-1', complete: true, errors: []
    }));
  });
  const sourceUrl = await listen(source);
  const aggregator = http.createServer((req, res) => {
    resolutions += 1;
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      serviceId: 'camera-service', cacheName: 'devices',
      snapshotUrl: `${sourceUrl}/api/hosted/caches/devices/snapshot`, instanceId: 'camera-instance'
    }));
  });
  const aggregatorUrl = await listen(aggregator);
  const node = createJsPmachineNodeServer({ name: 'cache-virtual-node', aggregatorUrl, logger });
  const nodeUrl = await listen(node);
  t.after(async () => {
    await fetch(`${nodeUrl}/pmachine/service_host/stop`, { method: 'POST' }).catch(() => {});
    await close(node);
    await close(aggregator);
    await close(source);
  });

  const fields = [{ name: 'cameraId', type: 'string' }];
  const sourceDefinition = { alias: 'camera', serviceId: 'camera-service', cacheName: 'devices' };
  const compiled = compilePascalishProgramWithAntlr(`service 'virtual-cache-test';
    get '/health'; begin return '{"status":"ok"}' end
    end.`, { hostServices: true });
  compiled.programMap.hostCaches = [{
    name: 'all-cameras', capacity: 50, fields, virtual: true,
    sources: ['camera=camera-service/devices'], sourceDefinitions: [sourceDefinition],
    queryPlan: parseCacheQuery('SELECT cache_key AS cameraId FROM camera', {
      cacheName: 'all-cameras', fields: [], viewFields: fields, virtual: true,
      sources: [sourceDefinition]
    })
  }];
  await runPcodeOnEsp32({
    pcodeText: compiled.pcodeText, programMap: compiled.programMap,
    node: `127.0.0.1:${node.address().port}`, logger
  });

  for (let read = 0; read < 2; read += 1) {
    const response = await fetch(`${nodeUrl}/api/hosted/caches/all-cameras/snapshot`);
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.equal(page.complete, true);
    assert.equal(page.records[0].device.cameraId, 'camera-1');
  }
  assert.equal(resolutions, 2, 'Aggregator resolution is performed afresh for each cache read');
  assert.equal(snapshots, 2);
});
