export const queueServiceProvider = {
  id: 'queue',
  name: 'Queue Service',
  category: 'messaging',
  description: 'Queue configuration, transfer operations, and message-level controls.',
  properties: [
    { id: 'managers', type: 'collection', description: 'Queue manager registry.', readOnly: true },
    { id: 'queueConfigs', type: 'collection', description: 'Queue configuration by manager.', readOnly: true },
    { id: 'temporaryQueueAudit', type: 'collection', description: 'Temporary queue compliance status.', readOnly: true }
  ],
  actions: [
    { id: 'createQueue', kind: 'command', description: 'Create queue config on manager.', http: { method: 'POST', path: '/api/queues/:managerId/create' }, requestExample: { queueName: 'swift.mt103.inbound', durable: true, dataTypeIds: ['swift-mt103'] }, responseExample: { status: 'ok', managerId: 'qm-primary', queueName: 'swift.mt103.inbound' } },
    { id: 'updateQueue', kind: 'command', description: 'Update queue config on manager.', http: { method: 'POST', path: '/api/queues/:managerId/update' }, requestExample: { queueName: 'swift.mt103.inbound', leaseMs: 30000 }, responseExample: { status: 'ok', updated: true } },
    { id: 'deleteQueue', kind: 'command', description: 'Delete queue config on manager.', http: { method: 'POST', path: '/api/queues/:managerId/delete' }, requestExample: { queueName: 'swift.mt103.inbound' }, responseExample: { status: 'ok', deleted: true } },
    { id: 'getQueueConfig', kind: 'query', description: 'Fetch queue config snapshot.', http: { method: 'GET', path: '/api/queues/:managerId/config' }, responseExample: { status: 'ok', managerId: 'qm-primary', queues: [{ queueName: 'swift.mt103.inbound', durable: true }] } },
    { id: 'exportManager', kind: 'query', description: 'Export all queues/messages from manager.', http: { method: 'GET', path: '/api/queues/:managerId/export' }, responseExample: { status: 'ok', managerId: 'qm-primary', queues: [], messages: [] } },
    { id: 'importManager', kind: 'command', description: 'Import queue bundle into manager.', http: { method: 'POST', path: '/api/queues/:managerId/import' }, requestExample: { queues: [{ queueName: 'swift.mt103.inbound', durable: true }], messages: [] }, responseExample: { status: 'ok', importedQueues: 1, importedMessages: 0 } }
  ]
};
