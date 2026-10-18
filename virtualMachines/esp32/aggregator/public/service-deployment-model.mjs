export function deploymentGraph(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload.processes) || !Array.isArray(payload.instances)) {
    throw new Error('Invalid lifecycle snapshot');
  }
  const nodes = [
    ...payload.processes.map(process => ({
      id: `process:${process.id}`, label: process.name || process.id,
      state: process.readiness?.state || 'unknown',
      detail: process, dependencies: (process.dependencies || []).map(id => `process:${id}`),
    })),
    ...payload.instances.map(instance => ({
      id: `instance:${instance.instanceId}`, label: instance.serviceId || instance.serviceName,
      state: instance.reporting === 'stale' ? 'stale'
        : instance.dependencyChainReady === false && instance.reporting === 'fresh' ? 'blocked'
        : instance.readiness?.ready === true ? 'ready'
          : instance.readiness?.ready === false ? 'blocked' : 'unknown',
      detail: instance,
      dependencies: Object.values(instance.dependencies || {}).map(binding => `instance:${binding.instanceId}`),
    })),
  ];
  const known = new Set(nodes.map(node => node.id));
  const missing = new Set(nodes.flatMap(node => node.dependencies).filter(id => !known.has(id)));
  for (const id of missing) nodes.push({ id, label: id.replace(/^[^:]+:/, ''), state: 'unobserved', dependencies: [], detail: { reason: 'Bound dependency has not reported' } });
  const levels = new Map(nodes.map(node => [node.id, 0]));
  // Layout only: unresolved/cyclic graphs remain visible without claiming readiness.
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const node of nodes) {
      const level = node.dependencies.length ? Math.min(nodes.length,
        Math.max(...node.dependencies.map(id => levels.get(id) || 0)) + 1) : 0;
      if (level !== levels.get(node.id)) { levels.set(node.id, level); changed = true; }
    }
    if (!changed) break;
  }
  for (const node of nodes) node.level = levels.get(node.id);
  return nodes;
}
