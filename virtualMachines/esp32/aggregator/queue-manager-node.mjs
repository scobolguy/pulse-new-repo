import express from 'express';
import os from 'os';
import fetch from 'node-fetch';
import path from 'path';
import QueueManager from './src/broker/QueueManager.mjs';
import { readEnvBoolean, readEnvString } from './src/env-config.mjs';

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  if (!arg) return fallback;
  return arg.slice(prefix.length);
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return '127.0.0.1';
}

const aggregatorUrl = getArg('aggregator', 'http://localhost:4000');
const port = Number(getArg('port', '4100'));
const host = getArg('host', '0.0.0.0');
const advertiseIp = getArg('advertise-ip', getLocalIp());
const nodeId = getArg('node-id', os.hostname());
const managerId = getArg('manager-id', `${nodeId}-qm-${port}`);
const managerName = getArg('name', managerId);
const heartbeatMs = Number(getArg('heartbeat-ms', '5000'));
const claimLeaseMsDefault = Number(getArg('claim-lease-ms', '30000'));
const claimReapMs = Number(getArg('claim-reap-ms', '1000'));
const queuePersistenceEnabled = readEnvBoolean('PULSE_QUEUE_PERSISTENCE', ['1'], false);
const persistPath = queuePersistenceEnabled
  ? readEnvString('PULSE_QUEUE_DATA_ROOT', 'C:\\pulse-new-repo-data\\queue-data')
  : null;

const app = express();
const queueManager = new QueueManager(managerName, persistPath);
app.use(express.json());

function getQueueNames() {
  return Object.keys(queueManager.queues || {});
}

async function sendHeartbeat() {
  const body = {
    managerId,
    name: managerName,
    nodeId,
    ip: advertiseIp,
    port,
    status: 'up',
    queues: getQueueNames(),
    persistence: queueManager.getPersistenceStatus(),
  };

  const response = await fetch(`${aggregatorUrl}/api/registry/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Heartbeat failed (${response.status}): ${text}`);
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'up',
    managerId,
    managerName,
    nodeId,
    ip: advertiseIp,
    port,
    queues: getQueueNames(),
    persistence: queueManager.getPersistenceStatus(),
  });
});

app.post('/enqueue', (req, res) => {
  const { queueName, message, sourceService, messageId, messageEnvelope } = req.body || {};
  if (!queueName) {
    return res.status(400).json({ error: 'queueName is required' });
  }
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'message')) {
    return res.status(400).json({ error: 'message is required' });
  }
  const acceptedMessageId = queueManager.enqueue(queueName, message, sourceService || 'remote-producer', messageId || null, messageEnvelope || null);
  res.json({ status: 'enqueued', managerId, queueName, queueLength: queueManager.getQueueLength(queueName), messageId: acceptedMessageId });
});

app.post('/replicate-enqueue', (req, res) => {
  const { queueName, message, sourceService, messageId, messageEnvelope } = req.body || {};
  if (!queueName) {
    return res.status(400).json({ error: 'queueName is required' });
  }
  queueManager.enqueueReplicated(queueName, message, sourceService || 'replication', messageId, messageEnvelope || null);
  res.json({ status: 'replicated', managerId, queueName, queueLength: queueManager.getQueueLength(queueName) });
});

app.post('/replicate-dequeue', (req, res) => {
  const { queueName, removedMessage } = req.body || {};
  if (!queueName) {
    return res.status(400).json({ error: 'queueName is required' });
  }
  const removed = queueManager.dequeueReplicated(queueName, removedMessage || null);
  res.json({ status: 'replicated', managerId, queueName, removed, queueLength: queueManager.getQueueLength(queueName) });
});

app.post('/dequeue', (req, res) => {
  const { queueName, consumerService } = req.body || {};
  if (!queueName) {
    return res.status(400).json({ error: 'queueName is required' });
  }
  const message = queueManager.dequeue(queueName, consumerService || 'remote-consumer');
  if (message === null) {
    return res.status(404).json({ error: 'Queue empty', managerId, queueName });
  }
  res.json({ status: 'dequeued', managerId, queueName, message });
});

app.post('/claim', (req, res) => {
  const { queueName, workerId, leaseMs } = req.body || {};
  if (!queueName) {
    return res.status(400).json({ error: 'queueName is required' });
  }
  if (!workerId) {
    return res.status(400).json({ error: 'workerId is required' });
  }

  try {
    const claim = queueManager.claim(queueName, workerId, Number(leaseMs || claimLeaseMsDefault));
    if (!claim) {
      return res.status(404).json({ error: 'Queue empty', managerId, queueName });
    }
    res.json({ status: 'claimed', managerId, queueName, claim });
  } catch (e) {
    res.status(400).json({ error: e.message, managerId, queueName });
  }
});

app.post('/claim/heartbeat', (req, res) => {
  const { queueName, workerId, claimToken, extendMs } = req.body || {};
  if (!queueName || !workerId || !claimToken) {
    return res.status(400).json({ error: 'queueName, workerId, claimToken are required' });
  }

  try {
    const heartbeat = queueManager.heartbeatClaim(queueName, claimToken, workerId, Number(extendMs || claimLeaseMsDefault));
    if (heartbeat === null) {
      return res.status(404).json({ error: 'Unknown claimToken', managerId, queueName, claimToken });
    }
    if (heartbeat === 'forbidden') {
      return res.status(409).json({ error: 'Claim owner mismatch', managerId, queueName, claimToken });
    }
    res.json({ status: 'lease-extended', managerId, queueName, claim: heartbeat });
  } catch (e) {
    res.status(400).json({ error: e.message, managerId, queueName, claimToken });
  }
});

app.post('/claim/complete', (req, res) => {
  const { queueName, workerId, claimToken, completionMeta } = req.body || {};
  if (!queueName || !workerId || !claimToken) {
    return res.status(400).json({ error: 'queueName, workerId, claimToken are required' });
  }

  try {
    const completed = queueManager.completeClaim(queueName, claimToken, workerId, completionMeta || null);
    if (completed === null) {
      return res.status(404).json({ error: 'Unknown claimToken', managerId, queueName, claimToken });
    }
    if (completed === 'forbidden') {
      return res.status(409).json({ error: 'Claim owner mismatch', managerId, queueName, claimToken });
    }
    res.json({ status: 'completed', managerId, queueName, result: completed });
  } catch (e) {
    res.status(400).json({ error: e.message, managerId, queueName, claimToken });
  }
});

app.post('/claim/fail', (req, res) => {
  const { queueName, workerId, claimToken, reason, delayMs, maxAttempts, deadLetter } = req.body || {};
  if (!queueName || !workerId || !claimToken) {
    return res.status(400).json({ error: 'queueName, workerId, claimToken are required' });
  }

  try {
    const failed = queueManager.failClaim(queueName, claimToken, workerId, {
      reason,
      delayMs,
      maxAttempts,
      deadLetter
    });
    if (failed === null) {
      return res.status(404).json({ error: 'Unknown claimToken', managerId, queueName, claimToken });
    }
    if (failed === 'forbidden') {
      return res.status(409).json({ error: 'Claim owner mismatch', managerId, queueName, claimToken });
    }
    res.json({ status: failed.status, managerId, queueName, result: failed });
  } catch (e) {
    res.status(400).json({ error: e.message, managerId, queueName, claimToken });
  }
});

app.post('/claim/reap-expired', (req, res) => {
  const { queueName } = req.body || {};
  try {
    const requeued = queueManager.reapExpiredClaims(queueName || null);
    res.json({ status: 'ok', managerId, queueName: queueName || null, requeued });
  } catch (e) {
    res.status(400).json({ error: e.message, managerId, queueName: queueName || null });
  }
});

app.get('/claim/metrics', (req, res) => {
  const queueName = String(req.query.queueName || '').trim();
  const metrics = queueManager.getClaimMetrics(queueName || null);
  res.json({ managerId, metrics });
});

app.get('/queues', (req, res) => {
  const queues = getQueueNames().map(queueName => ({
    queueName,
    length: queueManager.getQueueLength(queueName),
    status: queueManager.getStatus(queueName),
  }));
  res.json({ managerId, queues });
});

app.get('/queues/:queueName/status', (req, res) => {
  const { queueName } = req.params;
  res.json({
    managerId,
    queueName,
    status: queueManager.getStatus(queueName),
    length: queueManager.getQueueLength(queueName),
  });
});

app.get('/snapshot', (req, res) => {
  res.json({ managerId, snapshot: queueManager.getSnapshot() });
});

app.post('/replication/apply-snapshot', (req, res) => {
  try {
    const { snapshot } = req.body || {};
    queueManager.applySnapshot(snapshot);
    res.json({ status: 'snapshot-applied', managerId, queueCount: Object.keys(queueManager.queueConfig || {}).length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Apply config change from another peer
app.post('/apply-config-change', (req, res) => {
  try {
    const operation = req.body;
    console.log(`[QM] Applying config change: ${operation.type} - ${operation.queueName}`);
    queueManager.applyConfigChange(operation);
    res.json({ status: 'applied', operation });
  } catch (e) {
    console.error(`[QM] Error applying config change:`, e.message);
    res.status(400).json({ error: e.message });
  }
});

// Get current config and version for sync detection
app.get('/config', (req, res) => {
  res.json(queueManager.getAllQueueConfigs());
});

app.listen(port, host, () => {
  console.log(`[QM] ${managerId} listening on http://${host}:${port}`);
  console.log(`[QM] advertising ${advertiseIp}:${port} to ${aggregatorUrl}`);
  
  // Register callback to notify aggregator of config changes
  queueManager.onConfigChange((operation) => {
    console.log(`[QM] Local config changed: ${operation.type} - ${operation.queueName}`);
    // In production, would HTTP POST to aggregator endpoint
    // for notification to other peer instances
  });
  
  sendHeartbeat().catch(err => console.error('[QM] initial heartbeat failed:', err.message));
  setInterval(() => {
    sendHeartbeat().catch(err => console.error('[QM] heartbeat failed:', err.message));
  }, heartbeatMs);
  setInterval(() => {
    try {
      const requeued = queueManager.reapExpiredClaims();
      if (requeued > 0) {
        console.log(`[QM] lease-expiry requeued=${requeued}`);
      }
    } catch (err) {
      console.error('[QM] reap expired claims failed:', err.message);
    }
  }, Math.max(250, claimReapMs));
});
