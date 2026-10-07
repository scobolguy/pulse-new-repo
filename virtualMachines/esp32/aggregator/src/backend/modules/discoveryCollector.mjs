import { randomUUID } from 'node:crypto';
import { DISCOVERY_NODE_MAX_AGE_MS, isFreshDiscoveryNode, pruneDiscoveryNodes } from '../../discovery-topology.mjs';

export const DISCOVERY_PROTOCOL_VERSION = 1;

export function discoveryNodeIdentity(node) {
  return String(node?.nodeId || node?.id || node?.nodeName
    || (node?.ip ? `${node.ip}:${Number(node.port || node.httpPort || 80)}` : '')).trim();
}

export function normalizeNodeAnnouncement(body, fallbackIp = '') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('Announcement must be a JSON object'), { status: 400 });
  }
  const ip = String(body.ip || fallbackIp).replace('::ffff:', '').trim();
  const nodeId = String(body.nodeId || body.nodeName || ip).trim();
  const port = Number(body.port ?? body.httpPort ?? 80);
  if (!nodeId || !ip) {
    throw Object.assign(new Error('nodeId and a reachable ip are required'), { status: 400 });
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('port must be an integer between 1 and 65535'), { status: 400 });
  }
  const services = (Array.isArray(body.services) ? body.services : []).map((service) => {
    const name = String(typeof service === 'string' ? service : service?.name || service?.serviceName || '').trim();
    if (!name) throw Object.assign(new Error('Each service must have a name'), { status: 400 });
    return {
      name,
      endpoint: String(service?.endpoint || '/pmachine/service'),
      status: String(service?.status || 'up').toLowerCase(),
      metadata: service?.metadata && typeof service.metadata === 'object' ? service.metadata : {}
    };
  });
  return { ...body, nodeId, nodeName: String(body.nodeName || nodeId), ip, port, services };
}

export function recordNodeAnnouncement(discoveredNodes, announcement, now = Date.now()) {
  const key = announcement.port === 80 ? announcement.ip : `${announcement.ip}:${announcement.port}`;
  const previous = discoveredNodes.get(key) || {};
  const node = {
    ...previous,
    id: String(announcement.id || previous.id || announcement.nodeId),
    nodeId: announcement.nodeId,
    nodeName: announcement.nodeName,
    ip: announcement.ip,
    port: announcement.port,
    kind: 'machineAvailability',
    serviceName: announcement.serviceName || 'pmachine',
    source: announcement.source || 'pmachine-announce',
    available: announcement.available !== false,
    draining: Boolean(announcement.draining),
    status: String(announcement.status || (announcement.available === false ? 'unavailable' : 'available')),
    lastSeen: now,
    ts: now,
    beacon: { kind: 'machineAvailability', seenAt: now },
    details: {
      ...previous.details,
      hardware: String(announcement.hardware || previous.details?.hardware || 'ESP32'),
      runtime: String(announcement.runtime || previous.details?.runtime || 'pmachine'),
      services: announcement.services,
      capabilities: Array.isArray(announcement.capabilities) ? announcement.capabilities : previous.details?.capabilities || []
    },
    raw: JSON.stringify(announcement)
  };
  node.availability = { available: node.available, draining: node.draining, status: node.status };
  discoveredNodes.set(key, node);
  return node;
}

export function registerNodeAnnouncementRoute(app, {
  discoveredNodes, discoveryProvider, getDiscoveryProvider = () => discoveryProvider, upsertServiceInstance, logger = console
}) {
  app.post('/api/pmachine/announce', async (req, res) => {
    try {
      const announcement = normalizeNodeAnnouncement(req.body, req.ip);
      const provider = getDiscoveryProvider();
      if (provider?.mode === 'remote') {
        const result = await provider.announce(announcement);
        return res.json({ status: 'ok', node: announcement, delivery: result });
      }
      const node = recordNodeAnnouncement(discoveredNodes, announcement);
      for (const service of announcement.services) {
        upsertServiceInstance?.({
          serviceName: service.name,
          instanceId: `${service.name}:${node.nodeId}:${node.port}`,
          nodeId: node.nodeId, ip: node.ip, port: node.port, status: service.status,
          metadata: { ...service.metadata, route: service.endpoint, hardware: node.details.hardware, runtime: node.details.runtime }
        });
      }
      // Hybrid keeps the local record authoritative and mirrors the announcement to collectors best-effort.
      const delivery = provider?.mode === 'hybrid'
        ? await provider.announce(announcement).catch((error) => ({ degraded: true, error: error.message }))
        : undefined;
      return res.json({
        status: 'ok',
        node: { nodeId: node.nodeId, ip: node.ip, port: node.port, services: announcement.services.map((service) => service.name) },
        ...(delivery ? { delivery } : {})
      });
    } catch (error) {
      logger.warn(`[DISCOVERY] Announcement rejected: ${error.message}`);
      return res.status(error.status || 503).json({ error: error.message });
    }
  });
}

export function createDiscoverySnapshotSource({
  discoveredNodes,
  collectorId,
  bootId = randomUUID(),
  now = Date.now
}) {
  if (!String(collectorId || '').trim()) throw new Error('collectorId is required');
  let sequence = 0;
  return function snapshot() {
    const timestamp = now();
    pruneDiscoveryNodes(discoveredNodes, timestamp);
    const byIdentity = new Map();
    for (const node of discoveredNodes.values()) {
      if (!isFreshDiscoveryNode(node, undefined, timestamp)) continue;
      if (node.raw === 'active-probe' && !node.beacon) continue;
      if (node.details?.configured) continue;
      const nodeId = discoveryNodeIdentity(node);
      if (!nodeId) continue;
      const seenAt = Number(node.beacon?.seenAt ?? node.lastSeen);
      const observation = { ...node, nodeId, remainingTtlMs: DISCOVERY_NODE_MAX_AGE_MS - (timestamp - seenAt) };
      const previous = byIdentity.get(nodeId);
      if (!previous) byIdentity.set(nodeId, observation);
      else {
        const latest = previous.remainingTtlMs > observation.remainingTtlMs ? previous : observation;
        byIdentity.set(nodeId, {
          ...latest,
          details: { ...previous.details, ...observation.details }
        });
      }
    }
    return { protocolVersion: DISCOVERY_PROTOCOL_VERSION, collectorId, bootId, sequence: ++sequence, nodes: [...byIdentity.values()] };
  };
}
