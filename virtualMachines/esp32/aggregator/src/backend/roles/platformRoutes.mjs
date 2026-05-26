export function registerPlatformRoutes(app, deps) {
  const {
    requirePermission,
    enumerateApiCatalog,
    resolvePermissionForApiRequest,
    routeRoleManifest,
    listServiceProviders,
    getServiceProvider,
    getServiceProviderAction,
    getServiceProviderCategories
  } = deps;

  app.get('/api/platform/apis', requirePermission('topology.read'), (req, res) => {
    const methodFilter = String(req.query.method || '').trim().toUpperCase();
    const domainFilter = String(req.query.domain || '').trim().toLowerCase();
    const searchFilter = String(req.query.search || '').trim().toLowerCase();

    const catalog = enumerateApiCatalog(app, candidate => resolvePermissionForApiRequest(candidate));
    const filtered = catalog.filter(item => {
      if (methodFilter && item.method !== methodFilter) return false;
      if (domainFilter && item.domain !== domainFilter) return false;
      if (searchFilter) {
        const haystack = `${item.method} ${item.path} ${item.description} ${item.domain}`.toLowerCase();
        if (!haystack.includes(searchFilter)) return false;
      }
      return true;
    });

    const domains = new Map();
    for (const item of filtered) {
      const current = domains.get(item.domain) || 0;
      domains.set(item.domain, current + 1);
    }

    res.json({
      status: 'ok',
      total: filtered.length,
      domains: Array.from(domains.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
      routes: filtered
    });
  });

  app.get('/api/platform/routes/manifest', requirePermission('registry.read'), (req, res) => {
    res.json({
      status: 'ok',
      count: routeRoleManifest.length,
      manifest: routeRoleManifest
    });
  });

  app.get('/api/platform/providers', requirePermission('registry.read'), (req, res) => {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const actionId = String(req.query.actionId || '').trim();
    const providers = listServiceProviders({ search, category, actionId });

    res.json({
      status: 'ok',
      count: providers.length,
      categories: getServiceProviderCategories(),
      providers
    });
  });

  app.get('/api/platform/providers/:providerId', requirePermission('registry.read'), (req, res) => {
    const provider = getServiceProvider(req.params.providerId);
    if (!provider) {
      return res.status(404).json({
        status: 'error',
        error: 'unknown_provider',
        providerId: req.params.providerId
      });
    }
    return res.json({ status: 'ok', provider });
  });

  app.get('/api/platform/providers/:providerId/actions/:actionId', requirePermission('registry.read'), (req, res) => {
    const action = getServiceProviderAction(req.params.providerId, req.params.actionId);
    if (!action) {
      return res.status(404).json({
        status: 'error',
        error: 'unknown_action',
        providerId: req.params.providerId,
        actionId: req.params.actionId
      });
    }
    return res.json({ status: 'ok', action });
  });
}
