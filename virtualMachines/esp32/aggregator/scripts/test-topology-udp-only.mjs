import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-topology-udp-'));
const now = Date.now();
const discoveredNodes = new Map([
  ['192.0.2.10', {
    ip: '192.0.2.10',
    nodeId: 'udp-real-device',
    nodeName: 'udp-real-device',
    lastSeen: now,
    beacon: { kind: 'nodeBeacon', seenAt: now },
    details: { hardware: 'ESP32', services: ['pmachine'] }
  }],
  ['192.0.2.11', {
    ip: '192.0.2.11',
    nodeId: 'probe-only-device',
    nodeName: 'probe-only-device',
    lastSeen: now,
    raw: 'active-probe',
    details: { hardware: 'ESP32', services: ['pmachine'] }
  }],
  ['192.0.2.12', {
    ip: '192.0.2.12',
    nodeId: 'stale-device',
    nodeName: 'stale-device',
    lastSeen: now,
    beacon: { kind: 'machineAvailability', seenAt: now - 11 * 60 * 1000 },
    details: { hardware: 'ESP32', services: [{ name: 'pmachine' }] }
  }]
]);
const app = express();
registerTopologyRuntimeRoutes(app, {
  discoveredNodes,
  homeAutomationService: {
    getTopologyNodes: () => [
      { nodeId: 'home-automation', details: { deviceRole: 'home-automation' } },
      { nodeId: 'actually-discovered-switch', details: { deviceRole: 'home-automation-device' } }
    ]
  },
  services: {},
  serviceInstanceRegistry: new Map(),
  ffsDeploymentRegistry: new Map(),
  jsPmachineDeploymentSupervisor: { restore: async () => [], list: () => [] },
  deploymentIndexPath: path.join(tempDir, 'deployments.json')
});
const server = await new Promise((resolve) => {
  const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
});

try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/nodes`);
  assert.equal(response.status, 200);
  const nodes = await response.json();
  assert.deepEqual(nodes.map((node) => node.nodeId).sort(), ['actually-discovered-switch', 'udp-real-device']);
  assert.equal(nodes.some((node) => ['child1', 'child2', 'child3', 'Neptune'].includes(node.nodeId)), false);
  const targetsResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/pmachine/nodes`);
  assert.equal(targetsResponse.status, 200);
  const targets = await targetsResponse.json();
  assert.deepEqual(targets.map((node) => node.nodeId), ['udp-real-device']);
  assert.equal(targets[0].ip, '192.0.2.10');
  discoveredNodes.get('192.0.2.10').details.services = [{ name: 'pmachine' }];
  const objectTargetsResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/pmachine/nodes`);
  assert.equal(objectTargetsResponse.status, 200);
  assert.deepEqual((await objectTargetsResponse.json()).map((node) => node.nodeId), ['udp-real-device']);
  console.log('[topology-udp-only] PASS: topology contains only recent UDP-announced devices');
  console.log('[pmachine-targets] PASS: recent string/object PMachine services are deployable; stale and probe-only nodes are excluded');
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(tempDir, { recursive: true, force: true });
}
