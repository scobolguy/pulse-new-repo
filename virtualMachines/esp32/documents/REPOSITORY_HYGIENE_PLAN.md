# Repository Hygiene Plan

## Purpose

This workspace needs a hard separation between code, authored reference assets, generated artifacts, and operational runtime state. Today those classes are mixed together, which makes handoff, review, and version control noisy.

## Current Problems

The same directories currently hold incompatible file types:

- source code and long-lived documentation
- hand-authored DSL, examples, and fixtures
- compiled pcode and generated JSON sidecars
- queue messages, topology registries, logs, FSM status files, and experiment output

Concrete examples already present:

- workspace root:
  - `evolution-generation-*.json`
  - `tmp-*`
  - scratch `.pcode`, `.program.json`, `.mjs`, `.txt`, and log files
- `aggregator/data/`:
  - runtime cluster state
  - queue manager state
  - JSONL logs
  - startup FSM status
  - stress and run reports
  - hand-authored DSL sources and reference payloads

## Target Classification

Every file in the repo should belong to exactly one of these classes.

### 1. Source

Versioned and reviewed as code or maintained documentation.

Examples:

- `src/`, `include/`, `libraries/`, `scripts/`, `documents/`
- `aggregator/src/`, `aggregator/scripts/`, `aggregator/tools/`, `aggregator/docs/`
- curated configuration templates and operator docs

### 2. Authored Reference Assets

Versioned inputs, examples, and golden fixtures that are intentionally kept in git.

Examples:

- hand-authored `.pas`, `.wfl`, `.tsl`, `.dsl`
- curated example payloads used by tests, demos, or docs
- selected golden pcode fixtures only if they are intentionally reviewed artifacts

### 3. Generated Artifacts

Reproducible outputs created from source. These should usually not be committed unless explicitly promoted as golden fixtures.

Examples:

- `.pcode`
- `.program.json`
- `*.generated.json`
- `*-compiled.json`
- one-off benchmark output and evolution snapshots

### 4. Operational Runtime State

Local state, registries, logs, queue payloads, leases, FSM status, uploaded files, and node outputs. These should not live in source-controlled working areas.

Examples:

- `aggregator/data/cluster-registry.json`
- `aggregator/data/site-registry.json`
- `aggregator/data/node-topology-overrides.json`
- `aggregator/data/node-rename-overrides.json`
- `aggregator/data/allocator-decisions.jsonl`
- `aggregator/data/qm-primary/`
- `aggregator/data/qm-secondary/`
- `aggregator/data/run-reports/`
- `aggregator/data/stress-reports/`
- `aggregator/data/startup-quarantine/`
- `aggregator/data/local-tts/`
- top-level `evolution-generation-*.json`

## Target Directory Rules

### Root workspace

- keep code, maintained docs, and build scripts only
- move experiment output and scratch files out of the root

Recommended destinations:

- `runtime/experiments/` for local benchmark and evolution output
- `runtime/tmp/` for scratch files
- `artifacts/` for generated outputs worth keeping locally but not committing

### `aggregator/data/`

Split into explicit subdomains:

- `aggregator/data/source/`:
  - hand-authored DSL and reference fixtures
- `aggregator/data/generated/`:
  - compiler outputs, generated maps, generated workflow outputs
- `aggregator/data/runtime/`:
  - cluster registries, queue state, FSM status, logs, uploads, run reports

Do not keep mixed source and runtime state at the top level of `aggregator/data/` once cleanup starts.

### `pcode/`

Decide one rule and enforce it:

- either keep only curated golden pcode fixtures in git
- or treat the whole directory as generated and move everyday outputs to `artifacts/pcode/`

Today the directory is mixed. That should be resolved explicitly.

## Recommended Cleanup Sequence

### Phase 1: Stop The Bleeding

- expand ignore rules for obvious runtime and scratch outputs
- stop writing new scratch files into the workspace root
- stop treating runtime registries as documentation or design inputs

### Phase 2: Create Explicit Boundaries

- introduce `aggregator/data/source/`, `aggregator/data/generated/`, and `aggregator/data/runtime/`
- update scripts to write generated and runtime outputs into the correct destinations
- move top-level `tmp-*` and `evolution-generation-*` output into `runtime/`

### Phase 3: Promote Or Purge

- review existing tracked generated artifacts
- keep only the ones that are deliberate golden fixtures
- remove or relocate the rest from tracked source locations

### Phase 4: Enforce In Tooling

- update scripts and tests so they fail fast when writing runtime output into source paths
- document the rules in contributor docs
- optionally add CI checks for forbidden write locations

## Immediate Candidate Moves

These are the highest-value cleanup targets.

1. Move top-level `evolution-generation-*.json` into `runtime/experiments/evolution/`.
2. Move top-level `tmp-*` files and folders into `runtime/tmp/` or a developer-local scratch area.
3. Move Aggregator cluster registries, FSM status files, queue payloads, and report outputs under `aggregator/data/runtime/`.
4. Move reproducible generated compiler outputs under `aggregator/data/generated/`.
5. Decide whether `pcode/` is curated reference material or generated output, then make the directory single-purpose.

## Rule For BOB

If a file is created by running the system, by a queue manager, by a cluster controller, by a benchmark, by a startup FSM, or by a compiler, it should not default to a source-controlled top-level working directory.