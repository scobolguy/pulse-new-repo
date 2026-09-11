import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createJsPmachineDeploymentSupervisor } from '../src/backend/modules/jsPmachineDeploymentSupervisor.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-js-deployment-'));
const pcodePath = path.join(tempDir, 'service.pcode');
const mapPath = path.join(tempDir, 'service.program.json');
await fs.writeFile(pcodePath, 'HALT\n', 'utf8');
await fs.writeFile(mapPath, JSON.stringify({ runtimeUnit: { kind: 'service', id: 'verify-service' }, entries: [] }), 'utf8');

const supervisor = createJsPmachineDeploymentSupervisor();
try {
  const deployment = {
    key: 'verify-service::js-test',
    deploymentId: 'verify-service',
    serviceName: 'verify-service',
    workloadKind: 'service',
    runtimeState: 'running',
    targetNodeId: 'js-test',
    metadata: { startup: true, pcodePath, programMapPath: mapPath, inputQueue: 'verify.in', pollIntervalMs: 25 }
  };
  const started = await supervisor.start(deployment);
  if (started.state !== 'running') throw new Error(`expected running, got ${started.state}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const listed = supervisor.list().find((entry) => entry.key === deployment.key);
  if (!listed || listed.state !== 'running') throw new Error(`runtime did not remain running: ${JSON.stringify(listed)}`);
  const stopped = await supervisor.stop(deployment);
  if (stopped.state !== 'stopped') throw new Error(`expected stopped, got ${stopped.state}`);
  console.log(JSON.stringify({ status: 'ok', startedState: started.state, stoppedState: stopped.state }, null, 2));
} finally {
  supervisor.shutdown();
  await fs.rm(tempDir, { recursive: true, force: true });
}
