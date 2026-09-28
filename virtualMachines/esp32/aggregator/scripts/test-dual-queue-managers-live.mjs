import assert from 'node:assert/strict';
import { createQueueManagerProvider } from '../src/broker/queueManagerProviders/index.mjs';

const rabbit = createQueueManagerProvider('qm-rabbit', null, { provider: 'rabbitmq', queuePrefix: 'pulse-live-rabbit' });
const msmq = createQueueManagerProvider('qm-msmq', null, { provider: 'msmq', queuePrefix: 'pulse-live-msmq' });

try {
  await Promise.all([
    rabbit.createQueue('orders', { managerId: 'qm-rabbit' }),
    msmq.createQueue('orders', { managerId: 'qm-msmq' })
  ]);
  await Promise.all([
    rabbit.enqueue('orders', { owner: 'rabbit' }, 'dual-proof'),
    msmq.enqueue('orders', { owner: 'msmq' }, 'dual-proof')
  ]);
  const [rabbitMessage, msmqMessage] = await Promise.all([
    rabbit.dequeue('orders'),
    msmq.dequeue('orders')
  ]);
  assert.equal(rabbitMessage.message.owner, 'rabbit');
  assert.equal(msmqMessage.message.owner, 'msmq');
  console.log('[dual-queue-managers-live] PASS: RabbitMQ and MSMQ processed isolated messages concurrently');
} finally {
  await Promise.allSettled([rabbit.deleteQueue('orders'), msmq.deleteQueue('orders')]);
  rabbit.close();
  msmq.close();
}