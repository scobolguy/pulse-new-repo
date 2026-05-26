function buildCurrentMetricsPayload({
  metricsCollector,
  evaluateLatencyPolicies,
  workerConfig,
  getStep3LatencySummary,
  getQueueEnqueueLatencySummary,
  getEdgeOffloadMetricsSummary,
  getTxStatePersistenceSummary
}) {
  const metrics = metricsCollector.getCurrentMetrics();
  const latencyPolicy = evaluateLatencyPolicies(metrics, workerConfig);
  const step3Latency = getStep3LatencySummary({ recentLimit: 20 });
  const queueEnqueueLatency = getQueueEnqueueLatencySummary({ recentLimit: 3 });
  const edgeOffload = getEdgeOffloadMetricsSummary();
  const txStatePersistence = getTxStatePersistenceSummary();
  return {
    status: 'ok',
    timestamp: Date.now(),
    metrics,
    latencyPolicy,
    step3Latency,
    queueEnqueueLatency,
    edgeOffload,
    txStatePersistence
  };
}

export function registerObservabilityRoutes(app, deps) {
  const {
    requirePermission,
    metricsCollector,
    evaluateLatencyPolicies,
    getWorkerConfig,
    getStep3LatencySummary,
    getQueueEnqueueLatencySummary,
    getEdgeOffloadMetricsSummary,
    getTxStatePersistenceSummary,
    getNodeRuntimeDiagnosticsSnapshot
  } = deps;

  app.get('/api/metrics/current', (req, res) => {
    const payload = buildCurrentMetricsPayload({
      metricsCollector,
      evaluateLatencyPolicies,
      workerConfig: getWorkerConfig(),
      getStep3LatencySummary,
      getQueueEnqueueLatencySummary,
      getEdgeOffloadMetricsSummary,
      getTxStatePersistenceSummary
    });
    res.json(payload);
  });

  app.get('/api/metrics/runtime', requirePermission('lifecycle.read'), (req, res) => {
    res.json({
      status: 'ok',
      diagnostics: getNodeRuntimeDiagnosticsSnapshot()
    });
  });

  app.get('/api/metrics/history', (req, res) => {
    const limit = parseInt(req.query.limit || '100');
    const history = metricsCollector.getMetricsHistory(limit);
    res.json({
      status: 'ok',
      samples: history.length,
      history
    });
  });
}
