export const lifecycleServiceProvider = {
  id: 'lifecycle',
  name: 'Lifecycle Service',
  category: 'workflow',
  description: 'Lifecycle orchestration, test harnesses, policies, and worker controls.',
  properties: [
    { id: 'dashboard', type: 'object', description: 'Compiled lifecycle dashboard payload.', readOnly: true },
    { id: 'policy', type: 'object', description: 'Lifecycle execution policy flags.', readOnly: false },
    { id: 'heartbeat', type: 'object', description: 'Lifecycle heartbeat monitor summary.', readOnly: true }
  ],
  actions: [
    { id: 'getDashboard', kind: 'query', description: 'Get lifecycle dashboard.', http: { method: 'GET', path: '/api/lifecycle/dashboard' } },
    { id: 'runHappyPath', kind: 'command', description: 'Execute happy-path test run.', http: { method: 'POST', path: '/api/lifecycle/happy-path/run' } },
    { id: 'runSadPath', kind: 'command', description: 'Execute sad-path test run.', http: { method: 'POST', path: '/api/lifecycle/sad-path/run' } },
    { id: 'triggerHeartbeat', kind: 'command', description: 'Queue manual lifecycle heartbeat.', http: { method: 'POST', path: '/api/lifecycle/heartbeat/trigger' } },
    { id: 'updatePolicy', kind: 'command', description: 'Update lifecycle policy values.', http: { method: 'POST', path: '/api/lifecycle/policy' } },
    { id: 'updateFlowTargets', kind: 'command', description: 'Update lifecycle flow target thresholds.', http: { method: 'POST', path: '/api/lifecycle/policy/flow-targets' } }
  ]
};
