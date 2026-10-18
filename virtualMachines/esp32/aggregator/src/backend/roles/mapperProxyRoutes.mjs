import { forwardServiceRequest } from '../modules/serviceTransactions.mjs';

export function registerMapperProxyRoutes(app, deps) {
  const { serviceTransactions } = deps;

  app.use('/api/mapper', async (req, res) => {
    const query = req.search || (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    await forwardServiceRequest(serviceTransactions, 'pulse-data-mapper', {
      method: req.method, path: `/api/mapper${req.path}${query}`, body: req.body,
    }, res);
  });
}
