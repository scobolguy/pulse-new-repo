// QueueManager with distributed config sync and operation logging for replication
import { QueueManagerPersistence } from './QueueManagerPersistence.mjs';
import { randomUUID } from 'crypto';

export default class QueueManager {
  constructor(name = 'default', persistPath = null) {
    this.name = name;
    this.queues = {}; // {queueName: {messages: [], config: {...}}}
    this.queueConfig = {}; // Separate track of queue configurations
    this.operationLog = []; // Tracks all mutations for replication
    this.operationLogVersion = 0; // Version number for consistency
    this.persistPath = persistPath; // Path to persist config on disk
    this.configVersion = 0; // Version of config for sync detection
    this.peerNotifyCallbacks = []; // Callbacks to notify peer instances on config change
    this.persistence = persistPath ? new QueueManagerPersistence(name, persistPath) : null;
    this.seenMessageIds = new Set(); // Deduplication for replicated enqueues
    this.snapshotEveryOps = 200;
    this.retainOpsAfterSnapshot = 500;
    this.opsSinceCheckpoint = 0;
    this.inflightClaims = {}; // { queueName: { token: claim } }
    this.deadLetters = {}; // { queueName: [deadLetterItem] }
    this.loadFromDisk();
  }

  inferDefaultPersistMessages(queueName) {
    const normalizedQueueName = String(queueName || '').trim().toLowerCase();
    if (!normalizedQueueName) return true;

    if (normalizedQueueName === 'tx.reconciled') return false;
    if (normalizedQueueName === 'tx.completed') return false;
    if (normalizedQueueName === 'correspondent.pacs008.outbound') return false;
    return true;
  }

  shouldPersistQueueMessages(queueName) {
    const config = this.queueConfig[queueName] || null;
    if (typeof config?.persistMessages === 'boolean') {
      return config.persistMessages;
    }
    return this.inferDefaultPersistMessages(queueName);
  }

  ensureQueueReady(queueName) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} not configured`);
    }
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    if (!Array.isArray(this.queues[queueName].messages)) this.queues[queueName].messages = [];
  }

  ensureClaimBucket(queueName) {
    if (!this.inflightClaims[queueName]) this.inflightClaims[queueName] = {};
    return this.inflightClaims[queueName];
  }

  ensureDeadLetterBucket(queueName) {
    if (!this.deadLetters[queueName]) this.deadLetters[queueName] = [];
    return this.deadLetters[queueName];
  }

  findNextAvailableMessageIndex(queueName, nowMs = Date.now()) {
    this.ensureQueueReady(queueName);
    const queue = this.queues[queueName].messages;
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      const availableAt = Number(item?.availableAt || 0);
      if (!Number.isFinite(availableAt) || availableAt <= nowMs) return i;
    }
    return -1;
  }

  popNextAvailableMessage(queueName, nowMs = Date.now()) {
    const idx = this.findNextAvailableMessageIndex(queueName, nowMs);
    if (idx < 0) return null;
    return this.queues[queueName].messages.splice(idx, 1)[0] || null;
  }

  claim(queueName, workerId, leaseMs = 30000) {
    this.ensureQueueReady(queueName);
    this.reapExpiredClaims(queueName);

    const message = this.popNextAvailableMessage(queueName, Date.now());
    if (!message) return null;

    const safeLeaseMs = Math.max(1000, Number(leaseMs || 30000));
    const claimToken = randomUUID();
    const now = Date.now();
    const attempts = Number(message?.attemptCount || 0) + 1;

    const claim = {
      queueName,
      workerId: String(workerId || 'anonymous-worker'),
      claimToken,
      leaseMs: safeLeaseMs,
      claimedAt: now,
      leaseExpiresAt: now + safeLeaseMs,
      attempts,
      message: {
        ...message,
        attemptCount: attempts,
      }
    };

    this.ensureClaimBucket(queueName)[claimToken] = claim;

    this.logOperation({
      type: 'claim',
      queueName,
      workerId: claim.workerId,
      claimToken,
      messageId: message?.messageId || null,
      attempts,
      leaseMs: safeLeaseMs
    });

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
    this.ensureQueueReady(queueName);
    const claims = this.ensureClaimBucket(queueName);
    const claim = claims[claimToken];
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';

    const safeExtendMs = Math.max(1000, Number(extendMs || claim.leaseMs || 30000));
    claim.leaseMs = safeExtendMs;
    claim.leaseExpiresAt = Date.now() + safeExtendMs;

    this.logOperation({
      type: 'claim-heartbeat',
      queueName,
      workerId: claim.workerId,
      claimToken,
      leaseMs: safeExtendMs
    });

    return {
      queueName,
      claimToken,
      workerId: claim.workerId,
      leaseExpiresAt: claim.leaseExpiresAt
    };
  }

  completeClaim(queueName, claimToken, workerId, completionMeta = null) {
    this.ensureQueueReady(queueName);
    const claims = this.ensureClaimBucket(queueName);
    const claim = claims[claimToken];
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';

    if (claim?.message?.filePath && this.persistence) {
      this.persistence.removeMessageFile(claim.message.filePath);
    }

    delete claims[claimToken];
    this.logOperation({
      type: 'claim-complete',
      queueName,
      workerId: claim.workerId,
      claimToken,
      messageId: claim?.message?.messageId || null,
      completionMeta: completionMeta || null
    });

    return {
      queueName,
      claimToken,
      workerId: claim.workerId,
      messageId: claim?.message?.messageId || null,
      attempts: claim.attempts
    };
  }

  failClaim(queueName, claimToken, workerId, options = {}) {
    this.ensureQueueReady(queueName);
    const claims = this.ensureClaimBucket(queueName);
    const claim = claims[claimToken];
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';

    const reason = String(options.reason || 'worker-failed').slice(0, 400);
    const delayMs = Math.max(0, Number(options.delayMs || 0));
    const maxAttempts = Math.max(1, Number(options.maxAttempts || 5));
    const moveToDeadLetter = Boolean(options.deadLetter || claim.attempts >= maxAttempts);

    delete claims[claimToken];

    if (moveToDeadLetter) {
      const deadItem = {
        queueName,
        failedAt: Date.now(),
        reason,
        attempts: claim.attempts,
        workerId: claim.workerId,
        claimToken,
        message: claim.message
      };
      this.ensureDeadLetterBucket(queueName).push(deadItem);
      if (claim?.message?.filePath && this.persistence) {
        this.persistence.removeMessageFile(claim.message.filePath);
      }
      this.logOperation({
        type: 'claim-dead-letter',
        queueName,
        workerId: claim.workerId,
        claimToken,
        messageId: claim?.message?.messageId || null,
        attempts: claim.attempts,
        reason
      });
      return { status: 'dead-letter', attempts: claim.attempts, queueName, reason };
    }

    const retryMessage = {
      ...claim.message,
      attemptCount: claim.attempts,
      availableAt: Date.now() + delayMs,
      lastError: reason,
      lastWorkerId: claim.workerId
    };
    this.queues[queueName].messages.push(retryMessage);

    this.logOperation({
      type: 'claim-requeue',
      queueName,
      workerId: claim.workerId,
      claimToken,
      messageId: retryMessage?.messageId || null,
      attempts: claim.attempts,
      reason,
      delayMs
    });

    return {
      status: 'requeued',
      queueName,
      attempts: claim.attempts,
      availableAt: retryMessage.availableAt,
      reason
    };
  }

  reapExpiredClaims(queueName = null, nowMs = Date.now()) {
    const targets = queueName ? [queueName] : Object.keys(this.inflightClaims || {});
    let requeued = 0;

    for (const qn of targets) {
      const claims = this.inflightClaims[qn] || {};
      for (const [token, claim] of Object.entries(claims)) {
        if (Number(claim.leaseExpiresAt || 0) > nowMs) continue;

        delete claims[token];
        this.ensureQueueReady(qn);
        this.queues[qn].messages.push({
          ...(claim.message || {}),
          attemptCount: Number(claim.attempts || claim?.message?.attemptCount || 1),
          availableAt: nowMs,
          leaseExpired: true,
          lastWorkerId: claim.workerId,
        });
        requeued += 1;

        this.logOperation({
          type: 'claim-expired-requeue',
          queueName: qn,
          workerId: claim.workerId,
          claimToken: token,
          messageId: claim?.message?.messageId || null,
          attempts: claim.attempts || null
        });
      }
    }

    return requeued;
  }

  getClaimMetrics(queueName = null) {
    const targets = queueName ? [queueName] : Object.keys(this.queues || {});
    const byQueue = {};

    for (const qn of targets) {
      const claims = Object.values(this.inflightClaims[qn] || {});
      byQueue[qn] = {
        queued: this.getQueueLength(qn),
        inflight: claims.length,
        deadLetter: (this.deadLetters[qn] || []).length
      };
    }

    return byQueue;
  }

  // Load configuration and operations from disk
  loadFromDisk() {
    if (!this.persistence) return;
    
    try {
      let configNeedsSave = false;
      let snapshotQueueLengths = {};
      const snapshot = this.persistence.loadSnapshot();
      if (snapshot) {
        this.queues = JSON.parse(JSON.stringify(snapshot.queues || {}));
        this.queueConfig = JSON.parse(JSON.stringify(snapshot.queueConfig || {}));
        this.configVersion = Number(snapshot.configVersion || 0);
        this.operationLogVersion = Number(snapshot.operationLogVersion || 0);
        snapshotQueueLengths = snapshot.queueLengths || {};
      }

      const configData = this.persistence.loadConfig();
      if (configData) {
        this.queueConfig = configData.queueConfig || {};
        this.configVersion = Math.max(this.configVersion, Number(configData.configVersion || 0));
        // Reinitialize queues to match config
        for (const queueName of Object.keys(this.queueConfig)) {
          if (typeof this.queueConfig[queueName]?.persistMessages !== 'boolean') {
            this.queueConfig[queueName] = {
              ...(this.queueConfig[queueName] || {}),
              persistMessages: this.inferDefaultPersistMessages(queueName)
            };
            configNeedsSave = true;
          }
          if (!this.queues[queueName]) {
            this.queues[queueName] = { messages: [] };
          }
        }
      }
      
      const operations = this.persistence.loadOperations();
      for (const op of operations) {
        if (op.version && op.version <= this.operationLogVersion) {
          continue;
        }
        if (op.version && op.version > this.operationLogVersion) {
          this.operationLogVersion = op.version;
        }
        this.operationLog.push(op);
        this.applyOperationToState(op);
      }
      if (this.operationLog.length > 1000) {
        this.operationLog = this.operationLog.slice(-1000);
      }

      if (configNeedsSave) {
        this.persistence.saveConfig(this.queueConfig, this.configVersion);
      }

      this.restoreQueueMessagesFromFiles(snapshotQueueLengths);
    } catch (e) {
      console.error(`Error loading from disk for ${this.name}:`, e.message);
    }
  }

  restoreQueueMessagesFromFiles(snapshotQueueLengths = {}) {
    if (!this.persistence) return;

    for (const queueName of Object.keys(this.queues)) {
      if (!this.shouldPersistQueueMessages(queueName)) {
        this.persistence.removeQueueStorage(queueName);
        this.queues[queueName].messages = [];
        continue;
      }

      const expectedLength = Number(snapshotQueueLengths?.[queueName]);
      if (Number.isFinite(expectedLength) && expectedLength === 0) {
        const removedCount = this.persistence.removeAllQueueMessageFiles(queueName);
        if (removedCount > 0) {
          console.warn(`[QueueManager] Swept ${removedCount} stale message file(s) during startup for ${this.name}/${queueName}`);
        }
        this.queues[queueName].messages = [];
        continue;
      }

      const diskMessages = this.persistence.loadQueueMessages(queueName);
      if (diskMessages.length > 0) {
        this.queues[queueName].messages = diskMessages;
        continue;
      }

      const inMemoryMessages = Array.isArray(this.queues[queueName].messages)
        ? this.queues[queueName].messages
        : [];
      if (inMemoryMessages.length === 0) continue;

      const migrated = [];
      for (const msg of inMemoryMessages) {
        const messageId = msg && msg.messageId ? msg.messageId : randomUUID();
        try {
          const persisted = this.persistence.persistQueueMessage(queueName, {
            message: msg ? msg.message : null,
            sourceService: msg ? msg.sourceService : null,
            messageId,
            messageEnvelope: msg ? (msg.messageEnvelope || null) : null
          });
          migrated.push(persisted);
        } catch (e) {
          console.error(`Error migrating queued message for ${this.name}/${queueName}:`, e.message);
          migrated.push({
            message: msg ? msg.message : null,
            sourceService: msg ? msg.sourceService : null,
            messageId,
            messageEnvelope: msg ? (msg.messageEnvelope || null) : null
          });
        }
      }
      this.queues[queueName].messages = migrated;
    }
  }

  sweepStalePersistedMessages() {
    if (!this.persistence) return 0;

    let removedCount = 0;
    for (const queueName of Object.keys(this.queues || {})) {
      if (!this.shouldPersistQueueMessages(queueName)) {
        this.persistence.removeQueueStorage(queueName);
        this.queues[queueName].messages = [];
        continue;
      }

      if (this.getQueueLength(queueName) !== 0) {
        continue;
      }

      removedCount += this.persistence.removeAllQueueMessageFiles(queueName);
    }

    return removedCount;
  }

  checkpointPersistence() {
    if (!this.persistence) return;

    const queueLengths = {};
    for (const queueName of Object.keys(this.queues)) {
      queueLengths[queueName] = this.getQueueLength(queueName);
    }

    this.persistence.saveSnapshot({
      queueManagerName: this.name,
      queueConfig: this.queueConfig,
      queueLengths,
      configVersion: this.configVersion,
      operationLogVersion: this.operationLogVersion,
      timestamp: Date.now()
    });

    const retainedOperations = this.operationLog.slice(-this.retainOpsAfterSnapshot);
    this.persistence.replaceOperations(retainedOperations);
    this.operationLog = retainedOperations;
    this.opsSinceCheckpoint = 0;
  }

  applyOperationToState(operation) {
    if (!operation || typeof operation !== 'object') return;

    const { type, queueName, config } = operation;

    if (type === 'createQueue') {
      if (!this.queueConfig[queueName]) {
        this.queueConfig[queueName] = {
          name: queueName,
          createdAt: Date.now(),
          frozen: false,
          queueClass: 'permanent',
          ...(config || {})
        };
      }
      if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
      return;
    }

    if (type === 'deleteQueue') {
      delete this.queueConfig[queueName];
      delete this.queues[queueName];
      return;
    }

    if (type === 'updateQueueConfig') {
      this.queueConfig[queueName] = {
        ...(this.queueConfig[queueName] || { name: queueName, createdAt: Date.now(), frozen: false, queueClass: 'permanent' }),
        ...(config || {})
      };
      if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
      return;
    }

    if (type === 'truncateQueue') {
      if (this.persistence) {
        this.persistence.removeQueueStorage(queueName);
      }
      if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
      this.queues[queueName].messages = [];
      return;
    }

  }

  // Save configuration to disk
  saveToDisk() {
    if (!this.persistence) return;
    try {
      this.persistence.saveConfig(this.queueConfig, this.configVersion);
    } catch (e) {
      console.error(`Error saving to disk for ${this.name}:`, e.message);
    }
  }

  // Register callback for peer sync notifications
  onConfigChange(callback) {
    this.peerNotifyCallbacks.push(callback);
  }

  // Notify all registered peers of config change
  async notifyPeers(operation) {
    for (const callback of this.peerNotifyCallbacks) {
      try {
        await callback(operation);
      } catch (e) {
        console.error(`Error notifying peer: ${e.message}`);
      }
    }
  }

  // Create a new queue configuration
  createQueue(queueName, queueConfig = {}) {
    if (this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} already exists`);
    }
    this.queueConfig[queueName] = { 
      name: queueName, 
      createdAt: Date.now(), 
      frozen: false,
      queueClass: 'permanent',
      persistMessages: this.inferDefaultPersistMessages(queueName),
      ...queueConfig 
    };
    this.queues[queueName] = { messages: [] };
    this.configVersion++;
    this.saveToDisk();
    
    const operation = {
      type: 'createQueue',
      queueName,
      config: this.queueConfig[queueName],
      configVersion: this.configVersion
    };
    this.logOperation(operation);
    this.notifyPeers(operation);
    return this.queueConfig[queueName];
  }

  // Delete a queue configuration
  deleteQueue(queueName) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} does not exist`);
    }
    delete this.queueConfig[queueName];
    delete this.queues[queueName];
    if (this.persistence) {
      this.persistence.removeQueueStorage(queueName);
    }
    this.configVersion++;
    this.saveToDisk();
    
    const operation = {
      type: 'deleteQueue',
      queueName,
      configVersion: this.configVersion
    };
    this.logOperation(operation);
    this.notifyPeers(operation);
  }

  // Update queue configuration
  updateQueueConfig(queueName, updates) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} does not exist`);
    }
    this.queueConfig[queueName] = {
      ...this.queueConfig[queueName],
      persistMessages: this.inferDefaultPersistMessages(queueName),
      ...updates
    };
    this.configVersion++;
    this.saveToDisk();
    
    const operation = {
      type: 'updateQueueConfig',
      queueName,
      config: this.queueConfig[queueName],
      configVersion: this.configVersion
    };
    this.logOperation(operation);
    this.notifyPeers(operation);
    return this.queueConfig[queueName];
  }

  // Get all queue configurations (for sync to peers)
  getAllQueueConfigs() {
    return {
      configVersion: this.configVersion,
      operationVersion: this.operationLogVersion,
      queues: JSON.parse(JSON.stringify(this.queueConfig))
    };
  }

  // Apply config change from peer
  applyConfigChange(operation) {
    const { type, queueName, config, configVersion } = operation;
    
    // Only apply if we don't already have this version
    if (configVersion && configVersion <= this.configVersion) {
      return; // Ignore older versions
    }

    if (type === 'createQueue') {
      this.queueConfig[queueName] = config;
      this.queues[queueName] = { messages: [] };
      if (configVersion) this.configVersion = configVersion;
    } else if (type === 'deleteQueue') {
      delete this.queueConfig[queueName];
      delete this.queues[queueName];
      if (configVersion) this.configVersion = configVersion;
    } else if (type === 'updateQueueConfig') {
      this.queueConfig[queueName] = config;
      if (configVersion) this.configVersion = configVersion;
    }
    
    // Save to disk after applying peer config
    this.saveToDisk();
    
    // Log the operation for other replicas
    this.logOperation(operation);
  }

  // Log an operation for replication

  logOperation(operation) {
    this.operationLog.push({
      version: ++this.operationLogVersion,
      timestamp: Date.now(),
      ...operation
    });
    // Persist to disk
    if (this.persistence) {
      this.persistence.appendOperation(this.operationLog[this.operationLog.length - 1]);
    }
    // Keep only last 1000 operations in memory (prevent unbounded growth)
    if (this.operationLog.length > 1000) {
      this.operationLog.shift();
    }

    this.opsSinceCheckpoint += 1;
    if (this.persistence && this.opsSinceCheckpoint >= this.snapshotEveryOps) {
      this.checkpointPersistence();
    }
  }

  // Get operations since a specific version (for replicas to catch up)
  getOperationsSince(version) {
    return this.operationLog.filter(op => op.version > version);
  }

  // Apply a replicated operation (used by replicas)
  applyReplicatedOperation(operation) {
    const { type, queueName, message, sourceService, messageId, messageEnvelope, removedMessage } = operation;
    
    // Handle config operations first
    if (type === 'createQueue' || type === 'deleteQueue' || type === 'updateQueueConfig') {
      this.applyConfigChange(operation);
      return true;
    }
    
    if (type === 'enqueue') {
      this.enqueueReplicated(queueName, message, sourceService, messageId || null, messageEnvelope || null);
      return true;
    }
    if (type === 'dequeue') {
      return this.dequeueReplicated(queueName, removedMessage || null);
    }
    if (type === 'truncateQueue') {
      return this.truncateQueueReplicated(queueName);
    }
    return null;
  }

  freezeQueue(queueName) {
    this.updateQueueConfig(queueName, { frozen: true });
  }

  thawQueue(queueName) {
    this.updateQueueConfig(queueName, { frozen: false });
  }

  getStatus(queueName) {
    return this.queueConfig[queueName] || { frozen: false };
  }

  setConfig(queueName, config) {
    this.updateQueueConfig(queueName, config);
  }

  getConfig(queueName) {
    return this.queueConfig[queueName] || {};
  }

  enqueue(queueName, message, sourceService, messageId = null, messageEnvelope = null) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} not configured`);
    }
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    if (!this.queues[queueName].messages) this.queues[queueName].messages = [];
    const resolvedMessageId = messageId || randomUUID();
    let queuedItem = { message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null };
    if (this.persistence && this.shouldPersistQueueMessages(queueName)) {
      queuedItem = this.persistence.persistQueueMessage(queueName, queuedItem);
    }
    this.queues[queueName].messages.push(queuedItem);
    this.logOperation({ type: 'enqueue', queueName, message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null });
    return resolvedMessageId;
  }

  // Replicated enqueue: deduplicates by messageId, does not re-log (avoids cascade)
  enqueueReplicated(queueName, message, sourceService, messageId, messageEnvelope = null) {
    if (messageId && this.seenMessageIds.has(messageId)) return;
    if (messageId) {
      this.seenMessageIds.add(messageId);
      if (this.seenMessageIds.size > 10000) {
        this.seenMessageIds.delete(this.seenMessageIds.values().next().value);
      }
    }
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    if (!this.queues[queueName].messages) this.queues[queueName].messages = [];
    const resolvedMessageId = messageId || randomUUID();
    let queuedItem = { message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null };
    if (this.persistence && this.shouldPersistQueueMessages(queueName)) {
      queuedItem = this.persistence.persistQueueMessage(queueName, queuedItem);
    }
    this.queues[queueName].messages.push(queuedItem);
    this.logOperation({ type: 'enqueue', queueName, message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null });
  }

  dequeue(queueName, consumerService) {
    this.ensureQueueReady(queueName);
    const result = this.popNextAvailableMessage(queueName, Date.now());
    if (result === null) return null;
    const candidate = result;
    if (candidate && candidate.filePath && this.persistence) {
      this.persistence.removeMessageFile(candidate.filePath);
    }
    this.logOperation({ type: 'dequeue', queueName, consumerService, removedMessage: result || null });
    return result;
  }

  dequeueReplicated(queueName, removedMessage = null) {
    if (!this.queues[queueName] || !Array.isArray(this.queues[queueName].messages) || this.queues[queueName].messages.length === 0) {
      return null;
    }

    if (!removedMessage) {
      const queue = this.queues[queueName].messages;
      const candidate = queue[0] || null;
      if (candidate && candidate.filePath && this.persistence) {
        this.persistence.removeMessageFile(candidate.filePath);
      }
      const removed = queue.shift() || null;
      if (removed) {
        this.logOperation({ type: 'dequeue', queueName, removedMessage: removed });
      }
      return removed;
    }

    const queue = this.queues[queueName].messages;
    const removedMessageId = removedMessage.messageId || null;
    if (removedMessageId) {
      const idx = queue.findIndex(item => item && item.messageId === removedMessageId);
      if (idx >= 0) {
        const [removed] = queue.splice(idx, 1);
        if (removed && removed.filePath && this.persistence) {
          this.persistence.removeMessageFile(removed.filePath);
        }
        if (removed) {
          this.logOperation({ type: 'dequeue', queueName, removedMessage: removed });
        }
        return removed || null;
      }
    }

    const fallbackIdx = queue.findIndex(item => (
      item &&
      item.sourceService === removedMessage.sourceService &&
      JSON.stringify(item.message) === JSON.stringify(removedMessage.message)
    ));
    if (fallbackIdx >= 0) {
      const [removed] = queue.splice(fallbackIdx, 1);
      if (removed && removed.filePath && this.persistence) {
        this.persistence.removeMessageFile(removed.filePath);
      }
      if (removed) {
        this.logOperation({ type: 'dequeue', queueName, removedMessage: removed });
      }
      return removed || null;
    }

    const removed = queue.shift() || null;
    if (removed && removed.filePath && this.persistence) {
      this.persistence.removeMessageFile(removed.filePath);
    }
    if (removed) {
      this.logOperation({ type: 'dequeue', queueName, removedMessage: removed });
    }
    return removed;
  }

  truncateQueue(queueName) {
    const existed = Boolean(this.queueConfig[queueName] || this.queues[queueName]);
    if (!existed) return 0;

    const removedCount = this.getQueueLength(queueName);
    if (this.persistence) {
      this.persistence.removeQueueStorage(queueName);
    }
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    this.queues[queueName].messages = [];
    this.logOperation({ type: 'truncateQueue', queueName, removedCount });
    return removedCount;
  }

  truncateQueueReplicated(queueName) {
    const existed = Boolean(this.queueConfig[queueName] || this.queues[queueName]);
    if (!existed) return 0;

    const removedCount = this.getQueueLength(queueName);
    if (this.persistence) {
      this.persistence.removeQueueStorage(queueName);
    }
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    this.queues[queueName].messages = [];
    this.logOperation({ type: 'truncateQueue', queueName, removedCount });
    return removedCount;
  }

  getQueueLength(queueName) {
    return (this.queues[queueName] && this.queues[queueName].messages) ? this.queues[queueName].messages.length : 0;
  }

  // Get current version for replica sync
  getCurrentVersion() {
    return this.operationLogVersion;
  }

  // Get full queue state snapshot
  getSnapshot() {
    const queueLengths = {};
    for (const queueName of Object.keys(this.queues)) {
      queueLengths[queueName] = this.getQueueLength(queueName);
    }

    return {
      name: this.name,
      version: this.operationLogVersion,
      configVersion: this.configVersion,
      queueLengths,
      claimMetrics: this.getClaimMetrics(),
      queueConfig: JSON.parse(JSON.stringify(this.queueConfig)),
      timestamp: Date.now()
    };
  }

  applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('snapshot object is required');
    }

    this.queues = {};
    for (const queueName of Object.keys(snapshot.queueConfig || {})) {
      this.queues[queueName] = { messages: [] };
    }
    this.queueConfig = JSON.parse(JSON.stringify(snapshot.queueConfig || {}));
    this.configVersion = Number(snapshot.configVersion || 0);
    this.operationLogVersion = Number(snapshot.version || 0);
    this.operationLog = [];
    this.saveToDisk();
    this.checkpointPersistence();
  }

  getPersistenceStatus() {
    if (!this.persistence) {
      return {
        enabled: false,
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      enabled: true,
      ...this.persistence.getPersistenceStatus(),
    };
  }
}
