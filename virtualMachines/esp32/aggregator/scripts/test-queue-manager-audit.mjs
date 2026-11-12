import assert from 'node:assert/strict';
import test from 'node:test';
import QueueManager from '../src/broker/QueueManager.mjs';

test('message broker audit is opt-in and records enqueue and claim operations', () => {
  const events = [];
  const broker = new QueueManager('audit-test', null, {
    audit: event => events.push(event),
  });
  broker.createQueue('work');
  const messageId = broker.enqueue('work', { value: 1 }, 'producer', 'message-1', {
    processId: 'process-1',
    transactionId: 'tx-1',
  });
  const claim = broker.claim('work', 'worker-1');

  assert.equal(messageId, 'message-1');
  assert.equal(claim.message.messageId, 'message-1');
  assert.deepEqual(events.map(event => event.type), [
    'createQueue',
    'enqueue',
    'claim',
  ]);
  assert.equal(events[1].category, 'message-broker');
  assert.equal(events[1].messageEnvelope.transactionId, 'tx-1');
});

test('message broker audit remains disabled by default', () => {
  const broker = new QueueManager('no-audit-test');
  broker.createQueue('work');
  broker.enqueue('work', { value: 1 }, 'producer');
  assert.equal(broker.operationLog.length, 2);
});
