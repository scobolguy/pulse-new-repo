export const platformServiceProvider = {
  id: 'platform',
  name: 'Platform Provider',
  category: 'platform',
  description: 'Platform metadata including route manifest and API catalog.',
  properties: [
    { id: 'routeManifest', type: 'collection', description: 'Enabled route role manifest entries.', readOnly: true },
    { id: 'apiCatalog', type: 'collection', description: 'Discovered API route catalog.', readOnly: true },
    { id: 'apiCatalogSummary', type: 'object', description: 'Aggregated API counts by method, domain, and provider.', readOnly: true },
    { id: 'apiActions', type: 'collection', description: 'Provider-defined API actions with semantic metadata.', readOnly: true },
    { id: 'serviceProviders', type: 'collection', description: 'Service provider definitions for visual tooling.', readOnly: true }
  ],
  actions: [
    { id: 'listApis', kind: 'query', description: 'List API catalog entries.', http: { method: 'GET', path: '/api/platform/apis' } },
    { id: 'summarizeApis', kind: 'query', description: 'Get API catalog summary counts for reasoning and discovery.', http: { method: 'GET', path: '/api/platform/apis/summary' }, responseExample: { status: 'ok', total: 120, sources: [{ source: 'live-route', count: 90 }, { source: 'discovered-device', count: 30 }] } },
    { id: 'lookupApi', kind: 'query', description: 'Look up one API entry by exact method and path.', http: { method: 'GET', path: '/api/platform/apis/lookup' }, responseExample: { status: 'ok', entry: { method: 'GET', path: '/api/nodes', providerId: 'topology' } } },
    { id: 'listApiActions', kind: 'query', description: 'List provider-defined API actions and semantic metadata.', http: { method: 'GET', path: '/api/platform/apis/actions' } },
    { id: 'getRouteManifest', kind: 'query', description: 'Get route manifest registration state.', http: { method: 'GET', path: '/api/platform/routes/manifest' } },
    { id: 'listProviders', kind: 'query', description: 'List service provider models.', http: { method: 'GET', path: '/api/platform/providers' } }
  ]
};
