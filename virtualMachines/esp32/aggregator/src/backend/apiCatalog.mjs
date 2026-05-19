const ROUTE_DESCRIPTION_RULES = [
  {
    match: path => path.startsWith('/api/fsm') || path.startsWith('/api/nlp'),
    domain: 'lifecycle-inquiry',
    description: 'FSM/NLP inquiry endpoints for transaction status lookup, settlement summary, and clarification feedback loops.'
  },
  {
    match: path => path.startsWith('/api/lifecycle') || path.startsWith('/api/gateways'),
    domain: 'lifecycle-control',
    description: 'Lifecycle worker, bridge, policy, simulator, and gateway control endpoints.'
  },
  {
    match: path => path.startsWith('/api/queue') || path.startsWith('/api/queues') || path.startsWith('/api/broker'),
    domain: 'queue-broker',
    description: 'Queue and broker operations including enqueue/dequeue, queue config, routing, and broker state control.'
  },
  {
    match: path => path.startsWith('/api/users') || path.startsWith('/api/authz'),
    domain: 'identity',
    description: 'User context, authorization, groups, and profile management endpoints.'
  },
  {
    match: path => path.startsWith('/api/registry') || path.startsWith('/api/replication') || path.startsWith('/api/remote-'),
    domain: 'topology-registry',
    description: 'Distributed topology registry, remote agents, and replication management endpoints.'
  },
  {
    match: path => path.startsWith('/api/metrics') || path.startsWith('/api/system'),
    domain: 'observability',
    description: 'Operational health and performance telemetry endpoints.'
  }
];

function routeDescriptionForPath(path) {
  for (const rule of ROUTE_DESCRIPTION_RULES) {
    if (rule.match(path)) {
      return {
        domain: rule.domain,
        description: rule.description
      };
    }
  }
  return {
    domain: 'misc',
    description: 'General platform endpoint.'
  };
}

function readRouterStack(app) {
  if (Array.isArray(app?._router?.stack)) return app._router.stack;
  if (Array.isArray(app?.router?.stack)) return app.router.stack;
  return [];
}

function collectRoutesFromStack(stack, collected) {
  for (const layer of stack || []) {
    if (layer?.route?.path && layer.route.methods) {
      const path = String(layer.route.path);
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (!enabled) continue;
        collected.push({
          method: String(method || '').toUpperCase(),
          path
        });
      }
      continue;
    }

    const nested = layer?.handle?.stack;
    if (Array.isArray(nested)) {
      collectRoutesFromStack(nested, collected);
    }
  }
}

export function enumerateApiCatalog(app, permissionResolver) {
  const raw = [];
  collectRoutesFromStack(readRouterStack(app), raw);

  const deduped = new Map();
  for (const route of raw) {
    const key = `${route.method} ${route.path}`;
    if (!deduped.has(key)) {
      const permission = typeof permissionResolver === 'function'
        ? permissionResolver({ method: route.method, path: route.path })
        : null;
      const details = routeDescriptionForPath(route.path);
      deduped.set(key, {
        method: route.method,
        path: route.path,
        permission: permission || null,
        domain: details.domain,
        description: details.description
      });
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
