export function createRequestPolicyApi({ requireHttps = false } = {}) {
  function applyRequestSecurityHeaders(req, res, next) {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()');
    if (requireHttps) {
      res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    next();
  }

  function enforceHttpsTransport(req, res, next) {
    if (!requireHttps) return next();

    const forwardedProto = String(req.get('x-forwarded-proto') || '').toLowerCase();
    const isSecure = req.secure === true || forwardedProto === 'https';
    if (isSecure) return next();

    return res.status(426).json({
      error: 'HTTPS is required',
      code: 'HTTPS_REQUIRED'
    });
  }

  function resolvePermissionForApiRequest(req) {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || '').trim();

    if (path === '/api/authz/me') return null;

    if (path.startsWith('/api/metrics') || path === '/api/queues/status' || path === '/api/system/health') {
      return null;
    }

    if (path.startsWith('/api/users')) {
      return method === 'GET' ? 'users.read' : 'users.manage';
    }

    if (path.startsWith('/api/governance')) {
      return method === 'GET' ? 'governance.read' : 'governance.manage';
    }

    if (path.startsWith('/api/lifecycle/policy')) {
      return method === 'GET' ? 'lifecycle.policy.read' : 'lifecycle.policy.manage';
    }

    if (path.startsWith('/api/lifecycle/workers') || path.startsWith('/api/lifecycle/bridge-workers') || path.startsWith('/api/lifecycle/subflows/workers')) {
      return method === 'GET' ? 'lifecycle.workers.read' : 'lifecycle.workers.manage';
    }

    if (path.startsWith('/api/lifecycle')) {
      return method === 'GET' ? 'lifecycle.read' : 'lifecycle.manage';
    }

    if (path.startsWith('/api/fsm') || path.startsWith('/api/nlp')) {
      return 'lifecycle.read';
    }

    if (path.startsWith('/api/gateways')) {
      return method === 'GET' ? 'gateway.read' : 'gateway.manage';
    }

    if (path === '/api/queue/validation-errors') {
      return 'queue.view';
    }

    if (path.match(/^\/api\/queue\/[^/]+\/(enqueue|dequeue)$/)) {
      return null;
    }

    if (path.match(/^\/api\/queue\/[^/]+\/(length|status)$/)) {
      return 'queue.view';
    }

    if (path.match(/^\/api\/queue\/[^/]+\/config$/)) {
      return method === 'GET' ? 'queue.view' : 'queue.configure';
    }

    if (path.match(/^\/api\/queue\/[^/]+\/(freeze|thaw)$/)) {
      return 'queue.operate';
    }

    if (path === '/api/registry/queue-managers' || path === '/api/registry/queues' || path === '/api/registry/databases') {
      return 'queue.view';
    }

    if (path.match(/^\/api\/registry\/queue-managers\/[^/]+\/(quiesce|maintenance|return-service)$/)) {
      return 'queue.operate';
    }

    if (path.startsWith('/api/local-queue-managers') || path.startsWith('/api/remote-queue-managers')) {
      return method === 'GET' ? 'queue.view' : 'queue.configure';
    }

    if (path.match(/^\/api\/queues\/[^/]+\/config$/)) {
      return method === 'GET' ? 'queue.view' : 'queue.configure';
    }

    if (path.match(/^\/api\/queues\/[^/]+\/(create|delete|update|apply-config-change)$/)) {
      return 'queue.configure';
    }

    if (path === '/api/broker/publish') {
      return 'queue.operate';
    }

    if (path.startsWith('/api/broker/subscriptions')) {
      return method === 'GET' ? 'broker.read' : 'broker.configure';
    }

    if (path === '/api/broker/config') {
      return method === 'GET' ? 'broker.read' : 'broker.configure';
    }

    if (path.startsWith('/api/broker')) {
      return method === 'GET' ? 'broker.read' : 'broker.operate';
    }

    if (path.startsWith('/api/router')) {
      return method === 'GET' ? 'router.read' : 'router.manage';
    }

    if (path.startsWith('/api/workers')) {
      return method === 'GET' ? 'router.read' : 'router.manage';
    }

    if (path.startsWith('/api/librarian') || path.startsWith('/api/mapper')) {
      return method === 'GET' ? 'data.read' : 'data.manage';
    }

    if (path.startsWith('/api/availability')) {
      return method === 'GET' ? 'topology.read' : 'registry.manage';
    }

    if (path.startsWith('/api/presence')) {
      return 'topology.read';
    }

    if (path.startsWith('/api/registry') || path.startsWith('/api/local-queue-managers') || path.startsWith('/api/remote-queue-managers') || path.startsWith('/api/remote-agents') || path.startsWith('/api/replication') || path.startsWith('/api/nodes') || path.startsWith('/api/proxy') || path.startsWith('/api/services') || path.startsWith('/api/service-proxy') || path.startsWith('/api/discover-primary')) {
      return method === 'GET' ? 'registry.read' : 'registry.manage';
    }

    return method === 'GET' ? 'topology.read' : 'registry.manage';
  }

  function enforceApiPermission(req, res, next, deps) {
    const requiredPermission = resolvePermissionForApiRequest(req);
    if (!requiredPermission) {
      req.actor = deps.resolveActor(req);
      return next();
    }

    return deps.requirePermission(requiredPermission)(req, res, next);
  }

  return {
    applyRequestSecurityHeaders,
    enforceHttpsTransport,
    resolvePermissionForApiRequest,
    enforceApiPermission
  };
}
