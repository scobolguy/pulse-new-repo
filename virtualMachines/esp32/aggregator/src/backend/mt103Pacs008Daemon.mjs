function required(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function getPacs008EndToEndId(payload) {
  const transaction = payload?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf;
  const firstTransaction = Array.isArray(transaction) ? transaction[0] : transaction;
  return String(firstTransaction?.PmtId?.EndToEndId || '').trim();
}

export function createMt103Pacs008Daemon({
  queueManager,
  databaseManager,
  conversionService,
  tables = { incoming: 'incoming_messages', outgoing: 'outgoing_messages' },
  queues = { input: 'incoming_mt103', output: 'outgoing_message' },
  sourceService = 'mt103-pacs008-daemon',
  now = () => new Date().toISOString()
} = {}) {
  if (!queueManager) throw new Error('queueManager is required');
  if (!databaseManager) throw new Error('databaseManager is required');
  if (!conversionService?.convert) throw new Error('conversionService.convert is required');

  const incomingSchema = {
    table: tables.incoming,
    columns: {
      correlation_id: 'VARCHAR(128)',
      message_id: 'VARCHAR(128)',
      payload: 'TEXT',
      status: 'VARCHAR(32)',
      received_at: 'VARCHAR(40)',
      attempts: 'INTEGER',
      error: 'TEXT'
    }
  };
  const outgoingSchema = {
    table: tables.outgoing,
    columns: {
      correlation_id: 'VARCHAR(128)',
      message_id: 'VARCHAR(128)',
      payload: 'TEXT',
      status: 'VARCHAR(32)',
      created_at: 'VARCHAR(40)',
      published_at: 'VARCHAR(40)',
      error: 'TEXT'
    }
  };

  async function ensureTables() {
    await databaseManager.createTable(incomingSchema);
    await databaseManager.createTable(outgoingSchema);
  }

  async function processOnce({ workerId = sourceService, leaseMs = 30000 } = {}) {
    const claim = await queueManager.claim(required(queues.input, 'queues.input'), workerId, leaseMs);
    if (!claim) return { status: 'idle' };

    const envelope = claim.message?.messageEnvelope || {};
    const payload = claim.message?.message ?? claim.message;
    const messageId = String(claim.message?.messageId || envelope.messageId || '').trim() || `claim-${claim.claimToken}`;
    const correlationId = String(envelope.correlationId || payload?.correlationId || messageId).trim();
    const receivedAt = now();

    try {
      await databaseManager.insert(incomingSchema, {
        correlation_id: correlationId,
        message_id: messageId,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        status: 'received',
        received_at: receivedAt,
        attempts: claim.attempts || 1,
        error: null
      });

      const converted = await conversionService.convert(payload, { correlationId, messageId });
      const outgoingPayload = converted?.payload ?? converted;
      const outgoingMessageId = String(converted?.messageId || `${messageId}-pacs008`).trim();
      await databaseManager.insert(outgoingSchema, {
        correlation_id: correlationId,
        message_id: outgoingMessageId,
        payload: typeof outgoingPayload === 'string' ? outgoingPayload : JSON.stringify(outgoingPayload),
        status: 'ready',
        created_at: now(),
        published_at: null,
        error: null
      });

      const endToEndId = getPacs008EndToEndId(outgoingPayload);
      if (endToEndId) {
        console.log(`[${sourceService}] output queue ${queues.output} EndToEndId=${endToEndId}`);
      }
      await queueManager.enqueue(required(queues.output, 'queues.output'), outgoingPayload, sourceService, outgoingMessageId, {
        correlationId,
        sourceMessageId: messageId,
        messageType: 'pacs008'
      });
      await queueManager.completeClaim(queues.input, claim.claimToken, workerId, { correlationId, outgoingMessageId });
      return { status: 'completed', correlationId, messageId, outgoingMessageId };
    } catch (error) {
      const detail = String(error?.message || error);
      await databaseManager.insert(incomingSchema, {
        correlation_id: correlationId,
        message_id: messageId,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        status: 'failed',
        received_at: receivedAt,
        attempts: claim.attempts || 1,
        error: detail
      }).catch(() => {});
      await queueManager.failClaim(queues.input, claim.claimToken, workerId, { reason: detail });
      return { status: 'failed', correlationId, messageId, error: detail };
    }
  }

  return { incomingSchema, outgoingSchema, ensureTables, processOnce };
}
