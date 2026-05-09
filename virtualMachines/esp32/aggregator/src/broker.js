// src/broker.js
// ESM wrapper for broker classes
import MessageBroker from './broker/MessageBroker.mjs';
import QueueManager from './broker/QueueManager.mjs';

export function createMessageBroker(logger) {
  return new MessageBroker(logger);
}

export function createQueueManager(name, persistPath) {
  return new QueueManager(name, persistPath);
}
