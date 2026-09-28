import assert from 'node:assert/strict';
import { PersistentServiceManager } from '../src/backend/persistentServiceManager.mjs';

let clock = 1_000;
const instances = new Map();
const started = [];
const stopped = [];
const manager = new PersistentServiceManager({
  serviceName: 'ConversionService',
  policy: { persistent: true, minInstances: 1, maxInstances: 2, idleTimeout: 5, idleTimeoutUnit: 's' },
  instances,
  now: () => clock,
  startInstance: async () => {
    const instance = { instanceId: `conversion-${started.length + 1}`, status: 'up' };
    started.push(instance.instanceId);
    return instance;
  },
  stopInstance: async instance => stopped.push(instance.instanceId)
});

const first = await manager.resolve();
assert.equal(first.instanceId, 'conversion-1');
manager.markRequestStarted(first.instanceId);
manager.markRequestCompleted(first.instanceId);
clock += 6_000;
assert.deepEqual(await manager.reapIdle(), []);
assert.equal(instances.size, 1);

const second = await manager.resolve();
assert.equal(second.instanceId, 'conversion-1');
instances.set('conversion-2', { instanceId: 'conversion-2', serviceName: 'ConversionService', status: 'up', lastUsedAt: 0, activeRequests: 0 });
clock += 6_000;
assert.deepEqual(await manager.reapIdle(), ['conversion-2']);
assert.deepEqual(stopped, ['conversion-2']);
assert.deepEqual(started, ['conversion-1']);

console.log('[persistent-service-manager] PASS: resolve, load tracking, minimum retention, and idle eviction');
