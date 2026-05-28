export function registerGovernanceRolePolicyRoutes(app, deps) {
  const {
    requirePermission,
    getToxicRoleCombinationPolicy,
    getIamIntegrationPaths,
    getUserById,
    resolveEffectiveAccessForUser
  } = deps;

  app.get('/api/governance/roles/toxic-combinations', requirePermission('governance.read'), (req, res) => {
    const policy = getToxicRoleCombinationPolicy();
    res.json({
      status: 'ok',
      policyVersion: policy.version,
      source: policy.source,
      combinations: policy.combinations
    });
  });

  app.get('/api/governance/roles/evaluate/:userId', requirePermission('governance.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        error: 'unknown_user',
        userId
      });
    }

    const access = resolveEffectiveAccessForUser(userId);
    return res.json({
      status: 'ok',
      userId,
      profileIds: access.profileIds || [],
      toxicRoleViolations: access.toxicRoleViolations || [],
      hasViolation: Array.isArray(access.toxicRoleViolations) && access.toxicRoleViolations.length > 0,
      iamSource: access.iamSource || 'local'
    });
  });

  app.get('/api/governance/iam/integration-paths', requirePermission('governance.read'), (req, res) => {
    res.json({
      status: 'ok',
      integration: getIamIntegrationPaths()
    });
  });
}
