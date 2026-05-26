export function registerMapperProxyRoutes(app, deps) {
  const {
    resolveMapperOrigin
  } = deps;

  const mapperOrigin = resolveMapperOrigin();

  app.use('/api/mapper', async (req, res) => {
    const query = req.search || (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    const url = `${mapperOrigin}/api/mapper${req.path}${query}`;
    try {
      const method = req.method;
      const hasBody = !['GET', 'HEAD'].includes(method);
      const upstream = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });
      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType.includes('application/json')) {
        res.json(await upstream.json());
      } else {
        res.send(await upstream.text());
      }
    } catch (e) {
      res.status(502).json({ error: 'Mapper service unavailable', details: e.message });
    }
  });
}
