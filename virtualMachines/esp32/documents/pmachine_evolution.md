# PMachine Evolution Strategy

## Goal

Build an evolution loop where Pascalish organisms compete on ESP32 nodes under transaction load, with measurable fitness, controlled mutation, and eventually morphology and social-contract evolution.

## Scope

This plan starts with the smallest useful loop and expands in phases:

1. Run one organism end to end.
2. Measure fitness for that organism.
3. Mutate genome values off-device.
4. Select better performers on-device.
5. Add morphology changes.
6. Add social contracts and tribe behavior.

## Phase 1: Organism Runtime MVP

Deliverables:

- One Pascalish organism can accept a transaction and produce a result.
- The runtime records latency, success/failure, retry count, and resource usage.
- Metrics are stored in a stable JSON shape.

Acceptance criteria:

- A single organism can be executed repeatedly on an ESP32 node.
- The output is deterministic for a fixed input and genome.
- The runtime can report at least one fitness score.

## Phase 2: Genome and Fitness Language Extensions

Deliverables:

- `genome` block for mutable traits.
- `fitness` block for reporting metrics.
- `env` access for queue, gateway, and SLA state.
- Stable parsing rules for trait values and constraints.

Acceptance criteria:

- A Pascalish organism can declare a genome with defaults and mutation hints.
- A fitness block can read execution state and emit a comparable score.

## Phase 3: Off-Device Mutation Engine

Deliverables:

- Parser for organism source or compiled metadata.
- Mutation operators for `step`, `range`, `choices`, and `drift`.
- Constraint validation before deployment.
- Lineage metadata for parent/child tracking.

Acceptance criteria:

- A parent organism produces a valid child organism.
- The child preserves syntax and contract constraints.
- Mutation history is recorded.

## Phase 4: On-Device Selection

Deliverables:

- Periodic ranking by fitness.
- Retire low performers.
- Promote high performers as parents.
- Lightweight reporting endpoint or queue.

Acceptance criteria:

- The device can sort organisms by score.
- Selection is deterministic for the same metrics.
- Retired organisms stop consuming resources.

## Phase 5: Transaction Feeder and Stress Profiles

Deliverables:

- Normal, stress, hostile, and jackpot transaction classes.
- Volume patterns: feast, famine, storm.
- Reproducible transaction injection for testing.

Acceptance criteria:

- The same organism is tested under different load classes.
- Stress patterns change selection outcomes.

## Phase 6: Morphology Mutation

Deliverables:

- Add/remove/reorder subflows.
- Swap node types.
- Toggle aggregator/broker usage.
- Record structural shape as a trait.

Acceptance criteria:

- Two organisms with equal genomes but different morphology can be compared.
- Structural changes are visible in lineage output.

## Phase 7: Social Contracts

Deliverables:

- Shared queue and gateway agreements.
- Explicit requires/offers contract syntax.
- Conflict and cooperation tracking.

Acceptance criteria:

- Multiple organisms can declare shared responsibilities.
- The runtime can detect contention and cooperation.

## Phase 8: Analysis and Experimentation

Deliverables:

- Fitness over time.
- Morphology over generations.
- Tribe and specialist detection.
- Architecture trend analysis.

Acceptance criteria:

- Experiment runs can be compared across generations.
- Results show whether the system is converging toward more reliable or more specialized forms.

## First Coding Slice

Implement these in order:

1. Add organism metadata and a minimal fitness report schema.
2. Expose a single fitness record from the runtime.
3. Add a simple selector that ranks by success and latency.
4. Add a feeder that can inject normal and stress transactions.
5. Run one closed loop with no morphology mutation.

That slice is the smallest useful proof that evolution can happen in this codebase.
