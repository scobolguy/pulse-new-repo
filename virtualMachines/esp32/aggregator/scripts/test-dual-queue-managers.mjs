import assert from 'node:assert/strict';
import { createQueueManagerProvider } from '../src/broker/queueManagerProviders/index.mjs';

const rabbit = createQueueManagerProvider('qm-rabbit', null, { provider: 'rabbitmq', queuePrefix: 'pulse-proof-rabbit' });
const msmq = createQueueManagerProvider('qm-msmq', null, { provider: 'msmq', queuePrefix: 'pulse-proof-msmq' });

assert.equal(rabbit.getPersistenceStatus().backend, 'rabbitmq');
assert.equal(msmq.getPersistenceStatus().backend, 'msmq');
assert.notEqual(rabbit.fullQueueName('orders'), msmq.fullQueuePath('orders'));

assert.equal(rabbit.name, 'qm-rabbit');
assert.equal(msmq.name, 'qm-msmq');

rabbit.close();
msmq.close();
console.log('[dual-queue-managers] PASS: RabbitMQ and MSMQ managers coexist with isolated queue namespaces');