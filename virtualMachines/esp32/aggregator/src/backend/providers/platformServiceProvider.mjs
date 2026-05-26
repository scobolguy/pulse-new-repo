export const platformServiceProvider = {
  id: 'platform',
  name: 'Platform Provider',
  category: 'platform',
  description: 'Platform metadata including route manifest and API catalog.',
  properties: [
    { id: 'routeManifest', type: 'collection', description: 'Enabled route role manifest entries.', readOnly: true },
    { id: 'apiCatalog', type: 'collection', description: 'Discovered API route catalog.', readOnly: true },
    { id: 'serviceProviders', type: 'collection', description: 'Service provider definitions for visual tooling.', readOnly: true }
  ],
  actions: [
    { id: 'listApis', kind: 'query', description: 'List API catalog entries.', http: { method: 'GET', path: '/api/platform/apis' } },
    { id: 'getRouteManifest', kind: 'query', description: 'Get route manifest registration state.', http: { method: 'GET', path: '/api/platform/routes/manifest' } },
    { id: 'listProviders', kind: 'query', description: 'List service provider models.', http: { method: 'GET', path: '/api/platform/providers' } }
  ]
};
