// QueueManager.js
// Simple in-memory queue manager for message broker

class QueueManager {
  constructor(logger) {
    this.queues = {};
    this.logger = logger;
  }

  enqueue(queueName, message, sourceService) {
    if (!this.queues[queueName]) {
      this.queues[queueName] = [];
    }
    const timestamp = new Date().toISOString();
    this.queues[queueName].push(message);
    // Log the enqueue event
    if (this.logger) {
      this.logger({
        timestamp,
        source: sourceService,
        destination: queueName,
        type: 'queue',
        action: 'enqueue',
        payload: message
      });
    }
  }

  dequeue(queueName, consumerService) {
    if (!this.queues[queueName] || this.queues[queueName].length === 0) {
      return null;
    }
    const message = this.queues[queueName].shift();
    const timestamp = new Date().toISOString();
    // Log the dequeue event
    if (this.logger) {
      this.logger({
        timestamp,
        source: queueName,
        destination: consumerService,
        type: 'queue',
        action: 'dequeue',
        payload: message
      });
    }
    return message;
  }

  getQueueLength(queueName) {
    return this.queues[queueName] ? this.queues[queueName].length : 0;
  }
}

module.exports = QueueManager;
