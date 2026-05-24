// MessageBroker.mjs
// ESM version of MessageBroker


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve relative to the broker file itself so the path is stable regardless of cwd
const runtimeDataRoot = process.env.PULSE_RUNTIME_DATA_ROOT || process.env.PULSE_QUEUE_DATA_ROOT || path.resolve(__dirname, '../../data');
const SUBSCRIBERS_PATH = path.resolve(runtimeDataRoot, 'broker-subscribers.json');

export default class MessageBroker {
  constructor(logger) {
    this.logger = logger;
    console.log('[MessageBroker] Subscribers file:', SUBSCRIBERS_PATH);
    this.subscribers = this.loadSubscribers();
  }

  saveSubscribers() {
    try {
      fs.mkdirSync(path.dirname(SUBSCRIBERS_PATH), { recursive: true });
      fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(this.subscribers, null, 2));
    } catch (e) {
      console.error('[MessageBroker] Failed to save subscribers:', e.message);
    }
  }

  loadSubscribers() {
    try {
      if (fs.existsSync(SUBSCRIBERS_PATH)) {
        const data = fs.readFileSync(SUBSCRIBERS_PATH, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[MessageBroker] Failed to load subscribers:', e.message);
    }
    return {};
  }

  subscribe(topic, serviceName, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    this.subscribers[topic].push({ serviceName, handler });
    this.saveSubscribers();
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

  // For API: get all subscriptions (without handlers)
  getSubscriptions() {
    // Remove handler functions for serialization
    const result = {};
    for (const topic of Object.keys(this.subscribers)) {
      result[topic] = this.subscribers[topic].map(({ serviceName }) => ({ serviceName }));
    }
    return result;
  }

  // For API: add a subscription (handler is a no-op)
  addSubscription(topic, serviceName) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    // Prevent duplicate
    if (!this.subscribers[topic].some(sub => sub.serviceName === serviceName)) {
      this.subscribers[topic].push({ serviceName, handler: () => {} });
      this.saveSubscribers();
    }
  }
}
