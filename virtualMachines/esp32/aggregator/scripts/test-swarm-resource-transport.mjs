import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { loadRuntimeMachineAuth } from '../src/backend/security/runtimeMachineAuth.mjs';
import { SwarmResourceRegistry } from '../src/backend/swarmResourceRegistry.mjs';
import { registerSwarmResourceRoutes } from '../src/backend/roles/swarmResourceRoutes.mjs';
import { createSwarmResourceReporter } from '../src/backend/swarmResourceReporter.mjs';

test('HTTP resource reporting binds machine identity and rejects spoofing, replay and enrollment overrides', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-resource-auth-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const token = randomBytes(32).toString('hex');
  const wrongSourceToken = randomBytes(32).toString('hex');
  const legacyToken = randomBytes(32).toString('hex');
  const filePath = path.join(directory, 'machine-auth.json');
  const credential = (secret, nodeId) => ({
    tokenSha256: createHash('sha256').update(secret).digest('hex'),
    nodeId, serviceId: 'worker', ownerAggregatorId: 'aggregator-a', resourceReports: true,
    childRequests: [{ serviceId: 'child', method: 'POST', path: '/run' }],
  });
  await fs.writeFile(filePath, JSON.stringify({
    version: 1, credentials: [
      credential(token, '127.0.0.1'), credential(wrongSourceToken, '127.0.0.2'),
      { ...credential(legacyToken, '127.0.0.1'), resourceReports: false },
    ],
  }));
  const errors = [];
  const logger = { info() {}, error(...args) { errors.push(args); } };
  const machineAuth = await loadRuntimeMachineAuth({
    filePath, required: true, ownerAggregatorId: 'aggregator-a', logger,
  });
  const resources = new SwarmResourceRegistry({ clusterId: 'swarm-a' });
  resources.enroll({ nodeId: '127.0.0.1', capabilities: ['pmachine'] });
  const app = express();
  app.use(express.json({ limit: '4kb' }));
  registerSwarmResourceRoutes(app, { resources, machineAuth, logger });
  const fallback = (req, res) => res.status(418).json({ fallback: true });
  app.post('/existing/report', machineAuth.guard('report', fallback), (req, res) => res.json({ status: 'ok' }));
  app.post('/existing/child/:serviceId', machineAuth.guard('child', fallback), (req, res) => res.json({ status: 'ok' }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const body = {
    nodeId: '127.0.0.1', serviceId: 'worker', ownerAggregatorId: 'aggregator-a',
    sequence: 1, status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 4096,
  };
  async function report(changes = {}, secret = token, headers = {}) {
    const response = await fetch(`${origin}/api/swarm/resources/report`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: {
        'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}), ...headers,
      },
      body: JSON.stringify({ ...body, ...changes }),
    });
    const text = await response.text();
    return { status: response.status, body: JSON.parse(text) };
  }
  assert.equal((await report({}, null, { 'x-user-id': 'SystemAdmin' })).status, 401);
  assert.equal((await report({}, 'invalid')).status, 401);
  assert.equal((await report({}, legacyToken)).status, 403);
  assert.equal((await report({}, wrongSourceToken, { 'x-forwarded-for': '127.0.0.2' })).status, 403);
  assert.equal((await report({ nodeId: '127.0.0.2' })).status, 403);
  assert.equal((await report({ serviceId: 'other' })).status, 403);
  assert.equal((await report({ ownerAggregatorId: 'other' })).status, 403);
  assert.deepEqual(resources.candidates(), []);
  assert.equal((await report({ codeIds: ['a'.repeat(64)] })).status, 409);
  assert.equal((await report({ capabilities: ['pmachine'] })).status, 409);
  assert.equal((await report({ freeMemoryBytes: null })).status, 409);
  assert.equal((await report()).status, 200);
  assert.deepEqual(resources.candidates()[0].codeIds, []);
  assert.equal((await report()).status, 409);
  assert.equal((await report({ sequence: 2, status: 'degraded' })).status, 200);
  assert.deepEqual(resources.candidates(), []);
  const reporterOptions = {
    endpoint: `${origin}/api/swarm/resources/report`, nodeId: '127.0.0.1',
    serviceId: 'worker', ownerAggregatorId: 'aggregator-a', token,
    collect: async () => ({ status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 4096 }),
  };
  const reporter = createSwarmResourceReporter(reporterOptions);
  assert.deepEqual(await reporter.reportOnce(3), { sequence: 3, status: 'online' });
  assert.equal(resources.candidates()[0].freeMemoryBytes, 4096);
  await assert.rejects(reporter.reportOnce(3), /must increase/);
  const rejected = createSwarmResourceReporter({ ...reporterOptions, token: legacyToken });
  await assert.rejects(rejected.reportOnce(4), /HTTP 403/);
  for (const endpoint of [
    'http://192.168.2.83/api/swarm/resources/report',
    'http://localhost/api/swarm/resources/report',
    `${origin}/other`, `${origin}/api/swarm/resources/report?token=bad`,
    `${origin}/api/swarm/resources/report#fragment`,
  ]) assert.throws(() => createSwarmResourceReporter({ ...reporterOptions, endpoint }), /HTTPS/);
  const redirectedApp = express();
  redirectedApp.post('/api/swarm/resources/report', (req, res) => res.redirect(307, `${origin}/existing/report`));
  const redirectServer = redirectedApp.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    redirectServer.close(error => error ? reject(error) : resolve());
    redirectServer.closeAllConnections();
  }));
  await once(redirectServer, 'listening');
  const redirected = createSwarmResourceReporter({
    ...reporterOptions,
    endpoint: `http://127.0.0.1:${redirectServer.address().port}/api/swarm/resources/report`,
  });
  await assert.rejects(redirected.reportOnce(4), /fetch failed/);
  const invalidCollector = createSwarmResourceReporter({
    ...reporterOptions, collect: async () => ({ status: 'online', estimatedFreeSlots: 1 }),
  });
  await assert.rejects(invalidCollector.reportOnce(4), /Invalid measured free memory/);
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const delayed = createSwarmResourceReporter({ ...reporterOptions, collect: () => pending });
  const submission = delayed.reportOnce(4);
  await assert.rejects(delayed.reportOnce(5), /in progress/);
  finish({ status: 'degraded', estimatedFreeSlots: 0, freeMemoryBytes: 2048 });
  await submission;
  assert.deepEqual(resources.candidates(), []);
  assert.ok(errors.length >= 4, 'Invalid/replayed reports are explicitly logged');
  for (const route of ['/existing/report', '/existing/child/child']) {
    const response = await fetch(`${origin}${route}`, {
      method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 418, 'Existing user fallback behavior is preserved');
    await response.text();
  }
  const existingReport = await fetch(`${origin}/existing/report`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${legacyToken}` },
    body: JSON.stringify({
      serviceId: 'worker', instanceId: 'worker@127.0.0.1', nodeId: '127.0.0.1',
      ownerAggregatorId: 'aggregator-a', endpoint: 'http://127.0.0.1:80',
      listeners: [{ host: '127.0.0.1', protocol: 'http', port: 80 }],
    }),
  });
  assert.equal(existingReport.status, 200, 'Legacy report credentials retain their existing authorization');
  await existingReport.text();
  t.diagnostic('Verified scoped authentication over a real loopback HTTP listener; not TLS or physical node enrollment.');
});
