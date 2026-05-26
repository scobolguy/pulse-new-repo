export const librarianServiceProvider = {
  id: 'librarian',
  name: 'Data Librarian Provider',
  category: 'data',
  description: 'Data type and asset management through the librarian proxy service.',
  properties: [
    { id: 'dataTypes', type: 'collection', description: 'Available message/data types.', readOnly: true },
    { id: 'assets', type: 'collection', description: 'Stored librarian assets.', readOnly: true }
  ],
  actions: [
    { id: 'proxyRequest', kind: 'command', description: 'Forward request to librarian API.', http: { method: 'ANY', path: '/api/librarian/*' } },
    { id: 'uploadBinary', kind: 'command', description: 'Upload binary payload to librarian destination.', http: { method: 'POST', path: '/api/librarian/upload/:dest' } }
  ]
};
