export function registerLibrarianProxyRoutes(app, deps) {
  const {
    express,
    resolveLibrarianOrigin
  } = deps;

  const librarianOrigin = resolveLibrarianOrigin();

  app.post('/api/librarian/upload/:dest', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    const url = `${librarianOrigin}/api/librarian/upload/${req.params.dest}`;
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': req.get('content-type') || 'application/octet-stream',
          'x-filename': req.get('x-filename') || 'upload',
        },
        body: req.body,
      });
      res.status(upstream.status).json(await upstream.json());
    } catch (e) {
      res.status(502).json({ error: 'Librarian service unavailable', details: e.message });
    }
  });

  app.use('/api/librarian', async (req, res) => {
    const url = `${librarianOrigin}/api/librarian${req.path}${req.search || (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')}`;
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
      res.status(502).json({ error: 'Librarian service unavailable', details: e.message });
    }
  });
}
