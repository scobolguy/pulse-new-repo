import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildVflDeployments } from './build-vfl-deployment.mjs';
import { compileWorkflowDSL } from './compile-workflow-dsl.mjs';
import { deploy as deployWflMapper } from './deploy-wfl-udp-mapper.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-vfl-udp-mapper-'));
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let host;
let client;
let deploymentServer;
let capturedDeployment;

try {
  const packageDir = path.join(workspaceRoot, 'src', 'mapper-deployment');
  const wfl = await fs.readFile(path.join(packageDir, 'mapper-udp-daemon.wfl'), 'utf8');
  await fs.copyFile(path.join(packageDir, 'mapper-udp-daemon.vfl'), path.join(tempDir, 'mapper-udp-daemon.vfl'));
  await fs.copyFile(path.join(packageDir, 'mapper-runtime.pas'), path.join(tempDir, 'mapper-runtime.pas'));
  await fs.writeFile(path.join(tempDir, 'mapper.mapl'), [
    'map CopyId from Input to Output;',
    '  target.id := source.id;',
    'end;',
    'map UpperName from Input to Output;',
    '  target.name := upper(source.name);',
    'end;'
  ].join('\n'), 'utf8');

  const compiled = compileWorkflowDSL(wfl, {
    variables: { MAPPER_NODE_ID: 'test-node', MAPPER_MAP_FILE: 'mapper.mapl' }
  });
  const build = await buildVflDeployments(compiled, { artifactRoot: tempDir });
  const service = build.artifacts.find(artifact => artifact.programMap.runtimeUnit.kind === 'service');
  const daemon = build.artifacts.find(artifact => artifact.programMap.runtimeUnit.kind === 'daemon');
  assert.ok(service, 'WFL package includes the hosted health service');
  assert.ok(daemon, 'WFL package includes the hosted UDP mapper daemon');
  assert.equal(daemon.programMap.runtimeUnit.refreshMs, 60000);
  assert.deepEqual(daemon.programMap.entries.map(entry => entry.id), ['CopyId', 'UpperName']);
  assert.ok(daemon.programMap.entries.every(entry => entry.maplIr === undefined));
  assert.match(daemon.pcodeText, /CALL_EXT host\.map_apply 2/);
  assert.match(daemon.pcodeText, /CALL_EXT host\.udp_reply 1/);

  host = await createPascalishServiceHost({
    compiled: { pcodeText: service.pcodeText, programMap: service.programMap },
    daemons: [{ compiled: { pcodeText: daemon.pcodeText, programMap: daemon.programMap }, udpPort: 0 }],
    collectorId: 'mapper-daemon-test',
    host: '127.0.0.1',
    httpPort: null,
    udpPort: 0,
    logger: { warn() {}, error() {}, log() {} }
  });
  await host.start();
  const daemonPort = host.getStatus().daemonDiagnostics[0].udpPort;
  assert.ok(daemonPort > 0, 'host bound an ephemeral daemon UDP port');

  client = dgram.createSocket('udp4');
  const request = (payload, timeoutMs = 1500) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    client.once('message', data => {
      clearTimeout(timer);
      resolve(data.toString('utf8'));
    });
    client.send(Buffer.from(JSON.stringify(payload)), daemonPort, '127.0.0.1', error => {
      if (!error) return;
      clearTimeout(timer);
      reject(error);
    });
  });

  const mapped = await request({ mapId: 'UpperName', source: { name: 'pulse node' } });
  assert.deepEqual(JSON.parse(mapped), { name: 'PULSE NODE' });

  const unknownMapReply = await request({ mapId: 'UnknownMap', source: { name: 'pulse node' } }, 250);
  assert.equal(unknownMapReply, null, 'unknown map IDs do not produce success-shaped UDP replies');
  assert.match(host.getStatus().daemonDiagnostics[0].lastError, /Mapping not found: UnknownMap/);

  const deploymentApp = express();
  deploymentApp.use(express.json());
  deploymentApp.post('/api/nodes/:nodeId/deploy', (req, res) => {
    capturedDeployment = { nodeId: req.params.nodeId, body: req.body };
    res.json({ hostedInstallation: { running: true } });
  });
  deploymentServer = await new Promise(resolve => {
    const server = deploymentApp.listen(0, '127.0.0.1', () => resolve(server));
  });
  const wflPath = path.join(packageDir, 'mapper-udp-daemon.wfl');
  const deploymentResult = await deployWflMapper({
    input: wflPath,
    nodeId: 'test-node',
    mapFile: path.join(tempDir, 'mapper.mapl'),
    udpPort: 4211,
    backendUrl: `http://127.0.0.1:${deploymentServer.address().port}`
  });
  assert.equal(deploymentResult.result.hostedInstallation.running, true);
  assert.equal(capturedDeployment.nodeId, 'test-node');
  assert.equal(capturedDeployment.body.hostedServiceInstall.daemons[0].udpPort, 4211);
  assert.equal(capturedDeployment.body.files.length, 4);
  const signedDaemonMap = JSON.parse(capturedDeployment.body.files.find(file => file.path.endsWith('daemon.program.json')).content);
  assert.equal(signedDaemonMap.signing.algorithm, 'hmac-sha256');
  assert.deepEqual(signedDaemonMap.entries.map(entry => entry.id), ['CopyId', 'UpperName']);
  console.log('[vfl-udp-mapper-daemon] PASS: package build, UDP execution, deployment packaging, signature, and unknown-map failure');
} finally {
  if (client) await new Promise(resolve => client.close(resolve));
  if (host) await host.stop();
  if (deploymentServer) await new Promise(resolve => deploymentServer.close(resolve));
  await fs.rm(tempDir, { recursive: true, force: true });
}
