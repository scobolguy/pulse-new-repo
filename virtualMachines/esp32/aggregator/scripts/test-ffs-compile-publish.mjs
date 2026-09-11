import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFileServer } from '../fileServer.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-ffs-'));
const app = express();
app.use(express.json());
const fileServer = createFileServer({
  ffsConfig: { root },
  federatedConfig: {
    packageRoot: path.join(root, 'packages'),
    deploymentIndexPath: path.join(root, 'deployments.json')
  }
});
app.use(fileServer.router);
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));

try {
  const source = 'service gui_deploy_smoke on local; begin end.';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ffs/packages/compile-publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'gui-deploy-smoke',
      version: '0.1.0',
      language: 'pascalish',
      runtimeKind: 'service',
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

  console.log(JSON.stringify({
    status: 'ok',
    package: {
      name: packageInfo.name,
      version: packageInfo.version,
      pcodePath: packageInfo.pcodePath,
      programMapPath: packageInfo.programMapPath,
      runtimeKind: packageInfo.manifest.runtimeKind,
      signed: true
    }
  }, null, 2));
} finally {
  server.close();
  await fs.rm(root, { recursive: true, force: true });
}
