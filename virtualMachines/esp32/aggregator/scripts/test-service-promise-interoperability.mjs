import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import QueueManager from '../src/broker/QueueManager.mjs';
import { createJsPmachineDeploymentSupervisor } from '../src/backend/modules/jsPmachineDeploymentSupervisor.mjs';
import { registerTopologyRuntimeRoutes } from '../src/backend/roles/topologyRuntimeRoutes.mjs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { executeDeploymentPlan } from './interpret-workflow.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-service-promise-'));
const serviceId = 'promise-echo';
const requestQueue = `service.${serviceId}.requests`;
const queueManager = new QueueManager('promise-test');
queueManager.createQueue(requestQueue, { persistMessages: false });
const deployments = new Map();
const serviceInstances = new Map();
const completedClaims = [];
const jobRoots = new Map();
const supervisor = createJsPmachineDeploymentSupervisor();
const pcodePath = path.join(tempDir, 'echo.pcode');
const programMapPath = path.join(tempDir, 'echo.program.json');
const deploymentIndexPath = path.join(tempDir, 'deployments.json');
await fs.writeFile(pcodePath, 'PUSH_STR "pmachine-ok"\nPRINT\nHALT\n', 'utf8');
await fs.writeFile(programMapPath, JSON.stringify({ runtimeUnit: { kind: 'service', id: serviceId }, entries: [], globals: [] }), 'utf8');

const app = express();
app.use(express.json());
app.get('/api/nodes', (_req, res) => res.json({ nodes: [{ nodeId: 'instance-a' }, { nodeId: 'instance-b' }] }));
app.post('/api/queue/:queueName/claim', (req, res) => {
  const claim = queueManager.claim(req.params.queueName, req.body.workerId, req.body.leaseMs);
  return claim ? res.json({ claim }) : res.status(404).json({ error: 'Queue empty' });
});
app.post('/api/queue/:queueName/claim/heartbeat', (req, res) => {
  const claim = queueManager.heartbeatClaim(req.params.queueName, req.body.claimToken, req.body.workerId, req.body.extendMs);
  return claim ? res.json({ claim }) : res.status(404).json({ error: 'Claim not found' });
});
app.post('/api/queue/:queueName/claim/complete', (req, res) => {
  const result = queueManager.completeClaim(req.params.queueName, req.body.claimToken, req.body.workerId, req.body.completionMeta);
  if (result) completedClaims.push({ ...result, completionMeta: req.body.completionMeta });
  return result ? res.json({ result }) : res.status(404).json({ error: 'Claim not found' });
});
app.post('/api/queue/:queueName/claim/fail', (req, res) => {
  const { workerId, claimToken, ...options } = req.body;
  const result = queueManager.failClaim(req.params.queueName, claimToken, workerId, options);
  return result ? res.json({ result }) : res.status(404).json({ error: 'Claim not found' });
});
app.post('/api/services/:serviceId', async (req, res) => {
  const jobId = `job-${randomUUID()}`;
  const jobRoot = path.join(tempDir, 'jobs', jobId);
  const inputFile = path.join(jobRoot, 'input.json');
  const replyRoot = path.join(jobRoot, 'reply');
  await fs.mkdir(jobRoot, { recursive: true });
  await fs.writeFile(inputFile, `${JSON.stringify({ method: req.method, inputQueue: req.body.inputQueue, messageId: req.body.messageId, body: req.body })}\n`, 'utf8');
  jobRoots.set(jobId, { replyRoot });
  queueManager.enqueue(requestQueue, {
    jobId,
    serviceId: req.params.serviceId,
    messageId: req.body.messageId,
    inputFile,
    replyRoot,
    inputQueue: req.body.inputQueue
  }, 'promise-test');
  res.status(202).json({ jobId, state: 'queued' });
});
app.get('/api/service-jobs/:jobId', async (req, res) => {
  const job = jobRoots.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });
  try {
    const result = JSON.parse(await fs.readFile(`${job.replyRoot}.json`, 'utf8'));
    return res.json({ jobId: req.params.jobId, state: 'completed', result });
  } catch {
    try {
      const error = JSON.parse(await fs.readFile(`${job.replyRoot}.error.json`, 'utf8'));
      return res.json({ jobId: req.params.jobId, state: 'failed', error });
    } catch {
      return res.status(202).json({ jobId: req.params.jobId, state: 'queued' });
    }
  }
});
registerTopologyRuntimeRoutes(app, {
  discoveredNodes: [],
  services: {},
  serviceInstanceRegistry: serviceInstances,
  ffsDeploymentRegistry: deployments,
  jsPmachineDeploymentSupervisor: supervisor,
  deploymentIndexPath
});

const server = await new Promise((resolve) => {
  const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
});
const serviceBaseUrl = `http://127.0.0.1:${server.address().port}`;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${url}: ${JSON.stringify(payload)}`);
  return payload;
}

function invokeWithPromise(messageId) {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      const accepted = await fetchJson(`${serviceBaseUrl}/api/services/${serviceId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId, message: `request:${messageId}`, inputQueue: `${serviceId}.in` })
      });
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const job = await fetchJson(`${serviceBaseUrl}/api/service-jobs/${accepted.jobId}`);
        if (job.state === 'completed') return resolve({ jobId: accepted.jobId, result: job.result });
        if (job.state === 'failed') throw new Error(`Service job failed: ${JSON.stringify(job.error)}`);
        await new Promise((done) => setTimeout(done, 25));
      }
      throw new Error(`Service job timed out: ${accepted.jobId}`);
    };
    execute().catch(reject);
  });
}

const source = [
  'DEPLOYMENT "promise-proof" PROJECT "service-interoperability" TARGETS ("instance-a", "instance-b") BEGIN',
  `SERVICE "${serviceId}" FILE "echo.pcode" QUEUE "${serviceId}.in" -> "${serviceId}.out" TARGETS ("instance-a", "instance-b") STARTUP TRUE;`,
  'END;'
].join('\n');
const deploymentPlan = compileWorkflowDSLWithAntlr(source);
const deployment = {
  key: `${serviceId}::instance-a`,
  serviceName: serviceId,
  targetNodeIds: ['instance-a', 'instance-b'],
  metadata: { pcodePath, programMapPath, inputQueue: `${serviceId}.in`, backendUrl: serviceBaseUrl, pollIntervalMs: 25 }
};

try {
  const deployed = await executeDeploymentPlan(deploymentPlan, false, { serviceBaseUrl, artifactRoot: tempDir });
  assert.equal(deployed.deployments.length, 1);
  assert.equal(deployments.size, 1);
  const registered = Array.from(deployments.values())[0];
  assert.deepEqual(registered.targetNodeIds, ['instance-a', 'instance-b']);
  assert.equal(supervisor.list().filter((instance) => instance.state === 'running').length, 2);

  const requestIds = Array.from({ length: 8 }, (_, index) => `request-${index + 1}`);
  const results = await Promise.all(requestIds.map(invokeWithPromise));
  assert.equal(results.length, requestIds.length);
  assert.equal(new Set(results.map((result) => result.jobId)).size, requestIds.length);
  assert.equal(new Set(results.map((result) => result.result.messageId)).size, requestIds.length);
  assert.ok(results.every((result) => result.result.value === 'pmachine-ok'));
  assert.ok(results.every((result) => ['instance-a', 'instance-b'].some((target) => result.result.serviceInstanceId === `${serviceId}:${target}`)));
  const claimDeadline = Date.now() + 3000;
  while (completedClaims.length < requestIds.length && Date.now() < claimDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(completedClaims.length, requestIds.length);
  assert.equal(new Set(completedClaims.map((claim) => claim.messageId)).size, requestIds.length);
  assert.ok(completedClaims.every((claim) => claim.attempts === 1));

  console.log(JSON.stringify({
    status: 'ok',
    serviceId,
    submitted: requestIds.length,
    completedClaims: completedClaims.length,
    instances: [...new Set(results.map((result) => result.result.serviceInstanceId))],
    jobIds: results.map((result) => result.jobId)
  }, null, 2));
  console.log('[service-promise-interoperability] PASS: deployed PMachine instances completed one correlated claim per JavaScript Promise');
} finally {
  await supervisor.stop(deployment);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(tempDir, { recursive: true, force: true });
}
