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
    { id: 'upsertRule', kind: 'command', description: 'Create or update a routing rule.', http: { method: 'POST', path: '/api/router/rules' }, requestExample: { ruleId: 'mt103-ingress', inputQueue: 'swift.mt103.inbound', outputQueue: 'swift.mt103.parsed', enabled: true }, responseExample: { status: 'ok', ruleId: 'mt103-ingress' } },
    { id: 'deleteRule', kind: 'command', description: 'Delete a routing rule.', http: { method: 'DELETE', path: '/api/router/rules/:ruleId' }, responseExample: { status: 'ok', deletedRuleId: 'mt103-ingress' } },
    { id: 'ingest', kind: 'command', description: 'Ingest message through routing pipeline.', http: { method: 'POST', path: '/api/router/ingest' }, requestExample: { inputQueue: 'swift.mt103.inbound', message: 'MT103 SAMPLE', sourceService: 'ingress-gateway' }, responseExample: { status: 'ok', accepted: true, routedQueues: ['swift.mt103.parsed'] } },
    { id: 'edgeIngest', kind: 'command', description: 'Ingest message preferring edge execution.', http: { method: 'POST', path: '/api/edge/ingest' }, requestExample: { inputQueue: 'swift.mt103.inbound', message: 'MT103 SAMPLE', edgeRole: 'bonecrusher' }, responseExample: { status: 'ok', offloaded: true, targetNodeId: 'esp32-115' } },
    { id: 'processQueue', kind: 'command', description: 'Process messages from an input queue.', http: { method: 'POST', path: '/api/router/process/:inputQueue' }, requestExample: { maxMessages: 10 }, responseExample: { status: 'ok', inputQueue: 'swift.mt103.inbound', processed: 10 } },
    { id: 'listWorkers', kind: 'query', description: 'Get router worker status.', http: { method: 'GET', path: '/api/router/workers' } }
  ]
};
