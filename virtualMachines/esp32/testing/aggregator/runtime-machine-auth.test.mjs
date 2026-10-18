import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { test } from 'node:test';
import { loadRuntimeMachineAuth } from '../../aggregator/src/backend/security/runtimeMachineAuth.mjs';
import { registerServiceProcessRoutes } from '../../aggregator/src/backend/modules/serviceProcessManager.mjs';

const express = createRequire(new URL('../../aggregator/package.json', import.meta.url))('express');
const token = 'test-machine-credential-12345678901234567890';
const credential = {
  tokenSha256: createHash('sha256').update(token).digest('hex'),
  nodeId: '127.0.0.1',
  serviceId: 'pulse-librarian-s3-readonly',
  ownerAggregatorId: 'local-workspace',
  childRequests: [{ serviceId: 'pulse-filesystem', method: 'POST', path: '/catalogs' }],
};
const instanceId = `${credential.serviceId}@${credential.nodeId}`;
const logger = { info() {}, error() {} };

test('machine authentication authorizes only own reports and allocated read-only children, not service control', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-machine-auth-'));
  const filePath = path.join(root, 'credentials.json');
  await fs.writeFile(filePath, JSON.stringify({ version: 1, credentials: [credential] }));
  const previousBypass = process.env.PULSE_SERVICE_CONTROL_LOCAL_BYPASS;
  process.env.PULSE_SERVICE_CONTROL_LOCAL_BYPASS = '0';
  let parent = { status: 'allocated', allocatedInstanceId: instanceId, serviceId: credential.serviceId };
  let reported = 0;
  const submissions = [];
  const serviceTransactions = {
    get: async () => parent,
    submit: async (...args) => {
      submissions.push(args);
      return { transactionId: 'child-id', status: 'held' };
    },
    snapshot: async () => [{ instanceId, dependencyChainReady: true }],
  };
  const runtimeMachineAuth = await loadRuntimeMachineAuth({
    filePath, ownerAggregatorId: credential.ownerAggregatorId, serviceTransactions, logger,
  });
  const app = express();
  app.use(express.json());
  registerServiceProcessRoutes(app, {
    serviceProcessManager: { listServices: async () => [], startService: async () => ({}) },
    serviceTransactions,
    serviceInstanceReports: {
      report: async body => { reported++; return body; },
    },
    runtimeMachineAuth,
    requirePermission: () => (req, res, next) => req.get('authorization') === 'Bearer user-session'
      ? next() : res.status(401).json({ error: 'Authentication required' }),
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    if (previousBypass === undefined) delete process.env.PULSE_SERVICE_CONTROL_LOCAL_BYPASS;
    else process.env.PULSE_SERVICE_CONTROL_LOCAL_BYPASS = previousBypass;
    await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (route, body, authorization = `Bearer ${token}`, headers = {}) => fetch(origin + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}), ...headers },
    body: JSON.stringify(body),
  });
  const reportRoute = '/api/runtime/instances/report';
  const report = {
    ...credential, tokenSha256: undefined, childRequests: undefined,
    instanceId, endpoint: 'http://127.0.0.1:80', readiness: { ready: true, blockedBy: [] },
    listeners: [{ protocol: 'http', host: '127.0.0.1', port: 80 }],
  };
  assert.equal((await request(reportRoute, report, '')).status, 401);
  assert.equal((await request(reportRoute, report, `Bearer ${'x'.repeat(40)}`)).status, 401);
  assert.equal((await request(reportRoute, report)).status, 200);
  assert.equal(reported, 1);
  for (const change of [
    { serviceId: 'another-service' }, { instanceId: 'another-instance' },
    { nodeId: '192.0.2.1' }, { ownerAggregatorId: 'another-owner' },
    { endpoint: 'http://192.0.2.1:80' },
    { listeners: [{ protocol: 'http', host: '192.0.2.1', port: 80 }] },
  ]) assert.equal((await request(reportRoute, { ...report, ...change })).status, 403);
  assert.equal(reported, 1);
  assert.equal((await request('/api/runtime/services/filesystem/start', {})).status, 401);
  assert.equal((await request('/api/runtime/services/filesystem/start', {}, 'Bearer user-session')).status, 200);
  assert.equal((await request(reportRoute, report, 'Bearer user-session')).status, 200);

  const childRoute = '/api/runtime/services/pulse-filesystem/transactions';
  const child = { method: 'POST', path: '/catalogs', body: {} };
  const headers = { 'x-pulse-parent-transaction-id': 'parent-id' };
  assert.equal((await request(childRoute, child)).status, 403);
  parent = { status: 'allocated', allocatedInstanceId: 'another-instance', serviceId: credential.serviceId };
  assert.equal((await request(childRoute, child, undefined, headers)).status, 403);
  parent = { status: 'completed', allocatedInstanceId: instanceId, serviceId: credential.serviceId };
  assert.equal((await request(childRoute, child, undefined, headers)).status, 403);
  parent = { status: 'allocated', allocatedInstanceId: instanceId, serviceId: 'another-service' };
  assert.equal((await request(childRoute, child, undefined, headers)).status, 403);
  parent = { status: 'allocated', allocatedInstanceId: instanceId, serviceId: credential.serviceId };
  assert.equal((await request(childRoute, { ...child, path: '/catalog/save' }, undefined, headers)).status, 403);
  assert.equal((await request(childRoute, { ...child, method: 'DELETE' }, undefined, headers)).status, 403);
  assert.equal((await request('/api/runtime/services/other/transactions', child, undefined, headers)).status, 403);
  assert.equal((await request(childRoute, child, undefined, headers)).status, 202);
  assert.equal(submissions.length, 1);
  assert.deepEqual(submissions[0][2], { parentTransactionId: 'parent-id', parentInstanceId: instanceId });

  const otherFile = path.join(root, 'other-node.json');
  await fs.writeFile(otherFile, JSON.stringify({
    version: 1, credentials: [{ ...credential, nodeId: '192.0.2.1' }],
  }));
  const otherAuth = await loadRuntimeMachineAuth({
    filePath: otherFile, ownerAggregatorId: credential.ownerAggregatorId, serviceTransactions, logger,
  });
  const guard = otherAuth.guard('report', () => assert.fail('Unexpected session fallback'));
  let status;
  await guard({
    get: () => `Bearer ${token}`, socket: { remoteAddress: '127.0.0.1' }, ip: '192.0.2.1', body: report,
  }, { status: code => { status = code; return { json() {} }; } }, () => assert.fail('Wrong node authorized'));
  assert.equal(status, 403);
});

test('machine credential configuration fails closed, and absent optional configuration preserves session guards', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-machine-config-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'credentials.json');
  const options = { filePath, ownerAggregatorId: credential.ownerAggregatorId, logger };
  const auth = await loadRuntimeMachineAuth(options);
  let fallback = false;
  await auth.guard('report', () => { fallback = true; })({ get: () => `Bearer ${token}` }, {}, () => {});
  assert.equal(fallback, true);
  await assert.rejects(loadRuntimeMachineAuth({ ...options, required: true }), { code: 'ENOENT' });
  for (const configuration of [
    { version: 2, credentials: [] },
    { version: 1, credentials: [credential, credential] },
    { version: 1, credentials: [{ ...credential, ownerAggregatorId: 'other' }] },
    { version: 1, credentials: [{ ...credential, serviceId: undefined }] },
    { version: 1, credentials: [{ ...credential, tokenSha256: token }] },
    { version: 1, credentials: [{ ...credential, childRequests: [{ serviceId: 'pulse-filesystem', method: 'POST', path: '//evil' }] }] },
  ]) {
    await fs.writeFile(filePath, JSON.stringify(configuration));
    await assert.rejects(loadRuntimeMachineAuth(options), /Invalid/);
  }
  await fs.writeFile(filePath, '{malformed');
  await assert.rejects(loadRuntimeMachineAuth(options), SyntaxError);
});
