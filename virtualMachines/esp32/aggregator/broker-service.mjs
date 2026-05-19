#!/usr/bin/env node
/**
 * Standalone Broker Service
 * 
 * Runs independently on port 4001. Handles:
 * - Broker provider switching (legacy, msmq, rabbitmq, kafka, etc.)
 * - Pub/sub subscriptions
 * - Topic publishing
 * 
 * Restart this service to switch brokers without affecting queue managers.
 */
import express from 'express';
import cors from 'cors';
import { createMessageBroker } from './src/broker.js';
import {
  readEnvString,
  readEnvSecret,
  readEnvNumber,
  normalizeBrokerProvider
} from './src/env-config.mjs';

const BROKER_PORT = readEnvNumber('BROKER_PORT', 4001);
const BROKER_PROVIDER = normalizeBrokerProvider(readEnvString('BROKER_PROVIDER', 'legacy')) || 'legacy';
const BROKER_RABBITMQ_URL = readEnvString('RABBITMQ_URL', 'amqp://localhost');
const BROKER_RABBITMQ_EXCHANGE = readEnvString('RABBITMQ_EXCHANGE', 'pulse-broker');
const BROKER_RABBITMQ_QUEUE_PREFIX = readEnvString('RABBITMQ_QUEUE_PREFIX', 'pulse');
const BROKER_MSMQ_BASE_QUEUE_PATH = readEnvString('MSMQ_BASE_QUEUE_PATH', '.\\private$');
const BROKER_MSMQ_QUEUE_PREFIX = readEnvString('MSMQ_QUEUE_PREFIX', 'pulse');
const BROKER_KAFKA_BROKERS = readEnvString('KAFKA_BROKERS', 'localhost:9092');
const BROKER_KAFKA_CLIENT_ID = readEnvString('KAFKA_CLIENT_ID', 'pulse-broker');
const BROKER_KAFKA_TOPIC_PREFIX = readEnvString('KAFKA_TOPIC_PREFIX', 'pulse');
const BROKER_IBM_QUEUE_MANAGER = readEnvString('IBM_MQ_QUEUE_MANAGER', 'QM1');
const BROKER_IBM_CHANNEL = readEnvString('IBM_MQ_CHANNEL', 'DEV.APP.SVRCONN');
const BROKER_IBM_CONN_NAME = readEnvString('IBM_MQ_CONN_NAME', 'localhost(1414)');
const BROKER_IBM_QUEUE_PREFIX = readEnvString('IBM_MQ_QUEUE_PREFIX', 'pulse');
const BROKER_IBM_USERNAME = readEnvString('IBM_MQ_USER', '');
const BROKER_IBM_PASSWORD = readEnvSecret('IBM_MQ_PASSWORD', '');
const BROKER_APACHE_HOST = readEnvString('APACHE_BROKER_HOST', 'localhost');
const BROKER_APACHE_PORT = readEnvNumber('APACHE_BROKER_PORT', 61613);
const BROKER_APACHE_USERNAME = readEnvString('APACHE_BROKER_USER', '');
const BROKER_APACHE_PASSWORD = readEnvSecret('APACHE_BROKER_PASSWORD', '');
const BROKER_APACHE_TOPIC_PREFIX = readEnvString('APACHE_BROKER_TOPIC_PREFIX', '/topic/pulse');

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

// Global broker state
let brokerRuntimeConfig = {
  provider: BROKER_PROVIDER,
  url: BROKER_RABBITMQ_URL,
  exchangeName: BROKER_RABBITMQ_EXCHANGE,
  queuePrefix: BROKER_RABBITMQ_QUEUE_PREFIX,
  msmqBaseQueuePath: BROKER_MSMQ_BASE_QUEUE_PATH,
  msmqQueuePrefix: BROKER_MSMQ_QUEUE_PREFIX,
  kafkaBrokers: BROKER_KAFKA_BROKERS,
  kafkaClientId: BROKER_KAFKA_CLIENT_ID,
  kafkaTopicPrefix: BROKER_KAFKA_TOPIC_PREFIX,
  ibmQueueManager: BROKER_IBM_QUEUE_MANAGER,
  ibmChannel: BROKER_IBM_CHANNEL,
  ibmConnName: BROKER_IBM_CONN_NAME,
  ibmQueuePrefix: BROKER_IBM_QUEUE_PREFIX,
  ibmUsername: BROKER_IBM_USERNAME,
  ibmPassword: BROKER_IBM_PASSWORD,
  apacheHost: BROKER_APACHE_HOST,
  apachePort: BROKER_APACHE_PORT,
  apacheUsername: BROKER_APACHE_USERNAME,
  apachePassword: BROKER_APACHE_PASSWORD,
  apacheTopicPrefix: BROKER_APACHE_TOPIC_PREFIX
};

function createConfiguredBroker() {
  return createMessageBroker(undefined, {
    provider: brokerRuntimeConfig.provider,
    url: brokerRuntimeConfig.url,
    exchangeName: brokerRuntimeConfig.exchangeName,
    queuePrefix: brokerRuntimeConfig.queuePrefix,
    baseQueuePath: brokerRuntimeConfig.msmqBaseQueuePath,
    msmqQueuePrefix: brokerRuntimeConfig.msmqQueuePrefix,
    kafkaBrokers: brokerRuntimeConfig.kafkaBrokers,
    kafkaClientId: brokerRuntimeConfig.kafkaClientId,
    kafkaTopicPrefix: brokerRuntimeConfig.kafkaTopicPrefix,
    ibmQueueManager: brokerRuntimeConfig.ibmQueueManager,
    ibmChannel: brokerRuntimeConfig.ibmChannel,
    ibmConnName: brokerRuntimeConfig.ibmConnName,
    ibmQueuePrefix: brokerRuntimeConfig.ibmQueuePrefix,
    ibmUsername: brokerRuntimeConfig.ibmUsername,
    ibmPassword: brokerRuntimeConfig.ibmPassword,
    apacheHost: brokerRuntimeConfig.apacheHost,
    apachePort: brokerRuntimeConfig.apachePort,
    apacheUsername: brokerRuntimeConfig.apacheUsername,
    apachePassword: brokerRuntimeConfig.apachePassword,
    apacheTopicPrefix: brokerRuntimeConfig.apacheTopicPrefix
  });
}

let primaryBroker = createConfiguredBroker();
let secondaryBroker = createConfiguredBroker();

/**
 * GET /health
 * Service health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: brokerRuntimeConfig.provider });
});

/**
 * GET /broker/subscriptions
 * List all subscriptions
 */
app.get('/broker/subscriptions', (req, res) => {
  const subs = primaryBroker.getSubscriptions?.() || {};
  res.json(subs);
});

/**
 * GET /broker/config
 * Get current broker configuration
 */
app.get('/broker/config', (req, res) => {
  res.json(brokerRuntimeConfig);
});

/**
 * POST /broker/config
 * Update broker configuration and switch provider
 * Accepts: { provider, url, exchangeName, queuePrefix, msmqBaseQueuePath, msmqQueuePrefix, ... }
 */
app.post('/broker/config', (req, res) => {
  try {
    const updates = req.body || {};
    const nextConfig = {
      provider: normalizeBrokerProvider(updates.provider || brokerRuntimeConfig.provider || 'legacy') || 'legacy',
      url: String(updates.url || brokerRuntimeConfig.url).trim(),
      exchangeName: String(updates.exchangeName || brokerRuntimeConfig.exchangeName).trim(),
      queuePrefix: String(updates.queuePrefix || brokerRuntimeConfig.queuePrefix).trim(),
      msmqBaseQueuePath: String(updates.msmqBaseQueuePath || brokerRuntimeConfig.msmqBaseQueuePath).trim(),
      msmqQueuePrefix: String(updates.msmqQueuePrefix || brokerRuntimeConfig.msmqQueuePrefix).trim(),
      kafkaBrokers: String(updates.kafkaBrokers || brokerRuntimeConfig.kafkaBrokers).trim(),
      kafkaClientId: String(updates.kafkaClientId || brokerRuntimeConfig.kafkaClientId).trim(),
      kafkaTopicPrefix: String(updates.kafkaTopicPrefix || brokerRuntimeConfig.kafkaTopicPrefix).trim(),
      ibmQueueManager: String(updates.ibmQueueManager || brokerRuntimeConfig.ibmQueueManager).trim(),
      ibmChannel: String(updates.ibmChannel || brokerRuntimeConfig.ibmChannel).trim(),
      ibmConnName: String(updates.ibmConnName || brokerRuntimeConfig.ibmConnName).trim(),
      ibmQueuePrefix: String(updates.ibmQueuePrefix || brokerRuntimeConfig.ibmQueuePrefix).trim(),
      ibmUsername: String(updates.ibmUsername || brokerRuntimeConfig.ibmUsername || '').trim(),
      ibmPassword: String(updates.ibmPassword || brokerRuntimeConfig.ibmPassword || ''),
      apacheHost: String(updates.apacheHost || brokerRuntimeConfig.apacheHost).trim(),
      apachePort: Number(updates.apachePort || brokerRuntimeConfig.apachePort),
      apacheUsername: String(updates.apacheUsername || brokerRuntimeConfig.apacheUsername || '').trim(),
      apachePassword: String(updates.apachePassword || brokerRuntimeConfig.apachePassword || ''),
      apacheTopicPrefix: String(updates.apacheTopicPrefix || brokerRuntimeConfig.apacheTopicPrefix).trim()
    };

    // Copy subscriptions from old broker to new one
    const previousPrimary = primaryBroker;
    const previousSecondary = secondaryBroker;
    
    brokerRuntimeConfig = nextConfig;
    primaryBroker = createConfiguredBroker();
    secondaryBroker = createConfiguredBroker();

    // Restore subscriptions
    const subs = previousPrimary.getSubscriptions?.() || {};
    for (const [topic, subscribers] of Object.entries(subs || {})) {
      for (const subscriber of Array.isArray(subscribers) ? subscribers : []) {
        if (!subscriber || !subscriber.serviceName) continue;
        primaryBroker.addSubscription(topic, subscriber.serviceName);
        secondaryBroker.addSubscription(topic, subscriber.serviceName);
      }
    }

    console.log(`[BROKER] Switched to provider: ${brokerRuntimeConfig.provider}`);
    res.json({ status: 'applied', provider: brokerRuntimeConfig.provider });
  } catch (e) {
    console.error('[BROKER] Config update error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /broker/subscriptions
 * Add a subscription (topic -> serviceName)
 */
app.post('/broker/subscriptions', (req, res) => {
  try {
    const { topic, serviceName } = req.body || {};
    if (!topic || !serviceName) {
      return res.status(400).json({ error: 'topic and serviceName required' });
    }
    primaryBroker.addSubscription(topic, serviceName);
    secondaryBroker.addSubscription(topic, serviceName);
    res.json({ status: 'subscribed', topic, serviceName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /broker/publish
 * Publish a message to a topic
 */
app.post('/broker/publish', async (req, res) => {
  try {
    const { topic, message } = req.body || {};
    if (!topic || !message) {
      return res.status(400).json({ error: 'topic and message required' });
    }
    await primaryBroker.publish(topic, message);
    res.json({ status: 'published', topic });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start the service
app.listen(BROKER_PORT, () => {
  console.log(`[BROKER SERVICE] Starting on port ${BROKER_PORT}`);
  console.log(`[BROKER SERVICE] Provider: ${brokerRuntimeConfig.provider}`);
  console.log(`[BROKER SERVICE] Ready to accept requests`);
});
