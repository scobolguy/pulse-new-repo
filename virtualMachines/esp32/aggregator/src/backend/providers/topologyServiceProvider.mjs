export const topologyServiceProvider = {
  id: 'topology',
  name: 'Topology Service',
  category: 'platform',
  description: 'Cluster topology, node discovery, and system status endpoints.',
  properties: [
    { id: 'nodes', type: 'collection', description: 'Discovered topology nodes.', readOnly: true },
    { id: 'sites', type: 'collection', description: 'First-class site registry for physical locations and failover policies.', readOnly: true },
    { id: 'site', type: 'object', description: 'Per-node site metadata (siteId, siteCategory, siteMode, isExternalSite).', readOnly: true },
    { id: 'performance', type: 'object', description: 'System performance snapshot.', readOnly: true },
    { id: 'primaryBroker', type: 'object', description: 'Discovered primary broker details.', readOnly: true }
  ],
  actions: [
    { id: 'listNodes', kind: 'query', description: 'List visible topology nodes.', http: { method: 'GET', path: '/api/nodes' } },
    { id: 'listSites', kind: 'query', description: 'List registered sites and optional node assignments.', http: { method: 'GET', path: '/api/sites' } },
    { id: 'upsertSite', kind: 'command', description: 'Create or update a first-class site definition.', http: { method: 'POST', path: '/api/sites' } },
    { id: 'assignSiteNodes', kind: 'command', description: 'Assign nodes to a site.', http: { method: 'POST', path: '/api/sites/:siteId/assign' } },
    { id: 'discoverPrimary', kind: 'query', description: 'Find current primary broker node.', http: { method: 'GET', path: '/api/discover-primary' } },
    { id: 'getPerformance', kind: 'query', description: 'Get machine performance metrics.', http: { method: 'GET', path: '/api/system/performance' } },
    { id: 'proxyRequest', kind: 'command', description: 'Proxy a request to node HTTP endpoint.', http: { method: 'GET', path: '/api/proxy/:ip' } }
  ]
};
