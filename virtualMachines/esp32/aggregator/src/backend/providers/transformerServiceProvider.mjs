export const transformerServiceProvider = {
  id: 'transformer',
  name: 'Transformer Service Provider',
  category: 'data',
  description: 'Defines accessible transformers and their message-type mapping triplets.',
  properties: [
    { id: 'transformers', type: 'collection', description: 'Accessible transformer definitions.', readOnly: true }
  ],
  actions: [
    { id: 'listTransformers', kind: 'query', description: 'List all transformers with mapping triplets.', http: { method: 'GET', path: '/api/transformers' } },
    { id: 'getTransformer', kind: 'query', description: 'Read one transformer by name.', http: { method: 'GET', path: '/api/transformers/:transformerName' } }
  ]
};
