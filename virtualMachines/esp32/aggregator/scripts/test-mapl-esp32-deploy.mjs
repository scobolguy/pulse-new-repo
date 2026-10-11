import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-mapl-esp32-deploy-'));
const aggregatorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deploymentRequests = [];
const deploymentApp = express();
deploymentApp.use(express.json());
deploymentApp.post('/api/nodes/:nodeId/deploy', (req, res) => {
  deploymentRequests.push({ nodeId: req.params.nodeId, body: req.body });
  res.status(201).json({ status: 'ok', target: { nodeId: req.params.nodeId } });
});

const deploymentServer = deploymentApp.listen(0);
await new Promise(resolve => deploymentServer.once('listening', resolve));
const priorBackendUrl = process.env.PULSE_BACKEND_URL;
process.env.PULSE_BACKEND_URL = `http://127.0.0.1:${deploymentServer.address().port}`;
process.env.PULSE_RUNTIME_DATA_ROOT = runtimeRoot;
process.env.PULSE_PROGRAM_SOURCE_ROOT = path.join(runtimeRoot, 'src');
process.env.PULSE_PROGRAM_OBJECT_ROOT = path.join(runtimeRoot, 'object');
process.env.PULSE_MAP_EXPORT_ROOT = path.join(runtimeRoot, 'maps');

let server;
try {
  const { registerMapperRoutes } = await import(`../src/backend/mapperRoutes.mjs?deploy-test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  registerMapperRoutes(app);
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/mapper/authoring/deploy-esp32`;
  const mapl = `map Esp32Smoke from Input to Output;
    target.id := source.id;
    target.name := upper(source.name);
  end;`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nodeId: 'live-esp32-node',
      mapl,
      smokeTest: {
        inputQueue: 'mapper.smoke.in',
        message: JSON.stringify({ id: 'sample-1', name: 'pulse node' })
      }
    })
  });
  assert.equal(response.status, 201, await response.clone().text());
  const result = await response.json();
  assert.equal(result.nodeId, 'live-esp32-node');
  assert.equal(result.mapId, 'Esp32Smoke');
  assert.deepEqual(result.compatibility, [{
    mapId: 'Esp32Smoke',
    executableItems: 2,
    irOnly: []
  }]);

  assert.equal(deploymentRequests.length, 1);
  const deployed = deploymentRequests[0];
  assert.equal(deployed.nodeId, 'live-esp32-node');
  assert.equal(deployed.body.files.length, 2);
  assert.match(deployed.body.files[0].content, /OP_MAP SRC, "Esp32Smoke", mappedPayload/);
  const compactProgramMap = JSON.parse(deployed.body.files[1].content);
  assert.equal(compactProgramMap.entries[0].id, 'Esp32Smoke');
  assert.equal(compactProgramMap.entries[0].maplIr, undefined);
  assert.equal(compactProgramMap.signing.algorithm, 'hmac-sha256');
  assert.equal(deployed.body.program.inputQueue, 'mapper.smoke.in');

  const pcodePath = path.join(runtimeRoot, 'smoke.pcode');
  const programMapPath = path.join(runtimeRoot, 'smoke.program.json');
  await fs.writeFile(pcodePath, deployed.body.files[0].content, 'utf8');
  await fs.writeFile(programMapPath, deployed.body.files[1].content, 'utf8');
  const runtimeOutput = execFileSync(process.execPath, [
    path.join(aggregatorRoot, 'scripts', 'run-js-pmachine.mjs'),
    '--pcode', pcodePath,
    '--program-map', programMapPath,
    '--input-queue', 'mapper.smoke.in',
    '--message', JSON.stringify({ id: 'sample-1', name: 'pulse node' })
  ], { cwd: aggregatorRoot, encoding: 'utf8' });
  const runtimeResult = JSON.parse(runtimeOutput);
  assert.equal(runtimeResult.error, null);
  assert.deepEqual(JSON.parse(runtimeResult.globals.mappedPayload), {
    id: 'sample-1',
    name: 'PULSE NODE'
  });

  const unsupportedResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nodeId: 'live-esp32-node',
      mapl: 'map Unsupported from Input to Output; validate source.id <> ""; end;'
    })
  });
  assert.equal(unsupportedResponse.status, 422);
  assert.match((await unsupportedResponse.json()).error, /not executable by the ESP32/);
  assert.equal(deploymentRequests.length, 1);

  const multipleMapsResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nodeId: 'live-esp32-node', mapl: `${mapl}\n${mapl}` })
  });
  assert.equal(multipleMapsResponse.status, 422);
  assert.match((await multipleMapsResponse.json()).error, /one MAPL map per request/);
  assert.equal(deploymentRequests.length, 1);

  console.log('[MAPL-ESP32-DEPLOY] Compilation, signing, deployment, and unsupported-construct checks passed');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => deploymentServer.close(resolve));
  if (priorBackendUrl === undefined) delete process.env.PULSE_BACKEND_URL;
  else process.env.PULSE_BACKEND_URL = priorBackendUrl;
  await fs.rm(runtimeRoot, { recursive: true, force: true });
}
