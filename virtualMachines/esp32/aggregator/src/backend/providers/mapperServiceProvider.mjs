export const mapperServiceProvider = {
  id: 'mapper',
  name: 'Data Mapper Provider',
  category: 'data',
  description: 'Transformation and mapping operations through mapper proxy service.',
  properties: [
    { id: 'mapDefinitions', type: 'collection', description: 'Mapping definitions and transforms.', readOnly: true }
  ],
  actions: [
    { id: 'proxyRequest', kind: 'command', description: 'Forward request to mapper API.', http: { method: 'ANY', path: '/api/mapper/*' } }
  ]
};
