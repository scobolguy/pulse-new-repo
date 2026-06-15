const DEFAULT_POLICY_PROFILES = {
  'latency-first': {
    weights: {
      executionMs: 0.45,
      queueDelayMs: 0.2,
      dataMoveCost: 0.15,
      failureRisk: 0.15,
      congestionPrice: 0.2,
      specializationBenefit: 0.2,
      diversityPenalty: 0.1
    },
    minSuccessProb: 0.97,
    opsPenaltyPerReplica: 8,
    hedge: {
      enabled: true,
      delayFactor: 0.7,
      budgetRatio: 0.05
    }
  },
  'reliability-first': {
    weights: {
      executionMs: 0.2,
      queueDelayMs: 0.1,
      dataMoveCost: 0.1,
      failureRisk: 0.45,
      congestionPrice: 0.1,
      specializationBenefit: 0.15,
      diversityPenalty: 0.25
    },
    minSuccessProb: 0.995,
    opsPenaltyPerReplica: 3,
    hedge: {
      enabled: true,
      delayFactor: 0.5,
      budgetRatio: 0.1
    }
  },
  balanced: {
    weights: {
      executionMs: 0.3,
      queueDelayMs: 0.15,
      dataMoveCost: 0.1,
      failureRisk: 0.25,
      congestionPrice: 0.15,
      specializationBenefit: 0.2,
      diversityPenalty: 0.15
    },
    minSuccessProb: 0.985,
    opsPenaltyPerReplica: 5,
    hedge: {
      enabled: true,
      delayFactor: 0.65,
      budgetRatio: 0.06
    }
  },
  'cost-min': {
    weights: {
      executionMs: 0.2,
      queueDelayMs: 0.15,
      dataMoveCost: 0.15,
      failureRisk: 0.15,
      congestionPrice: 0.35,
      specializationBenefit: 0.2,
      diversityPenalty: 0.1
    },
    minSuccessProb: 0.96,
    opsPenaltyPerReplica: 12,
    hedge: {
      enabled: false,
      delayFactor: 0.75,
      budgetRatio: 0.02
    }
  },
  'http-sync-balanced': {
    weights: {
      executionMs: 0.4,
      queueDelayMs: 0.3,
      dataMoveCost: 0.08,
      failureRisk: 0.22,
      congestionPrice: 0.2,
      specializationBenefit: 0.2,
      diversityPenalty: 0.18
    },
    minSuccessProb: 0.99,
    opsPenaltyPerReplica: 6,
    hedge: {
      enabled: true,
      delayFactor: 0.8,
      budgetRatio: 0.05
    }
  }
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeWeights(weights) {
  const defaults = DEFAULT_POLICY_PROFILES.balanced.weights;
  const next = {
    executionMs: toNumber(weights?.executionMs, defaults.executionMs),
    queueDelayMs: toNumber(weights?.queueDelayMs, defaults.queueDelayMs),
    dataMoveCost: toNumber(weights?.dataMoveCost, defaults.dataMoveCost),
    failureRisk: toNumber(weights?.failureRisk, defaults.failureRisk),
    congestionPrice: toNumber(weights?.congestionPrice, defaults.congestionPrice),
    specializationBenefit: toNumber(weights?.specializationBenefit, defaults.specializationBenefit),
    diversityPenalty: toNumber(weights?.diversityPenalty, defaults.diversityPenalty)
  };
  return next;
}

function resolvePolicy(policyId = 'balanced', overrideWeights = null) {
  const key = toLower(policyId) || 'balanced';
  const profile = DEFAULT_POLICY_PROFILES[key] || DEFAULT_POLICY_PROFILES.balanced;
  return {
    id: key,
    minSuccessProb: profile.minSuccessProb,
    opsPenaltyPerReplica: Math.max(0, toNumber(profile.opsPenaltyPerReplica, 5)),
    hedge: {
      enabled: profile.hedge?.enabled !== false,
      delayFactor: Math.max(0, Math.min(1.5, toNumber(profile.hedge?.delayFactor, 0.65))),
      budgetRatio: Math.max(0, Math.min(1, toNumber(profile.hedge?.budgetRatio, 0.05)))
    },
    weights: normalizeWeights(overrideWeights || profile.weights)
  };
}

function clampProbability(value, fallback) {
  const raw = toNumber(value, fallback);
  return Math.max(0, Math.min(0.999999, raw));
}

function combinedSuccessProbability(entries) {
  const misses = (Array.isArray(entries) ? entries : []).reduce((acc, entry) => {
    const p = clampProbability(entry?.successProb, 0);
    return acc * (1 - p);
  }, 1);
  return 1 - misses;
}

function supportsCapability(candidate, requiredCapability) {
  if (!requiredCapability) return true;
  const required = toLower(requiredCapability);
  const listed = Array.isArray(candidate?.capabilities) ? candidate.capabilities : [];
  return listed.some((cap) => toLower(cap) === required);
}

function successProbability(candidate) {
  const oneMinusRisk = 1 - Math.max(0, Math.min(1, toNumber(candidate?.failureRisk, 0)));
  if (candidate?.successRate15m != null) {
    return Math.max(0, Math.min(1, toNumber(candidate.successRate15m, oneMinusRisk)));
  }
  return oneMinusRisk;
}

function estimateCandidateCost(job, candidate, policy, indexInDomain = 0) {
  const w = policy.weights;
  const executionMs = toNumber(candidate.executionMs, toNumber(candidate.p95LatencyMs, 50));
  const queueDelayMs = toNumber(candidate.queueDelayMs, toNumber(candidate.queueDepth, 0) * 2);
  const dataMoveCost = toNumber(candidate.dataMoveCost, 0);
  const failureRisk = Math.max(0, Math.min(1, toNumber(candidate.failureRisk, 0)));
  const congestionPrice = toNumber(candidate.congestionPrice, toNumber(candidate.cpuUtil, 0) * 0.01);
  const specializationBenefit = toNumber(candidate.specializationBenefit, supportsCapability(candidate, job.requiredCapability) ? 0.2 : 0);
  const diversityPenalty = indexInDomain > 0 ? toNumber(candidate.diversityPenalty, 0.5 * indexInDomain) : 0;

  const score =
    (w.executionMs * executionMs)
    + (w.queueDelayMs * queueDelayMs)
    + (w.dataMoveCost * dataMoveCost)
    + (w.failureRisk * failureRisk)
    + (w.congestionPrice * congestionPrice)
    - (w.specializationBenefit * specializationBenefit)
    + (w.diversityPenalty * diversityPenalty);

  return {
    score,
    terms: {
      executionMs,
      queueDelayMs,
      dataMoveCost,
      failureRisk,
      congestionPrice,
      specializationBenefit,
      diversityPenalty
    }
  };
}

function filterCandidates(job, candidates, policy) {
  const requiredService = toLower(job?.requiredService || '');
  const requiredCapability = toLower(job?.requiredCapability || '');
  const minSuccessProb = toNumber(job?.sla?.minSuccessProb, policy.minSuccessProb);

  return (Array.isArray(candidates) ? candidates : []).flatMap((candidate) => {
    const reasons = [];
    const candidateService = toLower(candidate?.service || candidate?.serviceName || '');

    if (requiredService && candidateService !== requiredService) {
      reasons.push('service_mismatch');
    }
    if (!supportsCapability(candidate, requiredCapability)) {
      reasons.push('capability_mismatch');
    }

    const p = successProbability(candidate);
    if (p < minSuccessProb) {
      reasons.push('insufficient_reliability');
    }

    if (toNumber(candidate?.estimatedFreeSlots, 1) <= 0) {
      reasons.push('no_capacity');
    }

    return [{ candidate, accepted: reasons.length === 0, reasons, successProb: p }];
  });
}

export function scoreCandidates(job, candidates, options = {}) {
  const policy = resolvePolicy(options.policyId, options.weights);
  const filtered = filterCandidates(job, candidates, policy);

  const domainCounts = new Map();
  const scored = filtered.map((entry) => {
    const failureDomain = String(entry.candidate?.failureDomain || 'default');
    const seen = domainCounts.get(failureDomain) || 0;
    const { score, terms } = estimateCandidateCost(job, entry.candidate, policy, seen);
    if (entry.accepted) {
      domainCounts.set(failureDomain, seen + 1);
    }

    return {
      id: String(entry.candidate?.id || entry.candidate?.nodeId || entry.candidate?.instanceId || ''),
      nodeId: entry.candidate?.nodeId || null,
      clusterId: entry.candidate?.clusterId || null,
      failureDomain,
      accepted: entry.accepted,
      reasons: entry.reasons,
      successProb: entry.successProb,
      score,
      terms,
      candidate: entry.candidate
    };
  });

  scored.sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;
    return a.score - b.score;
  });

  return {
    policy,
    candidates: scored
  };
}

export function allocateJob(job, candidates, options = {}) {
  const scored = scoreCandidates(job, candidates, options);
  const accepted = scored.candidates.filter((entry) => entry.accepted);
  const placement = job?.placementPolicy || {};
  const minReplicas = Math.max(1, toNumber(placement.minReplicas, 1));
  const maxReplicas = Math.max(minReplicas, toNumber(placement.maxReplicas, minReplicas));
  const targetSuccessProb = clampProbability(
    job?.sla?.targetSuccessProb,
    clampProbability(job?.sla?.minSuccessProb, scored.policy.minSuccessProb)
  );
  const opsPenaltyPerReplica = Math.max(0, toNumber(placement.opsPenaltyPerReplica, scored.policy.opsPenaltyPerReplica));
  const requireDistinctFailureDomain = placement.requireDistinctFailureDomain === true;
  const targetP95Ms = Math.max(1, toNumber(job?.sla?.targetP95Ms, 0));

  const picks = [];
  const usedDomains = new Set();

  const available = [...accepted];
  while (picks.length < maxReplicas && available.length > 0) {
    const canUseDistinctDomain = available.some((entry) => !usedDomains.has(entry.failureDomain || 'default'));
    const candidatePool = (requireDistinctFailureDomain && canUseDistinctDomain)
      ? available.filter((entry) => !usedDomains.has(entry.failureDomain || 'default'))
      : available;

    let bestIndex = -1;
    let bestAdjustedScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < available.length; i += 1) {
      const entry = available[i];
      if (!candidatePool.includes(entry)) continue;
      const adjustedScore = entry.score + (picks.length > 0 ? opsPenaltyPerReplica : 0);
      if (adjustedScore < bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) break;

    const next = available.splice(bestIndex, 1)[0];
    const domain = next.failureDomain || 'default';
    picks.push(next);
    usedDomains.add(domain);

    const currentCombinedSuccess = combinedSuccessProbability(picks);
    if (picks.length >= minReplicas && currentCombinedSuccess >= targetSuccessProb) {
      break;
    }
  }

  // Backfill to honor minimum replicas even when constraints are hard to satisfy.
  if (picks.length < minReplicas) {
    for (const entry of accepted) {
      if (picks.some((pick) => pick.id === entry.id)) continue;
      picks.push(entry);
      if (picks.length >= minReplicas) break;
    }
  }

  const combinedSuccessProb = combinedSuccessProbability(picks);
  const distinctDomainCount = new Set(picks.map((entry) => entry.failureDomain || 'default')).size;
  const distinctDomainConstraintMet = !requireDistinctFailureDomain || distinctDomainCount >= Math.min(picks.length, minReplicas);

  const primary = picks[0] || null;
  const predictedPrimaryMs = primary
    ? toNumber(primary.terms?.executionMs, 0) + toNumber(primary.terms?.queueDelayMs, 0)
    : 0;
  const hedgeDelayMs = targetP95Ms > 0
    ? Math.max(1, Math.round(targetP95Ms * scored.policy.hedge.delayFactor))
    : Math.max(1, Math.round(predictedPrimaryMs * scored.policy.hedge.delayFactor));
  const hedgeRecommended = Boolean(
    scored.policy.hedge.enabled
    && picks.length > 1
    && targetP95Ms > 0
    && predictedPrimaryMs > targetP95Ms
  );

  return {
    decision: picks,
    replicaCount: picks.length,
    scored,
    constraints: {
      minReplicas,
      maxReplicas,
      targetSuccessProb,
      combinedSuccessProb,
      successConstraintMet: combinedSuccessProb >= targetSuccessProb,
      requireDistinctFailureDomain,
      distinctDomainCount,
      distinctDomainConstraintMet,
      opsPenaltyPerReplica
    },
    hedge: {
      enabled: scored.policy.hedge.enabled,
      recommended: hedgeRecommended,
      budgetRatio: scored.policy.hedge.budgetRatio,
      delayMs: hedgeDelayMs,
      predictedPrimaryMs,
      targetP95Ms: targetP95Ms > 0 ? targetP95Ms : null
    }
  };
}

export function getAllocatorPolicyProfiles() {
  return JSON.parse(JSON.stringify(DEFAULT_POLICY_PROFILES));
}
