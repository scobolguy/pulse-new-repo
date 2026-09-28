import assert from 'node:assert/strict';
import { createMt103Pacs008Daemon } from '../src/backend/mt103Pacs008Daemon.mjs';

function createQueueManager(message) {
  const calls = [];
  let claim = message ? {
    claimToken: 'claim-1',
    attempts: 1,
    message: { messageId: 'mt103-1', message, messageEnvelope: { correlationId: 'corr-1' } }
  } : null;
  return {
    calls,
    async claim() { calls.push(['claim']); return claim; },
    async enqueue(...args) { calls.push(['enqueue', ...args]); },
    async completeClaim(...args) { calls.push(['complete', ...args]); claim = null; },
    async failClaim(...args) { calls.push(['fail', ...args]); claim = null; }
  };
}

function createDatabaseManager() {
  const calls = [];
  return {
    calls,
    async createTable(schema) { calls.push(['createTable', schema.table]); },
    async insert(schema, record) { calls.push(['insert', schema.table, record.status]); }
  };
}

const queueManager = createQueueManager('MT103\n:20:TEST-1');
const databaseManager = createDatabaseManager();
const daemon = createMt103Pacs008Daemon({
  queueManager,
  databaseManager,
  conversionService: { async convert(payload) { return { payload: `PACS008:${payload}` }; } }
});

await daemon.ensureTables();
const result = await daemon.processOnce({ workerId: 'test-worker' });
assert.equal(result.status, 'completed');
assert.deepEqual(databaseManager.calls.slice(0, 2), [
  ['createTable', 'incoming_messages'],
  ['createTable', 'outgoing_messages']
]);
assert.deepEqual(databaseManager.calls.slice(2), [
  ['insert', 'incoming_messages', 'received'],
  ['insert', 'outgoing_messages', 'ready']
]);
assert.equal(queueManager.calls.filter(call => call[0] === 'enqueue').length, 1);
assert.equal(queueManager.calls.filter(call => call[0] === 'complete').length, 1);

const failedQueue = createQueueManager('MT103\n:20:FAIL-1');
const failedDatabase = createDatabaseManager();
const failedDaemon = createMt103Pacs008Daemon({
  queueManager: failedQueue,
  databaseManager: failedDatabase,
  conversionService: { async convert() { throw new Error('conversion unavailable'); } }
});
const failed = await failedDaemon.processOnce({ workerId: 'failure-worker' });
assert.equal(failed.status, 'failed');
assert.equal(failedQueue.calls.filter(call => call[0] === 'fail').length, 1);
assert.equal(failedDatabase.calls.at(-1)[2], 'failed');

console.log('[mt103-pacs008-daemon] PASS: logical queue/database/service sequence and failure handling');
