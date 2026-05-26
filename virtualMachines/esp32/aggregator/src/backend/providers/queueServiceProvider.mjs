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
    { id: 'createQueue', kind: 'command', description: 'Create queue config on manager.', http: { method: 'POST', path: '/api/queues/:managerId/create' } },
    { id: 'updateQueue', kind: 'command', description: 'Update queue config on manager.', http: { method: 'POST', path: '/api/queues/:managerId/update' } },
    { id: 'deleteQueue', kind: 'command', description: 'Delete queue config on manager.', http: { method: 'POST', path: '/api/queues/:managerId/delete' } },
    { id: 'getQueueConfig', kind: 'query', description: 'Fetch queue config snapshot.', http: { method: 'GET', path: '/api/queues/:managerId/config' } },
    { id: 'exportManager', kind: 'query', description: 'Export all queues/messages from manager.', http: { method: 'GET', path: '/api/queues/:managerId/export' } },
    { id: 'importManager', kind: 'command', description: 'Import queue bundle into manager.', http: { method: 'POST', path: '/api/queues/:managerId/import' } }
  ]
};
