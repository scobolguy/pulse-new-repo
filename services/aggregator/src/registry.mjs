export const DEFAULT_TTL_MS = 180000;
const BEACON_KINDS = new Set(['nodeBeacon', 'machineAvailability']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function isEspNode(info) {
  return /esp32|esp8266/i.test(`${info.hardware ?? ''} ${info.runtime ?? ''}`)
    || (typeof info.firmwareBuildStamp === 'string' && info.firmwareBuildStamp.length > 0);
}

export class LiveRegistry {
  #nodes = new Map();

  constructor({ ttlMs = DEFAULT_TTL_MS, clock = Date.now } = {}) {
    if (!Number.isInteger(ttlMs) || ttlMs < 100) throw new Error('ttlMs must be an integer >= 100');
    this.ttlMs = ttlMs;
    this.clock = clock;
  }

  observe(beacon, peerIp) {
    if (!beacon || typeof beacon !== 'object' || !BEACON_KINDS.has(beacon.kind)) return null;
    if (!ID_PATTERN.test(String(beacon.nodeId ?? ''))) return null;
    if (beacon.ip && beacon.ip !== peerIp) return null;
    const port = beacon.httpPort ?? beacon.port ?? 80;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    if (!isEspNode(beacon)) return null;

    const node = {
      nodeId: beacon.nodeId,
      ip: peerIp,
      httpPort: port,
      hardware: beacon.hardware ?? null,
      runtime: beacon.runtime ?? null,
      firmwareBuildStamp: beacon.firmwareBuildStamp ?? null,
      deviceRole: beacon.deviceRole ?? null,
      status: beacon.status ?? null,
      available: beacon.available !== false && beacon.availability?.available !== false,
      draining: beacon.draining === true || beacon.availability?.draining === true,
      capabilityHash: beacon.capabilityHash ?? null,
      lastSeen: this.clock()
    };
    this.#nodes.set(node.nodeId, node);
    return node;
  }

  list() {
    const now = this.clock();
    for (const [id, node] of this.#nodes) {
      if (now - node.lastSeen >= this.ttlMs) this.#nodes.delete(id);
    }
    return [...this.#nodes.values()]
      .filter(node => node.available && !node.draining)
      .map(node => ({ ...node, ageMs: now - node.lastSeen }))
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  remove(nodeId) {
    return this.#nodes.delete(nodeId);
  }
}
