// MessageBroker.js
// Simple in-memory message broker with logging for topology analysis

class MessageBroker {
  constructor(logger) {
    this.subscribers = {};
    this.logger = logger;
  }

  subscribe(topic, serviceName, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    this.subscribers[topic].push({ serviceName, handler });
  }

  publish(topic, message, sourceService) {
    const timestamp = new Date().toISOString();
    const subscribers = this.subscribers[topic] || [];
    // Log the message event for topology analysis
    if (this.logger) {
      subscribers.forEach(sub => {
        this.logger({
          timestamp,
          source: sourceService,
          destination: sub.serviceName,
          type: 'pubsub',
          topic,
          payload: message
        });
      });
    }
    subscribers.forEach(sub => sub.handler(message, topic, sourceService));
  }
}

module.exports = MessageBroker;
