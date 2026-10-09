import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import dgram from 'node:dgram';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createDiscoveryProvider } from '../src/backend/modules/discoveryProvider.mjs';
import { createDiscoverySnapshotSource, registerNodeAnnouncementRoute } from '../src/backend/modules/discoveryCollector.mjs';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';
import { NodeRegistry } from '../src/esp32/nodeRegistry.mjs';
import { registerFlowDeploymentRoutes } from '../src/backend/flowDeploymentRoutes.mjs';
import { getEnvironment, getInfrastructureCatalog, getServiceHealthUrl } from '../src/backend/modules/serviceRegistry.mjs';

test('default service registry keeps Librarian and Discovery on distinct, consistent ports', () => {
  const { ports } = getEnvironment('default');
  assert.equal(ports.librarian, 4300);
  assert.equal(ports.discovery, 4301);
  assert.equal(new Set(Object.values(ports)).size, Object.keys(ports).length);
  const catalog = getInfrastructureCatalog();
  for (const key of ['librarian', 'discovery']) {
    const offering = catalog.serviceOfferings.find(entry => entry.id === `service.${key}`);
    assert.equal(offering.endpoint, `http://127.0.0.1:${ports[key]}`);
    assert.equal(getServiceHealthUrl(key, 'default'), `${offering.endpoint}/health`);
  }
});

const logger = { log() {}, warn() {}, error() {} };
async function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const close = (server) => new Promise((resolve) => server.close(resolve));

test('remote Aggregator forwards announcements and uses collector snapshots without device probes', async () => {
  const collectorNodes = new Map();
  const collector = express();
  collector.use(express.json());
  const snapshot = createDiscoverySnapshotSource({ discoveredNodes: collectorNodes, collectorId: 'pc-collector' });
  collector.get('/api/discovery/snapshot', (req, res) => res.json(snapshot()));
  registerNodeAnnouncementRoute(collector, { discoveredNodes: collectorNodes, logger });
  const collectorServer = await listen(collector);
  const collectorUrl = `http://127.0.0.1:${collectorServer.address().port}`;
  const discoveredNodes = new Map();
  const requests = [];
  const provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: [collectorUrl], timeoutMs: 2000, pollIntervalMs: 60000 },
    discoveredNodes, logger,
    fetchImpl: async (url, options) => {
      requests.push(String(url));
      assert.ok(String(url).startsWith(collectorUrl), 'Remote mode must never probe a device');
      return fetch(url, options);
    },
    createLocalRuntime: () => { throw new Error('Local discovery must not start'); }
  });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-discovery-split-'));
  const app = express();
  app.use(express.json());
  app.locals.discoveryProvider = provider;
  registerTopologyRuntimeRoutes(app, {
    discoveredNodes, services: {}, serviceInstanceRegistry: new Map(), upsertServiceInstance() {},
    ffsDeploymentRegistry: new Map(),
    jsPmachineDeploymentSupervisor: { restore: async () => [], list: () => [] },
    deploymentIndexPath: path.join(directory, 'deployments.json')
  });
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  try {
    await provider.start();
    const response = await fetch(`${base}/api/pmachine/announce`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId: 'board', ip: '192.0.2.25', port: 8080, services: ['pmachine'] })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).delivery.degraded, false);
    assert.equal(collectorNodes.size, 1);
    assert.equal(discoveredNodes.size, 0, 'An announcement is not a replacement for a collector snapshot');
    await provider.refresh();
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).startsWith(base) || String(url).startsWith(collectorUrl), 'Target selection must not probe nodes in remote mode');
      return originalFetch(url, options);
    };
    const targets = await (await fetch(`${base}/api/pmachine/nodes`)).json();
    assert.deepEqual(targets.map((node) => node.nodeId), ['board']);
    assert.equal(targets[0].port, 8080);
    assert.equal((await (await fetch(`${base}/api/discovery/status`)).json()).mode, 'remote');
    collectorNodes.clear();
    await provider.refresh();
    assert.deepEqual(await (await fetch(`${base}/api/nodes`)).json(), []);
    assert.deepEqual(await (await fetch(`${base}/api/pmachine/nodes`)).json(), []);
    assert.ok(requests.some((url) => url.endsWith('/api/discovery/snapshot')));
  } finally {
    globalThis.fetch = originalFetch;
    await provider.stop();
    await close(server);
    await close(collectorServer);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('saved inventory and startup seeds are not fresh announcements', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-inventory-'));
  const persistPath = path.join(directory, 'nodes.json');
  const oldSeenAt = Date.now() - 180001;
  await fs.writeFile(persistPath, JSON.stringify({ nodes: [{ id: 'saved', ip: '192.0.2.10', lastSeen: oldSeenAt }] }));
  const registry = new NodeRegistry({ persistPath, autoSave: false });
  try {
    await registry.initialize();
    assert.equal(registry.getNode('saved').lastSeen, oldSeenAt);
    await registry.registerNode({ id: 'configured', ip: '192.0.2.11', observed: false });
    assert.equal(registry.getNode('configured').lastSeen, 0);
    assert.deepEqual(await registry.cleanupStaleNodes(), ['saved']);
    assert.ok(registry.getNode('configured'), 'Configured inventory should not be deleted as expired presence');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('remote flow placement uses live collector nodes, not configured inventory', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-placement-split-'));
  const app = express();
  app.use(express.json());
  let live = [{
    nodeId: 'live-board', ip: '192.0.2.25', port: 8080, available: true,
    details: { services: ['pmachine'] }
  }];
  app.locals.discoveryProvider = { mode: 'remote', getNodes: () => live };
  app.locals.esp32NodeRegistry = {
    getAllNodes: () => [{ id: 'inventory-only', ip: '192.0.2.99' }]
  };
  registerFlowDeploymentRoutes(app, { runtimeRoot: directory });
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  const uploads = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(base)) return originalFetch(url, options);
    uploads.push(String(url));
    assert.ok(String(url).startsWith('http://192.0.2.25:8080/'));
    return new Response('uploaded');
  };
  try {
    const body = {
      flowName: 'split-placement', version: '1', type: 'compute',
      bundle: Buffer.from('PUSH_INT 1\nPRINT\n').toString('base64')
    };
    const response = await fetch(`${base}/api/deployment/flow`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(response.status, 201, await response.clone().text());
    assert.equal((await response.json()).deployment.targetNodeId, 'live-board');
    assert.equal(uploads.length, 2);
    live = [];
    const unavailable = await fetch(`${base}/api/deployment/flow`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, version: '2', placement: { node: 'inventory-only' } })
    });
    assert.equal(unavailable.status, 404);
    assert.equal(uploads.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await close(server);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('standalone PC collector implements snapshot and announcement contracts', { timeout: 20000 }, async () => {
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await close(reservation);
  const udp = dgram.createSocket('udp4');
  await new Promise((resolve) => udp.bind(0, '127.0.0.1', resolve));
  const udpPort = udp.address().port;
  await new Promise((resolve) => udp.close(resolve));
  const aggregatorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn(process.execPath, ['discovery-service.mjs'], {
    cwd: aggregatorRoot,
    env: {
      ...process.env,
      DISCOVERY_HTTP_PORT: String(port), UDP_PORT: String(udpPort),
      PULSE_DISCOVERY_COLLECTOR_ID: 'test-standalone-collector',
      ESP32_DISCOVERY_PROBE_ENABLED: '0',
      ESP32_DISCOVERY_PROBE_TIMEOUT_MS: '300'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (data) => { output = `${output}${data}`.slice(-4000); });
  child.stderr.on('data', (data) => { output = `${output}${data}`.slice(-4000); });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const base = `http://127.0.0.1:${port}`;
  const provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: [base], timeoutMs: 2000, pollIntervalMs: 60000 },
    discoveredNodes: new Map(), logger
  });
  try {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline && child.exitCode === null) {
      try {
        const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) });
        if (response.ok) { await response.json(); ready = true; break; }
      } catch (error) {
        if (child.exitCode !== null) throw new Error(`Collector exited before startup: ${error.message}\n${output}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(ready, true, output);
    const initial = await (await fetch(`${base}/api/discovery/snapshot`)).json();
    assert.equal(initial.protocolVersion, 1);
    assert.equal(initial.collectorId, 'test-standalone-collector');
    await provider.start();
    await provider.announce({
      nodeId: 'split-proof-node', ip: '192.0.2.25', port: 8080,
      runtime: 'js-pmachine', services: ['pmachine']
    });
    await provider.refresh();
    assert.ok(provider.getNodes().some((node) => node.nodeId === 'split-proof-node' && node.port === 8080));
    assert.equal(provider.getStatus().status, 'healthy');
  } finally {
    await provider.stop();
    if (child.exitCode === null) child.kill();
    await exited;
  }
});
