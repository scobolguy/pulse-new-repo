# Economic Allocator Implementation Plan

## Goals
- Optimize job placement across nodes and clusters with explicit tradeoffs between latency, reliability, distribution, and congestion.
- Support specialization where clusters advertise capabilities as services.
- Keep decision rationale auditable.

## Phase 1 (Implemented)
- Core economic scoring module:
  - `src/backend/allocator/economicAllocator.mjs`
  - Policy profiles: `latency-first`, `reliability-first`, `balanced`, `cost-min`.
  - Hard filters: service match, capability match, reliability threshold, capacity.
  - Scoring terms: execution, queue delay, data movement, risk, congestion, specialization benefit, diversity penalty.
  - Replica selection with failure-domain spread.
- API routes:
  - `GET /api/allocator/policies`
  - `POST /api/allocator/score`
  - `POST /api/allocator/allocate`
- Test harness:
  - `scripts/test-economic-allocator.mjs`
  - `npm run test:allocator`

## Phase 2
- Integrate allocator decisions into live dispatch path (optional shadow mode first).
- Emit placement decision logs with score term breakdown and reason codes.
- Add policy override support per service class.

## Phase 3
- Add market-style dynamic pricing:
  - Congestion multiplier from queue depth and CPU utilization.
  - Risk premium from rolling error rates.
- Add failure-domain constraints for replica placement as hard rule.

## Phase 4
- Add adaptive weight calibration from outcomes (online/offline learning).
- Add SLA-aware hedging strategy for latency-critical synchronous jobs.

## PMachine Reliability Upgrades Needed
- True page-fault-backed code fetch from FFS (out-of-core execution).
- Per-job isolation and deterministic cleanup.
- Durable job lifecycle state journal.
- Idempotency keys and retry budget by service class.
- Circuit breakers and load shedding.
- Telemetry required by allocator:
  - success rates (1m/15m)
  - p95 latency by capability
  - queue delay
  - page faults/evictions/cache hits

## Testing Strategy
### Unit
- Validate scoring math and ordering.
- Validate hard filters and reason codes.
- Validate replica spread behavior.

### Integration
- API contract tests for `/api/allocator/*`.
- Snapshot tests of score explanation payloads.
- Shadow-mode compare: current placement vs allocator recommendation.

### Failure and Chaos
- Candidate failures and stale health signals.
- Congestion spikes and rebalancing behavior.
- Failure-domain outage with replica requirements.

### Acceptance Gates
- Policy-aware placement decisions are deterministic for same inputs.
- No candidate selected when hard constraints fail.
- Replica decisions spread across domains when available.
- Mean and p95 latency no worse than baseline in shadow trials.
