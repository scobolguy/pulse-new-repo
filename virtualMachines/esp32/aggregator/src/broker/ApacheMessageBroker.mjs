let stompitImportPromise = null;

async function loadStompit() {
  if (!stompitImportPromise) {
    stompitImportPromise = import('stompit');
  }
  return stompitImportPromise;
}

function normalizeStompitModule(mod) {
  return mod?.default || mod;
}

function sanitizeTopicSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

function toPort(value, fallbackPort) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackPort;
  }
  return Math.trunc(parsed);
}

export default class ApacheMessageBroker {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = options;
    this.subscribers = {};
    this.subscriptionClients = new Map();
    this.host = String(options.apacheHost || process.env.APACHE_BROKER_HOST || 'localhost').trim() || 'localhost';
    this.port = toPort(options.apachePort || process.env.APACHE_BROKER_PORT || 61613, 61613);
    this.username = String(options.apacheUsername || process.env.APACHE_BROKER_USER || '').trim();
    this.password = String(options.apachePassword || process.env.APACHE_BROKER_PASSWORD || '');
    this.topicPrefix = String(options.apacheTopicPrefix || process.env.APACHE_BROKER_TOPIC_PREFIX || '/topic/pulse').trim() || '/topic/pulse';
  }

  topicDestination(topic) {
    return `${this.topicPrefix}/${sanitizeTopicSegment(topic)}`;
  }

  async connectClient() {
    const stompitModule = normalizeStompitModule(await loadStompit());
    const connectOptions = {
      host: this.host,
      port: this.port,
      connectHeaders: {
        host: '/',
        'heart-beat': '5000,5000'
      }
    };
    if (this.username) {
      connectOptions.connectHeaders.login = this.username;
      connectOptions.connectHeaders.passcode = this.password;
    }

    return await new Promise((resolve, reject) => {
      stompitModule.connect(connectOptions, (error, client) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(client);
      });
    });
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
      this.logError('apache.subscribe', topic, { message: error.message, serviceName });
    });
  }

  async bindSubscription(topic, serviceName, handler) {
    const key = `${topic}::${serviceName}`;
    if (this.subscriptionClients.has(key)) {
      return;
    }

    const destination = this.topicDestination(topic);
    const client = await this.connectClient();

    const subscribeHeaders = {
      destination,
      ack: 'auto',
      id: key
    };

    const subscription = client.subscribe(subscribeHeaders, (error, message) => {
      if (error) {
        this.logError('apache.consume', topic, { message: error.message, serviceName });
        return;
      }

      message.readString('utf8', (readError, body) => {
        if (readError) {
          this.logError('apache.consume-read', topic, { message: readError.message, serviceName });
          return;
        }

        try {
          const envelope = JSON.parse(body);
          handler(envelope.payload, topic, envelope.sourceService || serviceName);
        } catch (parseError) {
          this.logError('apache.consume-parse', topic, { message: parseError.message, serviceName });
        }
      });
    });

    subscription.on('error', error => {
      this.logError('apache.subscription', topic, { message: error.message, serviceName });
    });

    client.on('error', error => {
      this.logError('apache.client', topic, { message: error.message, serviceName });
    });

    this.subscriptionClients.set(key, client);
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
      this.logError('apache.publish', topic, { message: error.message });
    });
  }

  async publishAsync(topic, message, sourceService) {
    const destination = this.topicDestination(topic);
    const envelope = {
      topic,
      sourceService: sourceService || 'unknown',
      timestamp: new Date().toISOString(),
      payload: message
    };

    const client = await this.connectClient();
    await new Promise((resolve, reject) => {
      const frame = client.send({
        destination,
        'content-type': 'application/json'
      });

      frame.once('error', reject);
      frame.write(JSON.stringify(envelope));
      frame.end();
      resolve();
    });

    client.disconnect();
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
      destination: 'apache-broker',
      type: 'error',
      topic,
      payload
    });
  }
}