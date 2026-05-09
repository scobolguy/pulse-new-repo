// QueueManager with distributed config sync and operation logging for replication
import { QueueManagerPersistence } from './QueueManagerPersistence.mjs';

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
    this.loadFromDisk();
  }

  // Load configuration and operations from disk
  loadFromDisk() {
    if (!this.persistence) return;
    
    try {
      const configData = this.persistence.loadConfig();
      if (configData) {
        this.queueConfig = configData.queueConfig || {};
        this.configVersion = configData.configVersion || 0;
        // Reinitialize queues to match config
        for (const queueName of Object.keys(this.queueConfig)) {
          if (!this.queues[queueName]) {
            this.queues[queueName] = { messages: [] };
          }
        }
      }
      
      const operations = this.persistence.loadOperations();
      for (const op of operations) {
        if (op.version && op.version > this.operationLogVersion) {
          this.operationLogVersion = op.version;
        }
        this.operationLog.push(op);
      }
      if (this.operationLog.length > 1000) {
        this.operationLog.shift();
      }
    } catch (e) {
      console.error(`Error loading from disk for ${this.name}:`, e.message);
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
  }

  // Get operations since a specific version (for replicas to catch up)
  getOperationsSince(version) {
    return this.operationLog.filter(op => op.version > version);
  }

  // Apply a replicated operation (used by replicas)
  applyReplicatedOperation(operation) {
    const { type, queueName, message, sourceService } = operation;
    
    // Handle config operations first
    if (type === 'createQueue' || type === 'deleteQueue' || type === 'updateQueueConfig') {
      this.applyConfigChange(operation);
      return true;
    }
    
    if (type === 'enqueue') {
      if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
      if (!this.queues[queueName].messages) this.queues[queueName].messages = [];
      this.queues[queueName].messages.push({ message, sourceService });
      return true;
    }
    if (type === 'dequeue') {
      if (this.queues[queueName] && this.queues[queueName].messages) {
        return this.queues[queueName].messages.shift() || null;
      }
      return null;
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

  enqueue(queueName, message, sourceService) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} not configured`);
    }
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    if (!this.queues[queueName].messages) this.queues[queueName].messages = [];
    this.queues[queueName].messages.push({ message, sourceService });
    this.logOperation({ type: 'enqueue', queueName, message, sourceService });
  }

  dequeue(queueName, consumerService) {
    if (!this.queueConfig[queueName]) {
      throw new Error(`Queue ${queueName} not configured`);
    }
    if (!this.queues[queueName] || !this.queues[queueName].messages || this.queues[queueName].messages.length === 0) return null;
    const result = this.queues[queueName].messages.shift();
    this.logOperation({ type: 'dequeue', queueName, consumerService });
    return result;
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
    return {
      name: this.name,
      version: this.operationLogVersion,
      configVersion: this.configVersion,
      queues: JSON.parse(JSON.stringify(this.queues)),
      queueConfig: JSON.parse(JSON.stringify(this.queueConfig)),
      timestamp: Date.now()
    };
  }
}
