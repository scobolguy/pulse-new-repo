import fs from 'node:fs/promises';
import path from 'node:path';
import { allocateJob, getAllocatorPolicyProfiles, scoreCandidates } from '../allocator/economicAllocator.mjs';

const ALLOCATOR_DECISIONS_PATH = path.resolve(process.cwd(), 'data', 'allocator-decisions.jsonl');

function normalizeServiceInstances(serviceInstanceRegistry) {
  const out = [];
  for (const instance of serviceInstanceRegistry?.values?.() || []) {
    out.push({
      id: String(instance.instanceId || `${instance.serviceName}:${instance.nodeId || instance.ip || 'unknown'}`),
      nodeId: instance.nodeId || null,
      clusterId: instance.metadata?.clusterId || null,
      failureDomain: instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default',
      service: instance.serviceName || null,
      capabilities: Array.isArray(instance.metadata?.capabilities) ? instance.metadata.capabilities : [],
      executionMs: Number(instance.metadata?.p95LatencyMs || 50),
      queueDelayMs: Number(instance.metadata?.queueDelayMs || 0),
      dataMoveCost: Number(instance.metadata?.dataMoveCost || 0),
      failureRisk: Number(instance.metadata?.failureRisk || 0.01),
      congestionPrice: Number(instance.metadata?.congestionPrice || 0),
      specializationBenefit: Number(instance.metadata?.specializationBenefit || 0),
      diversityPenalty: Number(instance.metadata?.diversityPenalty || 0),
      successRate15m: Number(instance.metadata?.successRate15m || 0.99),
      estimatedFreeSlots: Number(instance.metadata?.estimatedFreeSlots || 1),
      status: instance.status
    });
  }
  return out;
}

async function readAllocatorDecisionLog(limit = 200) {
  const maxRows = Math.max(1, Math.min(5000, Number(limit) || 200));
  try {
    const raw = await fs.readFile(ALLOCATOR_DECISIONS_PATH, 'utf8');
    const rows = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return rows.slice(Math.max(0, rows.length - maxRows)).reverse();
  } catch {
    return [];
  }
}

function summarizeAllocatorDecisions(entries) {
  const total = entries.length;
  const byMode = {};
  const byPolicy = {};
  const bySource = {};

  let fallbackCount = 0;
  let distinctConstraintRequests = 0;
  let distinctConstraintMet = 0;

  for (const entry of entries) {
    const mode = String(entry?.mode || 'unknown');
    const policyId = String(entry?.policyId || 'unknown');
    const source = String(entry?.selected?.source || 'unknown');

    byMode[mode] = Number(byMode[mode] || 0) + 1;
    byPolicy[policyId] = Number(byPolicy[policyId] || 0) + 1;
    bySource[source] = Number(bySource[source] || 0) + 1;

    if (entry?.fallbackReason && String(entry.fallbackReason).trim().length > 0) {
      fallbackCount += 1;
    }

    if (entry?.allocator?.requireDistinctFailureDomain === true) {
      distinctConstraintRequests += 1;
      if (entry?.allocator?.distinctDomainConstraintMet === true) {
        distinctConstraintMet += 1;
      }
    }
  }

  return {
    total,
    byMode,
    byPolicy,
    bySource,
    fallbackCount,
    fallbackRate: total > 0 ? fallbackCount / total : 0,
    distinctConstraintRequests,
    distinctConstraintMet,
    distinctConstraintComplianceRate: distinctConstraintRequests > 0 ? (distinctConstraintMet / distinctConstraintRequests) : 1
  };
}

export function registerAllocatorRoutes(app, deps) {
  const { serviceInstanceRegistry } = deps;

  app.get('/api/allocator/policies', (req, res) => {
    res.json({
      status: 'ok',
      policies: getAllocatorPolicyProfiles()
    });
  });

  app.post('/api/allocator/score', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const job = body.job || {};
    const policyId = body.policyId || 'balanced';
    const weights = body.weights || null;
    const candidates = Array.isArray(body.candidates) ? body.candidates : normalizeServiceInstances(serviceInstanceRegistry);

    const scored = scoreCandidates(job, candidates, { policyId, weights });
    res.json({ status: 'ok', ...scored });
  });

  app.post('/api/allocator/allocate', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const job = body.job || {};
    const policyId = body.policyId || 'balanced';
    const weights = body.weights || null;
    const candidates = Array.isArray(body.candidates) ? body.candidates : normalizeServiceInstances(serviceInstanceRegistry);

    const result = allocateJob(job, candidates, { policyId, weights });
    res.json({
      status: 'ok',
      replicaCount: result.replicaCount,
      decision: result.decision,
      scored: result.scored
    });
  });

  app.get('/api/allocator/decisions', async (req, res) => {
    const limit = Number(req.query?.limit || 200);
    const entries = await readAllocatorDecisionLog(limit);
    res.json({
      status: 'ok',
      path: ALLOCATOR_DECISIONS_PATH,
      count: entries.length,
      decisions: entries
    });
  });

  app.get('/api/allocator/summary', async (req, res) => {
    const limit = Number(req.query?.limit || 1000);
    const entries = await readAllocatorDecisionLog(limit);
    res.json({
      status: 'ok',
      windowSize: entries.length,
      summary: summarizeAllocatorDecisions(entries)
    });
  });
}
