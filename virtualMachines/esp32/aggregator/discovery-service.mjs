import dgram from 'dgram';
import express from 'express';
import cors from 'cors';
import os from 'os';
import {
  normalizeDiscoveryNode,
  mergeDiscoveryNodes,
  isLoopbackHost,
  isEsp32DiscoveryNode
} from './src/discovery-topology.mjs';

const HTTP_PORT = Number(process.env.DISCOVERY_HTTP_PORT || 4300);
const UDP_PORT = Number(process.env.UDP_PORT || 4210);
const NODE_TTL_MS = Math.max(60_000, Number(process.env.DISCOVERY_NODE_TTL_MS || 10 * 60 * 1000));
const PROBE_ENABLED = String(process.env.ESP32_DISCOVERY_PROBE_ENABLED || '1').trim().toLowerCase() !== '0' && String(process.env.ESP32_DISCOVERY_PROBE_ENABLED || '1').trim().toLowerCase() !== 'false';
const PROBE_INTERVAL_MS = Math.max(5000, Number(process.env.ESP32_DISCOVERY_PROBE_INTERVAL_MS || 15000));
const PROBE_TIMEOUT_MS = Math.max(300, Number(process.env.ESP32_DISCOVERY_PROBE_TIMEOUT_MS || 1500));
const SEED_NODES = String(process.env.ESP32_DISCOVERY_SEED_NODES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => ({ host: value, port: 80 }));

const discoveredNodes = new Map();
const nodeEnrichmentLastAttempt = new Map();
const udpServer = dgram.createSocket('udp4');
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function getLocalAdvertiseIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces || {})) {
    for (const item of entries || []) {
      if (!item || item.internal || item.family !== 'IPv4') continue;
      return item.address;
    }
  }
  return '127.0.0.1';
}

function upsertServiceInstance({ serviceName, instanceId, nodeId, ip, port, status, metadata }) {
  const key = `service:${String(serviceName || '').trim()}:${String(instanceId || nodeId || ip || '').trim()}`;
  if (!key || key === 'service::') return null;
  const now = Date.now();
  const previous = discoveredNodes.get(key) || {};
  const next = {
    ...previous,
    id: key,
    source: 'service-instance',
    serviceName: String(serviceName || previous.serviceName || '').trim(),
    instanceId: String(instanceId || previous.instanceId || '').trim(),
    nodeId: String(nodeId || previous.nodeId || ip || '').trim(),
    ip: String(ip || previous.ip || '').trim(),
    port: Number(port) > 0 ? Number(port) : Number(previous.port || 0),
    availability: {
      available: String(status || previous?.availability?.status || '').toLowerCase() !== 'down',
      draining: String(status || previous?.availability?.status || '').toLowerCase() === 'draining',
      status: String(status || previous?.availability?.status || 'up')
    },
    lastSeen: now,
    details: {
      ...(previous.details || {}),
      ...(metadata || {})
    },
    raw: JSON.stringify({ serviceName, instanceId, nodeId, ip, port, status, metadata })
  };
  const normalized = normalizeDiscoveryNode(next);
  discoveredNodes.set(key, normalized);
  return normalized;
}

function upsertRemoteQueueManager({ managerId, name, nodeId, ip, port, status, queues }) {
  const key = `qm:${String(managerId || nodeId || ip || '').trim()}`;
  if (!key || key === 'qm:') return null;
  const now = Date.now();
  const previous = discoveredNodes.get(key) || {};
  const next = {
    ...previous,
    id: key,
    source: 'queue-manager',
    managerId: String(managerId || previous.managerId || '').trim(),
    name: String(name || previous.name || '').trim(),
    nodeId: String(nodeId || previous.nodeId || ip || '').trim(),
    ip: String(ip || previous.ip || '').trim(),
    port: Number(port) > 0 ? Number(port) : Number(previous.port || 0),
    availability: {
      available: String(status || previous?.availability?.status || '').toLowerCase() !== 'down',
      draining: String(status || previous?.availability?.status || '').toLowerCase() === 'draining',
      status: String(status || previous?.availability?.status || 'up')
    },
    lastSeen: now,
    details: {
      ...(previous.details || {}),
      queues: Array.isArray(queues) ? queues : previous?.details?.queues || []
    },
    raw: JSON.stringify({ kind: 'queueManagerHeartbeat', managerId, name, nodeId, ip, port, status, queues })
  };
  const normalized = normalizeDiscoveryNode(next);
  discoveredNodes.set(key, normalized);
  return normalized;
}

function upsertAvailabilityNode({ nodeId, nodeName, ip, available, draining, status, reason }) {
  const key = `node:${String(nodeId || ip || '').trim()}`;
  if (!key || key === 'node:') return null;
  const now = Date.now();
  const previous = discoveredNodes.get(key) || {};
  const next = {
    ...previous,
    id: key,
    source: 'availability',
    nodeId: String(nodeId || previous.nodeId || ip || '').trim(),
    nodeName: String(nodeName || previous.nodeName || '').trim(),
    ip: String(ip || previous.ip || '').trim(),
    availability: {
      available: Boolean(available),
      draining: Boolean(draining),
      status: String(status || (available ? 'available' : (draining ? 'draining' : 'unavailable')))
    },
    lastSeen: now,
    details: {
      ...(previous.details || {}),
      reason: reason || previous?.details?.reason || null
    },
    raw: JSON.stringify({ kind: 'machineAvailability', nodeId, nodeName, ip, available, draining, status, reason })
  };
  const normalized = normalizeDiscoveryNode(next);
  discoveredNodes.set(key, normalized);
  return normalized;
}

function toIntegerUdpPort(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return null;
  const port = Math.trunc(asNumber);
  if (port <= 0 || port > 65535) return null;
  return port;
}

function upsertClusterControllerNode({
  controllerId,
  nodeName,
  ip,
  parentUdpPort,
  childUdpPort,
  parentClusterId,
  clusterId,
  services,
  members,
  metadata,
  source = 'cluster-controller'
}) {
  const resolvedIp = String(ip || '').trim();
  const keySeed = String(controllerId || clusterId || resolvedIp || '').trim();
  if (!keySeed) return null;
  const key = `cluster-controller:${keySeed}`;
  const now = Date.now();
  const previous = discoveredNodes.get(key) || {};
  const next = {
    ...previous,
    id: key,
    source,
    ip: resolvedIp || previous.ip || '',
    nodeName: String(nodeName || previous.nodeName || keySeed).trim(),
    lastSeen: now,
    details: {
      ...(previous.details || {}),
      ...(metadata && typeof metadata === 'object' ? metadata : {})
    },
    cluster: {
      clusterId: String(clusterId || previous?.cluster?.clusterId || controllerId || keySeed).trim(),
      parentClusterId: String(parentClusterId || previous?.cluster?.parentClusterId || '').trim() || null,
      parentUdpPort: toIntegerUdpPort(parentUdpPort ?? previous?.cluster?.parentUdpPort),
      childUdpPort: toIntegerUdpPort(childUdpPort ?? previous?.cluster?.childUdpPort),
      services: Array.isArray(services) ? services : (Array.isArray(previous?.cluster?.services) ? previous.cluster.services : []),
      members: Array.isArray(members) ? members : (Array.isArray(previous?.cluster?.members) ? previous.cluster.members : [])
    },
    raw: JSON.stringify({
      kind: 'clusterController',
      controllerId,
      nodeName,
      ip: resolvedIp,
      parentUdpPort,
      childUdpPort,
      parentClusterId,
      clusterId
    })
  };

  const normalized = normalizeDiscoveryNode(next);
  discoveredNodes.set(key, normalized);

  if (resolvedIp) {
    const ipNode = discoveredNodes.get(resolvedIp) || {};
    const merged = normalizeDiscoveryNode({
      ...ipNode,
      ip: resolvedIp,
      nodeName: normalized.nodeName || ipNode.nodeName || resolvedIp,
      lastSeen: now,
      source: ipNode.source || 'cluster-controller',
      details: {
        ...(ipNode.details || {}),
        ...(normalized.details || {})
      },
      cluster: normalized.cluster
    });
    discoveredNodes.set(resolvedIp, merged);
  }

  return normalized;
}

function scheduleNodeEnrichment(ip) {
  const key = String(ip || '').trim();
  if (!key) return;
  const now = Date.now();
  const last = nodeEnrichmentLastAttempt.get(key) || 0;
  if (now - last < 5000) return;
  nodeEnrichmentLastAttempt.set(key, now);
  enrichNodeDetails(key).catch(() => {});
}

async function enrichNodeDetails(ip) {
  try {
    const servicesRes = await fetch(`http://${ip}:80/services/describe`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const statusRes = await fetch(`http://${ip}:80/status`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    let serviceDetails = {};
    let statusDetails = {};
    if (statusRes.ok) {
      statusDetails = await statusRes.json();
    }
    if (servicesRes.ok) {
      serviceDetails = await servicesRes.json();
    }
    const details = { ...statusDetails, ...serviceDetails };
    const node = discoveredNodes.get(ip);
    if (node) {
      node.details = details;
      discoveredNodes.set(ip, node);
    }
  } catch {
    // Ignore unreachable nodes.
  }
}

async function probeEsp32Node(node, visited = new Set()) {
  const host = String(node?.host || '').trim();
  const port = Number(node?.port) > 0 ? Number(node.port) : 80;
  if (!host || visited.has(host) || isLoopbackHost(host)) return;
  visited.add(host);

  const statusUrl = `http://${host}:${port}/status`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const statusRes = await fetch(statusUrl, { signal: controller.signal });
    if (!statusRes.ok) return;
    const statusPayload = await statusRes.json();
    if (!isEsp32DiscoveryNode({ details: statusPayload, lastSeen: now }, NODE_TTL_MS, now)) return;

    const ip = host;
    const now = Date.now();
    const previous = discoveredNodes.get(ip) || {};
    const normalized = normalizeDiscoveryNode({
      ...previous,
      ip,
      nodeName: statusPayload?.nodeName || previous.nodeName || ip,
      lastSeen: now,
      raw: previous.raw || 'active-probe',
      details: {
        ...(previous.details || {}),
        ...statusPayload
      }
    });
    discoveredNodes.set(ip, normalized);

    const peers = Array.isArray(statusPayload?.discoveredNodes) ? statusPayload.discoveredNodes : [];
    for (const peer of peers) {
      const peerIp = String(peer?.ip || '').trim();
      if (!peerIp || isLoopbackHost(peerIp)) continue;
      await probeEsp32Node({ host: peerIp, port: 80 }, visited);
    }
  } catch {
    // Ignore transient probe failures.
  } finally {
    clearTimeout(timeout);
  }
}

async function runEsp32DiscoveryProbe() {
  const visited = new Set();
  for (const node of SEED_NODES) {
    await probeEsp32Node(node, visited);
  }
}

udpServer.on('message', (msg, rinfo) => {
  const ip = rinfo.address;
  const now = Date.now();
  let node = discoveredNodes.get(ip) || {};
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
    if (data && data.kind === 'machineAvailability') {
      upsertAvailabilityNode({
        nodeId: data.nodeId || ip,
        nodeName: data.nodeName || data.nodeId || ip,
        ip,
        available: Boolean(data.available),
        draining: Boolean(data.draining),
        status: data.status,
        reason: data.reason
      });
    }

    if (data && (data.kind === 'clusterController' || data.kind === 'cluster-controller' || data.cluster || data.clusterController)) {
      const clusterPayload = data.cluster || data.clusterController || data;
      upsertClusterControllerNode({
        controllerId: clusterPayload.controllerId || clusterPayload.clusterId || clusterPayload.id || data.nodeId || ip,
        nodeName: clusterPayload.nodeName || data.nodeName || `Cluster Controller ${ip}`,
        ip,
        parentUdpPort: clusterPayload.parentUdpPort || clusterPayload.upstreamUdpPort,
        childUdpPort: clusterPayload.childUdpPort || clusterPayload.downstreamUdpPort,
        parentClusterId: clusterPayload.parentClusterId,
        clusterId: clusterPayload.clusterId || clusterPayload.id,
        services: clusterPayload.services,
        members: clusterPayload.members,
        metadata: clusterPayload.metadata,
        source: 'cluster-controller-udp'
      });
    }

    node = {
      ...node,
      ...data,
      ip,
      lastSeen: now,
      raw: msg.toString()
    };
  } catch {
    node = {
      ...node,
      ip,
      lastSeen: now,
      raw: msg.toString(),
      nodeName: msg.toString().substring(0, 32)
    };
  }
  discoveredNodes.set(ip, node);
  scheduleNodeEnrichment(ip);
});

udpServer.bind(UDP_PORT, () => {
  try {
    udpServer.setBroadcast(true);
  } catch (error) {
    console.warn(`[DISCOVERY] Could not enable broadcast mode: ${error.message}`);
  }
  console.log(`[DISCOVERY] Listening for node broadcasts on UDP ${UDP_PORT}`);
});

if (PROBE_ENABLED && SEED_NODES.length > 0) {
  runEsp32DiscoveryProbe().catch(() => {});
  setInterval(() => {
    runEsp32DiscoveryProbe().catch(() => {});
  }, PROBE_INTERVAL_MS);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, node] of discoveredNodes.entries()) {
    if (now - Number(node?.lastSeen || 0) > NODE_TTL_MS) {
      discoveredNodes.delete(key);
    }
  }
}, Math.max(5000, Math.min(NODE_TTL_MS, 60000)));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'node-discovery',
    udpPort: UDP_PORT,
    httpPort: HTTP_PORT,
    nodes: discoveredNodes.size
  });
});

app.get('/api/nodes', (req, res) => {
  const nodes = mergeDiscoveryNodes(Array.from(discoveredNodes.values()));
  res.json({
    status: 'ok',
    nodes,
    count: nodes.length
  });
});

app.post('/api/cluster-controller/register', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ip = String(body.ip || body.host || '').trim();
  const controllerId = String(body.controllerId || body.clusterId || '').trim();
  const parentUdpPort = toIntegerUdpPort(body.parentUdpPort ?? body.upstreamUdpPort);
  const childUdpPort = toIntegerUdpPort(body.childUdpPort ?? body.downstreamUdpPort);
  if (!ip && !controllerId) {
    return res.status(400).json({ error: 'Either ip or controllerId is required.' });
  }
  if (!parentUdpPort || !childUdpPort) {
    return res.status(400).json({ error: 'parentUdpPort and childUdpPort are required and must be valid UDP ports.' });
  }

  const node = upsertClusterControllerNode({
    controllerId: controllerId || ip,
    nodeName: String(body.nodeName || body.name || `Cluster Controller ${controllerId || ip}`).trim(),
    ip,
    parentUdpPort,
    childUdpPort,
    parentClusterId: body.parentClusterId,
    clusterId: body.clusterId || controllerId || ip,
    services: Array.isArray(body.services) ? body.services : [],
    members: Array.isArray(body.members) ? body.members : [],
    metadata: body.metadata,
    source: 'cluster-controller-http'
  });

  return res.json({ status: 'ok', node });
});

app.listen(HTTP_PORT, () => {
  console.log(`[DISCOVERY] HTTP service listening on ${HTTP_PORT}`);
});
