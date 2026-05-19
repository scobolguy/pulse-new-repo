export function registerLifecycleWorkerGatewayRoutes(app, deps) {
  const {
    requirePermission,
    getLifecycleWorkersPayload,
    getQueueBridgeWorkersPayload,
    ensureWorkerStartsEnabled,
    startLifecycleWorker,
    getLifecycleWorkerPayloadById,
    stopLifecycleWorker,
    startQueueBridgeWorker,
    getQueueBridgeWorkerPayloadById,
    stopQueueBridgeWorker,
    startDefaultQueueDrivenLifecycleWorkers,
    applyHardReset,
    workerRuntimeControl,
    stopAllQueueDrivenWorkers,
    getSubflowBridgeWorkersPayload,
    startDefaultSubflowBridgeWorkers,
    stopSubflowBridgeWorkers,
    getGatewayStatusPayload,
    buildGatewayStreamPayload,
    startRouterWorker,
    stopRouterWorker
  } = deps;

  app.get('/api/lifecycle/workers', requirePermission('lifecycle.workers.read'), (req, res) => {
    res.json({
      lifecycleWorkers: getLifecycleWorkersPayload(),
      bridgeWorkers: getQueueBridgeWorkersPayload()
    });
  });

  app.post('/api/lifecycle/workers/start', requirePermission('lifecycle.workers.manage'), (req, res) => {
    try {
      ensureWorkerStartsEnabled();
      const worker = startLifecycleWorker(req.body || {});
      res.json({
        status: 'started',
        worker: getLifecycleWorkerPayloadById(worker.workerId) || {
          workerId: worker.workerId,
          fromState: worker.fromState,
          eventName: worker.eventName,
          intervalMs: worker.intervalMs,
          batchSize: worker.batchSize,
          processingDelayMs: worker.processingDelayMs,
          consumerService: worker.consumerService,
          sourceService: worker.sourceService,
          processedMessages: worker.processedMessages,
          lastRunAt: worker.lastRunAt,
          lastError: worker.lastError,
          startedAt: worker.startedAt
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/workers/:workerId/stop', requirePermission('lifecycle.workers.manage'), (req, res) => {
    const removed = stopLifecycleWorker(req.params.workerId);
    if (!removed) {
      return res.status(404).json({ error: 'Lifecycle worker not found' });
    }
    res.json({ status: 'stopped', workerId: req.params.workerId });
  });

  app.post('/api/lifecycle/bridge-workers/start', requirePermission('lifecycle.workers.manage'), (req, res) => {
    try {
      ensureWorkerStartsEnabled();
      const worker = startQueueBridgeWorker(req.body || {});
      res.json({
        status: 'started',
        worker: getQueueBridgeWorkerPayloadById(worker.workerId) || {
          workerId: worker.workerId,
          inputQueue: worker.inputQueue,
          outputQueue: worker.outputQueue,
          intervalMs: worker.intervalMs,
          batchSize: worker.batchSize,
          processingDelayMs: worker.processingDelayMs,
          consumerService: worker.consumerService,
          sourceService: worker.sourceService,
          processedMessages: worker.processedMessages,
          lastRunAt: worker.lastRunAt,
          lastError: worker.lastError,
          startedAt: worker.startedAt
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/bridge-workers/:workerId/stop', requirePermission('lifecycle.workers.manage'), (req, res) => {
    const removed = stopQueueBridgeWorker(req.params.workerId);
    if (!removed) {
      return res.status(404).json({ error: 'Bridge worker not found' });
    }
    res.json({ status: 'stopped', workerId: req.params.workerId });
  });

  app.post('/api/lifecycle/workers/start-default', requirePermission('lifecycle.workers.manage'), (req, res) => {
    try {
      ensureWorkerStartsEnabled();
      const { intervalMs, batchSize } = req.body || {};
      const workers = startDefaultQueueDrivenLifecycleWorkers({
        intervalMs: Number(intervalMs) > 0 ? Number(intervalMs) : 250,
        batchSize: Number(batchSize) > 0 ? Number(batchSize) : 50
      });
      res.json({
        status: 'started',
        workersStarted: workers.length,
        lifecycleWorkers: getLifecycleWorkersPayload(),
        bridgeWorkers: getQueueBridgeWorkersPayload()
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/workers/stop-all', requirePermission('lifecycle.workers.manage'), (req, res) => {
    const { hardReset, reason } = req.body || {};
    if (hardReset) {
      applyHardReset({ reason });
      return res.json({
        status: 'stopped',
        hardReset: true,
        autoRestartEnabled: workerRuntimeControl.autoRestartEnabled,
        hardResetAt: workerRuntimeControl.hardResetAt,
        hardResetReason: workerRuntimeControl.hardResetReason
      });
    }
    stopAllQueueDrivenWorkers();
    res.json({ status: 'stopped', hardReset: false });
  });

  app.get('/api/lifecycle/auto-restart', requirePermission('lifecycle.workers.read'), (req, res) => {
    res.json({
      autoRestartEnabled: workerRuntimeControl.autoRestartEnabled,
      hardResetAt: workerRuntimeControl.hardResetAt,
      hardResetReason: workerRuntimeControl.hardResetReason
    });
  });

  app.post('/api/lifecycle/auto-restart', requirePermission('lifecycle.workers.manage'), (req, res) => {
    const { enabled, reason } = req.body || {};
    workerRuntimeControl.autoRestartEnabled = Boolean(enabled);
    if (workerRuntimeControl.autoRestartEnabled) {
      workerRuntimeControl.hardResetAt = null;
      workerRuntimeControl.hardResetReason = null;
    } else {
      workerRuntimeControl.hardResetAt = new Date().toISOString();
      workerRuntimeControl.hardResetReason = String(reason || 'manual-disable').trim() || 'manual-disable';
    }

    res.json({
      status: 'updated',
      autoRestartEnabled: workerRuntimeControl.autoRestartEnabled,
      hardResetAt: workerRuntimeControl.hardResetAt,
      hardResetReason: workerRuntimeControl.hardResetReason
    });
  });

  app.get('/api/lifecycle/subflows/workers', requirePermission('lifecycle.workers.read'), (req, res) => {
    res.json({ workers: getSubflowBridgeWorkersPayload() });
  });

  app.post('/api/lifecycle/subflows/workers/start-default', requirePermission('lifecycle.workers.manage'), (req, res) => {
    try {
      ensureWorkerStartsEnabled();
      const { intervalMs, batchSize } = req.body || {};
      const workers = startDefaultSubflowBridgeWorkers({
        intervalMs: Number(intervalMs) > 0 ? Number(intervalMs) : 500,
        batchSize: Number(batchSize) > 0 ? Number(batchSize) : 25
      });
      res.json({ status: 'started', workersStarted: workers.length, workers: getSubflowBridgeWorkersPayload() });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/subflows/workers/stop-all', requirePermission('lifecycle.workers.manage'), (req, res) => {
    stopSubflowBridgeWorkers();
    res.json({ status: 'stopped' });
  });

  app.get('/api/gateways', requirePermission('gateway.read'), (req, res) => {
    res.json(getGatewayStatusPayload());
  });

  app.get('/api/gateways/stream', requirePermission('gateway.read'), (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const send = () => {
      if (res.writableEnded || res.destroyed) return;
      const payload = buildGatewayStreamPayload();
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send();
    const streamTimer = setInterval(send, 400);
    const keepAliveTimer = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(': keepalive\n\n');
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(streamTimer);
      clearInterval(keepAliveTimer);
    });
  });

  app.post('/api/router/workers/start', (req, res) => {
    try {
      const { inputQueue, intervalMs, batchSize, consumerService } = req.body || {};
      if (!inputQueue) {
        return res.status(400).json({ error: 'inputQueue is required' });
      }
      const worker = startRouterWorker({ inputQueue, intervalMs, batchSize, consumerService });
      res.json({ status: 'started', worker: {
        inputQueue: worker.inputQueue,
        intervalMs: worker.intervalMs,
        batchSize: worker.batchSize,
        consumerService: worker.consumerService,
        startedAt: worker.startedAt
      } });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/router/workers/:inputQueue/stop', (req, res) => {
    const removed = stopRouterWorker(req.params.inputQueue);
    if (!removed) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.json({ status: 'stopped', inputQueue: req.params.inputQueue });
  });
}
