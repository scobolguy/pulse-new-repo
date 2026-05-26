export const observabilityServiceProvider = {
  id: 'observability',
  name: 'Observability Service',
  category: 'platform',
  description: 'Metrics, latency policy evaluation, and runtime diagnostics.',
  properties: [
    { id: 'metricsCurrent', type: 'object', description: 'Current metrics snapshot.', readOnly: true },
    { id: 'metricsHistory', type: 'collection', description: 'Historical metrics samples.', readOnly: true },
    { id: 'runtimeDiagnostics', type: 'object', description: 'Node runtime diagnostics.', readOnly: true }
  ],
  actions: [
    { id: 'getCurrentMetrics', kind: 'query', description: 'Fetch current observability payload.', http: { method: 'GET', path: '/api/metrics/current' } },
    { id: 'getMetricsHistory', kind: 'query', description: 'Fetch metrics history samples.', http: { method: 'GET', path: '/api/metrics/history' } },
    { id: 'getRuntimeMetrics', kind: 'query', description: 'Fetch runtime diagnostics.', http: { method: 'GET', path: '/api/metrics/runtime' } }
  ]
};
