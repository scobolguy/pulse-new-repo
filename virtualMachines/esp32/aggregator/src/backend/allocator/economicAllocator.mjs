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
    minSuccessProb: 0.97
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
    minSuccessProb: 0.995
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
    minSuccessProb: 0.985
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
    minSuccessProb: 0.96
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
    weights: normalizeWeights(overrideWeights || profile.weights)
  };
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
  const replicaCount = Math.max(1, toNumber(job?.placementPolicy?.minReplicas, 1));

  const picks = [];
  const usedDomains = new Set();
  for (const entry of accepted) {
    const domain = entry.failureDomain || 'default';
    if (usedDomains.has(domain) && picks.length < replicaCount) {
      continue;
    }
    picks.push(entry);
    usedDomains.add(domain);
    if (picks.length >= replicaCount) break;
  }

  // If domain spread could not satisfy desired replicas, fill from remaining accepted.
  if (picks.length < replicaCount) {
    for (const entry of accepted) {
      if (picks.some((pick) => pick.id === entry.id)) continue;
      picks.push(entry);
      if (picks.length >= replicaCount) break;
    }
  }

  return {
    decision: picks,
    replicaCount,
    scored
  };
}

export function getAllocatorPolicyProfiles() {
  return JSON.parse(JSON.stringify(DEFAULT_POLICY_PROFILES));
}
