import { findServiceProviderActionByHttp, listServiceProviderActions } from './providers/serviceProviderRegistry.mjs';

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

function inferPathParams(path) {
  const matches = String(path || '').match(/:([A-Za-z0-9_]+)/g) || [];
  return matches.map((token) => ({
    name: token.slice(1),
    in: 'path',
    required: true,
    type: 'string'
  }));
}

function buildProviderActionIndex() {
  const out = new Map();
  for (const action of listServiceProviderActions()) {
    const method = String(action.http?.method || '').trim().toUpperCase();
    const path = String(action.http?.path || '').trim();
    if (!method || !path) continue;
    out.set(`${method} ${path}`, action);
  }
  return out;
}

function parseDeviceCommandMethodsAndPath(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const pathMatch = source.match(/(\/[A-Za-z0-9_./:-]+)/);
  if (!pathMatch) return [];

  const methods = Array.from(source.matchAll(/\b(GET|POST|PUT|DELETE|PATCH)\b/gi))
    .map((match) => String(match[1] || '').toUpperCase())
    .filter(Boolean);
  if (methods.length === 0) return [];

  return Array.from(new Set(methods)).map((method) => ({
    method,
    path: pathMatch[1]
  }));
}

function slugifyCatalogToken(value, fallback = 'item') {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return normalized || fallback;
}

export function enumerateDiscoveredNodeApiCatalog(discoveredNodes) {
  const nodes = discoveredNodes instanceof Map
    ? Array.from(discoveredNodes.values())
    : (Array.isArray(discoveredNodes) ? discoveredNodes : []);

  const out = [];
  for (const node of nodes) {
    const nodeId = String(node?.details?.nodeId || node?.nodeId || node?.nodeName || node?.ip || '').trim();
    const nodeName = String(node?.nodeName || node?.details?.nodeName || nodeId || '').trim();
    const ip = String(node?.ip || '').trim();
    const deviceRole = String(node?.details?.deviceRole || '').trim();
    const services = Array.isArray(node?.details?.services) ? node.details.services : [];

    for (const service of services) {
      const serviceName = String(service?.name || '').trim();
      const serviceDescription = String(service?.description || '').trim();
      const commands = Array.isArray(service?.commands) ? service.commands : [];

      for (const command of commands) {
        const commandName = String(command?.name || '').trim() || 'command';
        const commandDescription = String(command?.description || '').trim();
        for (const route of parseDeviceCommandMethodsAndPath(commandDescription)) {
          out.push({
            method: route.method,
            path: route.path,
            permission: null,
            domain: 'device',
            category: 'hardware',
            providerId: 'device',
            providerName: serviceName || 'Discovered Device Service',
            actionId: `${slugifyCatalogToken(serviceName, 'service')}.${slugifyCatalogToken(commandName, 'command')}`,
            actionName: commandName,
            actionKind: route.method === 'GET' ? 'query' : 'command',
            description: commandDescription || serviceDescription || 'Discovered device endpoint.',
            providerDescription: serviceDescription || null,
            parameters: inferPathParams(route.path),
            tags: Array.from(new Set(['device', 'esp32', serviceName, commandName, deviceRole].filter(Boolean))),
            source: 'discovered-device',
            nodeId: nodeId || null,
            nodeName: nodeName || null,
            ip: ip || null,
            deviceRole: deviceRole || null,
            serviceName: serviceName || null
          });
        }
      }
    }
  }

  return out.sort((a, b) => {
    const pathCompare = String(a.path || '').localeCompare(String(b.path || ''));
    if (pathCompare !== 0) return pathCompare;
    const methodCompare = String(a.method || '').localeCompare(String(b.method || ''));
    if (methodCompare !== 0) return methodCompare;
    return String(a.nodeId || '').localeCompare(String(b.nodeId || ''));
  });
}

export function enumerateApiCatalog(app, permissionResolver) {
  const raw = [];
  collectRoutesFromStack(readRouterStack(app), raw);
  const providerActionIndex = buildProviderActionIndex();

  const deduped = new Map();
  for (const route of raw) {
    const key = `${route.method} ${route.path}`;
    if (!deduped.has(key)) {
      const permission = typeof permissionResolver === 'function'
        ? permissionResolver({ method: route.method, path: route.path })
        : null;
      const details = routeDescriptionForPath(route.path);
      const providerAction = providerActionIndex.get(key) || findServiceProviderActionByHttp(route.method, route.path);
      deduped.set(key, {
        method: route.method,
        path: route.path,
        permission: permission || null,
        domain: providerAction?.providerId || details.domain,
        category: providerAction?.category || null,
        providerId: providerAction?.providerId || null,
        providerName: providerAction?.providerName || null,
        actionId: providerAction?.actionId || null,
        actionName: providerAction?.actionName || null,
        actionKind: providerAction?.kind || null,
        description: providerAction?.description || details.description,
        providerDescription: providerAction?.providerDescription || null,
        requestExample: providerAction?.requestExample || null,
        responseExample: providerAction?.responseExample || null,
        parameters: inferPathParams(route.path),
        tags: Array.from(new Set([
          details.domain,
          providerAction?.providerId,
          providerAction?.category,
          route.method === 'GET' ? 'read' : 'write'
        ].filter(Boolean))),
        source: providerAction ? 'provider-registry+live-route' : 'live-route'
      });
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function findApiCatalogEntry(app, matcher, permissionResolver) {
  const method = String(matcher?.method || '').trim().toUpperCase();
  const path = String(matcher?.path || '').trim();
  if (!method || !path) return null;

  return enumerateApiCatalog(app, permissionResolver).find((entry) => {
    return entry.method === method && entry.path === path;
  }) || null;
}
