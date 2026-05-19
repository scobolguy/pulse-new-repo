// src/broker.js
// ESM wrapper for broker classes
import MessageBroker from './broker/MessageBroker.mjs';
import RabbitMQMessageBroker from './broker/RabbitMQMessageBroker.mjs';
import MsmqMessageBroker from './broker/MsmqMessageBroker.mjs';
import KafkaMessageBroker from './broker/KafkaMessageBroker.mjs';
import IbmMessageBroker from './broker/IbmMessageBroker.mjs';
import ApacheMessageBroker from './broker/ApacheMessageBroker.mjs';
import QueueManager from './broker/QueueManager.mjs';

class InMemoryMessageBroker {
  constructor(logger) {
    this.logger = logger;
    this.subscribers = {};
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
    if (this.logger) {
      for (const sub of subscribers) {
        this.logger({
          timestamp,
          source: sourceService,
          destination: sub.serviceName,
          type: 'pubsub',
          topic,
          payload: message
        });
      }
    }
    for (const sub of subscribers) {
      sub.handler(message, topic, sourceService);
    }
  }

  getSubscriptions() {
    const result = {};
    for (const topic of Object.keys(this.subscribers)) {
      result[topic] = this.subscribers[topic].map(({ serviceName }) => ({ serviceName }));
    }
    return result;
  }

  addSubscription(topic, serviceName) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    if (!this.subscribers[topic].some(sub => sub.serviceName === serviceName)) {
      this.subscribers[topic].push({ serviceName, handler: () => {} });
    }
  }
}

function normalizeBrokerProvider(provider) {
  const normalized = String(provider || 'legacy').trim().toLowerCase();
  if (normalized === 'apache-kafka') return 'kafka';
  if (normalized === 'apache' || normalized === 'apache-broker' || normalized === 'apache-activemq' || normalized === 'activemq') return 'apache';
  if (normalized === 'ibm-message-broker' || normalized === 'ibmmq' || normalized === 'ibm-mq') return 'ibm';
  return normalized;
}

function createBrokerProvider(provider, logger, options = {}) {
  const selectedProvider = normalizeBrokerProvider(provider);

  if (selectedProvider === 'legacy') {
    return new MessageBroker(logger);
  }

  if (selectedProvider === 'memory') {
    return new InMemoryMessageBroker(logger);
  }

  if (selectedProvider === 'rabbitmq') {
    return new RabbitMQMessageBroker(logger, options);
  }

  if (selectedProvider === 'msmq') {
    return new MsmqMessageBroker(logger, options);
  }

  if (selectedProvider === 'kafka') {
    return new KafkaMessageBroker(logger, options);
  }

  if (selectedProvider === 'ibm') {
    return new IbmMessageBroker(logger, options);
  }

  if (selectedProvider === 'apache') {
    return new ApacheMessageBroker(logger, options);
  }

  throw new Error(`Unsupported broker provider: ${provider}`);
}

export function createMessageBroker(logger, options = {}) {
  return createBrokerProvider(options.provider, logger, options);
}

export function createQueueManager(name, persistPath) {
  return new QueueManager(name, persistPath);
}
