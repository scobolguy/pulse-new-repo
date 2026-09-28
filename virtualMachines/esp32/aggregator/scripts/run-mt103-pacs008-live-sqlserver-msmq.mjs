import assert from 'node:assert/strict';
import { createDatabaseProvider } from '../src/backend/databaseProviders/index.mjs';
import MsmqQueueManagerAdapter from '../src/broker/queueManagerProviders/MsmqQueueManagerAdapter.mjs';
import { createMt103Pacs008Daemon } from '../src/backend/mt103Pacs008Daemon.mjs';

const database = createDatabaseProvider('mssql', {
  connectionString: process.env.MSSQL_DATABASE_CONNECTION_STRING || process.env.GROUP_MSSQL_CONNECTION_STRING
});
const queue = new MsmqQueueManagerAdapter('qm-secondary', {
  baseQueuePath: process.env.MSMQ_BASE_QUEUE_PATH || '.\\private$',
  queuePrefix: process.env.MSMQ_QUEUE_PREFIX || 'pulse-msmq-live'
});
const inputQueue = 'mt103-live-in';
const outputQueue = 'pacs008-live-out';
const incomingSchema = {
  table: 'incoming_messages',
  columns: {
    correlation_id: 'VARCHAR(128)', message_id: 'VARCHAR(128)', payload: 'VARCHAR(MAX)',
    status: 'VARCHAR(32)', received_at: 'VARCHAR(40)', attempts: 'INT', error: 'VARCHAR(MAX)'
  }
};
const outgoingSchema = {
  table: 'outgoing_messages',
  columns: {
    correlation_id: 'VARCHAR(128)', message_id: 'VARCHAR(128)', payload: 'VARCHAR(MAX)',
    status: 'VARCHAR(32)', created_at: 'VARCHAR(40)', published_at: 'VARCHAR(40)', error: 'VARCHAR(MAX)'
  }
};

try {
  await database.createTable(incomingSchema);
  await database.createTable(outgoingSchema);
  await database.query("DELETE FROM [incoming_messages] WHERE [correlation_id] LIKE 'live-sqlserver-msmq-%'");
  await database.query("DELETE FROM [outgoing_messages] WHERE [correlation_id] LIKE 'live-sqlserver-msmq-%'");
  await queue.createQueue(inputQueue, { managerId: 'qm-secondary', provider: 'msmq' });
  await queue.createQueue(outputQueue, { managerId: 'qm-secondary', provider: 'msmq' });
  await queue.truncateQueue(inputQueue);
  await queue.truncateQueue(outputQueue);

  for (let index = 1; index <= 10; index += 1) {
    const id = String(index).padStart(3, '0');
    await queue.enqueue(inputQueue, `MT103\n:20:LIVE-${id}\n:32A:260914USD${(100 + index).toFixed(2)}`, 'live-test', `live-mt103-${id}`, { correlationId: `live-sqlserver-msmq-${id}` });
  }

  const daemon = createMt103Pacs008Daemon({
    queueManager: queue,
    databaseManager: database,
    queues: { input: inputQueue, output: outputQueue },
    conversionService: {
      async convert(payload, context) {
        return { messageId: `${context.messageId}-pacs008`, payload: `PACS008\n:20:${context.correlationId}\n:PAYLOAD:${payload}` };
      }
    }
  });
  await daemon.ensureTables();

  const results = [];
  for (let index = 0; index < 10; index += 1) results.push(await daemon.processOnce({ workerId: 'live-sqlserver-msmq-worker' }));
  assert.equal(results.filter(result => result.status === 'completed').length, 10);

  const incomingRows = await database.query("SELECT correlation_id, message_id, status FROM [incoming_messages] WHERE correlation_id LIKE 'live-sqlserver-msmq-%' ORDER BY correlation_id");
  const outgoingRows = await database.query("SELECT correlation_id, message_id, status FROM [outgoing_messages] WHERE correlation_id LIKE 'live-sqlserver-msmq-%' ORDER BY correlation_id");
  const outputLength = await queue.getQueueLength(outputQueue);
  assert.equal(incomingRows.length, 10);
  assert.equal(outgoingRows.length, 10);
  assert.equal(outputLength, 10);

  console.log(JSON.stringify({
    status: 'PASS',
    database: { provider: database.provider, tables: ['incoming_messages', 'outgoing_messages'], incomingRows: incomingRows.length, outgoingRows: outgoingRows.length },
    queue: { provider: 'msmq', managerId: 'qm-secondary', inputQueue, outputQueue, outputDepth: outputLength },
    rows: { incoming: incomingRows, outgoing: outgoingRows }
  }, null, 2));
} finally {
  if (process.env.CLEANUP_LIVE_ARTIFACTS === '1') {
    await queue.deleteQueue(inputQueue).catch(() => {});
    await queue.deleteQueue(outputQueue).catch(() => {});
  }
  queue.close();
  await database.close().catch(() => {});
}
