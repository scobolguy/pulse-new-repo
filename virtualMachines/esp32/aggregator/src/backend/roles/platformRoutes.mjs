export function registerPlatformRoutes(app, deps) {
  const {
    requirePermission,
    enumerateApiCatalog,
    enumerateDiscoveredNodeApiCatalog,
    findApiCatalogEntry,
    resolvePermissionForApiRequest,
    routeRoleManifest,
    listServiceProviders,
    getServiceProvider,
    getServiceProviderAction,
    getServiceProviderCategories,
    listServiceProviderActions,
    discoveredNodes
  } = deps;

  app.get('/api/platform/apis', requirePermission('topology.read'), (req, res) => {
    const methodFilter = String(req.query.method || '').trim().toUpperCase();
    const domainFilter = String(req.query.domain || '').trim().toLowerCase();
    const providerFilter = String(req.query.providerId || '').trim().toLowerCase();
    const categoryFilter = String(req.query.category || '').trim().toLowerCase();
    const actionFilter = String(req.query.actionId || '').trim().toLowerCase();
    const sourceFilter = String(req.query.source || '').trim().toLowerCase();
    const nodeIdFilter = String(req.query.nodeId || '').trim().toLowerCase();
    const searchFilter = String(req.query.search || '').trim().toLowerCase();

    const backendCatalog = enumerateApiCatalog(app, candidate => resolvePermissionForApiRequest(candidate));
    const deviceCatalog = enumerateDiscoveredNodeApiCatalog(discoveredNodes);
    const catalog = [...backendCatalog, ...deviceCatalog];
    const filtered = catalog.filter(item => {
      if (methodFilter && item.method !== methodFilter) return false;
      if (domainFilter && item.domain !== domainFilter) return false;
      if (providerFilter && String(item.providerId || '').toLowerCase() !== providerFilter) return false;
      if (categoryFilter && String(item.category || '').toLowerCase() !== categoryFilter) return false;
      if (actionFilter && String(item.actionId || '').toLowerCase() !== actionFilter) return false;
      if (sourceFilter && String(item.source || '').toLowerCase() !== sourceFilter) return false;
      if (nodeIdFilter && String(item.nodeId || '').toLowerCase() !== nodeIdFilter) return false;
      if (searchFilter) {
        const haystack = `${item.method} ${item.path} ${item.description} ${item.domain} ${item.providerId || ''} ${item.actionId || ''} ${item.nodeId || ''} ${item.nodeName || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(searchFilter)) return false;
      }
      return true;
    });

    const domains = new Map();
    for (const item of filtered) {
      const current = domains.get(item.domain) || 0;
      domains.set(item.domain, current + 1);
    }

    const providers = new Map();
    for (const item of filtered) {
      const providerId = String(item.providerId || '').trim();
      if (!providerId) continue;
      const current = providers.get(providerId) || {
        providerId,
        providerName: item.providerName || providerId,
        count: 0
      };
      current.count += 1;
      providers.set(providerId, current);
    }

    res.json({
      status: 'ok',
      service: 'platform-api-catalog',
      total: filtered.length,
      filters: {
        method: methodFilter || null,
        domain: domainFilter || null,
        providerId: providerFilter || null,
        category: categoryFilter || null,
        actionId: actionFilter || null,
        source: sourceFilter || null,
        nodeId: nodeIdFilter || null,
        search: searchFilter || null
      },
      domains: Array.from(domains.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
      providers: Array.from(providers.values())
        .sort((a, b) => b.count - a.count || a.providerId.localeCompare(b.providerId)),
      routes: filtered
    });
  });

  app.get('/api/platform/apis/summary', requirePermission('topology.read'), (req, res) => {
    const catalog = [
      ...enumerateApiCatalog(app, candidate => resolvePermissionForApiRequest(candidate)),
      ...enumerateDiscoveredNodeApiCatalog(discoveredNodes)
    ];
    const methods = new Map();
    const domains = new Map();
    const providers = new Map();
    const sources = new Map();

    for (const item of catalog) {
      methods.set(item.method, (methods.get(item.method) || 0) + 1);
      domains.set(item.domain, (domains.get(item.domain) || 0) + 1);
      if (item.providerId) {
        providers.set(item.providerId, (providers.get(item.providerId) || 0) + 1);
      }
      sources.set(String(item.source || 'unknown'), (sources.get(String(item.source || 'unknown')) || 0) + 1);
    }

    return res.json({
      status: 'ok',
      service: 'platform-api-catalog',
      total: catalog.length,
      methods: Array.from(methods.entries()).map(([method, count]) => ({ method, count })).sort((a, b) => a.method.localeCompare(b.method)),
      domains: Array.from(domains.entries()).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
      providers: Array.from(providers.entries()).map(([providerId, count]) => ({ providerId, count })).sort((a, b) => b.count - a.count || a.providerId.localeCompare(b.providerId)),
      sources: Array.from(sources.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
    });
  });

  app.get('/api/platform/apis/lookup', requirePermission('topology.read'), (req, res) => {
    const method = String(req.query.method || '').trim().toUpperCase();
    const routePath = String(req.query.path || '').trim();
    if (!method || !routePath) {
      return res.status(400).json({
        status: 'error',
        error: 'method_and_path_required'
      });
    }

    const entry = findApiCatalogEntry(app, { method, path: routePath }, candidate => resolvePermissionForApiRequest(candidate))
      || enumerateDiscoveredNodeApiCatalog(discoveredNodes).find((item) => item.method === method && item.path === routePath)
      || null;
    if (!entry) {
      return res.status(404).json({
        status: 'error',
        error: 'route_not_found',
        method,
        path: routePath
      });
    }

    return res.json({
      status: 'ok',
      entry
    });
  });

  app.get('/api/platform/apis/actions', requirePermission('topology.read'), (req, res) => {
    const providerId = String(req.query.providerId || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();

    const actions = listServiceProviderActions().filter((action) => {
      if (providerId && String(action.providerId || '').toLowerCase() !== providerId) return false;
      if (category && String(action.category || '').toLowerCase() !== category) return false;
      if (search) {
        const haystack = `${action.providerId} ${action.actionId} ${action.description} ${action.http?.method || ''} ${action.http?.path || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return res.json({
      status: 'ok',
      total: actions.length,
      actions
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
