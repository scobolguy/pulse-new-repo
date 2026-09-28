import assert from 'node:assert/strict';
import { createMt103Pacs008Daemon } from '../src/backend/mt103Pacs008Daemon.mjs';

const messages = Array.from({ length: 10 }, (_, index) => ({
  messageId: `mt103-${String(index + 1).padStart(3, '0')}`,
  message: `MT103\n:20:BATCH-${String(index + 1).padStart(3, '0')}\n:32A:260914USD${(100 + index).toFixed(2)}`,
  messageEnvelope: { correlationId: `corr-${String(index + 1).padStart(3, '0')}` }
}));

const incoming = [];
const outgoing = [];
const published = [];
let claimIndex = 0;
const queueManager = {
  async claim() {
    const message = messages[claimIndex++];
    return message ? { claimToken: `claim-${claimIndex}`, attempts: 1, message } : null;
  },
  async enqueue(queueName, payload, sourceService, messageId, envelope) {
    published.push({ queueName, payload, sourceService, messageId, envelope });
  },
  async completeClaim() {},
  async failClaim(queueName, claimToken, workerId, options) {
    throw new Error(`Unexpected failure: ${queueName}/${claimToken}/${workerId}/${options?.reason}`);
  }
};
const databaseManager = {
  async createTable() {},
  async insert(schema, record) {
    (schema.table === 'incoming_messages' ? incoming : outgoing).push(record);
  }
};
const daemon = createMt103Pacs008Daemon({
  queueManager,
  databaseManager,
  conversionService: {
    async convert(payload, context) {
      return { messageId: `${context.messageId}-pacs008`, payload: `PACS008:${payload}` };
    }
  }
});

await daemon.ensureTables();
const results = [];
for (let index = 0; index < 10; index += 1) results.push(await daemon.processOnce({ workerId: 'batch-worker' }));

assert.equal(results.filter(result => result.status === 'completed').length, 10);
assert.equal(incoming.length, 10);
assert.equal(outgoing.length, 10);
assert.equal(published.length, 10);
assert.equal(new Set(incoming.map(record => record.message_id)).size, 10);
assert.equal(new Set(outgoing.map(record => record.message_id)).size, 10);
assert.deepEqual(
  published.map(item => item.payload),
  messages.map(item => `PACS008:${item.message}`)
);
assert.equal((await daemon.processOnce()).status, 'idle');

console.log('[mt103-pacs008-daemon-batch] PASS: 10 unique MT103 messages processed without cross-message mixups');
