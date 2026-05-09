import express from 'express';
import os from 'os';
import fetch from 'node-fetch';
import path from 'path';
import QueueManager from './src/broker/QueueManager.mjs';

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
const persistPath = path.join(process.cwd(), 'data'); // Persist config locally

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
  });
});

app.post('/enqueue', (req, res) => {
  const { queueName, message, sourceService } = req.body || {};
  if (!queueName) {
    return res.status(400).json({ error: 'queueName is required' });
  }
  queueManager.enqueue(queueName, message, sourceService || 'remote-producer');
  res.json({ status: 'enqueued', managerId, queueName, queueLength: queueManager.getQueueLength(queueName) });
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
});
