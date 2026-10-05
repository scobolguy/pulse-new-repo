import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';

test('HTTP announcements retain same-IP nodes and expire from topology and targets after three minutes', async (t) => {
  for (const key of ['JS_PMACHINE_BASE_URLS', 'SERVICE_EDGE_BASE_URLS', 'SERVICE_EDGE_BASE_URL']) {
    const previous = process.env[key];
    process.env[key] = '';
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-node-expiry-'));
  const discoveredNodes = new Map();
  const app = express();
  app.use(express.json());
  registerTopologyRuntimeRoutes(app, {
    discoveredNodes, services: {}, serviceInstanceRegistry: new Map(),
    upsertServiceInstance() {},
    ffsDeploymentRegistry: new Map(),
    jsPmachineDeploymentSupervisor: { restore: async () => [], list: () => [] },
    deploymentIndexPath: path.join(directory, 'deployments.json')
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function announce(name, port) {
    const response = await fetch(`${base}/api/pmachine/announce`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nodeId: name, nodeName: name, ip: '127.0.0.1', port,
        runtime: 'js-pmachine', services: [{ name: 'pmachine' }]
      })
    });
    assert.equal(response.status, 200);
    await response.json();
  }
  async function list(endpoint) {
    const response = await fetch(`${base}${endpoint}`);
    assert.equal(response.status, 200);
    return response.json();
  }
  try {
    await announce('js-01', 4111);
    await announce('js-02', 4112);
    assert.equal(discoveredNodes.size, 2);
    assert.deepEqual((await list('/api/pmachine/nodes')).map((node) => node.nodeId).sort(), ['js-01', 'js-02']);
    now += 179_999;
    assert.equal((await list('/api/nodes')).length, 2);
    await announce('js-02', 4112);
    now += 1;
    assert.deepEqual((await list('/api/pmachine/nodes')).map((node) => node.nodeId), ['js-02']);
    assert.deepEqual((await list('/api/nodes')).map((node) => node.nodeId), ['js-02']);
    assert.equal(discoveredNodes.has('127.0.0.1:4111'), false);
    await announce('js-01', 4111);
    assert.equal((await list('/api/nodes')).length, 2);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
