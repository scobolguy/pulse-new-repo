export function registerRuntimeRegistryRoutes(app, deps) {
  const {
    requirePermission,
    serviceInstanceRegistry,
    getUiCardOverrides,
    setUiCardOverrides,
    hasPermission,
    queueManagerRegistry,
    setQueueManagerStatus,
    setNodeLifecycleState,
    getNodeDrainStatus,
    queueRoutes,
    queueManagers,
    setBrokerInstanceState,
    brokerInstances,
    getBrokerStateLabel,
    getBrokerInstancesPayload,
    globalState,
    GATEWAY_IDS,
    executeGatewayAction,
    getGatewayStatusPayload,
    brokerRuntimeConfig,
    gatewayRuntimeConfig,
    createDefaultGatewayRuntimeConfig,
    rebuildBrokerInstances,
    gatewayModeState,
    gatewayQuiesceState,
    normalizeGatewayRuntimeConfig
  } = deps;

  function parseRuntimeInstanceId(rawInstanceId) {
    const text = String(rawInstanceId || '').trim();
    const [rawClassId, ...rest] = text.split(':');
    const classId = String(rawClassId || '').trim().toLowerCase();
    const instanceKey = rest.join(':').trim();
    return { classId, instanceKey };
  }

  function requireRuntimePermission(req, permission) {
    const permissions = Array.isArray(req?.authz?.permissions) ? req.authz.permissions : [];
    return hasPermission(permissions, permission);
  }

  app.get('/api/registry/services', (req, res) => {
    const services = {};
    for (const instance of serviceInstanceRegistry.values()) {
      if (!services[instance.serviceName]) services[instance.serviceName] = [];
      services[instance.serviceName].push(instance);
    }
    res.json({ services });
  });

  app.get('/api/ui/card-overrides', requirePermission('lifecycle.read'), (req, res) => {
    const overrides = getUiCardOverrides();
    res.json({
      hiddenMap: overrides.hiddenMap || {},
      renameMap: overrides.renameMap || {},
      runtimeMap: overrides.runtimeMap || {}
    });
  });

  app.put('/api/ui/card-overrides', requirePermission('lifecycle.manage'), (req, res) => {
    try {
      const nextOverrides = setUiCardOverrides(req.body || {});
      res.json({
        status: 'ok',
        hiddenMap: nextOverrides.hiddenMap,
        renameMap: nextOverrides.renameMap,
        runtimeMap: nextOverrides.runtimeMap || {}
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/runtime/classes/database/actions/:action', requirePermission('queue.operate'), (req, res) => {
    const action = String(req.params.action || '').toLowerCase();
    const statusMap = {
      quiesce: 'quiesced',
      maintenance: 'maintenance',
      'return-service': 'up',
      up: 'up'
    };

    const nextStatus = statusMap[action];
    if (!nextStatus) {
      return res.status(400).json({ error: 'Unsupported action. Use quiesce, maintenance, return-service, or up.' });
    }

    const changed = [];
    for (const manager of queueManagerRegistry.values()) {
      const updated = setQueueManagerStatus(manager.managerId, nextStatus);
      if (updated) changed.push(updated.managerId);
    }

    res.json({ status: 'ok', classId: 'database', action, affectedInstanceIds: changed });
  });

  app.post('/api/runtime/classes/broker/actions/:action', requirePermission('broker.operate'), (req, res) => {
    const action = String(req.params.action || '').toLowerCase();
    if (!['up', 'down', 'quiesce', 'unquiesce'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported action. Use up, down, quiesce, or unquiesce.' });
    }

    try {
      if (action === 'up') {
        globalState.brokerClassDown = false;
        setBrokerInstanceState('primary', { active: true, quiesced: false });
      }

      if (action === 'down') {
        globalState.brokerClassDown = true;
        for (const instanceId of brokerInstances.keys()) {
          setBrokerInstanceState(instanceId, { active: false, quiesced: false });
        }
      }

      if (action === 'quiesce' || action === 'unquiesce') {
        if (globalState.brokerClassDown) {
          return res.status(409).json({ error: 'Broker class is down. Use action=up first.' });
        }
        const shouldQuiesce = action === 'quiesce';
        for (const [instanceId, instance] of brokerInstances.entries()) {
          if (instance.active) {
            setBrokerInstanceState(instanceId, { quiesced: shouldQuiesce });
          }
        }
      }

      res.json({
        status: 'ok',
        classId: 'broker',
        action,
        classState: getBrokerStateLabel(),
        brokers: getBrokerInstancesPayload()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/runtime/classes/gateway/actions/:action', requirePermission('gateway.manage'), async (req, res) => {
    const action = String(req.params.action || '').toLowerCase();
    if (!['start', 'stop', 'quiesce'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported action. Use start, stop, or quiesce.' });
    }

    try {
      const requestedConfig = req.body && typeof req.body === 'object' ? req.body : {};
      const requestedTargets = Array.isArray(requestedConfig.targets)
        ? requestedConfig.targets.map((v) => String(v || '').trim().toLowerCase()).filter((v) => GATEWAY_IDS.includes(v))
        : [];
      const keyedTargets = GATEWAY_IDS.filter((gatewayId) => requestedConfig[gatewayId] && typeof requestedConfig[gatewayId] === 'object');
      const targetGatewayIds = requestedTargets.length > 0
        ? requestedTargets
        : (keyedTargets.length > 0 ? keyedTargets : GATEWAY_IDS);

      const operationResults = [];
      for (const gatewayId of targetGatewayIds) {
        const gatewayConfig = requestedConfig[gatewayId] && typeof requestedConfig[gatewayId] === 'object'
          ? requestedConfig[gatewayId]
          : requestedConfig;
        const result = await executeGatewayAction(gatewayId, action, gatewayConfig);
        operationResults.push({ gatewayId, ...result });
      }

      res.json({ status: 'ok', classId: 'gateway', action, operations: operationResults, gateways: getGatewayStatusPayload() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/runtime/instances/:instanceId/config', requirePermission('registry.read'), (req, res) => {
    const { classId, instanceKey } = parseRuntimeInstanceId(req.params.instanceId);

    if (classId === 'database') {
      const manager = queueManagerRegistry.get(instanceKey);
      if (!manager) {
        return res.status(404).json({ error: 'Database server instance not found' });
      }

      const provider = String(manager?.persistence?.provider || manager?.provider || 'queue-manager');
      const config = manager?.persistence?.config && typeof manager.persistence.config === 'object'
        ? manager.persistence.config
        : {};

      return res.json({
        instanceId: `database:${manager.managerId}`,
        classId: 'database',
        provider,
        configurable: true,
        config: {
          managerId: manager.managerId,
          nodeId: manager.nodeId,
          ip: manager.ip,
          port: manager.port,
          status: manager.status,
          ...config
        }
      });
    }

    if (classId === 'broker') {
      if (instanceKey === 'class' || instanceKey === 'network') {
        return res.json({
          instanceId: 'broker:class',
          classId: 'broker',
          provider: brokerRuntimeConfig.provider,
          configurable: true,
          config: {
            provider: brokerRuntimeConfig.provider,
            url: brokerRuntimeConfig.url,
            exchangeName: brokerRuntimeConfig.exchangeName,
            queuePrefix: brokerRuntimeConfig.queuePrefix,
            msmqBaseQueuePath: brokerRuntimeConfig.msmqBaseQueuePath,
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
          }
        });
      }

      const instance = brokerInstances.get(instanceKey);
      if (!instance) {
        return res.status(404).json({ error: 'Broker instance not found' });
      }

      return res.json({
        instanceId: `broker:${instanceKey}`,
        classId: 'broker',
        provider: brokerRuntimeConfig.provider,
        configurable: true,
        config: {
          instanceId: instanceKey,
          active: Boolean(instance.active),
          quiesced: Boolean(instance.quiesced),
          provider: brokerRuntimeConfig.provider
        }
      });
    }

    if (classId === 'gateway') {
      const gateways = getGatewayStatusPayload();
      const gateway = gateways[instanceKey];
      if (!gateway) {
        return res.status(404).json({ error: 'Gateway instance not found' });
      }

      const runtime = gatewayRuntimeConfig[instanceKey] || createDefaultGatewayRuntimeConfig();

      return res.json({
        instanceId: `gateway:${instanceKey}`,
        classId: 'gateway',
        provider: 'gateway-adapter',
        configurable: true,
        config: {
          gatewayId: instanceKey,
          running: Boolean(gateway.running),
          quiesced: Boolean(gateway.quiesced),
          mode: String(gateway.mode || 'live'),
          workerIds: Array.isArray(gateway.workerIds) ? gateway.workerIds : [],
          controlPlane: runtime.controlPlane,
          remoteApi: {
            enabled: Boolean(runtime.remoteApi?.enabled),
            baseUrl: String(runtime.remoteApi?.baseUrl || ''),
            timeoutMs: Number(runtime.remoteApi?.timeoutMs || 5000),
            fallbackToLocal: Boolean(runtime.remoteApi?.fallbackToLocal),
            authType: String(runtime.remoteApi?.authType || 'none'),
            authHeader: String(runtime.remoteApi?.authHeader || 'Authorization'),
            token: String(runtime.remoteApi?.token || ''),
            apiKeyHeader: String(runtime.remoteApi?.apiKeyHeader || 'x-api-key'),
            apiKey: String(runtime.remoteApi?.apiKey || ''),
            actionPaths: {
              start: String(runtime.remoteApi?.actionPaths?.start || '/api/control/start'),
              stop: String(runtime.remoteApi?.actionPaths?.stop || '/api/control/stop'),
              quiesce: String(runtime.remoteApi?.actionPaths?.quiesce || '/api/control/quiesce')
            }
          }
        }
      });
    }

    return res.status(400).json({ error: 'Unknown runtime instance class' });
  });

  app.put('/api/runtime/instances/:instanceId/config', requirePermission('registry.manage'), (req, res) => {
    const { classId, instanceKey } = parseRuntimeInstanceId(req.params.instanceId);
    const payload = req.body || {};

    if (classId === 'database') {
      const manager = queueManagerRegistry.get(instanceKey);
      if (!manager) {
        return res.status(404).json({ error: 'Database server instance not found' });
      }
      const provider = String(payload?.provider || manager?.persistence?.provider || manager?.provider || 'queue-manager').trim() || 'queue-manager';
      const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
      manager.persistence = {
        provider,
        config: nextConfig
      };
      manager.updatedAt = new Date().toISOString();
      queueManagerRegistry.set(manager.managerId, manager);
      return res.json({ status: 'updated', instanceId: `database:${manager.managerId}`, provider, config: nextConfig });
    }

    if (classId === 'broker') {
      if (instanceKey === 'class' || instanceKey === 'network') {
        if (!requireRuntimePermission(req, 'broker.configure')) {
          return res.status(403).json({ error: 'Permission denied: broker.configure is required.' });
        }

        const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
        try {
          const runtime = rebuildBrokerInstances(nextConfig);
          return res.json({ status: 'updated', instanceId: 'broker:class', broker: runtime });
        } catch (e) {
          return res.status(400).json({ error: e.message });
        }
      }

      if (!requireRuntimePermission(req, 'broker.operate')) {
        return res.status(403).json({ error: 'Permission denied: broker.operate is required.' });
      }

      const instance = brokerInstances.get(instanceKey);
      if (!instance) {
        return res.status(404).json({ error: 'Broker instance not found' });
      }

      const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
      const active = Object.prototype.hasOwnProperty.call(nextConfig, 'active') ? Boolean(nextConfig.active) : Boolean(instance.active);
      const quiesced = Object.prototype.hasOwnProperty.call(nextConfig, 'quiesced') ? Boolean(nextConfig.quiesced) : Boolean(instance.quiesced);
      setBrokerInstanceState(instanceKey, { active, quiesced });
      return res.json({ status: 'updated', instanceId: `broker:${instanceKey}`, config: { active, quiesced } });
    }

    if (classId === 'gateway') {
      if (!requireRuntimePermission(req, 'gateway.manage')) {
        return res.status(403).json({ error: 'Permission denied: gateway.manage is required.' });
      }

      if (!GATEWAY_IDS.includes(instanceKey)) {
        return res.status(404).json({ error: 'Gateway instance not found' });
      }

      const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
      if (Object.prototype.hasOwnProperty.call(nextConfig, 'mode')) {
        gatewayModeState[instanceKey] = String(nextConfig.mode || gatewayModeState[instanceKey] || 'live').trim().toLowerCase() || 'live';
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, 'quiesced')) {
        gatewayQuiesceState[instanceKey] = Boolean(nextConfig.quiesced);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, 'controlPlane') || Object.prototype.hasOwnProperty.call(nextConfig, 'remoteApi')) {
        gatewayRuntimeConfig[instanceKey] = normalizeGatewayRuntimeConfig({
          controlPlane: nextConfig.controlPlane,
          remoteApi: nextConfig.remoteApi
        }, gatewayRuntimeConfig[instanceKey]);
      }
      return res.json({ status: 'updated', instanceId: `gateway:${instanceKey}`, config: nextConfig, gateway: getGatewayStatusPayload()[instanceKey] });
    }

    return res.status(400).json({ error: 'Unknown runtime instance class' });
  });

  app.post('/api/registry/nodes/:nodeId/quiesce', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'quiesced');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'quiesced' });
  });

  app.post('/api/registry/nodes/:nodeId/drain', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'draining');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    const drain = getNodeDrainStatus(req.params.nodeId);
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'draining', drain });
  });

  app.get('/api/registry/nodes/:nodeId/drain-status', (req, res) => {
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    res.json(drain);
  });

  app.post('/api/registry/nodes/:nodeId/maintenance', (req, res) => {
    const force = req.query.force === 'true';
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    if (!drain.drainReady && !force) {
      return res.status(409).json({
        error: 'Node not drained',
        message: 'Use /drain-status and wait for pendingMessagesKnown=0, or pass ?force=true',
        drain
      });
    }
    const changed = setNodeLifecycleState(req.params.nodeId, 'maintenance');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'maintenance' });
  });

  app.post('/api/registry/nodes/:nodeId/return-service', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'up');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'up' });
  });

  app.post('/api/registry/queue-managers/:managerId/quiesce', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'quiesced');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/maintenance', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'maintenance');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/return-service', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'up');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.get('/api/registry/queues', (req, res) => {
    const queues = Array.from(queueRoutes.values()).map(route => {
      const manager = queueManagerRegistry.get(route.managerId);
      let queueLength = null;
      if (manager?.local) {
        queueLength = queueManagers[manager.localIndex].getQueueLength(route.queueName);
      }
      return {
        queueName: route.queueName,
        managerId: route.managerId,
        queueLength,
        assignedAt: route.assignedAt
      };
    });
    res.json({ queues });
  });
}
