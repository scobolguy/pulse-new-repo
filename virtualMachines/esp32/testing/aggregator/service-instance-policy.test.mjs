import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceInstancePolicy } from '../../aggregator/src/service-lifecycle/instance-policy.mjs';

const bindings = {
  librarian: {
    instanceId: 'librarian-1',
    endpoint: 'http://127.0.0.1:4301',
    readinessUrl: 'http://127.0.0.1:4301/ready',
  },
};

test('Pascalish instance policy evaluates required bindings and builds the shared report contract', async t => {
  const policy = await createServiceInstancePolicy({ logger: { warn() {}, error() {} } });
  t.after(() => policy.stop());

  const evaluation = await policy.dispatch('/evaluate', {
    version: 1,
    serviceId: 'mapper',
    requires: ['librarian'],
    bindings,
    observations: { librarian: { ready: true, instanceId: 'librarian-1' } },
  });
  assert.deepEqual(evaluation, { ok: true, readiness: { ready: true, blockedBy: [] } });

  const dependencies = { librarian: bindings.librarian };
  const result = await policy.dispatch('/report', {
    version: 1,
    serviceId: 'mapper',
    instanceId: 'mapper-1',
    nodeId: 'node-1',
    bootId: 'boot-1',
    sequence: 1,
    ownerAggregatorId: 'aggregator-1',
    endpoint: 'http://127.0.0.1:4300',
    readiness: evaluation.readiness,
    dependencies,
    ttlMs: 30000,
    listeners: [],
  });
  assert.deepEqual(result.report, {
    version: 1,
    serviceId: 'mapper',
    instanceId: 'mapper-1',
    nodeId: 'node-1',
    bootId: 'boot-1',
    sequence: 1,
    ownerAggregatorId: 'aggregator-1',
    endpoint: 'http://127.0.0.1:4300',
    readiness: evaluation.readiness,
    dependencies,
    ttlMs: 30000,
    listeners: [],
  });
});

test('Pascalish instance policy identifies missing, failed, and mismatched dependencies', async t => {
  const policy = await createServiceInstancePolicy({ logger: { warn() {}, error() {} } });
  t.after(() => policy.stop());

  const result = await policy.dispatch('/evaluate', {
    version: 1,
    serviceId: 'mapper',
    requires: ['librarian', 'filesystem', 'broker'],
    bindings: {
      librarian: bindings.librarian,
      filesystem: { instanceId: 'filesystem-1', endpoint: 'http://127.0.0.1:4302', readinessUrl: 'http://127.0.0.1:4302/ready' },
    },
    observations: {
      librarian: { ready: true, instanceId: 'stale-librarian' },
      filesystem: { ready: false, instanceId: 'filesystem-1', reason: 'schema-root-unavailable' },
    },
  });

  assert.deepEqual(result.readiness, {
    ready: false,
    blockedBy: [
      { serviceId: 'librarian', instanceId: 'librarian-1', reason: 'instance-mismatch' },
      { serviceId: 'filesystem', instanceId: 'filesystem-1', reason: 'schema-root-unavailable' },
      { serviceId: 'broker', instanceId: '', reason: 'missing-binding' },
    ],
  });
});

test('Pascalish report validation rejects invalid TTLs and ready reports with blockers', async t => {
  const policy = await createServiceInstancePolicy({ logger: { warn() {}, error() {} } });
  t.after(() => policy.stop());
  const report = {
    version: 1,
    serviceId: 'mapper',
    instanceId: 'mapper-1',
    nodeId: 'node-1',
    bootId: 'boot-1',
    sequence: 1,
    ownerAggregatorId: 'aggregator-1',
    endpoint: 'http://127.0.0.1:4300',
    readiness: { ready: true, blockedBy: [] },
    dependencies: {},
    ttlMs: 30000,
    listeners: [],
  };

  await assert.rejects(policy.dispatch('/report', { ...report, ttlMs: 1000 }), /ttlMs must be 30000/);
  await assert.rejects(policy.dispatch('/report', {
    ...report,
    readiness: { ready: true, blockedBy: [{ serviceId: 'librarian', instanceId: 'lib-1', reason: 'not-ready' }] },
  }), /cannot contain blockers/);
  const blockedBy = [{ serviceId: 'pulse-filesystem', instanceId: 'fs-1', reason: 'probe-failed' }];
  const listeners = [{ protocol: 'http', host: '127.0.0.1', port: 54321 }];
  assert.deepEqual((await policy.dispatch('/report', {
    ...report, readiness: { ready: false, blockedBy }, listeners,
  })).report, { ...report, readiness: { ready: false, blockedBy }, listeners });
  await assert.rejects(policy.dispatch('/unknown', {}), /Unsupported service-instance policy route/);
});

test('Pascalish transaction policy times out durable held work and never retries uncertain outcomes', async t => {
  const policy = await createServiceInstancePolicy({ logger: { warn() {}, error() {} } });
  t.after(() => policy.stop());
  assert.equal((await policy.dispatch('/transaction-action', {
    transaction: { transactionId: 'held-1', status: 'held' }, elapsedMs: 30000,
  })).action, 'timeout');
  assert.equal((await policy.dispatch('/transaction-action', {
    transaction: { transactionId: 'uncertain-1', status: 'uncertain' }, elapsedMs: 1,
  })).action, 'fail');
  assert.equal((await policy.dispatch('/transaction-action', {
    transaction: { transactionId: 'completed-1', status: 'completed' }, elapsedMs: 1,
  })).action, 'return');
  assert.equal((await policy.dispatch('/transaction-action', {
    transaction: { transactionId: 'parent-1', status: 'waiting-child' }, elapsedMs: 1,
  })).action, 'poll');
});
