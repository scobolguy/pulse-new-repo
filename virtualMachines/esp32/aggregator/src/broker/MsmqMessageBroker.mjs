import { spawn } from 'child_process';

function sanitizeQueueSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

function escapePowerShellSingleQuoted(value) {
  return String(value || '').replace(/'/g, "''");
}

function buildQueueName(queuePrefix, topic, serviceName) {
  return `${sanitizeQueueSegment(queuePrefix)}.${sanitizeQueueSegment(topic)}.${sanitizeQueueSegment(serviceName)}`;
}

function buildQueuePath(baseQueuePath, queueName) {
  const normalizedBase = String(baseQueuePath || '.\\private$')
    .trim()
    .replace(/[\\/]+$/, '') || '.\\private$';
  return `${normalizedBase}\\${queueName}`;
}

export default class MsmqMessageBroker {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = options;
    this.subscribers = {};
    this.queuePrefix = sanitizeQueueSegment(options.queuePrefix || process.env.MSMQ_QUEUE_PREFIX || 'pulse');
    this.baseQueuePath = String(options.baseQueuePath || process.env.MSMQ_BASE_QUEUE_PATH || '.\\private$').trim() || '.\\private$';
  }

  subscribe(topic, serviceName, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    if (this.subscribers[topic].some(subscriber => subscriber.serviceName === serviceName)) {
      return;
    }

    this.subscribers[topic].push({ serviceName, handler });
    const queueName = buildQueueName(this.queuePrefix, topic, serviceName);
    void this.ensureQueue(queueName).catch(error => {
      this.logError('msmq.ensure-queue', topic, { message: error.message, queueName });
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

    const envelope = {
      topic,
      sourceService: sourceService || 'unknown',
      timestamp,
      payload: message
    };

    void this.publishToMsmq(topic, envelope).catch(error => {
      this.logError('msmq.publish', topic, { message: error.message });
    });
  }

  async publishToMsmq(topic, envelope) {
    const subscribers = this.subscribers[topic] || [];
    if (!subscribers.length) {
      return;
    }

    const payload = JSON.stringify(envelope);
    for (const sub of subscribers) {
      const queueName = buildQueueName(this.queuePrefix, topic, sub.serviceName);
      const queuePath = buildQueuePath(this.baseQueuePath, queueName);
      await this.ensureQueue(queueName);
      await this.sendMessage(queuePath, payload, topic, sub.serviceName);
    }
  }

  async ensureQueue(queueName) {
    const queuePath = buildQueuePath(this.baseQueuePath, queueName);
    const escapedQueuePath = escapePowerShellSingleQuoted(queuePath);
    const script = [
      'Add-Type -AssemblyName System.Messaging',
      `$path = '${escapedQueuePath}'`,
      'if (-not [System.Messaging.MessageQueue]::Exists($path)) {',
      '  [System.Messaging.MessageQueue]::Create($path, $false) | Out-Null',
      '}'
    ].join('; ');
    await this.runPowerShell(script);
  }

  async sendMessage(queuePath, payload, topic, serviceName) {
    const escapedQueuePath = escapePowerShellSingleQuoted(queuePath);
    const escapedPayload = escapePowerShellSingleQuoted(payload);
    const script = [
      'Add-Type -AssemblyName System.Messaging',
      `$path = '${escapedQueuePath}'`,
      `$body = '${escapedPayload}'`,
      '$queue = New-Object System.Messaging.MessageQueue($path)',
      '$msg = New-Object System.Messaging.Message',
      '$msg.Body = $body',
      '$msg.Formatter = New-Object System.Messaging.XmlMessageFormatter([string])',
      '$queue.Send($msg)',
      '$queue.Dispose()'
    ].join('; ');
    await this.runPowerShell(script);

    if (this.logger) {
      this.logger({
        timestamp: new Date().toISOString(),
        source: 'msmq-broker',
        destination: serviceName,
        type: 'broker.transport',
        topic,
        payload: { queuePath }
      });
    }
  }

  runPowerShell(script) {
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true
      });

      let stderr = '';
      child.stderr.on('data', data => {
        stderr += data.toString('utf8');
      });
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      });
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
      destination: 'msmq-broker',
      type: 'error',
      topic,
      payload
    });
  }
}