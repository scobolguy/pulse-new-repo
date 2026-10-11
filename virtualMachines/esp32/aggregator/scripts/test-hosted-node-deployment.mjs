import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-hosted-node-deploy-'));
const priorBoardPort = process.env.PULSE_ESP32_HTTP_PORT;
const now = Date.now();
const boardCalls = [];
let boardServer;
let apiServer;

try {
  const boardApp = express();
  boardApp.use(express.urlencoded({ extended: false }));
  boardApp.get('/pmachine/service_host/status', (_req, res) => {
    boardCalls.push({ method: 'GET', path: '/pmachine/service_host/status' });
    res.status(404).type('text/plain').send('Hosted service not found');
  });
  boardApp.post('/ffs/mkdir', (req, res) => {
    boardCalls.push({ method: 'POST', path: '/ffs/mkdir', body: req.body });
    res.status(200).send('ok');
  });
  boardApp.post('/ffs/upload', (req, res) => {
    boardCalls.push({ method: 'POST', path: '/ffs/upload', body: req.body });
    res.status(200).send('ok');
  });
  boardApp.post('/pmachine/service_host/install', (req, res) => {
    boardCalls.push({ method: 'POST', path: '/pmachine/service_host/install', body: req.body });
    res.json({ running: true, hostBindingsVersion: 1 });
  });
  boardServer = await new Promise(resolve => {
    const server = boardApp.listen(0, '127.0.0.1', () => resolve(server));
  });
  process.env.PULSE_ESP32_HTTP_PORT = String(boardServer.address().port);

  const discoveredNodes = new Map([['mapper-node', {
    ip: '127.0.0.1',
    nodeId: 'mapper-node',
    nodeName: 'mapper-node',
    lastSeen: now,
    beacon: { kind: 'nodeBeacon', seenAt: now },
    details: { hardware: 'ESP32', services: [{ name: 'pmachine' }] }
  }]]);
  const app = express();
  app.use(express.json());
  registerTopologyRuntimeRoutes(app, {
    discoveredNodes,
    services: {},
    serviceInstanceRegistry: new Map(),
    ffsDeploymentRegistry: new Map(),
    jsPmachineDeploymentSupervisor: { restore: async () => [], list: () => [] },
    deploymentIndexPath: path.join(tempDir, 'deployments.json')
  });
  apiServer = await new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

  const response = await fetch(`http://127.0.0.1:${apiServer.address().port}/api/nodes/mapper-node/deploy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      serviceName: 'data-mapper',
      packageName: 'data-mapper-udp',
      files: [
        { path: '/pmachine/programs/mapper-service.pcode', content: 'HALT\n' },
        { path: '/pmachine/programs/mapper-service.program.json', content: '{"runtimeUnit":{"kind":"service"}}' },
        { path: '/pmachine/programs/mapper-daemon.pcode', content: 'HALT\n' },
        { path: '/pmachine/programs/mapper-daemon.program.json', content: '{"runtimeUnit":{"kind":"daemon"}}' }
      ],
      hostedServiceInstall: {
        serviceFile: '/pmachine/programs/mapper-service.pcode',
        serviceMap: '/pmachine/programs/mapper-service.program.json',
        collectorId: 'data-mapper-udp',
        daemons: [{
          file: '/pmachine/programs/mapper-daemon.pcode',
          map: '/pmachine/programs/mapper-daemon.program.json',
          udpPort: 4211
        }]
      }
    })
  });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.equal(result.hostedInstallation.running, true);
  assert.equal(result.uploads.length, 4);
  assert.equal(boardCalls[0].path, '/pmachine/service_host/status', 'runtime is probed before files are uploaded');
  const installCall = boardCalls.find(call => call.path === '/pmachine/service_host/install');
  assert.ok(installCall);
  assert.equal(installCall.body.udpPort, '0');
  assert.equal(JSON.parse(installCall.body.daemons)[0].udpPort, 4211);

  boardCalls.length = 0;
  discoveredNodes.get('mapper-node').beacon.seenAt = Date.now() - 4 * 60 * 1000;
  const staleResponse = await fetch(`http://127.0.0.1:${apiServer.address().port}/api/nodes/mapper-node/deploy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hostedServiceInstall: {
        serviceFile: '/pmachine/programs/mapper-service.pcode',
        serviceMap: '/pmachine/programs/mapper-service.program.json',
        collectorId: 'data-mapper-udp',
        daemons: [{ file: '/pmachine/programs/mapper-daemon.pcode', map: '/pmachine/programs/mapper-daemon.program.json', udpPort: 4211 }]
      }
    })
  });
  assert.equal(staleResponse.status, 404);
  assert.equal(boardCalls.length, 0, 'stale targets are rejected before any board request');
  console.log('[hosted-node-deployment] PASS: live target preflight, artifact upload, hosted install, stale-target rejection');
} finally {
  if (apiServer) await new Promise(resolve => apiServer.close(resolve));
  if (boardServer) await new Promise(resolve => boardServer.close(resolve));
  if (priorBoardPort === undefined) delete process.env.PULSE_ESP32_HTTP_PORT;
  else process.env.PULSE_ESP32_HTTP_PORT = priorBoardPort;
  await fs.rm(tempDir, { recursive: true, force: true });
}
