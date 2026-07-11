export function registerBrokerAdminRoutes(app, deps = {}) {
  const {
    MODULAR_MODE,
    proxyRequest,
    requirePermission,
    BROKER_SUPPORTED_PROVIDERS,
    normalizeBrokerProvider,
    brokerRuntimeConfig,
    getPrimaryBroker,
    hasSecondaryBroker,
    rebuildBrokerInstances
  } = deps;

  app.get('/api/broker/subscriptions', (req, res) => {
    if (MODULAR_MODE) {
      proxyRequest('GET', '/broker/subscriptions', req, res);
    } else {
      try {
        res.json({ subscriptions: getPrimaryBroker().getSubscriptions() });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.get('/api/broker/config', requirePermission('broker.read'), (req, res) => {
    if (MODULAR_MODE) {
      proxyRequest('GET', '/broker/config', req, res);
    } else {
      res.json({
        broker: {
          provider: brokerRuntimeConfig.provider,
          supportedProviders: BROKER_SUPPORTED_PROVIDERS,
          rabbitmq: {
            exchangeName: brokerRuntimeConfig.exchangeName,
            queuePrefix: brokerRuntimeConfig.queuePrefix,
            urlConfigured: brokerRuntimeConfig.provider === 'rabbitmq' ? true : Boolean(brokerRuntimeConfig.url)
          },
          msmq: {
            baseQueuePath: brokerRuntimeConfig.msmqBaseQueuePath,
            queuePrefix: brokerRuntimeConfig.msmqQueuePrefix
          },
          kafka: {
            brokers: brokerRuntimeConfig.kafkaBrokers,
            clientId: brokerRuntimeConfig.kafkaClientId,
            topicPrefix: brokerRuntimeConfig.kafkaTopicPrefix
          },
          ibm: {
            queueManager: brokerRuntimeConfig.ibmQueueManager,
            channel: brokerRuntimeConfig.ibmChannel,
            connName: brokerRuntimeConfig.ibmConnName,
            queuePrefix: brokerRuntimeConfig.ibmQueuePrefix,
            username: brokerRuntimeConfig.ibmUsername,
            passwordConfigured: Boolean(brokerRuntimeConfig.ibmPassword)
          },
          apache: {
            host: brokerRuntimeConfig.apacheHost,
            port: brokerRuntimeConfig.apachePort,
            topicPrefix: brokerRuntimeConfig.apacheTopicPrefix,
            username: brokerRuntimeConfig.apacheUsername,
            passwordConfigured: Boolean(brokerRuntimeConfig.apachePassword)
          },
          secondaryRunning: hasSecondaryBroker()
        }
      });
    }
  });

  app.post('/api/broker/config', requirePermission('broker.configure'), (req, res) => {
    if (MODULAR_MODE) {
      proxyRequest('POST', '/broker/config', req, res);
    } else {
      try {
        const nextProvider = normalizeBrokerProvider(req.body?.provider);
        const nextUrl = String(req.body?.url || '').trim();
        const nextExchangeName = String(req.body?.exchangeName || '').trim();
        const nextQueuePrefix = String(req.body?.queuePrefix || '').trim();
        const nextMsmqBaseQueuePath = String(req.body?.msmqBaseQueuePath || '').trim();
        const nextMsmqQueuePrefix = String(req.body?.msmqQueuePrefix || '').trim();
        const nextKafkaBrokers = String(req.body?.kafkaBrokers || '').trim();
        const nextKafkaClientId = String(req.body?.kafkaClientId || '').trim();
        const nextKafkaTopicPrefix = String(req.body?.kafkaTopicPrefix || '').trim();
        const nextIbmQueueManager = String(req.body?.ibmQueueManager || '').trim();
        const nextIbmChannel = String(req.body?.ibmChannel || '').trim();
        const nextIbmConnName = String(req.body?.ibmConnName || '').trim();
        const nextIbmQueuePrefix = String(req.body?.ibmQueuePrefix || '').trim();
        const nextIbmUsername = String(req.body?.ibmUsername || '').trim();
        const hasIbmPassword = Object.prototype.hasOwnProperty.call(req.body || {}, 'ibmPassword');
        const nextIbmPassword = hasIbmPassword ? String(req.body?.ibmPassword || '') : '';
        const nextApacheHost = String(req.body?.apacheHost || '').trim();
        const nextApachePort = Number(req.body?.apachePort || 0);
        const nextApacheUsername = String(req.body?.apacheUsername || '').trim();
        const hasApachePassword = Object.prototype.hasOwnProperty.call(req.body || {}, 'apachePassword');
        const nextApachePassword = hasApachePassword ? String(req.body?.apachePassword || '') : '';
        const nextApacheTopicPrefix = String(req.body?.apacheTopicPrefix || '').trim();

        if (!nextProvider) {
          return res.status(400).json({ error: 'provider is required' });
        }
        if (!BROKER_SUPPORTED_PROVIDERS.includes(nextProvider)) {
          return res.status(400).json({ error: `Unsupported provider: ${nextProvider}` });
        }

        const nextConfig = { provider: nextProvider };
        if (nextUrl) nextConfig.url = nextUrl;
        if (nextExchangeName) nextConfig.exchangeName = nextExchangeName;
        if (nextQueuePrefix) nextConfig.queuePrefix = nextQueuePrefix;
        if (nextMsmqBaseQueuePath) nextConfig.msmqBaseQueuePath = nextMsmqBaseQueuePath;
        if (nextMsmqQueuePrefix) nextConfig.msmqQueuePrefix = nextMsmqQueuePrefix;
        if (nextKafkaBrokers) nextConfig.kafkaBrokers = nextKafkaBrokers;
        if (nextKafkaClientId) nextConfig.kafkaClientId = nextKafkaClientId;
        if (nextKafkaTopicPrefix) nextConfig.kafkaTopicPrefix = nextKafkaTopicPrefix;
        if (nextIbmQueueManager) nextConfig.ibmQueueManager = nextIbmQueueManager;
        if (nextIbmChannel) nextConfig.ibmChannel = nextIbmChannel;
        if (nextIbmConnName) nextConfig.ibmConnName = nextIbmConnName;
        if (nextIbmQueuePrefix) nextConfig.ibmQueuePrefix = nextIbmQueuePrefix;
        if (nextIbmUsername) nextConfig.ibmUsername = nextIbmUsername;
        if (hasIbmPassword) nextConfig.ibmPassword = nextIbmPassword;
        if (nextApacheHost) nextConfig.apacheHost = nextApacheHost;
        if (nextApachePort > 0) nextConfig.apachePort = nextApachePort;
        if (nextApacheUsername) nextConfig.apacheUsername = nextApacheUsername;
        if (hasApachePassword) nextConfig.apachePassword = nextApachePassword;
        if (nextApacheTopicPrefix) nextConfig.apacheTopicPrefix = nextApacheTopicPrefix;

        const runtime = rebuildBrokerInstances(nextConfig);
        res.json({
          status: 'updated',
          broker: runtime
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.post('/api/broker/subscriptions', (req, res) => {
    if (MODULAR_MODE) {
      proxyRequest('POST', '/broker/subscriptions', req, res);
    } else {
      try {
        const { topic, serviceName } = req.body || {};
        if (!topic || !serviceName) {
          return res.status(400).json({ error: 'topic and serviceName are required' });
        }
        getPrimaryBroker().addSubscription(topic, serviceName);
        res.json({ status: 'added', topic, serviceName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  });
}
