const DEFAULT_FLOW_DEFINITIONS = {
  'core-outgoing': {
    description: 'Core outgoing payment processing',
    p95Ms: 1500,
    warningRatio: 0.8,
    queues: ['core.tx.outgoing', 'SWIFT.gateway'],
    throughputQueue: 'SWIFT.gateway',
    targetThroughputTps: 20
  },
  'legacy-payment': {
    description: 'Legacy payment transformation to PACS',
    p95Ms: 1800,
    warningRatio: 0.8,
    queues: ['swift.mt103.inbound', 'tx.pacs.created'],
    throughputQueue: 'tx.pacs.created',
    targetThroughputTps: 25
  },
  'incoming-payment': {
    description: 'Incoming payment sanctions/liquidity pipeline',
    p95Ms: 2200,
    warningRatio: 0.8,
    queues: ['tx.pacs.created', 'tx.lynx.pending', 'tx.correspondent.unreconciled'],
    throughputQueue: 'tx.correspondent.unreconciled',
    targetThroughputTps: 20
  },
  'core-payment': {
    description: 'Ingress to reconciliation completion',
    p95Ms: 2500,
    warningRatio: 0.8,
    queues: ['tx.pacs.created', 'tx.lynx.pending', 'tx.correspondent.unreconciled', 'tx.reconciled'],
    throughputQueue: 'tx.reconciled',
    targetThroughputTps: 30
  },
  bocInterface: {
    description: 'Ingress to BoC interface',
    p95Ms: 500,
    warningRatio: 0.8,
    queues: ['tx.lynx.pending', 'lynx.pacs009.outbound'],
    throughputQueue: 'lynx.pacs009.outbound',
    targetThroughputTps: 15
  },
  swiftGateway: {
    description: 'Ingress to SWIFT gateway handoff',
    p95Ms: 2000,
    warningRatio: 0.8,
    queues: ['swift.mt103.inbound', 'swift.mt103.parsed'],
    throughputQueue: 'swift.mt103.parsed',
    targetThroughputTps: 30
  }
};

function normalizeFlowTarget(targetId, target = {}, fallback = {}) {
  return {
    description: target.description || fallback.description || targetId,
    p95Ms: Number(target.p95Ms ?? fallback.p95Ms ?? 0),
    warningRatio: Number(target.warningRatio ?? fallback.warningRatio ?? 0.8),
    queues: Array.isArray(target.queues) ? target.queues : (Array.isArray(fallback.queues) ? fallback.queues : []),
    throughputQueue: String(target.throughputQueue || fallback.throughputQueue || '').trim(),
    targetThroughputTps: Number(target.targetThroughputTps ?? fallback.targetThroughputTps ?? 0)
  };
}

export function getLatencyPolicyThresholds(workerConfig = {}) {
  const configured = workerConfig?.monitoring?.latencyPolicies || {};
  const configuredTargets = configured.targets && typeof configured.targets === 'object' ? configured.targets : {};
  const mergedTargets = {};

  for (const [targetId, fallback] of Object.entries(DEFAULT_FLOW_DEFINITIONS)) {
    mergedTargets[targetId] = normalizeFlowTarget(targetId, configuredTargets[targetId], fallback);
  }

  for (const [targetId, target] of Object.entries(configuredTargets)) {
    if (!mergedTargets[targetId]) {
      mergedTargets[targetId] = normalizeFlowTarget(targetId, target, {});
    }
  }

  return {
    enabled: configured.enabled === true,
    targets: mergedTargets
  };
}

export function validateLatencyPolicyTargetsUpdate(payload = {}) {
  const errors = [];
  const targets = payload?.targets && typeof payload.targets === 'object' ? payload.targets : {};
  const removeTargets = Array.isArray(payload?.removeTargets) ? payload.removeTargets : [];

  if (payload?.removeTargets !== undefined && !Array.isArray(payload.removeTargets)) {
    errors.push('removeTargets must be an array when provided.');
  }

  for (const flowId of removeTargets) {
    if (!String(flowId || '').trim()) {
      errors.push('removeTargets entries must be non-empty flow IDs.');
      break;
    }
  }

  for (const [targetId, target] of Object.entries(targets)) {
    const flowId = String(targetId || '').trim();
    if (!flowId) {
      errors.push('Flow ID is required.');
      continue;
    }

    if (!target || typeof target !== 'object') {
      errors.push(`${flowId}: target must be an object.`);
      continue;
    }

    if (!String(target.description || '').trim()) {
      errors.push(`${flowId}: description is required.`);
    }

    const p95Ms = Number(target.p95Ms);
    if (!Number.isFinite(p95Ms) || p95Ms <= 0) {
      errors.push(`${flowId}: p95Ms must be a positive number.`);
    }

    const warningRatio = Number(target.warningRatio);
    if (!Number.isFinite(warningRatio) || warningRatio <= 0 || warningRatio >= 1) {
      errors.push(`${flowId}: warningRatio must be between 0 and 1.`);
    }

    if (!Array.isArray(target.queues) || target.queues.length === 0 || target.queues.some((queueName) => !String(queueName || '').trim())) {
      errors.push(`${flowId}: queues must contain at least one queue name.`);
    }

    if (!String(target.throughputQueue || '').trim()) {
      errors.push(`${flowId}: throughputQueue is required.`);
    }

    const targetThroughputTps = Number(target.targetThroughputTps);
    if (!Number.isFinite(targetThroughputTps) || targetThroughputTps <= 0) {
      errors.push(`${flowId}: targetThroughputTps must be a positive number.`);
    }
  }

  return errors;
}

export function applyLatencyPolicyTargetsUpdate(workerConfig = {}, payload = {}, updatedBy = 'unknown') {
  if (!workerConfig.monitoring) workerConfig.monitoring = {};
  if (!workerConfig.monitoring.latencyPolicies) workerConfig.monitoring.latencyPolicies = {};

  const existingTargets = workerConfig.monitoring.latencyPolicies.targets && typeof workerConfig.monitoring.latencyPolicies.targets === 'object'
    ? workerConfig.monitoring.latencyPolicies.targets
    : {};
  const removeTargets = new Set(
    Array.isArray(payload?.removeTargets)
      ? payload.removeTargets.map((targetId) => String(targetId || '').trim()).filter(Boolean)
      : []
  );

  const nextTargets = {};
  for (const [targetId, target] of Object.entries(existingTargets)) {
    if (!removeTargets.has(String(targetId || '').trim())) {
      nextTargets[String(targetId).trim()] = normalizeFlowTarget(targetId, target, {});
    }
  }

  const rawTargets = payload?.targets && typeof payload.targets === 'object' ? payload.targets : {};

  for (const [targetId, target] of Object.entries(rawTargets)) {
    nextTargets[String(targetId).trim()] = normalizeFlowTarget(targetId, target, {});
  }

  workerConfig.monitoring.latencyPolicies.enabled = payload?.enabled === true;
  workerConfig.monitoring.latencyPolicies.targets = nextTargets;
  workerConfig.updatedAt = new Date().toISOString();
  workerConfig.updatedBy = updatedBy;
  return workerConfig;
}

export function evaluateLatencyPolicies(metrics = null, workerConfig = {}) {
  const policy = getLatencyPolicyThresholds(workerConfig);
  const latencyByQueue = metrics?.processingLatencies || {};
  const targets = policy.targets || {};
  const evaluations = {};

  for (const [targetId, target] of Object.entries(targets)) {
    const queueNames = Array.isArray(target.queues) ? target.queues : [];
    const queueStats = queueNames
      .map(queueName => ({ queueName, stats: latencyByQueue[queueName] || null }))
      .filter(entry => entry.stats && Number.isFinite(entry.stats.p95));

    if (queueStats.length === 0) {
      evaluations[targetId] = {
        status: 'no-data',
        description: target.description || targetId,
        p95Ms: null,
        targetP95Ms: Number(target.p95Ms || 0),
        warningP95Ms: Math.round(Number(target.p95Ms || 0) * Number(target.warningRatio || 0.8)),
        budgetUsedPercent: null,
        sourceQueues: queueNames
      };
      continue;
    }

    const worst = queueStats.reduce((acc, current) => (
      !acc || current.stats.p95 > acc.stats.p95 ? current : acc
    ), null);

    const targetP95Ms = Number(target.p95Ms || 0);
    const warningP95Ms = Math.round(targetP95Ms * Number(target.warningRatio || 0.8));
    const observedP95Ms = Number(worst.stats.p95 || 0);
    const budgetUsedPercent = targetP95Ms > 0
      ? Math.round((observedP95Ms / targetP95Ms) * 10000) / 100
      : null;

    let status = 'ok';
    if (targetP95Ms > 0 && observedP95Ms >= targetP95Ms) {
      status = 'critical';
    } else if (targetP95Ms > 0 && observedP95Ms >= warningP95Ms) {
      status = 'warning';
    }

    evaluations[targetId] = {
      status,
      description: target.description || targetId,
      p95Ms: observedP95Ms,
      targetP95Ms,
      warningP95Ms,
      budgetUsedPercent,
      sourceQueue: worst.queueName,
      sourceQueues: queueNames
    };
  }

  return {
    enabled: policy.enabled === true,
    targets,
    evaluations
  };
}
