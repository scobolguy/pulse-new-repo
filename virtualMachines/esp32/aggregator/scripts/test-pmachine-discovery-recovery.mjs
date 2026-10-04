import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';

test('deployment lookup recovers an announced board with an empty capability cache', async () => {
  const originalFetch = globalThis.fetch;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-target-recovery-'));
  const now = Date.now();
  const ip = '192.0.2.115';
  const discoveredNodes = new Map([[ip, {
    ip, nodeId: 'test-esp32', nodeName: 'test-esp32', lastSeen: now,
    beacon: { kind: 'nodeBeacon', seenAt: now },
    details: { hardware: 'ESP32', services: [] }
  }]]);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(`http://${ip}:80/`)) {
      requests.push(String(url));
      if (String(url).endsWith('/services/describe')) throw new Error('description unavailable');
      return new Response(JSON.stringify({ nodeName: 'test-esp32', services: ['pmachine', 'FFS'] }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    return originalFetch(url, options);
  };
  const app = express();
  registerTopologyRuntimeRoutes(app, {
    discoveredNodes, services: {}, serviceInstanceRegistry: new Map(),
    ffsDeploymentRegistry: new Map(),
    jsPmachineDeploymentSupervisor: { restore: async () => [], list: () => [] },
    deploymentIndexPath: path.join(directory, 'deployments.json')
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/pmachine/nodes`;
    const response = await originalFetch(url);
    assert.equal(response.status, 200);
    const targets = await response.json();
    assert.ok(targets.some((node) => node.ip === ip && node.details.services.some((service) =>
      (typeof service === 'string' ? service : service.name) === 'pmachine')));
    assert.deepEqual(discoveredNodes.get(ip).details.services, ['pmachine', 'FFS']);
    assert.equal(requests.length, 2);
    await originalFetch(url);
    assert.equal(requests.length, 2, 'Known capabilities should not be fetched again on every picker open');
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
