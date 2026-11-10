import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { PMachineScheduler } from '../../pmachines/javascript/index.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { loadRuntimeMachineAuth } from '../src/backend/security/runtimeMachineAuth.mjs';
import { SwarmResourceRegistry } from '../src/backend/swarmResourceRegistry.mjs';
import { registerSwarmResourceRoutes } from '../src/backend/roles/swarmResourceRoutes.mjs';
import {
  collectJsPmachineResources, createSwarmResourceReporter,
} from '../src/backend/swarmResourceReporter.mjs';

function stop(server) {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

test('JavaScript PMachine reports measured scheduler capacity through its own scoped identity', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-js-agent-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const token = randomBytes(32).toString('hex');
  const nodeId = '127.0.0.1';
  const ownerAggregatorId = 'aggregator-a';
  const codeId = createHash('sha256').update('verified-test-bundle').digest('hex');
  const credentialsPath = path.join(directory, 'credentials.json');
  await fs.writeFile(credentialsPath, JSON.stringify({
    version: 1,
    credentials: [{
      tokenSha256: createHash('sha256').update(token).digest('hex'),
      nodeId, serviceId: 'js-pmachine', ownerAggregatorId, resourceReports: true,
      childRequests: [{ serviceId: 'child', method: 'POST', path: '/run' }],
    }],
  }));
  const auth = await loadRuntimeMachineAuth({
    filePath: credentialsPath, required: true, ownerAggregatorId, logger: { info() {} },
  });
  const resources = new SwarmResourceRegistry({ clusterId: 'swarm-a' });
  resources.enroll({ nodeId, capabilities: ['pmachine'] });
  resources.verifyBundle(nodeId, codeId);
  const app = express();
  app.use(express.json({ limit: '4kb' }));
  registerSwarmResourceRoutes(app, { resources, machineAuth: auth });
  const aggregator = app.listen(0, nodeId);
  const runtime = createJsPmachineNodeServer({
    name: 'local-js-worker', scheduler: new PMachineScheduler({ slots: 2 }),
  });
  t.after(() => Promise.all([stop(aggregator), stop(runtime)]));
  await Promise.all([once(aggregator, 'listening'), new Promise(resolve => runtime.listen(0, nodeId, resolve))]);

  const measured = await collectJsPmachineResources(`http://${nodeId}:${runtime.address().port}`);
  assert.equal(measured.nodeName, 'local-js-worker');
  assert.equal(measured.status, 'online');
  assert.equal(measured.estimatedFreeSlots, 2);
  assert.ok(measured.freeMemoryBytes > 0 && measured.freeMemoryBytes <= 1024 * 1024 * 1024);
  const reporter = createSwarmResourceReporter({
    endpoint: `http://${nodeId}:${aggregator.address().port}/api/swarm/resources/report`,
    nodeId, serviceId: 'js-pmachine', ownerAggregatorId, token,
    collect: () => collectJsPmachineResources(`http://${nodeId}:${runtime.address().port}`),
  });
  assert.deepEqual(await reporter.reportOnce(1), { sequence: 1, status: 'online' });
  assert.deepEqual(resources.candidates()[0].codeIds, [codeId]);
  assert.equal(resources.candidates()[0].estimatedFreeSlots, 2);
  assert.equal(resources.candidates()[0].freeMemoryBytes, measured.freeMemoryBytes);
});

test('JavaScript PMachine without configured shared scheduler is explicitly non-admissible', async t => {
  const runtime = createJsPmachineNodeServer({ name: 'unmanaged-js-worker' });
  t.after(() => stop(runtime));
  await new Promise(resolve => runtime.listen(0, '127.0.0.1', resolve));
  const measured = await collectJsPmachineResources(`http://127.0.0.1:${runtime.address().port}`);
  assert.equal(measured.status, 'degraded');
  assert.equal(measured.estimatedFreeSlots, 0);
  assert.ok(measured.freeMemoryBytes >= 0);
});
