import fs from 'fs';
console.log('hello');
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
// Run with: node backend.mjs
import dgram from 'dgram';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createMessageBroker, createQueueManager } from './src/broker.js';
import { createFileServer } from './fileServer.js';
import crypto from 'crypto';

const HTTP_PORT = 4000;
const UDP_PORT = 4210;
const BROKER_SERVICE = 'broker';

const app = express();
app.use(cors());
app.use(express.json());

console.log('[DEBUG] Creating global state...');
const queueManagerInstances = new Map(); // Maps managerId to QueueManager instance
let queueManagers = [
  (() => { 
    console.log('[DEBUG] Creating primary QueueManager');
    const qm = createQueueManager('qm-primary', './data');
    queueManagerInstances.set('qm-primary', qm);
    return qm;
  })(),
  (() => { 
    console.log('[DEBUG] Creating secondary QueueManager'); 
    const qm = createQueueManager('qm-secondary', './data');
    queueManagerInstances.set('qm-secondary', qm);
    return qm;
  })()
];
const primaryBroker = createMessageBroker();
let secondaryBroker = null;
globalThis.secondaryBrokerActive = false;
globalThis.secondaryBrokerQuiesced = false;
const discoveredNodes = new Map();
const queueManagerRegistry = new Map();
const queueRoutes = new Map();
const MANAGER_ACTIVE_STATES = new Set(['up', 'degraded']);
const serviceInstanceRegistry = new Map();
const localQueueManagerProcesses = new Map();
const queueManagerScriptPath = fileURLToPath(new URL('./queue-manager-node.mjs', import.meta.url));

function normalizeNodeId(value) {
  return (value || '').toString().trim();
}

function registerLocalQueueManagers() {
  queueManagerRegistry.set('qm-primary', {
    managerId: 'qm-primary',
    name: 'primary',
    nodeId: '127.0.0.1',
    ip: '127.0.0.1',
    port: HTTP_PORT,
    status: 'up',
    local: true,
    localIndex: 0,
    lastHeartbeat: Date.now(),
    queues: [],
    replicaOf: null,        // null means it's the primary
    replicas: [],           // list of replica managerId
    operationVersion: 0     // current operation log version
  });
  queueManagerRegistry.set('qm-secondary', {
    managerId: 'qm-secondary',
    name: 'secondary',
    nodeId: '127.0.0.1',
    ip: '127.0.0.1',
    port: HTTP_PORT,
    status: 'up',
    local: true,
    localIndex: 1,
    lastHeartbeat: Date.now(),
    queues: [],
    replicaOf: null,        // null means it's the primary
    replicas: [],           // list of replica managerId
    operationVersion: 0     // current operation log version
  });
}

registerLocalQueueManagers();

function upsertRemoteQueueManager({ managerId, name, nodeId, ip, port, status, queues, replicaOf, operationVersion }) {
  if (!managerId) return;
  const prev = queueManagerRegistry.get(managerId) || {};
  const nextStatus = status || prev.status || 'up';
  const effectiveNodeId = normalizeNodeId(nodeId || ip || prev.nodeId);
  queueManagerRegistry.set(managerId, {
    ...prev,
    managerId,
    name: name || prev.name || managerId,
    nodeId: effectiveNodeId,
    ip: ip || prev.ip,
    port: Number(port || prev.port || HTTP_PORT),
    status: nextStatus,
    local: false,
    lastHeartbeat: Date.now(),
    queues: Array.isArray(queues) ? queues : (prev.queues || []),
    replicaOf: replicaOf || prev.replicaOf || null,
    replicas: prev.replicas || [],
    operationVersion: operationVersion || prev.operationVersion || 0
  });
}

function upsertServiceInstance({ serviceName, instanceId, nodeId, ip, port, status, metadata }) {
  if (!serviceName) return;
  const effectiveInstanceId = instanceId || `${serviceName}:${nodeId || ip || 'unknown'}:${port || ''}`;
  const prev = serviceInstanceRegistry.get(effectiveInstanceId) || {};
  const effectiveNodeId = normalizeNodeId(nodeId || ip || prev.nodeId);
  const nextStatus = status || prev.status || 'up';
  serviceInstanceRegistry.set(effectiveInstanceId, {
    ...prev,
    instanceId: effectiveInstanceId,
    serviceName,
    nodeId: effectiveNodeId,
    ip: ip || prev.ip,
    port: Number(port || prev.port || HTTP_PORT),
    status: nextStatus,
    metadata: metadata || prev.metadata || {},
    lastHeartbeat: Date.now()
  });
}

function setNodeLifecycleState(nodeId, state) {
  const normalized = normalizeNodeId(nodeId);
  if (!normalized) return false;
  let changed = false;

  for (const [managerId, manager] of queueManagerRegistry.entries()) {
    if (normalizeNodeId(manager.nodeId || manager.ip) === normalized) {
      manager.status = state;
      manager.updatedAt = new Date().toISOString();
      queueManagerRegistry.set(managerId, manager);
      changed = true;
    }
  }

  for (const [instanceId, instance] of serviceInstanceRegistry.entries()) {
    if (normalizeNodeId(instance.nodeId || instance.ip) === normalized) {
      instance.status = state;
      instance.updatedAt = new Date().toISOString();
      serviceInstanceRegistry.set(instanceId, instance);
      changed = true;
    }
  }

  return changed;
}

function getNodeQueueManagers(nodeId) {
  const normalized = normalizeNodeId(nodeId);
  return Array.from(queueManagerRegistry.values()).filter(m => normalizeNodeId(m.nodeId || m.ip) === normalized);
}

function getNodeDrainStatus(nodeId) {
  const managers = getNodeQueueManagers(nodeId);
  const managerIds = new Set(managers.map(m => m.managerId));
  const queueAssignments = [];

  let pendingMessagesKnown = 0;
  let unknownQueueDepthCount = 0;

  for (const route of queueRoutes.values()) {
    if (!managerIds.has(route.managerId)) continue;
    const manager = queueManagerRegistry.get(route.managerId);
    let queueLength = null;
    if (manager?.local) {
      queueLength = queueManagers[manager.localIndex].getQueueLength(route.queueName);
      pendingMessagesKnown += queueLength;
    } else {
      unknownQueueDepthCount += 1;
    }
    queueAssignments.push({
      queueName: route.queueName,
      managerId: route.managerId,
      queueLength
    });
  }

  const drainReady = pendingMessagesKnown === 0 && unknownQueueDepthCount === 0;
  return {
    nodeId,
    managerCount: managers.length,
    managers,
    queueAssignments,
    pendingMessagesKnown,
    unknownQueueDepthCount,
    drainReady
  };
}

function getAvailableServiceInstances(serviceName) {
  return Array.from(serviceInstanceRegistry.values()).filter(i => i.serviceName === serviceName && MANAGER_ACTIVE_STATES.has(i.status));
}

function getLocalQueueManagerLaunchers() {
  return Array.from(localQueueManagerProcesses.values()).map(entry => ({
    managerId: entry.managerId,
    nodeId: entry.nodeId,
    port: entry.port,
    advertiseIp: entry.advertiseIp,
    aggregatorUrl: entry.aggregatorUrl,
    pid: entry.child.pid,
    status: entry.status,
    startedAt: entry.startedAt,
    stoppedAt: entry.stoppedAt || null,
    exitCode: entry.exitCode ?? null,
    signal: entry.signal ?? null,
    lastError: entry.lastError || null,
  }));
}

function launchLocalQueueManager({ managerId, nodeId, port, advertiseIp, aggregatorUrl }) {
  const existing = localQueueManagerProcesses.get(managerId);
  if (existing && existing.status === 'running') {
    throw new Error(`Queue manager ${managerId} is already running`);
  }

  const args = [
    queueManagerScriptPath,
    `--aggregator=${aggregatorUrl}`,
    `--port=${port}`,
    `--manager-id=${managerId}`,
    `--node-id=${nodeId}`,
    `--advertise-ip=${advertiseIp}`,
  ];

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const entry = {
    managerId,
    nodeId,
    port,
    advertiseIp,
    aggregatorUrl,
    child,
    status: 'running',
    startedAt: new Date().toISOString(),
    logs: [],
    lastError: null,
  };

  child.stdout.on('data', chunk => {
    entry.logs.push(chunk.toString());
    entry.logs = entry.logs.slice(-50);
  });
  child.stderr.on('data', chunk => {
    entry.lastError = chunk.toString();
    entry.logs.push(chunk.toString());
    entry.logs = entry.logs.slice(-50);
  });
  child.on('exit', (code, signal) => {
    entry.status = 'stopped';
    entry.exitCode = code;
    entry.signal = signal;
    entry.stoppedAt = new Date().toISOString();
  });

  localQueueManagerProcesses.set(managerId, entry);
  return entry;
}

function stopLocalQueueManager(managerId) {
  const entry = localQueueManagerProcesses.get(managerId);
  if (!entry) return null;
  if (entry.status === 'running') {
    entry.child.kill();
    entry.status = 'stopping';
  }
  return entry;
}

function resolveServiceInstance(serviceName) {
  const candidates = getAvailableServiceInstances(serviceName);
  if (candidates.length === 0) return null;
  let selected = candidates[0];
  for (const c of candidates) {
    if ((c.lastHeartbeat || 0) > (selected.lastHeartbeat || 0)) selected = c;
  }
  return selected;
}

function getAvailableQueueManagers() {
  return Array.from(queueManagerRegistry.values()).filter(m => MANAGER_ACTIVE_STATES.has(m.status));
}

function setQueueManagerStatus(managerId, status) {
  const manager = queueManagerRegistry.get(managerId);
  if (!manager) return null;
  manager.status = status;
  manager.updatedAt = new Date().toISOString();
  queueManagerRegistry.set(managerId, manager);
  return manager;
}

function ensureRoute(queueName) {
  const existing = queueRoutes.get(queueName);
  if (existing) {
    const manager = queueManagerRegistry.get(existing.managerId);
    if (manager && MANAGER_ACTIVE_STATES.has(manager.status)) {
      return existing;
    }
  }

  const available = getAvailableQueueManagers();
  if (available.length === 0) {
    return null;
  }

  let selected = available[0];
  let selectedCount = Number.MAX_SAFE_INTEGER;
  for (const manager of available) {
    let count = 0;
    for (const route of queueRoutes.values()) {
      if (route.managerId === manager.managerId) count += 1;
    }
    if (count < selectedCount) {
      selected = manager;
      selectedCount = count;
    }
  }

  const route = {
    queueName,
    managerId: selected.managerId,
    assignedAt: new Date().toISOString()
  };
  queueRoutes.set(queueName, route);
  return route;
}

async function enqueueViaRoute(route, queueName, message, sourceService) {
  const manager = queueManagerRegistry.get(route.managerId);
  if (!manager) throw new Error(`Route manager ${route.managerId} not found`);

  if (manager.local) {
    const qm = queueManagers[manager.localIndex];
    qm.enqueue(queueName, message, sourceService || 'unknown');
    return { deliveredTo: manager.managerId, mode: 'local' };
  }

  const url = `http://${manager.ip}:${manager.port}/enqueue`;
  const remoteRes = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queueName, message, sourceService: sourceService || 'unknown' })
  });
  if (!remoteRes.ok) {
    throw new Error(`Remote enqueue failed at ${url} with status ${remoteRes.status}`);
  }
  return { deliveredTo: manager.managerId, mode: 'remote', url };
}

// --- UDP Node Discovery ---
const udpServer = dgram.createSocket('udp4');
udpServer.on('message', (msg, rinfo) => {
  const ip = rinfo.address;
  const now = Date.now();
  let node = discoveredNodes.get(ip) || {};
  let parsed = false;
  try {
    const data = JSON.parse(msg.toString());
    if (data && (data.kind === 'queueManagerHeartbeat' || data.service === 'queue-manager')) {
      upsertRemoteQueueManager({
        managerId: data.managerId || `${ip}:${data.port || HTTP_PORT}:${data.name || 'qm'}`,
        name: data.name || data.managerName,
        nodeId: data.nodeId || ip,
        ip,
        port: data.port || data.httpPort || HTTP_PORT,
        status: data.status || 'up',
        queues: data.queues
      });
    }
    if (data && data.serviceName) {
      upsertServiceInstance({
        serviceName: data.serviceName,
        instanceId: data.instanceId,
        nodeId: data.nodeId || ip,
        ip,
        port: data.port || data.httpPort || HTTP_PORT,
        status: data.status || 'up',
        metadata: data.metadata
      });
    }
    node = {
      ...node,
      ...data,
      ip,
      lastSeen: now,
      raw: msg.toString()
    };
    parsed = true;
  } catch (e) {
    // Not JSON, treat as plain text
    node = {
      ...node,
      ip,
      lastSeen: now,
      raw: msg.toString(),
      nodeName: msg.toString().substring(0, 32),
    };
  }
  discoveredNodes.set(ip, node);
  if (parsed) enrichNodeDetails(ip);
});
udpServer.bind(UDP_PORT, () => {
  console.log(`[UDP] Listening for node broadcasts on port ${UDP_PORT}`);
});

// --- Node Cleanup ---
setInterval(() => {
  const now = Date.now();
  for (const [ip, node] of discoveredNodes.entries()) {
    if (now - node.lastSeen > 10 * 60 * 1000) { // 10 min timeout
      discoveredNodes.delete(ip);
      console.log(`[TOPOLOGY] Removed inactive node: ${ip}`);
    }
  }

  for (const [managerId, manager] of queueManagerRegistry.entries()) {
    if (manager.local) {
      manager.lastHeartbeat = now;
      if (MANAGER_ACTIVE_STATES.has(manager.status)) {
        manager.status = 'up';
      }
      queueManagerRegistry.set(managerId, manager);
      continue;
    }
    if (MANAGER_ACTIVE_STATES.has(manager.status) && now - manager.lastHeartbeat > 30 * 1000) {
      manager.status = 'down';
      queueManagerRegistry.set(managerId, manager);
    }
  }

  for (const [instanceId, instance] of serviceInstanceRegistry.entries()) {
    if (MANAGER_ACTIVE_STATES.has(instance.status) && now - (instance.lastHeartbeat || 0) > 30 * 1000) {
      instance.status = 'down';
      serviceInstanceRegistry.set(instanceId, instance);
    }
  }
}, 60 * 1000);

// --- Service Topology Enrichment ---
import fetch from 'node-fetch';
async function enrichNodeDetails(ip) {
  try {
    const servicesRes = await fetch(`http://${ip}:80/services/describe`);
    const statusRes = await fetch(`http://${ip}:80/status`);
    let details = {};
    if (servicesRes.ok) {
      details = await servicesRes.json();
    }
    if (statusRes.ok) {
      details = { ...details, ...(await statusRes.json()) };
    }
    const node = discoveredNodes.get(ip);
    if (node) {
      node.details = details;
      discoveredNodes.set(ip, node);
    }
  } catch (e) {
    // Ignore unreachable nodes
  }
}

function getActiveQueueManagers() {
  return queueManagers;
}
function getNextQueueManager() {
  // Simple round-robin or always primary for demo
  return queueManagers[0];
}
function getBrokerNodeDetails() {
  return { status: 'ok', service: BROKER_SERVICE };
}
function updateVirtualNodes() {
  // Dummy implementation
}

function registerRoutes(app) {
  function startSecondaryBroker() {
    if (secondaryBroker && globalThis.secondaryBrokerActive) {
      return { status: 'already running' };
    }
    secondaryBroker = createMessageBroker();
    globalThis.secondaryBrokerActive = true;
    globalThis.secondaryBrokerQuiesced = false;
    return { status: 'secondary broker started' };
  }

  app.post('/api/registry/heartbeat', (req, res) => {
    try {
      const { managerId, name, ip, port, status, queues } = req.body || {};
      const effectiveIp = ip || req.ip?.replace('::ffff:', '') || '127.0.0.1';
      upsertRemoteQueueManager({ managerId, name, nodeId: effectiveIp, ip: effectiveIp, port, status, queues });
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/registry/service-instances/heartbeat', (req, res) => {
    try {
      const { serviceName, instanceId, nodeId, ip, port, status, metadata } = req.body || {};
      const effectiveIp = ip || req.ip?.replace('::ffff:', '') || '127.0.0.1';
      upsertServiceInstance({
        serviceName,
        instanceId,
        nodeId: nodeId || effectiveIp,
        ip: effectiveIp,
        port,
        status,
        metadata
      });
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/registry/queue-managers', (req, res) => {
    const managers = Array.from(queueManagerRegistry.values()).sort((a, b) => a.managerId.localeCompare(b.managerId));
    res.json({ queueManagers: managers });
  });

  app.get('/api/local-queue-managers', (req, res) => {
    res.json({ launchers: getLocalQueueManagerLaunchers() });
  });

  app.post('/api/local-queue-managers/start', (req, res) => {
    try {
      const defaultIp = req.ip?.replace('::ffff:', '') || '127.0.0.1';
      const {
        managerId,
        nodeId,
        port,
        advertiseIp,
        aggregatorUrl,
      } = req.body || {};

      if (!managerId || !port) {
        return res.status(400).json({ error: 'managerId and port are required' });
      }

      const entry = launchLocalQueueManager({
        managerId,
        nodeId: nodeId || os.hostname(),
        port: Number(port),
        advertiseIp: advertiseIp || defaultIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
      });

      res.json({ status: 'started', launcher: getLocalQueueManagerLaunchers().find(x => x.managerId === entry.managerId) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/local-queue-managers/:managerId/stop', (req, res) => {
    const entry = stopLocalQueueManager(req.params.managerId);
    if (!entry) {
      return res.status(404).json({ error: 'Queue manager launcher not found' });
    }
    res.json({ status: 'stopping', managerId: req.params.managerId });
  });

  app.get('/api/registry/services', (req, res) => {
    const services = {};
    for (const instance of serviceInstanceRegistry.values()) {
      if (!services[instance.serviceName]) services[instance.serviceName] = [];
      services[instance.serviceName].push(instance);
    }
    res.json({ services });
  });

  app.post('/api/registry/nodes/:nodeId/quiesce', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'quiesced');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'quiesced' });
  });

  app.post('/api/registry/nodes/:nodeId/drain', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'draining');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    const drain = getNodeDrainStatus(req.params.nodeId);
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'draining', drain });
  });

  app.get('/api/registry/nodes/:nodeId/drain-status', (req, res) => {
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    res.json(drain);
  });

  app.post('/api/registry/nodes/:nodeId/maintenance', (req, res) => {
    const force = req.query.force === 'true';
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    if (!drain.drainReady && !force) {
      return res.status(409).json({
        error: 'Node not drained',
        message: 'Use /drain-status and wait for pendingMessagesKnown=0, or pass ?force=true',
        drain
      });
    }
    const changed = setNodeLifecycleState(req.params.nodeId, 'maintenance');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'maintenance' });
  });

  app.post('/api/registry/nodes/:nodeId/return-service', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'up');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'up' });
  });

  app.post('/api/registry/queue-managers/:managerId/quiesce', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'quiesced');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/maintenance', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'maintenance');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/return-service', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'up');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.get('/api/registry/queues', (req, res) => {
    const queues = Array.from(queueRoutes.values()).map(route => {
      const manager = queueManagerRegistry.get(route.managerId);
      let queueLength = null;
      if (manager?.local) {
        queueLength = queueManagers[manager.localIndex].getQueueLength(route.queueName);
      }
      return {
        queueName: route.queueName,
        managerId: route.managerId,
        queueLength,
        assignedAt: route.assignedAt
      };
    });
    res.json({ queues });
  });

  app.get('/api/broker/routes', (req, res) => {
    res.json({ routes: Array.from(queueRoutes.values()) });
  });

  app.get('/api/services/resolve/:serviceName', (req, res) => {
    const serviceName = req.params.serviceName;
    const instance = resolveServiceInstance(serviceName);
    if (!instance) {
      return res.status(404).json({ error: `No available instance for ${serviceName}` });
    }
    res.json({ serviceName, instance });
  });

  app.all('/api/service-proxy/:serviceName', async (req, res) => {
    const serviceName = req.params.serviceName;
    const instance = resolveServiceInstance(serviceName);
    if (!instance) {
      return res.status(404).json({ error: `No available instance for ${serviceName}` });
    }

    const path = req.query.path || '/';
    const query = req.query.query ? `?${req.query.query}` : '';
    const targetUrl = `http://${instance.ip}:${instance.port}${path}${query}`;

    try {
      const method = req.method;
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const headers = { 'content-type': req.get('content-type') || 'application/json' };
      const body = hasBody ? JSON.stringify(req.body || {}) : undefined;
      const proxied = await fetch(targetUrl, { method, headers, body });
      const contentType = proxied.headers.get('content-type') || '';
      res.status(proxied.status);
      if (contentType.includes('application/json')) {
        res.json(await proxied.json());
      } else {
        res.send(await proxied.text());
      }
    } catch (e) {
      res.status(502).json({ error: 'Service proxy failed', details: e.message, targetUrl });
    }
  });

  app.get('/api/broker/state', (req, res) => {
    res.json({
      state: globalThis.secondaryBrokerActive ? 'primary+secondary' : 'primary-only',
      brokers: {
        primary: { active: !!primaryBroker, quiesced: false },
        secondary: { active: !!secondaryBroker && !!globalThis.secondaryBrokerActive, quiesced: !!globalThis.secondaryBrokerQuiesced }
      },
      routeCount: queueRoutes.size,
      availableQueueManagers: getAvailableQueueManagers().length
    });
  });

  app.post('/api/broker/start', (req, res) => {
    try {
      const result = startSecondaryBroker();
      res.json({ ...result, state: globalThis.secondaryBrokerActive ? 'primary+secondary' : 'primary-only' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/broker/unquiesce', (req, res) => {
    globalThis.secondaryBrokerQuiesced = false;
    res.json({ status: 'unquiesced', state: globalThis.secondaryBrokerActive ? 'primary+secondary' : 'primary-only' });
  });

  app.post('/api/broker/publish', async (req, res) => {
    const { queueName, message, sourceService } = req.body || {};
    if (!queueName) {
      return res.status(400).json({ error: 'queueName is required' });
    }

    let route = ensureRoute(queueName);
    if (!route) {
      return res.status(503).json({ error: 'No available queue managers' });
    }

    try {
      const delivery = await enqueueViaRoute(route, queueName, message, sourceService || 'unknown');
      return res.json({ status: 'published', route, delivery });
    } catch (e) {
      const manager = queueManagerRegistry.get(route.managerId);
      if (manager) {
        manager.status = 'down';
        queueManagerRegistry.set(route.managerId, manager);
      }
      queueRoutes.delete(queueName);

      route = ensureRoute(queueName);
      if (!route) {
        return res.status(503).json({ error: 'All queue managers unavailable', details: e.message });
      }

      try {
        const delivery = await enqueueViaRoute(route, queueName, message, sourceService || 'unknown');
        return res.json({ status: 'published-with-failover', route, delivery, priorError: e.message });
      } catch (e2) {
        return res.status(503).json({ error: 'Publish failed after failover', details: e2.message, priorError: e.message });
      }
    }
  });

    // UDP discovery for primary broker
    app.get('/api/discover-primary', async (req, res) => {
      // Find the most recently seen broker node (not self)
      const now = Date.now();
      const nodes = Array.from(discoveredNodes.values())
        .filter(n => n.details?.services?.some(s => s.name?.toLowerCase().includes('broker')) && now - n.lastSeen < 10 * 60 * 1000)
        .sort((a, b) => b.lastSeen - a.lastSeen);
      if (nodes.length > 0) {
        res.json({ url: `http://${nodes[0].ip}:4000`, ip: nodes[0].ip, node: nodes[0] });
      } else {
        res.status(404).json({ error: 'No primary broker found' });
      }
    });

    // Quiesce endpoint (simulate taking out of round robin)
    app.post('/api/broker/quiesce', (req, res) => {
      // For demo, just set a flag
      globalThis.secondaryBrokerQuiesced = true;
        res.json({ status: 'quiesced', state: globalThis.secondaryBrokerActive ? 'primary+secondary' : 'primary-only' });
    });

    // Stop endpoint (simulate stopping secondary broker)
    app.post('/api/broker/stop', (req, res) => {
      globalThis.secondaryBrokerActive = false;
      globalThis.secondaryBrokerQuiesced = false;
      res.json({ status: 'stopped', state: 'primary-only' });
    });
  console.log('[DEBUG] Registering routes...');
  app.post('/api/queue/:queueName/freeze', (req, res) => {
    const { queueName } = req.params;
    for (const qm of getActiveQueueManagers()) {
      qm.freezeQueue(queueName);
    }
    res.json({ status: 'frozen' });
  });
  app.post('/api/queue/:queueName/thaw', (req, res) => {
    const { queueName } = req.params;
    for (const qm of getActiveQueueManagers()) {
      qm.thawQueue(queueName);
    }
    res.json({ status: 'thawed' });
  });
  app.get('/api/queue/:queueName/status', (req, res) => {
    const { queueName } = req.params;
    res.json({
      primary: queueManagers[0].getStatus(queueName),
      secondary: queueManagers[1].getStatus(queueName)
    });
  });
  app.post('/api/queue/:queueName/config', (req, res) => {
    const { queueName } = req.params;
    for (const qm of getActiveQueueManagers()) {
      qm.setConfig(queueName, req.body);
    }
    res.json({ status: 'config set' });
  });
  app.get('/api/queue/:queueName/config', (req, res) => {
    const { queueName } = req.params;
    res.json({
      primary: queueManagers[0].getConfig(queueName),
      secondary: queueManagers[1].getConfig(queueName)
    });
  });
  app.post('/api/queue/:queueName/enqueue', (req, res) => {
    const { queueName } = req.params;
    const { message, sourceService } = req.body;
    try {
      getNextQueueManager().enqueue(queueName, message, sourceService || 'unknown');
      res.json({ status: 'enqueued' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post('/api/queue/:queueName/dequeue', (req, res) => {
    const { queueName } = req.params;
    const { consumerService } = req.body;
    try {
      const message = getNextQueueManager().dequeue(queueName, consumerService || 'unknown');
      if (message === null) {
        res.status(404).json({ error: 'Queue empty' });
      } else {
        res.json({ message });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get('/api/queue/:queueName/length', (req, res) => {
    const { queueName } = req.params;
    res.json({
      primary: queueManagers[0].getQueueLength(queueName),
      secondary: queueManagers[1].getQueueLength(queueName)
    });
  });
  const logFile = 'secondary-broker.log';
  function logToFile(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.debug('[SECONDARY BROKER]', msg);
  }
  app.post('/api/broker/launch-secondary', (req, res) => {
    logToFile('--- /api/broker/launch-secondary called ---');
    console.log('DEBUG: /api/broker/launch-secondary called');
    if (secondaryBroker && globalThis.secondaryBrokerActive) {
      logToFile('Secondary broker already running');
      console.log('DEBUG: Secondary broker already running');
      return res.status(200).json({ status: 'already running' });
    }
    try {
      logToFile('Attempting to create secondary broker...');
      console.log('DEBUG: Attempting to create secondary broker...');
      const result = startSecondaryBroker();
      logToFile('Created secondary broker instance');
      console.log('DEBUG: Created secondary broker instance');
      logToFile('Secondary broker started successfully');
      console.log('DEBUG: Secondary broker started successfully');
      res.json(result);
      console.log('DEBUG: Response sent for secondary broker started');
    } catch (e) {
      globalThis.secondaryBrokerActive = false;
      const errorMsg = 'Failed to start secondary broker: ' + (e && e.stack ? e.stack : e.toString());
      logToFile(errorMsg);
      console.error(errorMsg);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to start secondary broker', details: errorMsg });
    }
  });

  // --- REPLICATION ENDPOINTS ---
  // Create a replica instance for a queue manager
  app.post('/api/replication/create-replica', (req, res) => {
    try {
      const { primaryManagerId, replicaManagerId, replicaNodeId, replicaIp, replicaPort } = req.body || {};
      
      if (!primaryManagerId || !replicaManagerId) {
        return res.status(400).json({ error: 'primaryManagerId and replicaManagerId are required' });
      }

      const primary = queueManagerRegistry.get(primaryManagerId);
      if (!primary) {
        return res.status(404).json({ error: `Primary manager ${primaryManagerId} not found` });
      }

      // Create replica entry in registry
      const replica = {
        managerId: replicaManagerId,
        name: `${primary.name}-replica`,
        nodeId: replicaNodeId || primary.nodeId,
        ip: replicaIp || primary.ip,
        port: replicaPort || primary.port,
        status: 'up',
        local: false,
        lastHeartbeat: Date.now(),
        queues: [],
        replicaOf: primaryManagerId,  // Point to primary
        replicas: [],
        operationVersion: 0,
        primarySyncVersion: 0  // Track which operations we've synced from primary
      };

      queueManagerRegistry.set(replicaManagerId, replica);

      // Add to primary's replica list
      if (!primary.replicas) primary.replicas = [];
      primary.replicas.push(replicaManagerId);
      queueManagerRegistry.set(primaryManagerId, primary);

      res.json({ 
        status: 'replica-created', 
        primary: { managerId: primaryManagerId, replicas: primary.replicas },
        replica: { managerId: replicaManagerId, replicaOf: primaryManagerId }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get operations since a version (for replica sync)
  app.get('/api/replication/operations/:managerId', (req, res) => {
    try {
      const { managerId } = req.params;
      const sinceVersion = Number(req.query.since || 0);

      const manager = queueManagerRegistry.get(managerId);
      if (!manager) {
        return res.status(404).json({ error: `Manager ${managerId} not found` });
      }

      // Get operations from this manager
      if (manager.local) {
        const qm = queueManagers[manager.localIndex];
        const ops = qm.getOperationsSince(sinceVersion);
        return res.json({
          managerId,
          currentVersion: qm.getCurrentVersion(),
          operations: ops,
          operationCount: ops.length
        });
      }

      res.json({
        managerId,
        currentVersion: manager.operationVersion,
        operations: [],
        operationCount: 0,
        note: 'Remote manager operations not directly accessible - use replica sync endpoint'
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get full queue state snapshot
  app.get('/api/replication/snapshot/:managerId', (req, res) => {
    try {
      const { managerId } = req.params;
      const manager = queueManagerRegistry.get(managerId);
      if (!manager) {
        return res.status(404).json({ error: `Manager ${managerId} not found` });
      }

      if (manager.local) {
        const qm = queueManagers[manager.localIndex];
        const snapshot = qm.getSnapshot();
        return res.json({ managerId, snapshot });
      }

      res.json({
        managerId,
        snapshot: null,
        note: 'Remote manager snapshot not directly accessible'
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Apply replicated operations (called by replicas to sync from primary)
  app.post('/api/replication/apply-operations/:targetManagerId', (req, res) => {
    try {
      const { targetManagerId } = req.params;
      const { operations } = req.body || {};

      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations array is required' });
      }

      const manager = queueManagerRegistry.get(targetManagerId);
      if (!manager) {
        return res.status(404).json({ error: `Target manager ${targetManagerId} not found` });
      }

      if (!manager.local) {
        return res.status(400).json({ error: 'Can only apply operations to local managers' });
      }

      const qm = queueManagers[manager.localIndex];
      let applied = 0;

      for (const op of operations) {
        try {
          qm.applyReplicatedOperation(op);
          applied++;
          manager.primarySyncVersion = op.version;
        } catch (e) {
          console.error(`Failed to apply operation:`, op, e);
        }
      }

      queueManagerRegistry.set(targetManagerId, manager);

      res.json({
        status: 'operations-applied',
        targetManagerId,
        applied,
        total: operations.length,
        newVersion: manager.primarySyncVersion
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get replica sync status
  app.get('/api/replication/status/:managerId', (req, res) => {
    try {
      const { managerId } = req.params;
      const manager = queueManagerRegistry.get(managerId);
      if (!manager) {
        return res.status(404).json({ error: `Manager ${managerId} not found` });
      }

      const status = {
        managerId,
        isReplica: !!manager.replicaOf,
        replicaOf: manager.replicaOf,
        replicas: manager.replicas || [],
        operationVersion: manager.operationVersion || 0,
        primarySyncVersion: manager.primarySyncVersion || 0,
        syncLag: (manager.operationVersion || 0) - (manager.primarySyncVersion || 0)
      };

      // If this is the primary, get info about all replicas
      if (!manager.replicaOf && manager.replicas && manager.replicas.length > 0) {
        status.replicaStatuses = manager.replicas.map(replicaId => {
          const replica = queueManagerRegistry.get(replicaId);
          return {
            replicaId,
            status: replica?.status || 'unknown',
            syncLag: (manager.operationVersion || 0) - (replica?.primarySyncVersion || 0),
            lastHeartbeat: replica?.lastHeartbeat
          };
        });
      }

      res.json(status);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Queue configuration synchronization endpoints for distributed config management
  
  // Create a new queue configuration and sync to all peer instances
  app.post('/api/queues/:managerId/create', (req, res) => {
    try {
      const { managerId } = req.params;
      const { queueName, config } = req.body;
      
      const qm = queueManagerInstances.get(managerId);
      if (!qm) {
        return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      }
      
      const result = qm.createQueue(queueName, config);
      res.json({ success: true, queueName, config: result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  
  // Delete a queue configuration and sync to all peer instances
  app.post('/api/queues/:managerId/delete', (req, res) => {
    try {
      const { managerId } = req.params;
      const { queueName } = req.body;
      
      const qm = queueManagerInstances.get(managerId);
      if (!qm) {
        return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      }
      
      qm.deleteQueue(queueName);
      res.json({ success: true, queueName, deleted: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  
  // Update queue configuration and sync to all peer instances
  app.post('/api/queues/:managerId/update', (req, res) => {
    try {
      const { managerId } = req.params;
      const { queueName, updates } = req.body;
      
      const qm = queueManagerInstances.get(managerId);
      if (!qm) {
        return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      }
      
      const result = qm.updateQueueConfig(queueName, updates);
      res.json({ success: true, queueName, config: result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  
  // Get all queue configurations (including version info for sync detection)
  app.get('/api/queues/:managerId/config', (req, res) => {
    try {
      const { managerId } = req.params;
      
      const qm = queueManagerInstances.get(managerId);
      if (!qm) {
        return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      }
      
      const allConfigs = qm.getAllQueueConfigs();
      res.json(allConfigs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // Apply a configuration change from a peer instance
  app.post('/api/queues/:managerId/apply-config-change', (req, res) => {
    try {
      const { managerId } = req.params;
      const operation = req.body;
      
      const qm = queueManagerInstances.get(managerId);
      if (!qm) {
        return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      }
      
      qm.applyConfigChange(operation);
      res.json({ 
        success: true, 
        appliedOperation: operation.type,
        queueName: operation.queueName,
        newConfigVersion: qm.configVersion 
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // TEST ENDPOINT
  console.log('[DEBUG] About to register replication endpoints');
  app.get('/api/replication-test', (req, res) => {
    console.log('[DEBUG] REPLICATION-TEST ENDPOINT CALLED');
    res.json({ status: 'replication endpoints loaded' });
  });
  console.log('[DEBUG] Registered replication-test endpoint');
  
  const fileServer = createFileServer();
  console.log('[DEBUG] File server routes registered');
  app.use('/api/fileserver', fileServer.router);
  app.get('/status', (req, res) => {
    res.json(getBrokerNodeDetails());
  });
  app.get('/services/describe', (req, res) => {
    res.json({ services: [BROKER_SERVICE] });
  });
  setInterval(updateVirtualNodes, 3000);
  console.log('[DEBUG] All routes registered');
  app.get('/api/nodes', (req, res) => {
    // Backend server as a virtual node
    const backendNode = {
      ip: '127.0.0.1',
      nodeName: 'Aggregator Backend',
      lastSeen: Date.now(),
      details: {
        nodeName: 'Aggregator Backend',
        hardware: 'Server',
        services: [
          { name: 'Message Broker', status: 'online', api: '/api/broker' },
          { name: 'Queue Manager', status: 'online', api: '/api/queue' },
          { name: 'File Server', status: 'online', api: '/api/fileserver' }
        ],
        status: 'ok',
        version: '1.0.0'
      }
    };
    // Return backend node + discovered nodes, sorted by lastSeen desc
    const nodes = [backendNode, ...Array.from(discoveredNodes.values())].sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(nodes);
  });
  app.get('/api/proxy/:ip', async (req, res) => {
    const { ip } = req.params;
    const path = req.query.path || '/';
    try {
      const url = `http://${ip}:80${path}`;
      const deviceRes = await fetch(url);
      const contentType = deviceRes.headers.get('content-type') || '';
      res.status(deviceRes.status);
      if (contentType.includes('application/json')) {
        const data = await deviceRes.json();
        res.json(data);
      } else {
        const text = await deviceRes.text();
        console.log(`[Proxy Debug] ${url} returned non-JSON content-type (${contentType}):\n${text.substring(0, 500)}`);
        res.type(contentType).send(text);
      }
    } catch (e) {
      res.status(502).json({ error: 'Proxy fetch failed', details: e.toString() });
    }
  });

  // Catch-all error handler for uncaught errors in Express (MUST BE LAST)
  app.use((err, req, res, next) => {
    const errorMsg = '[EXPRESS ERROR] ' + (err && err.stack ? err.stack : err.toString());
    logToFile(errorMsg);
    console.error(errorMsg);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error', details: errorMsg });
  });
}

try {
  console.log('[DEBUG] Starting backend server...');
  
  // Set up peer sync callbacks for each queue manager
  // This enables distributed config synchronization
  for (const [managerId, qm] of queueManagerInstances) {
    qm.onConfigChange(async (operation) => {
      // When this queue manager's config changes, notify all other instances
      // In a distributed setup, this would HTTP POST to all peer instances
      // For now, log it so the sync mechanism can pick it up
      console.log(`[SYNC] Config change on ${managerId}: ${operation.type} - ${operation.queueName}`);
      
      // In production, you'd iterate through all registered instances of this queue manager
      // and POST to their /api/queues/:managerId/apply-config-change endpoint
    });
  }
  
  registerRoutes(app);
  app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Aggregator backend running on http://0.0.0.0:${HTTP_PORT} (LAN accessible)`);
  });
} catch (err) {
  console.error('[ERROR] Backend failed to start:', err);
}
