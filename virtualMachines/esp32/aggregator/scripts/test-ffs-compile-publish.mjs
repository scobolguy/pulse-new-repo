import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFileServer } from '../fileServer.js';
import { NodeRegistry } from '../src/esp32/nodeRegistry.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-ffs-'));
const app = express();
app.use(express.json());
let fileServer;
const nodeRegistry = new NodeRegistry({
  persistPath: path.join(root, 'nodes.json'),
  autoSave: false,
  onNodeRegistered: async (node) => fileServer.ensureNodePublicDirectory(node.id)
});
fileServer = createFileServer({
  ffsConfig: { root },
  nodeRegistry,
  federatedConfig: {
    packageRoot: path.join(root, 'packages'),
    deploymentIndexPath: path.join(root, 'deployments.json')
  }
});
app.use(fileServer.router);
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));

try {
  await Promise.all([
    nodeRegistry.registerNode({ id: 'esp32-pmachine-01', runtime: 'esp32' }),
    nodeRegistry.registerNode({ id: 'js-pmachine-01', runtime: 'javascript' }),
    nodeRegistry.registerNode({ id: 'native-pmachine-01', runtime: 'native' })
  ]);
  const publicDirectories = await fileServer.ensureNodePublicDirectories();
  if (publicDirectories.length !== 3) throw new Error('not every PMachine received a public directory');

  const putResponse = await fetch(`http://127.0.0.1:${server.address().port}/ffs/put`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nodeId: 'js-pmachine-01',
      path: 'nested/pulse-service.pcode',
      data: 'HALT\n'
    })
  });
  const putPayload = await putResponse.json();
  if (!putResponse.ok) throw new Error(JSON.stringify(putPayload));
  if (putPayload.path !== 'nodes/js-pmachine-01/public/nested/pulse-service.pcode') {
    throw new Error(`unexpected node public path: ${putPayload.path}`);
  }

  const source = 'service gui_deploy_smoke on local; begin end.';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ffs/packages/compile-publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'gui-deploy-smoke',
      version: '0.1.0',
      language: 'pascalish',
      runtimeKind: 'service',
      targetNodeId: 'native-pmachine-01',
      artifactName: 'gui-deploy-smoke',
      source,
      metadata: { test: 'compile-publish' }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));

  const packageInfo = payload.package || {};
  if (!packageInfo.pcodePath || !packageInfo.programMapPath) {
    throw new Error('compiled package paths are missing');
  }
  if (packageInfo.manifest?.runtimeKind !== 'service') {
    throw new Error('runtime kind was not preserved');
  }
  if (!packageInfo.manifest?.signing?.signature) {
    throw new Error('signed program map metadata is missing');
  }
  if (payload.nodePublic?.pcodePath !== 'nodes/native-pmachine-01/public/gui-deploy-smoke.pcode') {
    throw new Error('compiler did not publish pcode to the PMachine public directory');
  }

  await Promise.all(nodeRegistry.getAllNodes().map(async ({ id }) => {
    const stat = await fs.stat(path.join(root, 'nodes', id, 'public'));
    if (!stat.isDirectory()) throw new Error(`missing public directory for ${id}`);
  }));

  console.log(JSON.stringify({
    status: 'ok',
    package: {
      name: packageInfo.name,
      version: packageInfo.version,
      pcodePath: packageInfo.pcodePath,
      programMapPath: packageInfo.programMapPath,
      nodePublicPath: payload.nodePublic.publicPath,
      runtimeKind: packageInfo.manifest.runtimeKind,
      signed: true
    }
  }, null, 2));
} finally {
  server.close();
  await fs.rm(root, { recursive: true, force: true });
}
