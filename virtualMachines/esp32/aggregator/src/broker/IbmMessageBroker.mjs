let ibmMqImportPromise = null;

async function loadIbmMq() {
  if (!ibmMqImportPromise) {
    ibmMqImportPromise = import('ibmmq');
  }
  return ibmMqImportPromise;
}

function sanitizeQueueSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

function queueNameFor(queuePrefix, topic, serviceName) {
  return `${sanitizeQueueSegment(queuePrefix)}.${sanitizeQueueSegment(topic)}.${sanitizeQueueSegment(serviceName)}`;
}

export default class IbmMessageBroker {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = options;
    this.subscribers = {};
    this.connection = null;
    this.mq = null;
    this.connectPromise = null;

    this.queueManager = String(options.ibmQueueManager || process.env.IBM_MQ_QUEUE_MANAGER || 'QM1').trim() || 'QM1';
    this.channel = String(options.ibmChannel || process.env.IBM_MQ_CHANNEL || 'DEV.APP.SVRCONN').trim() || 'DEV.APP.SVRCONN';
    this.connName = String(options.ibmConnName || process.env.IBM_MQ_CONN_NAME || 'localhost(1414)').trim() || 'localhost(1414)';
    this.queuePrefix = sanitizeQueueSegment(options.ibmQueuePrefix || process.env.IBM_MQ_QUEUE_PREFIX || 'pulse');
    this.username = String(options.ibmUsername || process.env.IBM_MQ_USER || '').trim();
    this.password = String(options.ibmPassword || process.env.IBM_MQ_PASSWORD || '');
  }

  async connect() {
    if (this.connection) {
      return this.connection;
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
    const mq = await loadIbmMq();
    this.mq = mq;

    const cno = new mq.MQCNO();
    cno.Options = mq.MQC.MQCNO_CLIENT_BINDING;

    const cd = new mq.MQCD();
    cd.ChannelName = this.channel;
    cd.ConnectionName = this.connName;
    cno.ClientConn = cd;

    if (this.username) {
      const csp = new mq.MQCSP();
      csp.AuthenticationType = mq.MQC.MQCSP_AUTH_USER_ID_AND_PWD;
      csp.UserId = this.username;
      csp.Password = this.password;
      cno.SecurityParms = csp;
    }

    const hConn = await new Promise((resolve, reject) => {
      mq.Connx(this.queueManager, cno, (err, conn) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(conn);
      });
    });

    this.connection = hConn;
    return hConn;
  }

  subscribe(topic, serviceName, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    if (this.subscribers[topic].some(subscriber => subscriber.serviceName === serviceName)) {
      return;
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

    void this.publishAsync(topic, message, sourceService).catch(error => {
      this.logError('ibm.publish', topic, { message: error.message });
    });
  }

  async publishAsync(topic, message, sourceService) {
    const subscribers = this.subscribers[topic] || [];
    if (!subscribers.length) {
      return;
    }

    const mq = this.mq || await loadIbmMq();
    const hConn = await this.connect();
    const envelope = {
      topic,
      sourceService: sourceService || 'unknown',
      timestamp: new Date().toISOString(),
      payload: message
    };
    const payload = Buffer.from(JSON.stringify(envelope), 'utf8');

    for (const sub of subscribers) {
      const queueName = queueNameFor(this.queuePrefix, topic, sub.serviceName);
      const od = new mq.MQOD();
      od.ObjectName = queueName;

      const openOptions = mq.MQC.MQOO_OUTPUT;
      const hObj = await new Promise((resolve, reject) => {
        mq.Open(hConn, od, openOptions, (err, obj) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(obj);
        });
      });

      try {
        const md = new mq.MQMD();
        const pmo = new mq.MQPMO();
        pmo.Options = mq.MQC.MQPMO_NO_SYNCPOINT;

        await new Promise((resolve, reject) => {
          mq.Put(hObj, md, pmo, payload, err => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      } finally {
        await new Promise((resolve) => {
          mq.Close(hObj, 0, () => resolve());
        });
      }
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
      destination: 'ibm-broker',
      type: 'error',
      topic,
      payload
    });
  }
}