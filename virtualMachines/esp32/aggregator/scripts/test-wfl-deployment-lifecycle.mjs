import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { executeDeploymentPlan } from './interpret-workflow.mjs';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-wfl-deployment-'));
const deploymentIndexPath = path.join(tempDir, 'deployments.json');
const pcodePath = path.join(tempDir, 'sample.pcode');
const programMapPath = path.join(tempDir, 'sample.program.json');
await fs.writeFile(pcodePath, 'HALT\n', 'utf8');
await fs.writeFile(programMapPath, JSON.stringify({ entries: [] }), 'utf8');
const deploymentRegistry = new Map();
const serviceInstanceRegistry = new Map();
const supervisorCalls = { starts: [], stops: [], restores: 0 };
const supervisor = {
  async start(deployment) {
    supervisorCalls.starts.push(deployment.key);
    return { state: 'running' };
  },
  async stop(deployment) {
    supervisorCalls.stops.push({ key: deployment.key, targetNodeId: arguments[1]?.targetNodeId || null });
    return { state: 'stopped' };
  },
  async restore() {
    supervisorCalls.restores += 1;
  },
  list() {
    return [];
  }
};

const app = express();
app.use(express.json());
app.get('/api/nodes', (_req, res) => res.json([{ nodeId: 'node-a' }, { nodeId: 'node-b' }]));
registerTopologyRuntimeRoutes(app, {
  discoveredNodes: [],
  services: {},
  serviceInstanceRegistry,
  ffsDeploymentRegistry: deploymentRegistry,
  jsPmachineDeploymentSupervisor: supervisor,
  deploymentIndexPath
});

const server = await new Promise((resolve) => {
  const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
});
const serviceBaseUrl = `http://127.0.0.1:${server.address().port}`;

try {
  const deploySource = [
    'DEPLOYMENT "payments" PROJECT "payments-project" TARGETS ("node-a", "node-b") BEGIN',
    'SERVICE "sample-service" FILE "sample.pcode" QUEUE "sample.in" -> "sample.out" TARGETS ("node-a", "node-b") STARTUP TRUE;',
    'END;'
  ].join('\n');
  const deployPlan = compileWorkflowDSLWithAntlr(deploySource);
  const deployed = await executeDeploymentPlan(deployPlan, false, { serviceBaseUrl, artifactRoot: tempDir });
  assert.equal(deployed.deployments.length, 1);
  assert.equal(deploymentRegistry.size, 1);
  assert.deepEqual(Array.from(deploymentRegistry.values())[0].targetNodeIds, ['node-a', 'node-b']);
  assert.equal(serviceInstanceRegistry.size, 2);
  assert.equal(supervisorCalls.starts.length, 1);

  const removeNodeA = compileWorkflowDSLWithAntlr([
    'DEPLOYMENT "payments" PROJECT "payments-project" TARGETS ("node-a", "node-b") BEGIN',
    'REMOVE SERVICE "sample-service" FROM TARGETS ("node-a");',
    'END;'
  ].join('\n'));
  assert.equal(removeNodeA.deployments[0].resources[0].action, 'remove');
  const dryRun = await executeDeploymentPlan(removeNodeA, true, { serviceBaseUrl });
  assert.equal(dryRun.removals.length, 1);
  assert.equal(dryRun.removals[0].request.targetNodeId, 'node-a');
  assert.equal(deploymentRegistry.size, 1);

  const removedA = await executeDeploymentPlan(removeNodeA, false, { serviceBaseUrl });
  assert.equal(removedA.removals[0].action, 'removed-from-target');
  assert.deepEqual(Array.from(deploymentRegistry.values())[0].targetNodeIds, ['node-b']);
  assert.deepEqual(Array.from(serviceInstanceRegistry.values()).map((instance) => instance.nodeId), ['node-b']);
  assert.deepEqual(supervisorCalls.stops, [{ key: 'sample-service::node-a', targetNodeId: 'node-a' }]);
  const nodeAManifest = JSON.parse(await fs.readFile(path.join(tempDir, 'startup-manifests', 'node-a.json'), 'utf8'));
  const nodeBManifest = JSON.parse(await fs.readFile(path.join(tempDir, 'startup-manifests', 'node-b.json'), 'utf8'));
  assert.equal(nodeAManifest.deployments.length, 0);
  assert.equal(nodeBManifest.deployments.length, 1);

  const removeNodeB = compileWorkflowDSLWithAntlr([
    'DEPLOYMENT "payments" PROJECT "payments-project" TARGETS ("node-a", "node-b") BEGIN',
    'REMOVE SERVICE "sample-service" FROM TARGETS ("node-b");',
    'END;'
  ].join('\n'));
  const removedB = await executeDeploymentPlan(removeNodeB, false, { serviceBaseUrl });
  assert.equal(removedB.removals[0].action, 'removed-from-target');
  assert.equal(deploymentRegistry.size, 0);
  assert.equal(serviceInstanceRegistry.size, 0);
  assert.deepEqual(supervisorCalls.stops, [
    { key: 'sample-service::node-a', targetNodeId: 'node-a' },
    { key: 'sample-service::node-a', targetNodeId: null }
  ]);
  const finalNodeBManifest = JSON.parse(await fs.readFile(path.join(tempDir, 'startup-manifests', 'node-b.json'), 'utf8'));
  assert.equal(finalNodeBManifest.deployments.length, 0);

  const persisted = JSON.parse(await fs.readFile(deploymentIndexPath, 'utf8'));
  assert.deepEqual(persisted.deployments, []);
  console.log('[wfl-deployment-lifecycle] PASS: deploy, dry-run, target removal, final cleanup');
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  supervisor.shutdown?.();
  await fs.rm(tempDir, { recursive: true, force: true });
}
