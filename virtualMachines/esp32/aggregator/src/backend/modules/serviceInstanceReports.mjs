import { createServiceInstancePolicy } from '../../service-lifecycle/instance-policy.mjs';
import { createServiceLifecyclePolicy } from './serviceLifecyclePolicy.mjs';

export async function createServiceInstanceReports({ registry, now = Date.now, logger = console }) {
  const reports = await createServiceInstancePolicy({ logger });
  const lifecycle = await createServiceLifecyclePolicy({
    source: '../../../../src/service-lifecycle/registry.pas',
    collectorId: 'pulse-service-instance-registry-policy', logger,
  });
  const retiredBoots = new Map();
  const epoch = now();
  let pending = Promise.resolve();
  function enqueue(operation) {
    const result = pending.then(operation);
    pending = result.catch(error => logger.warn('[SERVICE-REPORT] Rejected:', error.message));
    return result;
  }
  return {
    report: body => enqueue(async () => {
      const { report } = await reports.dispatch('/report', body);
      const httpListener = report.listeners.find(listener => ['http', 'https'].includes(listener.protocol));
      const url = new URL(report.endpoint);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Invalid service report endpoint');
      }
      const entry = registry.get(report.instanceId);
      const existing = entry?.version === 1 && entry.bootId ? entry : undefined;
      const result = await lifecycle.dispatch('/accept', {
        candidate: report, previous: existing || {}, exists: !!existing,
        retiredBoots: retiredBoots.get(report.instanceId) || [],
        count: registry.size - (entry && !existing ? 1 : 0), timestamp: Math.floor((now() - epoch) / 1000),
        observedAt: new Date(now()).toISOString(),
      });
      const instance = {
        ...result.instance,
        serviceName: report.serviceId, nodeId: report.nodeId,
        ip: httpListener?.host || null, port: httpListener?.port || null,
        lastHeartbeat: now(), expiresAt: new Date(now() + report.ttlMs).toISOString(),
        metadata: { route: url.pathname },
      };
      registry.set(report.instanceId, instance);
      retiredBoots.set(report.instanceId, result.retiredBoots);
      return instance;
    }),
    expire: () => enqueue(async () => {
      for (const [id, instance] of registry) {
        if (!instance.expiresAt) continue;
        const result = await lifecycle.dispatch('/expire', { instance, timestamp: Math.floor((now() - epoch) / 1000) });
        registry.set(id, result.instance);
      }
    }),
    stop: async () => { await pending; await reports.stop(); await lifecycle.stop(); },
  };
}
