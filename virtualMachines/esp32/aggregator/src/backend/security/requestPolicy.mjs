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
    // SECURITY DISABLED FOR DEVELOPMENT - ALL REQUESTS BYPASS AUTHENTICATION
    return null;
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
