let kafkaImportPromise = null;

async function loadKafkaJs() {
  if (!kafkaImportPromise) {
    kafkaImportPromise = import('kafkajs');
  }
  return kafkaImportPromise;
}

function sanitizeTopicSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

export default class KafkaMessageBroker {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = options;
    this.subscribers = {};
    this.kafka = null;
    this.producer = null;
    this.connectPromise = null;
    this.subscriptionConsumers = new Map();
    this.clientId = String(options.kafkaClientId || process.env.KAFKA_CLIENT_ID || 'pulse-broker').trim() || 'pulse-broker';
    this.topicPrefix = sanitizeTopicSegment(options.kafkaTopicPrefix || process.env.KAFKA_TOPIC_PREFIX || 'pulse');
    const brokersRaw = String(options.kafkaBrokers || process.env.KAFKA_BROKERS || 'localhost:9092').trim() || 'localhost:9092';
    this.brokers = brokersRaw.split(',').map(item => item.trim()).filter(Boolean);
  }

  kafkaTopicFor(topic) {
    return `${this.topicPrefix}.${sanitizeTopicSegment(topic)}`;
  }

  async connect() {
    if (this.producer) {
      return this.producer;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.initialize().catch(error => {
        this.connectPromise = null;
        throw error;
      });
    }

    return this.connectPromise;
  }

  async initialize() {
    const { Kafka } = await loadKafkaJs();
    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers
    });

    const producer = this.kafka.producer();
    await producer.connect();
    this.producer = producer;
    return producer;
  }

  subscribe(topic, serviceName, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }

    if (this.subscribers[topic].some(subscriber => subscriber.serviceName === serviceName)) {
      return;
    }

    this.subscribers[topic].push({ serviceName, handler });
    void this.bindSubscription(topic, serviceName, handler).catch(error => {
      this.logError('kafka.subscribe', topic, { message: error.message, serviceName });
    });
  }

  async bindSubscription(topic, serviceName, handler) {
    await this.connect();
    const consumerKey = `${topic}::${serviceName}`;
    if (this.subscriptionConsumers.has(consumerKey)) {
      return;
    }

    const topicName = this.kafkaTopicFor(topic);
    const groupId = `${sanitizeTopicSegment(this.clientId)}.${sanitizeTopicSegment(serviceName)}`;
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic: topicName, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message?.value) {
          return;
        }
        try {
          const envelope = JSON.parse(message.value.toString('utf8'));
          handler(envelope.payload, topic, envelope.sourceService || serviceName);
        } catch (error) {
          this.logError('kafka.consume', topic, { message: error.message, serviceName });
        }
      }
    });

    this.subscriptionConsumers.set(consumerKey, consumer);
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

    void this.publishAsync(topic, message, sourceService).catch(error => {
      this.logError('kafka.publish', topic, { message: error.message });
    });
  }

  async publishAsync(topic, message, sourceService) {
    const producer = await this.connect();
    const envelope = {
      topic,
      sourceService: sourceService || 'unknown',
      timestamp: new Date().toISOString(),
      payload: message
    };

    await producer.send({
      topic: this.kafkaTopicFor(topic),
      messages: [{ value: JSON.stringify(envelope) }]
    });
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
    if (!this.subscribers[topic].some(subscriber => subscriber.serviceName === serviceName)) {
      this.subscribe(topic, serviceName, () => {});
    }
  }

  logError(source, topic, payload) {
    if (!this.logger) {
      return;
    }
    this.logger({
      timestamp: new Date().toISOString(),
      source,
      destination: 'kafka-broker',
      type: 'error',
      topic,
      payload
    });
  }
}