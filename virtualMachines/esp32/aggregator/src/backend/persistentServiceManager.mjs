function normalizePolicy(policy = {}) {
  const minInstances = Math.max(0, Number(policy.minInstances || 0));
  const maxInstances = Math.max(minInstances, Number(policy.maxInstances || minInstances || 1));
  const unit = String(policy.idleTimeoutUnit || 's').toLowerCase();
  const multiplier = unit === 'm' ? 60_000 : unit === 'ms' ? 1 : 1_000;
  return {
    persistent: policy.persistent !== false,
    minInstances,
    maxInstances,
    idleTimeoutMs: Math.max(0, Number(policy.idleTimeout || 0) * multiplier)
  };
}

function instanceLoad(instance) {
  return Number(instance?.activeRequests ?? instance?.load ?? 0);
}

function isHealthy(instance) {
  return ['up', 'degraded', 'ready', 'running', 'resident'].includes(String(instance?.status || '').toLowerCase());
}

export class PersistentServiceManager {
  constructor({ serviceName, policy = {}, instances = new Map(), startInstance, stopInstance, now = () => Date.now() } = {}) {
    if (!serviceName) throw new Error('serviceName is required');
    this.serviceName = String(serviceName);
    this.policy = normalizePolicy(policy);
    this.instances = instances;
    this.startInstance = startInstance;
    this.stopInstance = stopInstance;
    this.now = now;
  }

  snapshot() {
    return {
      serviceName: this.serviceName,
      policy: { ...this.policy },
      instances: Array.from(this.instances.values()).filter(instance => instance.serviceName === this.serviceName)
    };
  }

  async resolve() {
    const available = Array.from(this.instances.values())
      .filter(instance => instance.serviceName === this.serviceName && isHealthy(instance))
      .sort((left, right) => instanceLoad(left) - instanceLoad(right));
    if (available.length) return available[0];
    if (!this.startInstance) throw new Error(`No available instance for ${this.serviceName}`);
    const count = Array.from(this.instances.values()).filter(instance => instance.serviceName === this.serviceName).length;
    if (count >= this.policy.maxInstances) throw new Error(`Service '${this.serviceName}' reached maxInstances=${this.policy.maxInstances}`);
    const started = await this.startInstance({ serviceName: this.serviceName, policy: this.policy });
    if (!started) throw new Error(`Service manager could not start '${this.serviceName}'`);
    this.instances.set(started.instanceId, { ...started, serviceName: this.serviceName, lastUsedAt: this.now(), activeRequests: 0 });
    return this.instances.get(started.instanceId);
  }

  markRequestStarted(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Unknown service instance '${instanceId}'`);
    instance.activeRequests = instanceLoad(instance) + 1;
    instance.lastUsedAt = this.now();
    return instance;
  }

  markRequestCompleted(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return null;
    instance.activeRequests = Math.max(0, instanceLoad(instance) - 1);
    instance.lastUsedAt = this.now();
    return instance;
  }

  async reapIdle() {
    if (!this.stopInstance || !this.policy.persistent) return [];
    const candidates = Array.from(this.instances.values())
      .filter(instance => instance.serviceName === this.serviceName)
      .filter(instance => isHealthy(instance) && instanceLoad(instance) === 0)
      .filter(instance => this.now() - Number(instance.lastUsedAt || 0) >= this.policy.idleTimeoutMs)
      .sort((left, right) => Number(left.lastUsedAt || 0) - Number(right.lastUsedAt || 0));
    const count = Math.max(0, candidates.length - Math.max(0, this.policy.minInstances));
    const evicted = [];
    for (const instance of candidates.slice(0, count)) {
      await this.stopInstance(instance);
      this.instances.delete(instance.instanceId);
      evicted.push(instance.instanceId);
    }
    return evicted;
  }
}

export { normalizePolicy };
