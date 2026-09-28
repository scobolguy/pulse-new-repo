import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import QueueManager from '../src/broker/QueueManager.mjs';
import { registerQueueBrokerOpsRoutes } from '../src/backend/roles/queueBrokerOpsRoutes.mjs';
import { registerQueueConfigRoutes } from '../src/backend/roles/queueConfigRoutes.mjs';

const managerId = 'qm-http-canonical-proof';
const queueName = 'swift.mt103.http-proof';
const canonicalId = 'type:swift-mt103-v4';
const queueManager = new QueueManager(managerId);
const queueManagerInstances = new Map([[managerId, queueManager]]);
const queueManagerRegistry = new Map([[managerId, { managerId, local: true, localIndex: 0 }]]);
const queueManagers = [queueManager];
const queueRoutes = new Map();

const librarianServer = http.createServer((req, res) => {
  if (req.url === '/api/librarian/data-types') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      types: [{
        id: 'mt103',
        logicalId: 'mt103',
        canonicalId,
        aliases: ['swift-mt103']
      }]
    }));
    return;
  }
  res.statusCode = 404;
  res.end();
});
await new Promise(resolve => librarianServer.listen(0, '127.0.0.1', resolve));
const librarianPort = librarianServer.address().port;

const app = express();
app.use(express.json());
const requirePermission = () => (req, res, next) => next();

registerQueueConfigRoutes(app, {
  requirePermission,
  queueManagerInstances,
  queueManagerRegistry,
  inferQueueDataTypeIds: () => ['text-string'],
  compileQueueDslSpec: () => ({}),
  diffQueueConfigs: () => ({ creates: [], updates: [], deletes: [], unchanged: [] }),
  queueConfigMapFromWorkflowSymbols: () => ({}),
  systemRegistry: {},
  resolveLibrarianOrigin: () => `http://127.0.0.1:${librarianPort}`,
  IS_PRODUCTION_ENV: false,
  ALLOW_TEMP_QUEUES_IN_PRODUCTION: false,
});

const ensureRoute = name => queueRoutes.get(name) || null;
const enqueueViaRoute = async (route, name, message, sourceService, envelope) => ({
  managerId: route.managerId,
  messageId: queueManager.enqueue(name, message, sourceService, null, envelope)
});
registerQueueBrokerOpsRoutes(app, {
  queueRoutes,
  queueManagerRegistry,
  queueManagers,
  resolveServiceInstance: () => null,
  getBrokerStateLabel: () => 'running',
  getActiveBrokerInstances: () => [],
  getBrokerInstancesPayload: () => [],
  getAvailableQueueManagers: () => queueManagers,
  setBrokerInstanceState: () => {},
  brokerInstances: [],
  getOrCreateBrokerInstance: () => null,
  startSecondaryBroker: async () => {},
  ensureRoute,
  enqueueViaRoute,
  messageRouter: null,
  globalState: {},
  getActiveQueueManagers: () => queueManagers,
  ensureQueueTriggeredFlowForQueue: () => false,
  queueValidationErrors: [],
  requirePermission,
  dlqEvents: [],
  summarizeDlqEvents: () => ({}),
  dequeueViaRoute: async () => null,
});

const backend = await new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});
const baseUrl = `http://127.0.0.1:${backend.address().port}`;

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return { response, payload: await response.json() };
}

try {
  const created = await request(`/api/queues/${managerId}/create`, {
    method: 'POST',
    body: { queueName, config: { dataTypeId: 'mt103' } }
  });
  assert.equal(created.response.status, 200, JSON.stringify(created.payload));
  assert.equal(created.payload.config.dataTypeId, canonicalId);
  queueRoutes.set(queueName, { queueName, managerId });

  const enqueued = await request(`/api/queue/${encodeURIComponent(queueName)}/enqueue`, {
    method: 'POST',
    body: {
      message: 'MT103\\n:20:HTTP-PROOF-1',
      sourceService: 'http-proof',
      messageEnvelope: { dataTypeId: canonicalId }
    }
  });
  assert.equal(enqueued.response.status, 200, JSON.stringify(enqueued.payload));

  const claimed = await request(`/api/queue/${encodeURIComponent(queueName)}/claim`, {
    method: 'POST',
    body: { workerId: 'http-proof-worker' }
  });
  assert.equal(claimed.response.status, 200, JSON.stringify(claimed.payload));
  assert.equal(claimed.payload.claim.message.messageEnvelope.dataTypeId, canonicalId);

  console.log('[queue-type-http-boundary] PASS: Librarian canonical IDs validate, enqueue, and claim through HTTP routes');
} finally {
  await new Promise(resolve => backend.close(resolve));
  await new Promise(resolve => librarianServer.close(resolve));
}
