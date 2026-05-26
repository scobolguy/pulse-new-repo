export function registerPlatformRoutes(app, deps) {
  const {
    requirePermission,
    enumerateApiCatalog,
    resolvePermissionForApiRequest,
    routeRoleManifest
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
}
