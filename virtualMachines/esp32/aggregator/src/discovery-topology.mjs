export const DISCOVERY_NODE_MAX_AGE_MS = 10 * 60 * 1000;

function normalizeUdpPort(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return null;
  const port = Math.trunc(asNumber);
  if (port <= 0 || port > 65535) return null;
  return port;
}

function normalizeClusterTreeNode(node = {}) {
  const id = String(node.id || node.nodeId || node.name || '').trim();
  const ip = normalizeDiscoveryIp(node.ip || node.host || '');
  const nodeName = String(node.nodeName || node.name || id || ip || '').trim();
  const services = Array.isArray(node.services)
    ? node.services.map(service => ({
        name: String(service?.name || service || '').trim(),
        status: String(service?.status || '').trim() || null
      })).filter(service => Boolean(service.name))
    : [];
  const children = Array.isArray(node.children)
    ? node.children.map(child => normalizeClusterTreeNode(child)).filter(Boolean)
    : [];
  return {
    id: id || undefined,
    ip: ip || undefined,
    nodeName,
    services,
    children
  };
}

function normalizeClusterTopology(value = {}) {
  if (!value || typeof value !== 'object') return null;
  const parentUdpPort = normalizeUdpPort(value.parentUdpPort || value.upstreamUdpPort || value.northboundUdpPort);
  const childUdpPort = normalizeUdpPort(value.childUdpPort || value.downstreamUdpPort || value.southboundUdpPort);
  const parentClusterId = String(value.parentClusterId || '').trim() || null;
  const clusterId = String(value.clusterId || value.id || '').trim() || null;
  const services = Array.isArray(value.services)
    ? value.services.map(service => ({
        name: String(service?.name || service || '').trim(),
        status: String(service?.status || '').trim() || null
      })).filter(service => Boolean(service.name))
    : [];
  const members = Array.isArray(value.members)
    ? value.members.map(member => normalizeClusterTreeNode(member)).filter(Boolean)
    : [];
  return {
    clusterId,
    parentClusterId,
    parentUdpPort,
    childUdpPort,
    services,
    members
  };
}

export function normalizeDiscoveryIp(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('::ffff:')) return raw.substring(7);
  return raw;
}

export function isLoopbackHost(host) {
  const normalized = String(host || '').trim();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

export function normalizeDiscoveryNode(node = {}) {
  const ip = normalizeDiscoveryIp(node.ip || node.host || '');
  const id = String(node.id || node.nodeId || node.managerId || node.instanceId || node.serviceName || ip || node.nodeName || '').trim();
  const lastSeen = Number(node.lastSeen || node.ts || node.seenAt || 0) || Date.now();
  const details = node.details && typeof node.details === 'object' ? node.details : {};
  const clusterTopology = normalizeClusterTopology(node.cluster || details.cluster || {});
  const availability = node.availability && typeof node.availability === 'object'
    ? {
        available: Boolean(node.availability.available),
        draining: Boolean(node.availability.draining),
        status: String(node.availability.status || (node.availability.available ? 'available' : 'unavailable'))
      }
    : (node.kind === 'machineAvailability' || node.service === 'machine-availability' || node.source === 'availability'
        ? {
            available: Boolean(node.available),
            draining: Boolean(node.draining),
            status: String(node.status || (node.available ? 'available' : (node.draining ? 'draining' : 'unavailable')))
          }
        : null);

  return {
    ...node,
    id,
    ip,
    lastSeen,
    details,
    availability,
    nodeName: String(node.nodeName || details.nodeName || node.name || id || ip || '').trim(),
    cluster: clusterTopology,
    source: String(node.source || '').trim() || 'discovery'
  };
}

export function extractDiscoveryNodes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.nodes)) return payload.nodes;
  if (Array.isArray(payload?.data?.nodes)) return payload.data.nodes;
  return [];
}

export function mergeDiscoveryNodes(nodes = []) {
  const dedup = new Map();
  for (const node of nodes) {
    const normalized = normalizeDiscoveryNode(node);
    const key = normalized.id || normalized.ip || normalized.nodeName;
    if (!key) continue;
    const previous = dedup.get(key) || {};
    dedup.set(key, { ...previous, ...normalized });
  }
  return Array.from(dedup.values()).sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0));
}

export function isFreshDiscoveryNode(node, maxAgeMs = DISCOVERY_NODE_MAX_AGE_MS, now = Date.now()) {
  return Number(node?.lastSeen || 0) > 0 && (now - Number(node.lastSeen)) <= maxAgeMs;
}

export function isEsp32DiscoveryNode(node, maxAgeMs = DISCOVERY_NODE_MAX_AGE_MS, now = Date.now()) {
  if (!node) return false;
  const hardware = String(node?.details?.hardware || '').toUpperCase();
  return hardware === 'ESP32' && isFreshDiscoveryNode(node, maxAgeMs, now);
}

export function isBrokerDiscoveryNode(node, maxAgeMs = DISCOVERY_NODE_MAX_AGE_MS, now = Date.now()) {
  if (!node) return false;
  if (!isFreshDiscoveryNode(node, maxAgeMs, now)) return false;
  const services = Array.isArray(node?.details?.services) ? node.details.services : [];
  return services.some((service) => String(service?.name || '').toLowerCase().includes('broker'));
}
