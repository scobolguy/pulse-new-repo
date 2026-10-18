import { forwardServiceRequest } from '../modules/serviceTransactions.mjs';

export function registerLibrarianProxyRoutes(app, deps) {
  const {
    express,
    serviceTransactions
  } = deps;

  app.post('/api/librarian/upload/:dest', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    await forwardServiceRequest(serviceTransactions, 'pulse-data-librarian', {
      method: 'POST',
      path: `/api/librarian/upload/${encodeURIComponent(req.params.dest)}`,
      headers: {
        'content-type': req.get('content-type') || 'application/octet-stream',
        'x-filename': req.get('x-filename') || 'upload',
      },
      body: req.body.toString('base64'), bodyEncoding: 'base64',
    }, res);
  });

  app.use('/api/librarian', async (req, res) => {
    await forwardServiceRequest(serviceTransactions, 'pulse-data-librarian', {
      method: req.method, body: req.body,
      path: `/api/librarian${req.path}${req.search || (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')}`,
    }, res);
  });
}
