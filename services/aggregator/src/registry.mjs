export const DEFAULT_TTL_MS = 180000;
const BEACON_KINDS = new Set(['nodeBeacon', 'machineAvailability']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const PMACHINE_CAPABILITIES = new Set(['pmachine', 'pmachine-pcode-v1', 'pascalish-dag-v1']);

export function isEspNode(info) {
  return /esp32|esp8266/i.test(`${info.hardware ?? ''} ${info.runtime ?? ''}`)
    || (typeof info.firmwareBuildStamp === 'string' && info.firmwareBuildStamp.length > 0);
}

function capabilityNames(info) {
  const capabilities = Array.isArray(info.capabilities) ? info.capabilities : [];
  return capabilities.map(value => typeof value === 'string' ? value : value?.name).filter(Boolean);
}

export function isPmachineNode(info) {
  if (info.pmachine === true || info.pmachine?.available === true) return true;
  return capabilityNames(info).some(capability => PMACHINE_CAPABILITIES.has(capability));
}

function normalizePmachine(info) {
  if (!isPmachineNode(info)) return null;
  const descriptor = info.pmachine && typeof info.pmachine === 'object' ? info.pmachine : {};
  return {
    available: descriptor.available !== false,
    protocol: descriptor.protocol ?? 'pcode-v1',
    runtimes: Array.isArray(descriptor.runtimes) ? [...descriptor.runtimes] : ['pcode'],
    languages: Array.isArray(descriptor.languages) ? [...descriptor.languages] : null,
    endpoint: descriptor.endpoint ?? '/pmachine/execute_json'
  };
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
    if (!isEspNode(beacon) && !isPmachineNode(beacon)) return null;

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
      capabilities: capabilityNames(beacon),
      pmachine: normalizePmachine(beacon),
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
