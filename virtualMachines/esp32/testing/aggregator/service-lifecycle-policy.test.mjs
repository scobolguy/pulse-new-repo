import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceLifecyclePolicy } from '../../aggregator/src/backend/modules/serviceLifecyclePolicy.mjs';

const services = {
  mapper: { dependencies: ['librarian'], management: 'managed', ownerAggregatorId: 'a' },
  librarian: { dependencies: ['filesystem'], management: 'managed', ownerAggregatorId: 'a' },
  filesystem: { dependencies: [], management: 'managed', ownerAggregatorId: 'a' },
};

test('Pascalish preserves long Mapper and MCP dispatch windows without extending ordinary calls', async t => {
  const policy = await createServiceLifecyclePolicy({
    source: '../../../../src/service-lifecycle/transactions.pas',
  });
  t.after(() => policy.stop());
  for (const serviceId of ['pulse-local-mcp', 'pulse-data-mapper']) {
    assert.equal((await policy.dispatch('/dispatch-policy', { serviceId })).timeoutMs, 180000);
  }
  assert.equal((await policy.dispatch('/dispatch-policy', { serviceId: 'pulse-filesystem' })).timeoutMs, 15000);
});

test('Pascalish orders dependency graphs, rejects cycles and missing requirements', async () => {
  const policy = await createServiceLifecyclePolicy();
  try {
    assert.deepEqual((await policy.dispatch('/start-order', {
      services, ids: Object.keys(services), roots: ['mapper'],
    })).order, ['filesystem', 'librarian', 'mapper']);
    await assert.rejects(policy.dispatch('/start-order', {
      services: { a: { dependencies: ['b'] }, b: { dependencies: ['a'] } },
      ids: ['a', 'b'], roots: ['a'],
    }), /cycle/);
    await assert.rejects(policy.dispatch('/start-order', {
      services: { a: { dependencies: ['missing'] } }, ids: ['a'], roots: ['a'],
    }), /Unknown dependency/);
  } finally { await policy.stop(); }
});

test('Pascalish allows frontend cold builds without extending other service startup deadlines', async t => {
  const policy = await createServiceLifecyclePolicy();
  t.after(() => policy.stop());
  assert.equal((await policy.dispatch('/startup-policy', {
    serviceId: 'pulse-frontend', defaultTimeoutMs: 20000,
  })).timeoutMs, 120000);
  assert.equal((await policy.dispatch('/startup-policy', {
    serviceId: 'pulse-filesystem', defaultTimeoutMs: 20000,
  })).timeoutMs, 20000);
});

test('Pascalish blocks readiness without restarting live dependents and respects ownership', async () => {
  const policy = await createServiceLifecyclePolicy();
  const observations = {
    mapper: { alive: true, ready: true, reason: '' },
    librarian: { alive: true, ready: false, reason: 'Filesystem unavailable' },
    filesystem: { alive: false, ready: false, reason: 'Connection refused' },
  };
  try {
    const blocked = await policy.dispatch('/evaluate', { services, observations, id: 'mapper', owner: 'a' });
    assert.equal(blocked.ready, false);
    assert.equal(blocked.action, 'observe');
    assert.deepEqual(blocked.blockedBy, [{ serviceId: 'librarian', reason: 'Filesystem unavailable' }]);
    assert.equal((await policy.dispatch('/evaluate', {
      services, observations, id: 'filesystem', owner: 'a',
    })).action, 'start');
    assert.equal((await policy.dispatch('/evaluate', {
      services, observations, id: 'filesystem', owner: 'b',
    })).action, 'observe');
    const external = { ...services, filesystem: { ...services.filesystem, management: 'external' } };
    assert.equal((await policy.dispatch('/evaluate', {
      services: external, observations, id: 'filesystem', owner: 'a',
    })).action, 'observe');
    observations.librarian.ready = true;
    assert.equal((await policy.dispatch('/evaluate', { services, observations, id: 'mapper', owner: 'a' })).ready, true);
  } finally { await policy.stop(); }
});

test('Pascalish protects in-use prerequisites and chooses reverse cascade order', async t => {
  const policy = await createServiceLifecyclePolicy();
  t.after(() => policy.stop());
  const request = { services, ids: Object.keys(services), order: ['filesystem', 'librarian', 'mapper'],
    desired: { mapper: true, librarian: true, filesystem: true }, id: 'filesystem', owner: 'a', cascade: false };
  await assert.rejects(policy.dispatch('/stop-order', request), /in use/);
  assert.deepEqual((await policy.dispatch('/stop-order', { ...request, cascade: true })).order,
    ['mapper', 'librarian', 'filesystem']);
  await assert.rejects(policy.dispatch('/stop-order', { ...request, cascade: true, owner: 'b' }), /does not own/);
  assert.deepEqual((await policy.dispatch('/stop-order', { ...request, id: 'mapper' })).order, ['mapper']);
});

test('Pascalish recovery is bounded without restarting before its deadline', async t => {
  const policy = await createServiceLifecyclePolicy();
  t.after(() => policy.stop());
  assert.equal((await policy.dispatch('/recovery', { attempts: 0, lastAttempt: 0, now: 0 })).action, 'start');
  assert.equal((await policy.dispatch('/recovery', { attempts: 3, lastAttempt: 0, now: 7 })).action, 'wait');
  assert.equal((await policy.dispatch('/recovery', { attempts: 3, lastAttempt: 0, now: 8 })).action, 'start');
  const maximum = await policy.dispatch('/recovery', { attempts: 100, lastAttempt: 0, now: 60 });
  assert.equal(maximum.delaySeconds, 60);
  assert.equal(maximum.action, 'start');
});
