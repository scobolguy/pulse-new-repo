export const iamServiceProvider = {
  id: 'iam',
  name: 'Identity & Access Provider',
  category: 'governance',
  description: 'Identity governance, toxic role combination policy, and SailPoint migration/integration metadata.',
  properties: [
    { id: 'toxicRoleCombinations', type: 'collection', description: 'Separation-of-duties role pairs that are not allowed.', readOnly: true },
    { id: 'iamSource', type: 'object', description: 'Authoritative IAM source metadata and integration state.', readOnly: true }
  ],
  actions: [
    { id: 'listToxicCombinations', kind: 'query', description: 'List toxic role combinations for SoD policy.', http: { method: 'GET', path: '/api/governance/roles/toxic-combinations' } },
    { id: 'evaluateUserRoleConflicts', kind: 'query', description: 'Evaluate a user for toxic role combinations.', http: { method: 'GET', path: '/api/governance/roles/evaluate/:userId' } },
    { id: 'listIamIntegrationPaths', kind: 'query', description: 'Describe IAM integration and migration paths (SailPoint-ready).', http: { method: 'GET', path: '/api/governance/iam/integration-paths' } }
  ]
};
