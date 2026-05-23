import fs from 'fs';

export function registerQueueBrokerOpsRoutes(app, deps) {
  const {
    queueRoutes,
    queueManagerRegistry,
    queueManagers,
    resolveServiceInstance,
    getBrokerStateLabel,
    getActiveBrokerInstances,
    getBrokerInstancesPayload,
    getAvailableQueueManagers,
    setBrokerInstanceState,
    brokerInstances,
    getOrCreateBrokerInstance,
    startSecondaryBroker,
    ensureRoute,
    enqueueViaRoute,
    messageRouter,
    globalState,
    getActiveQueueManagers,
    ensureQueueTriggeredFlowForQueue,
    queueValidationErrors,
    requirePermission,
    dlqEvents,
    summarizeDlqEvents,
    dequeueViaRoute
  } = deps;

  app.get('/api/broker/routes', (req, res) => {
    res.json({ routes: Array.from(queueRoutes.values()) });
  });

  app.get('/api/services/resolve/:serviceName', (req, res) => {
    const serviceName = req.params.serviceName;
    const instance = resolveServiceInstance(serviceName);
    if (!instance) {
      return res.status(404).json({ error: `No available instance for ${serviceName}` });
    }
    res.json({ serviceName, instance });
  });

  app.all('/api/service-proxy/:serviceName', async (req, res) => {
    const serviceName = req.params.serviceName;
    const instance = resolveServiceInstance(serviceName);
    if (!instance) {
      return res.status(404).json({ error: `No available instance for ${serviceName}` });
    }

    const path = req.query.path || '/';
    const query = req.query.query ? `?${req.query.query}` : '';
    const targetUrl = `http://${instance.ip}:${instance.port}${path}${query}`;

    try {
      const method = req.method;
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const headers = { 'content-type': req.get('content-type') || 'application/json' };
      const body = hasBody ? JSON.stringify(req.body || {}) : undefined;
      const proxied = await fetch(targetUrl, { method, headers, body });
      const contentType = proxied.headers.get('content-type') || '';
      res.status(proxied.status);
      if (contentType.includes('application/json')) {
        res.json(await proxied.json());
      } else {
        res.send(await proxied.text());
      }
    } catch (e) {
      res.status(502).json({ error: 'Service proxy failed', details: e.message, targetUrl });
    }
  });

  app.get('/api/broker/state', (req, res) => {
    const classStatus = globalState.brokerClassDown ? 'down' : 'up';
    const hasActive = getActiveBrokerInstances().length > 0;
    const state = getBrokerStateLabel();

    res.json({
      state,
      classStatus,
      classDown: !!globalState.brokerClassDown,
      hasActiveInstance: hasActive,
      brokers: getBrokerInstancesPayload(),
      routeCount: queueRoutes.size,
      availableQueueManagers: getAvailableQueueManagers().length
    });
  });

  app.post('/api/broker/class/down', (req, res) => {
    globalState.brokerClassDown = true;
    for (const instanceId of brokerInstances.keys()) {
      setBrokerInstanceState(instanceId, { active: false, quiesced: false });
    }
    res.json({ status: 'class-down', state: 'class-down' });
  });

  app.post('/api/broker/class/up', (req, res) => {
    globalState.brokerClassDown = false;
    setBrokerInstanceState('primary', { active: true, quiesced: false });
    res.json({ status: 'class-up', state: getBrokerStateLabel() });
  });

  app.post('/api/broker/instances/:instanceId/:action', (req, res) => {
    try {
      const { instanceId, action } = req.params;
      const id = String(instanceId || '').toLowerCase();
      const allowedActions = new Set(['up', 'down', 'quiesce', 'unquiesce']);

      if (!allowedActions.has(action)) {
        return res.status(400).json({ error: 'action must be one of up, down, quiesce, unquiesce' });
      }

      if (globalState.brokerClassDown) {
        return res.status(409).json({ error: 'Broker class is down. Use /api/broker/class/up first.' });
      }

      const instance = getOrCreateBrokerInstance(id);
      if (action === 'up') {
        if (id === 'secondary') {
          startSecondaryBroker();
        } else {
          setBrokerInstanceState(id, { active: true, quiesced: false });
        }
      }

      if (action === 'down') {
        setBrokerInstanceState(id, { active: false, quiesced: false });
      }

      if (action === 'quiesce') {
        if (!instance.active) {
          return res.status(409).json({ error: `Broker instance ${id} is down` });
        }
        setBrokerInstanceState(id, { quiesced: true });
      }

      if (action === 'unquiesce') {
        if (!instance.active) {
          return res.status(409).json({ error: `Broker instance ${id} is down` });
        }
        setBrokerInstanceState(id, { quiesced: false });
      }

      res.json({ status: 'ok', instanceId: id, action, state: getBrokerStateLabel() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/broker/start', (req, res) => {
    try {
      const result = startSecondaryBroker();
      res.json({ ...result, state: getBrokerStateLabel() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/broker/unquiesce', (req, res) => {
    const secondary = getOrCreateBrokerInstance('secondary');
    if (!secondary.active) {
      return res.status(409).json({ error: 'Secondary broker is down' });
    }
    setBrokerInstanceState('secondary', { quiesced: false });
    res.json({ status: 'unquiesced', state: getBrokerStateLabel() });
  });

  app.post('/api/broker/publish', async (req, res) => {
    const { queueName, message, sourceService } = req.body || {};
    if (globalState.brokerClassDown) {
      return res.status(503).json({ error: 'Broker class is down' });
    }

    const hasActiveBrokerInstance = getActiveBrokerInstances().length > 0;

    if (!hasActiveBrokerInstance) {
      return res.status(503).json({ error: 'No active broker instances available' });
    }

    if (!queueName) {
      return res.status(400).json({ error: 'queueName is required' });
    }

    let route = ensureRoute(queueName);
    if (!route) {
      return res.status(503).json({ error: 'No available queue managers' });
    }

    try {
      const delivery = await enqueueViaRoute(route, queueName, message, sourceService || 'unknown');
      return res.json({ status: 'published', route, delivery });
    } catch (e) {
      if (e && e.statusCode) {
        return res.status(e.statusCode).json({ error: e.message, code: e.code, validation: e.validation });
      }
      const manager = queueManagerRegistry.get(route.managerId);
      if (manager) {
        manager.status = 'down';
        queueManagerRegistry.set(route.managerId, manager);
      }
      queueRoutes.delete(queueName);

      route = ensureRoute(queueName);
      if (!route) {
        return res.status(503).json({ error: 'All queue managers unavailable', details: e.message });
      }

      try {
        const delivery = await enqueueViaRoute(route, queueName, message, sourceService || 'unknown');
        return res.json({ status: 'published-with-failover', route, delivery, priorError: e.message });
      } catch (e2) {
        if (e2 && e2.statusCode) {
          return res.status(e2.statusCode).json({ error: e2.message, code: e2.code, validation: e2.validation, priorError: e.message });
        }
        return res.status(503).json({ error: 'Publish failed after failover', details: e2.message, priorError: e.message });
      }
    }
  });

  app.get('/api/router/rules', async (req, res) => {
    try {
      const rules = await messageRouter.listRules();
      res.json({ rules });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queue/:queueName/freeze', (req, res) => {
    const { queueName } = req.params;
    for (const qm of getActiveQueueManagers()) {
      qm.freezeQueue(queueName);
    }
    res.json({ status: 'frozen' });
  });

  app.post('/api/queue/:queueName/thaw', (req, res) => {
    const { queueName } = req.params;
    for (const qm of getActiveQueueManagers()) {
      qm.thawQueue(queueName);
    }
    res.json({ status: 'thawed' });
  });

  app.get('/api/queue/:queueName/status', (req, res) => {
    const { queueName } = req.params;
    res.json({
      primary: queueManagers[0].getStatus(queueName),
      secondary: queueManagers[1].getStatus(queueName)
    });
  });

  app.post('/api/queue/:queueName/config', (req, res) => {
    const { queueName } = req.params;
    for (const qm of getActiveQueueManagers()) {
      qm.setConfig(queueName, req.body);
    }
    res.json({ status: 'config set' });
  });

  app.get('/api/queue/:queueName/config', (req, res) => {
    const { queueName } = req.params;
    res.json({
      primary: queueManagers[0].getConfig(queueName),
      secondary: queueManagers[1].getConfig(queueName)
    });
  });

  app.post('/api/queue/:queueName/enqueue', async (req, res) => {
    const { queueName } = req.params;
    const { message, sourceService, messageEnvelope } = req.body || {};
    try {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'message')) {
        return res.status(400).json({ error: 'message is required' });
      }
      const autostart = ensureQueueTriggeredFlowForQueue(queueName);
      const route = ensureRoute(queueName);
      if (!route) return res.status(503).json({ error: 'No available queue managers' });
      const delivery = await enqueueViaRoute(route, queueName, message, sourceService, messageEnvelope || null);
      res.json({ status: 'enqueued', delivery, autostart });
    } catch (e) {
      if (e && e.statusCode) {
        return res.status(e.statusCode).json({ error: e.message, code: e.code, validation: e.validation });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/queue/validation-errors', (req, res) => {
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 1000) : 100;
    const items = queueValidationErrors.slice(-limit).reverse();
    res.json({ count: items.length, totalBuffered: queueValidationErrors.length, items });
  });

  app.get('/api/queue/dlq/events', requirePermission('queue.view'), (req, res) => {
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 5000) : 100;
    const items = dlqEvents.slice(-limit).reverse();
    res.json({ count: items.length, totalBuffered: dlqEvents.length, items });
  });

  app.get('/api/queue/dlq/analysis', requirePermission('queue.view'), (req, res) => {
    const limitRaw = Number(req.query.limit || 500);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 5000) : 500;
    const windowItems = dlqEvents.slice(-limit);
    const summary = summarizeDlqEvents(windowItems);
    const queueLength = queueManagers[0].getQueueLength('ops.validation.deadletter') + queueManagers[1].getQueueLength('ops.validation.deadletter');

    const top = (obj, max = 5) => Object.entries(obj || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, max)
      .map(([name, count]) => ({ name, count }));

    const likelyFindings = [];
    for (const item of top(summary.byReason, 3)) {
      if (item.name.toLowerCase().includes('swift-mt103')) {
        likelyFindings.push('MT103 queue is receiving non-MT103 payloads (often object instead of FIN string/envelope).');
      }
      if (item.name.toLowerCase().includes('iso 20022 pacs')) {
        likelyFindings.push('PACS queues are receiving payloads without top-level Document object.');
      }
    }

    res.json({
      status: 'ok',
      deadLetterQueue: 'ops.validation.deadletter',
      queueLength,
      analyzedWindow: windowItems.length,
      bufferedEvents: dlqEvents.length,
      summary,
      top: {
        reasons: top(summary.byReason, 10),
        workers: top(summary.byWorker, 10),
        sourceQueues: top(summary.bySourceQueue, 10),
        targetQueues: top(summary.byTargetQueue, 10),
        messageShapes: top(summary.byShape, 10)
      },
      likelyFindings
    });
  });

  app.post('/api/queue/:queueName/dequeue', async (req, res) => {
    const { queueName } = req.params;
    const { consumerService } = req.body;
    try {
      const message = await dequeueViaRoute(queueName, consumerService);
      if (message === null) {
        res.status(404).json({ error: 'Queue empty' });
      } else {
        res.json({ message });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queue/:queueName/truncate', (req, res) => {
    const { queueName } = req.params;
    try {
      const activeManagers = getActiveQueueManagers();
      const perManager = [];
      let removedTotal = 0;

      for (const qm of activeManagers) {
        const removed = Number(qm.truncateQueue(queueName) || 0);
        removedTotal += removed;
        perManager.push({ removed });
      }

      res.json({
        status: 'truncated',
        queueName,
        removedTotal,
        activeManagers: activeManagers.length,
        perManager
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/queue/:queueName/length', (req, res) => {
    const { queueName } = req.params;
    res.json({
      primary: queueManagers[0].getQueueLength(queueName),
      secondary: queueManagers[1].getQueueLength(queueName)
    });
  });

  const logFile = 'secondary-broker.log';
  function logToFile(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.debug('[SECONDARY BROKER]', msg);
  }

  app.post('/api/broker/launch-secondary', (req, res) => {
    logToFile('--- /api/broker/launch-secondary called ---');
    const secondary = getOrCreateBrokerInstance('secondary');
    if (secondary.active) {
      logToFile('Secondary broker already running');
      return res.status(200).json({ status: 'already running' });
    }
    try {
      logToFile('Attempting to create secondary broker...');
      const result = startSecondaryBroker();
      logToFile('Created secondary broker instance');
      logToFile('Secondary broker started successfully');
      res.json(result);
    } catch (e) {
      setBrokerInstanceState('secondary', { active: false, quiesced: false });
      const errorMsg = 'Failed to start secondary broker: ' + (e && e.stack ? e.stack : e.toString());
      logToFile(errorMsg);
      console.error(errorMsg);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to start secondary broker', details: errorMsg });
    }
  });
}
