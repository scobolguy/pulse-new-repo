export function registerSystemRegistryRoutes(app, deps) {
  const { requirePermission, systemRegistry } = deps;

  app.get('/api/systems', requirePermission('queue.view'), (req, res) => {
    res.json({ systems: systemRegistry.listStatuses() });
  });

  app.get('/api/systems/:systemId/status', requirePermission('queue.view'), (req, res) => {
    const status = systemRegistry.getStatus(req.params.systemId);
    if (!status) return res.status(404).json({ error: 'System not found' });
    return res.json(status);
  });

  app.post('/api/systems/:systemId/lifecycle', requirePermission('queue.configure'), (req, res) => {
    try {
      const action = String(req.body?.action || '').trim().toLowerCase();
      return res.json(systemRegistry.transition(req.params.systemId, action));
    } catch (error) {
      const statusCode = /not found/i.test(error.message) ? 404 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
  });
}
