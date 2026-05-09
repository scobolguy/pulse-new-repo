// Minimal QueueManager class with operation logging for replication
export default class QueueManager {
  constructor(name = 'default') {
    this.name = name;
    this.queues = {};
    this.operationLog = []; // Tracks all mutations for replication
    this.operationLogVersion = 0; // Version number for consistency
  }

  // Log an operation for replication
  logOperation(operation) {
    this.operationLog.push({
      version: ++this.operationLogVersion,
      timestamp: Date.now(),
      ...operation
    });
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
    this.queues[queueName] = { frozen: true };
    this.logOperation({ type: 'freezeQueue', queueName });
  }

  thawQueue(queueName) {
    if (this.queues[queueName]) this.queues[queueName].frozen = false;
    this.logOperation({ type: 'thawQueue', queueName });
  }

  getStatus(queueName) {
    return this.queues[queueName] || { frozen: false };
  }

  setConfig(queueName, config) {
    this.queues[queueName] = { ...config };
    this.logOperation({ type: 'setConfig', queueName, config });
  }

  getConfig(queueName) {
    return this.queues[queueName] || {};
  }

  enqueue(queueName, message, sourceService) {
    if (!this.queues[queueName]) this.queues[queueName] = { messages: [] };
    if (!this.queues[queueName].messages) this.queues[queueName].messages = [];
    this.queues[queueName].messages.push({ message, sourceService });
    this.logOperation({ type: 'enqueue', queueName, message, sourceService });
  }

  dequeue(queueName, consumerService) {
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
      queues: JSON.parse(JSON.stringify(this.queues)),
      timestamp: Date.now()
    };
  }
}
