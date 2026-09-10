import { randomUUID } from 'node:crypto';

let amqplibImportPromise = null;
function loadAmqplib() {
  if (!amqplibImportPromise) amqplibImportPromise = import('amqplib');
  return amqplibImportPromise;
}

function sanitizeQueueSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

/**
 * Work-queue provider backed by RabbitMQ (see queueManagerContract in
 * ./index.mjs for the interface this implements). "claim" is basic.get held
 * unacked, tracked locally with a lease; a periodic reaper nacks+requeues
 * claims whose lease expired without a heartbeat/complete/fail.
 */
export default class RabbitMqQueueManagerAdapter {
  constructor(name, options = {}) {
    this.name = name;
    this.url = String(options.url || process.env.RABBITMQ_URL || 'amqp://localhost').trim() || 'amqp://localhost';
    this.queuePrefix = sanitizeQueueSegment(options.queuePrefix || process.env.RABBITMQ_QUEUE_PREFIX || 'pulse');
    this.queueConfig = {};
    this.connection = null;
    this.channel = null;
    this.readyPromise = null;
    this.claims = new Map(); // claimToken -> { queueName, workerId, deliveryTag, message, leaseMs, claimedAt, leaseExpiresAt, attempts }
    this.reaperTimer = setInterval(() => { void this.reapExpiredClaims(); }, 5000);
    this.reaperTimer.unref?.();
    this.warnedReplicationOnce = false;
  }

  fullQueueName(queueName) {
    return `${this.queuePrefix}.${sanitizeQueueSegment(queueName)}`;
  }

  async connect() {
    if (this.channel) return this.channel;
    if (!this.readyPromise) {
      this.readyPromise = this.initialize().catch((error) => {
        this.readyPromise = null;
        throw error;
      });
    }
    return this.readyPromise;
  }

  async initialize() {
    const amqplib = await loadAmqplib();
    const connection = await amqplib.connect(this.url);
    connection.on('close', () => {
      this.connection = null;
      this.channel = null;
      this.readyPromise = null;
    });
    const channel = await connection.createChannel();
    await channel.prefetch(50);
    this.connection = connection;
    this.channel = channel;
    return channel;
  }

  // ── Queue lifecycle ───────────────────────────────────────────────────
  async createQueue(queueName, queueConfig = {}) {
    const channel = await this.connect();
    await channel.assertQueue(this.fullQueueName(queueName), { durable: true });
    this.queueConfig[queueName] = { name: queueName, createdAt: Date.now(), frozen: false, ...queueConfig };
    return this.queueConfig[queueName];
  }

  getConfig(queueName) { return this.queueConfig[queueName] || {}; }
  getStatus(queueName) { return this.queueConfig[queueName] || { frozen: false }; }
  getAllQueueConfigs() { return { configVersion: 0, operationVersion: 0, queues: { ...this.queueConfig } }; }

  async deleteQueue(queueName) {
    const channel = await this.connect();
    await channel.deleteQueue(this.fullQueueName(queueName));
    delete this.queueConfig[queueName];
  }

  async truncateQueue(queueName) {
    const channel = await this.connect();
    const { messageCount } = await channel.purgeQueue(this.fullQueueName(queueName));
    return messageCount || 0;
  }

  // ── Enqueue / dequeue ─────────────────────────────────────────────────
  async enqueue(queueName, message, sourceService, messageId = null, messageEnvelope = null) {
    const channel = await this.connect();
    const resolvedMessageId = messageId || randomUUID();
    const payload = { message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null };
    channel.sendToQueue(this.fullQueueName(queueName), Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      messageId: resolvedMessageId
    });
    return resolvedMessageId;
  }

  async dequeue(queueName) {
    const channel = await this.connect();
    const msg = await channel.get(this.fullQueueName(queueName), { noAck: false });
    if (!msg) return null;
    const payload = JSON.parse(msg.content.toString('utf8'));
    channel.ack(msg);
    return payload;
  }

  // ── Claim / lease (competing-consumer work queue) ────────────────────
  async claim(queueName, workerId, leaseMs = 30000) {
    const channel = await this.connect();
    const msg = await channel.get(this.fullQueueName(queueName), { noAck: false });
    if (!msg) return null;

    const payload = JSON.parse(msg.content.toString('utf8'));
    const claimToken = randomUUID();
    const safeLeaseMs = Math.max(1000, Number(leaseMs || 30000));
    const now = Date.now();
    const attempts = Number(payload?.message?.attemptCount || 0) + 1;
    const claim = {
      queueName,
      workerId: String(workerId || 'anonymous-worker'),
      claimToken,
      leaseMs: safeLeaseMs,
      claimedAt: now,
      leaseExpiresAt: now + safeLeaseMs,
      attempts,
      deliveryTag: msg.fields.deliveryTag,
      message: { ...payload, attemptCount: attempts }
    };
    this.claims.set(claimToken, claim);

    return {
      queueName,
      workerId: claim.workerId,
      claimToken,
      leaseExpiresAt: claim.leaseExpiresAt,
      attempts,
      message: claim.message
    };
  }

  heartbeatClaim(queueName, claimToken, workerId, extendMs = 30000) {
    const claim = this.claims.get(claimToken);
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';

    const safeExtendMs = Math.max(1000, Number(extendMs || claim.leaseMs || 30000));
    claim.leaseMs = safeExtendMs;
    claim.leaseExpiresAt = Date.now() + safeExtendMs;
    return { queueName, claimToken, workerId: claim.workerId, leaseExpiresAt: claim.leaseExpiresAt };
  }

  async completeClaim(queueName, claimToken, workerId, completionMeta = null) {
    const claim = this.claims.get(claimToken);
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';

    const channel = await this.connect();
    channel.ack({ fields: { deliveryTag: claim.deliveryTag } });
    this.claims.delete(claimToken);
    return {
      queueName,
      claimToken,
      workerId: claim.workerId,
      messageId: claim?.message?.messageId || null,
      attempts: claim.attempts,
      completionMeta: completionMeta || null
    };
  }

  async failClaim(queueName, claimToken, workerId, options = {}) {
    const claim = this.claims.get(claimToken);
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';

    const channel = await this.connect();
    const reason = String(options.reason || 'worker-failed').slice(0, 400);
    const maxAttempts = Math.max(1, Number(options.maxAttempts || 5));
    const moveToDeadLetter = Boolean(options.deadLetter || claim.attempts >= maxAttempts);
    this.claims.delete(claimToken);

    if (moveToDeadLetter) {
      // Drop from this queue; route to a dead-letter queue by configuring
      // an x-dead-letter-exchange on the underlying RabbitMQ queue if needed.
      channel.nack({ fields: { deliveryTag: claim.deliveryTag } }, false, false);
      return { status: 'dead-letter', attempts: claim.attempts, queueName, reason };
    }

    channel.nack({ fields: { deliveryTag: claim.deliveryTag } }, false, true);
    return {
      status: 'requeued',
      queueName,
      attempts: claim.attempts,
      availableAt: Date.now() + Math.max(0, Number(options.delayMs || 0)),
      reason
    };
  }

  reapExpiredClaims(queueName = null, nowMs = Date.now()) {
    let requeued = 0;
    for (const [token, claim] of this.claims.entries()) {
      if (queueName && claim.queueName !== queueName) continue;
      if (claim.leaseExpiresAt > nowMs) continue;
      this.channel?.nack({ fields: { deliveryTag: claim.deliveryTag } }, false, true);
      this.claims.delete(token);
      requeued += 1;
    }
    return requeued;
  }

  async getQueueLength(queueName) {
    const channel = await this.connect();
    const { messageCount } = await channel.checkQueue(this.fullQueueName(queueName));
    return messageCount || 0;
  }

  getPersistenceStatus() {
    return { enabled: true, backend: 'rabbitmq', url: this.url, checkedAt: new Date().toISOString() };
  }

  // ── PULSE in-house replication layer does not apply here: RabbitMQ ──────
  // ── replicates/persists natively (durable + mirrored/quorum queues). ────
  warnReplicationNoOp(method) {
    if (this.warnedReplicationOnce) return;
    this.warnedReplicationOnce = true;
    console.warn(`[QUEUE-MANAGER] ${method}() is a no-op on the 'rabbitmq' provider — RabbitMQ handles durability/replication natively.`);
  }

  enqueueReplicated() { this.warnReplicationNoOp('enqueueReplicated'); }
  dequeueReplicated() { this.warnReplicationNoOp('dequeueReplicated'); return null; }
  getSnapshot() {
    return { name: this.name, version: 0, configVersion: 0, queueLengths: {}, claimMetrics: {}, queueConfig: { ...this.queueConfig }, timestamp: Date.now() };
  }
  applySnapshot() { this.warnReplicationNoOp('applySnapshot'); }
  getCurrentVersion() { return 0; }
  getOperationsSince() { return []; }
  applyReplicatedOperation() { this.warnReplicationNoOp('applyReplicatedOperation'); return null; }
  onConfigChange() { /* no-op: no cross-instance config push needed for this provider */ }
  freezeQueue(queueName) { this.queueConfig[queueName] = { ...(this.queueConfig[queueName] || {}), frozen: true }; }
  thawQueue(queueName) { this.queueConfig[queueName] = { ...(this.queueConfig[queueName] || {}), frozen: false }; }

  async close() {
    clearInterval(this.reaperTimer);
    try { await this.channel?.close(); } catch { /* already closed */ }
    try { await this.connection?.close(); } catch { /* already closed */ }
  }
}
