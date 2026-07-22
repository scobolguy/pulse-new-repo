export const helloServiceProvider = {
  id: 'helloService',
  name: 'Hello Service',
  category: 'utility',
  description: 'Simple hello world service endpoint.',
  properties: [],
  actions: [
    {
      id: 'getHello',
      kind: 'query',
      description: 'Return the hello world greeting.',
      http: { method: 'GET', path: '/api/helloService' },
      responseExample: 'hello, world'
    }
  ]
};
