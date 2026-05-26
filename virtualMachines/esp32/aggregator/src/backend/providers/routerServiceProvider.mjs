export const routerServiceProvider = {
  id: 'router',
  name: 'Router Service',
  category: 'messaging',
  description: 'Controls routing rules, ingest operations, and queue processing workers.',
  properties: [
    { id: 'rules', type: 'collection', description: 'Routing rules and priorities.', readOnly: true },
    { id: 'workers', type: 'collection', description: 'Router worker runtime status.', readOnly: true }
  ],
  actions: [
    { id: 'upsertRule', kind: 'command', description: 'Create or update a routing rule.', http: { method: 'POST', path: '/api/router/rules' } },
    { id: 'deleteRule', kind: 'command', description: 'Delete a routing rule.', http: { method: 'DELETE', path: '/api/router/rules/:ruleId' } },
    { id: 'ingest', kind: 'command', description: 'Ingest message through routing pipeline.', http: { method: 'POST', path: '/api/router/ingest' } },
    { id: 'edgeIngest', kind: 'command', description: 'Ingest message preferring edge execution.', http: { method: 'POST', path: '/api/edge/ingest' } },
    { id: 'processQueue', kind: 'command', description: 'Process messages from an input queue.', http: { method: 'POST', path: '/api/router/process/:inputQueue' } },
    { id: 'listWorkers', kind: 'query', description: 'Get router worker status.', http: { method: 'GET', path: '/api/router/workers' } }
  ]
};
