import assert from 'node:assert/strict';
import { allocateJob, scoreCandidates } from '../src/backend/allocator/economicAllocator.mjs';

const candidates = [
  {
    id: 'cluster-a-node-1',
    service: 'pmachine',
    capabilities: ['mt103.parse'],
    failureDomain: 'zone-a',
    executionMs: 20,
    queueDelayMs: 5,
    dataMoveCost: 1,
    failureRisk: 0.01,
    congestionPrice: 0.4,
    specializationBenefit: 0.8,
    estimatedFreeSlots: 2,
    successRate15m: 0.995
  },
  {
    id: 'cluster-b-node-1',
    service: 'pmachine',
    capabilities: ['mt103.parse'],
    failureDomain: 'zone-b',
    executionMs: 30,
    queueDelayMs: 4,
    dataMoveCost: 1,
    failureRisk: 0.005,
    congestionPrice: 0.3,
    specializationBenefit: 0.5,
    estimatedFreeSlots: 3,
    successRate15m: 0.998
  },
  {
    id: 'cluster-c-node-1',
    service: 'mapper',
    capabilities: ['map.transform'],
    failureDomain: 'zone-c',
    executionMs: 15,
    queueDelayMs: 2,
    dataMoveCost: 3,
    failureRisk: 0.02,
    congestionPrice: 0.1,
    specializationBenefit: 0.2,
    estimatedFreeSlots: 1,
    successRate15m: 0.97
  }
];

const job = {
  requiredService: 'pmachine',
  requiredCapability: 'mt103.parse',
  sla: { minSuccessProb: 0.99 },
  placementPolicy: { minReplicas: 2 }
};

const scored = scoreCandidates(job, candidates, { policyId: 'balanced' });
assert.equal(scored.candidates.length, 3);
assert.equal(scored.candidates.filter((c) => c.accepted).length, 2);
assert.equal(scored.candidates[0].accepted, true);

const allocation = allocateJob(job, candidates, { policyId: 'balanced' });
assert.equal(allocation.decision.length, 2);
assert.notEqual(allocation.decision[0].failureDomain, allocation.decision[1].failureDomain);

console.log('allocator tests passed');
