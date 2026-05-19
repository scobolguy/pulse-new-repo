let amqplibImportPromise = null;

async function loadAmqplib() {
  if (!amqplibImportPromise) {
    amqplibImportPromise = import('amqplib');
  }
  return amqplibImportPromise;
}

function sanitizeQueueSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

export default class RabbitMQMessageBroker {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = options;
    this.subscribers = {};
    this.connection = null;
    this.channel = null;
    this.readyPromise = null;
    this.exchangeName = String(options.exchangeName || process.env.RABBITMQ_EXCHANGE || 'pulse-broker').trim() || 'pulse-broker';
    this.url = String(options.url || process.env.RABBITMQ_URL || 'amqp://localhost').trim() || 'amqp://localhost';
    this.queuePrefix = sanitizeQueueSegment(options.queuePrefix || process.env.RABBITMQ_QUEUE_PREFIX || 'pulse');
  }

  async connect() {
    if (this.channel) {
      return this.channel;
    }
    if (!this.readyPromise) {
      this.readyPromise = this.initialize().catch(error => {
        this.readyPromise = null;
        throw error;
      });
    }
    return this.readyPromise;
  }

  async initialize() {
    const amqplib = await loadAmqplib();
    const connection = await amqplib.connect(this.url);
    connection.on('close', () => {
      this.connection = null;
      this.channel = null;
      this.readyPromise = null;
    });
    connection.on('error', error => {
      if (this.logger) {
        this.logger({
          timestamp: new Date().toISOString(),
          source: 'rabbitmq-broker',
          destination: 'rabbitmq-broker',
          type: 'error',
          topic: 'broker.connection',
          payload: { message: error.message }
        });
      }
    });

    const channel = await connection.createChannel();
    await channel.assertExchange(this.exchangeName, 'topic', { durable: true });
    this.connection = connection;
    this.channel = channel;
    return channel;
  }

  async bindSubscription(topic, serviceName, handler) {
    const channel = await this.connect();
    const queueName = `${this.queuePrefix}.${sanitizeQueueSegment(topic)}.${sanitizeQueueSegment(serviceName)}`;
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, this.exchangeName, topic);
    await channel.consume(queueName, message => {
      if (!message) {
        return;
      }
      try {
        const parsed = JSON.parse(message.content.toString('utf8'));
        handler(parsed.payload, topic, parsed.sourceService || serviceName);
      } catch (error) {
        if (this.logger) {
          this.logger({
            timestamp: new Date().toISOString(),
            source: 'rabbitmq-broker',
            destination: serviceName,
            type: 'error',
            topic,
            payload: { message: error.message }
          });
        }
      } finally {
        channel.ack(message);
      }
    }, { noAck: false });
  }

  subscribe(topic, serviceName, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    if (this.subscribers[topic].some(subscriber => subscriber.serviceName === serviceName)) {
      return;
    }

    const subscriber = { serviceName, handler };
    this.subscribers[topic].push(subscriber);
    void this.bindSubscription(topic, serviceName, handler).catch(error => {
      if (this.logger) {
        this.logger({
          timestamp: new Date().toISOString(),
          source: 'rabbitmq-broker',
          destination: serviceName,
          type: 'error',
          topic,
          payload: { message: error.message }
        });
      }
    });
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
      if (this.logger) {
        this.logger({
          timestamp: new Date().toISOString(),
          source: 'rabbitmq-broker',
          destination: 'rabbitmq-broker',
          type: 'error',
          topic,
          payload: { message: error.message }
        });
      }
    });
  }

  async publishAsync(topic, message, sourceService) {
    const channel = await this.connect();
    const envelope = {
      topic,
      sourceService: sourceService || 'unknown',
      timestamp: new Date().toISOString(),
      payload: message
    };
    channel.publish(
      this.exchangeName,
      topic,
      Buffer.from(JSON.stringify(envelope), 'utf8'),
      { contentType: 'application/json', persistent: true }
    );
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
}