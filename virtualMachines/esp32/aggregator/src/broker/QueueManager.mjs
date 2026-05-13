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
    this.loadFromDisk();
  }

  // Load configuration and operations from disk
  loadFromDisk() {
    if (!this.persistence) return;
    
    try {
      const snapshot = this.persistence.loadSnapshot();
      if (snapshot) {
        this.queues = JSON.parse(JSON.stringify(snapshot.queues || {}));
        this.queueConfig = JSON.parse(JSON.stringify(snapshot.queueConfig || {}));
        this.configVersion = Number(snapshot.configVersion || 0);
        this.operationLogVersion = Number(snapshot.operationLogVersion || 0);
      }

      const configData = this.persistence.loadConfig();
      if (configData) {
        this.queueConfig = configData.queueConfig || {};
        this.configVersion = Math.max(this.configVersion, Number(configData.configVersion || 0));
        // Reinitialize queues to match config
        for (const queueName of Object.keys(this.queueConfig)) {
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

      this.restoreQueueMessagesFromFiles();
    } catch (e) {
      console.error(`Error loading from disk for ${this.name}:`, e.message);
    }
  }

  restoreQueueMessagesFromFiles() {
    if (!this.persistence) return;

    for (const queueName of Object.keys(this.queues)) {
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
        ...(this.queueConfig[queueName] || { name: queueName, createdAt: Date.now(), frozen: false }),
        ...(config || {})
      };
      if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
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
    this.queueConfig[queueName] = { ...this.queueConfig[queueName], ...updates };
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
    if (this.persistence) {
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
    if (this.persistence) {
      queuedItem = this.persistence.persistQueueMessage(queueName, queuedItem);
    }
    this.queues[queueName].messages.push(queuedItem);
    this.logOperation({ type: 'enqueue', queueName, message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null });
  }

  dequeue(queueName, consumerService) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} not configured`);
    }
    if (!this.queues[queueName] || !this.queues[queueName].messages || this.queues[queueName].messages.length === 0) return null;
    const queue = this.queues[queueName].messages;
    const candidate = queue[0] || null;
    if (candidate && candidate.filePath && this.persistence) {
      this.persistence.removeMessageFile(candidate.filePath);
    }
    const result = queue.shift();
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
