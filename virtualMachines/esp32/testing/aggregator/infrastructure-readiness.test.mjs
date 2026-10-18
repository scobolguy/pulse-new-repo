import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createInfrastructureReadiness, registerInfrastructureReadinessRoutes } from '../../aggregator/src/backend/modules/infrastructureReadiness.mjs';
import { createServiceLifecyclePolicy } from '../../aggregator/src/backend/modules/serviceLifecyclePolicy.mjs';

const express = createRequire(new URL('../../aggregator/package.json', import.meta.url))('express');

test('infrastructure readiness uses read-only SQL and authenticated AMQP and closes resources', async () => {
  const events = [];
  const connection = new EventEmitter();
  connection.createChannel = async () => ({ close: async () => events.push('channel-close') });
  connection.close = async () => events.push('amqp-close');
  class Pool {
    config = {};
    async connect() { events.push('sql-connect'); }
    request() { return { query: async query => {
      assert.equal(query, 'SELECT 1 AS pulse_ready');
      events.push('sql-query');
      return { recordset: [{ pulse_ready: 1 }] };
    } }; }
    async close() { events.push('sql-close'); }
  }
  const probes = createInfrastructureReadiness({
    sqlConnectionString: () => 'test', rabbitUrl: () => 'amqp://configured',
    importImpl: async name => name === 'mssql' ? { ConnectionPool: Pool } : {
      connect: async (url, options) => {
        assert.equal(url, 'amqp://configured'); assert.equal(options.timeout, 2000);
        events.push('amqp-connect'); return connection;
      },
    },
  });
  await probes.database();
  await probes.rabbitmq();
  assert.deepEqual(events, ['sql-connect', 'sql-query', 'sql-close',
    'amqp-connect', 'channel-close', 'amqp-close']);
});

test('probe failures are explicit, credentials are redacted and concurrent observations coalesce', async t => {
  let calls = 0;
  const app = express();
  registerInfrastructureReadinessRoutes(app, { ownerAggregatorId: 'owner', probes: {
    database: async () => { throw new Error('Database login rejected'); },
    rabbitmq: async () => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 20));
      throw new Error('Connection refused amqp://user:secret@broker');
    },
  } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/runtime/infrastructure`;
  const responses = await Promise.all([fetch(`${base}/rabbitmq/ready`), fetch(`${base}/rabbitmq/ready`)]);
  for (const response of responses) {
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ready, false);
    assert.equal(body.instanceId, 'rabbitmq:owner');
    assert.doesNotMatch(body.error, /secret/);
  }
  assert.equal(calls, 1);
  const database = await fetch(`${base}/database/ready`);
  assert.equal(database.status, 503);
  assert.equal((await database.json()).error, 'Database login rejected');
});

test('Pascalish only binds RabbitMQ-backed brokers and blocks/recover dependents of external database', async t => {
  const policy = await createServiceLifecyclePolicy();
  t.after(() => policy.stop());
  assert.deepEqual((await policy.dispatch('/infrastructure-dependencies', {
    brokerProvider: 'rabbitmq',
  })).dependencies, { broker: ['rabbitmq'] });
  assert.deepEqual((await policy.dispatch('/infrastructure-dependencies', {
    brokerProvider: 'legacy',
  })).dependencies, { broker: [] });
  const services = {
    database: { dependencies: [], management: 'external', ownerAggregatorId: 'owner' },
    consumer: { dependencies: ['database'], management: 'managed', ownerAggregatorId: 'owner' },
  };
  const observations = {
    database: { alive: false, ready: false, reason: 'SQL login failed' },
    consumer: { alive: true, ready: true, reason: '' },
  };
  const input = { services, observations, owner: 'owner' };
  assert.equal((await policy.dispatch('/evaluate', { ...input, id: 'database' })).action, 'observe');
  assert.equal((await policy.dispatch('/evaluate', { ...input, id: 'consumer' })).ready, false);
  observations.database = { alive: true, ready: true, reason: '' };
  assert.equal((await policy.dispatch('/evaluate', { ...input, id: 'consumer' })).ready, true);
});
