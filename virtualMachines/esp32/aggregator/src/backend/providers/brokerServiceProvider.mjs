export const brokerServiceProvider = {
  id: 'broker',
  name: 'Broker Service',
  category: 'messaging',
  description: 'Manages broker instances, queue routes, and broker state.',
  properties: [
    { id: 'provider', type: 'string', description: 'Active broker provider (legacy/rabbitmq/msmq/kafka/ibm/apache).', readOnly: true },
    { id: 'instances', type: 'collection', description: 'Known broker instances and runtime state.', readOnly: true },
    { id: 'routes', type: 'collection', description: 'Message routing table definitions.', readOnly: true }
  ],
  actions: [
    { id: 'listState', kind: 'query', description: 'Get broker state summary.', http: { method: 'GET', path: '/api/broker/state' } },
    { id: 'listInstances', kind: 'query', description: 'List broker instances.', http: { method: 'GET', path: '/api/broker/instances' } },
    { id: 'setInstanceState', kind: 'command', description: 'Set broker instance desired state.', http: { method: 'POST', path: '/api/broker/instances/:instanceId/state' } }
  ]
};
