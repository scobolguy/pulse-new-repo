function name(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value))
    throw new Error(`Invalid ${label}`);
  return value;
}

function integer(value, label, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`Invalid ${label}`);
  return value;
}

// Enrollment and bundle verification are privileged control-plane operations.
// A transport must authenticate the node before passing its identity to report.
export class SwarmResourceRegistry {
  #nodes = new Map();

  constructor({ clusterId, now = Date.now, maxAgeMs = 30000, maxNodes = 256 }) {
    this.clusterId = name(clusterId, 'swarm id');
    if (typeof now !== 'function') throw new Error('A resource registry clock is required');
    this.now = now;
    this.maxAgeMs = integer(maxAgeMs, 'resource report age', 300000);
    this.maxNodes = integer(maxNodes, 'node capacity', 4096);
    if (!maxAgeMs || !maxNodes) throw new Error('Resource limits must be positive');
    this.clockFloor = 0;
  }

  #timestamp() {
    const at = integer(this.now(), 'resource registry timestamp', Number.MAX_SAFE_INTEGER);
    if (at < this.clockFloor) throw new Error('Resource registry clock moved backwards');
    this.clockFloor = at;
    return at;
  }

  #node(nodeId) {
    const node = this.#nodes.get(name(nodeId, 'node id'));
    if (!node) throw new Error('Node is not enrolled in this swarm');
    return node;
  }

  enroll({ nodeId, capabilities }) {
    name(nodeId, 'node id');
    if (this.#nodes.has(nodeId)) throw new Error('Node already enrolled');
    if (this.#nodes.size >= this.maxNodes) throw new Error('Resource registry capacity exhausted');
    if (!Array.isArray(capabilities) || !capabilities.length || capabilities.length > 32)
      throw new Error('Explicit node capabilities are required');
    capabilities.forEach(capability => name(capability, 'node capability'));
    if (new Set(capabilities).size !== capabilities.length) throw new Error('Duplicate node capability');
    this.#nodes.set(nodeId, { capabilities: [...capabilities], codeIds: new Set(), report: null });
  }

  verifyBundle(nodeId, codeId) {
    const node = this.#node(nodeId);
    if (typeof codeId !== 'string' || !/^[a-f0-9]{64}$/.test(codeId))
      throw new Error('Verified bundle requires its SHA-256');
    if (!node.codeIds.has(codeId) && node.codeIds.size >= 128)
      throw new Error('Node bundle registry capacity exhausted');
    node.codeIds.add(codeId);
  }

  revokeBundle(nodeId, codeId) {
    const node = this.#node(nodeId);
    if (!node.codeIds.delete(codeId)) throw new Error('Bundle is not verified on this node');
  }

  report(authenticatedNodeId, { sequence, status, estimatedFreeSlots, freeMemoryBytes }) {
    const node = this.#node(authenticatedNodeId);
    integer(sequence, 'resource report sequence', Number.MAX_SAFE_INTEGER);
    integer(estimatedFreeSlots, 'measured free slots', 4096);
    integer(freeMemoryBytes, 'measured free memory', 1024 * 1024 * 1024);
    if (!['online', 'degraded', 'offline'].includes(status)) throw new Error('Explicit node health is required');
    if (node.report && sequence <= node.report.sequence) throw new Error('Stale resource report sequence');
    node.report = { sequence, status, estimatedFreeSlots, freeMemoryBytes, observedAt: this.#timestamp() };
  }

  candidates() {
    const at = this.#timestamp();
    return [...this.#nodes].flatMap(([nodeId, node]) => {
      if (!node.report || node.report.status !== 'online' ||
          at - node.report.observedAt > this.maxAgeMs) return [];
      return [{
        nodeId, clusterId: this.clusterId, ...node.report,
        capabilities: [...node.capabilities], codeIds: [...node.codeIds],
      }];
    });
  }
}
