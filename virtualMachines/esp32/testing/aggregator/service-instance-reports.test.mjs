import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceInstanceReports } from '../../aggregator/src/backend/modules/serviceInstanceReports.mjs';

test('Pascalish registry enforces freshness, incarnations, identity and expiry', async t => {
  let timestamp = Date.now();
  const registry = new Map();
  const reports = await createServiceInstanceReports({
    registry, now: () => timestamp, logger: { log() {}, warn() {}, error() {} },
  });
  t.after(() => reports.stop());
  const report = {
    version: 1, serviceId: 'pulse-filesystem', instanceId: 'fs-1',
    nodeId: 'node-1', bootId: 'boot-1', sequence: 1, ownerAggregatorId: 'a',
    endpoint: 'http://192.168.2.90', dependencies: {}, ttlMs: 30000,
    readiness: { ready: true, blockedBy: [] },
    listeners: [{ protocol: 'http', host: '192.168.2.90', port: 54321 }],
  };
  registry.set('fs-1', { instanceId: 'fs-1', serviceName: 'pulse-filesystem', status: 'registered', port: 80 });
  assert.equal((await reports.report(report)).status, 'up');
  assert.equal(registry.get('fs-1').port, 54321);
  await assert.rejects(reports.report({ ...report, sequence: 2, listeners: undefined }), /listeners/);
  await assert.rejects(reports.report(report), /Stale/);
  await assert.rejects(reports.report({ ...report, sequence: 2, nodeId: 'node-2' }), /conflict/);
  await reports.report({ ...report, bootId: 'boot-2' });
  await assert.rejects(reports.report({ ...report, sequence: 3 }), /Retired/);
  timestamp += 30000;
  await reports.expire();
  assert.equal(registry.get('fs-1').reporting, 'stale');
  assert.equal(registry.get('fs-1').readiness.ready, false);
  assert.equal(registry.get('fs-1').status, 'down');
});
