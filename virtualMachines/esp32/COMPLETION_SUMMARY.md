# Project Handoff Summary For BOB

This file is now the high-level handoff summary for the `virtualMachines/esp32` workspace.

## Workspace Status

The workspace is active and functional, but it is carrying too much operational and generated output inside source directories. The two most important realities for handoff are:

- clustering is implemented and persisted in the Aggregator backend today
- repository hygiene is not yet enforced consistently, so source, generated, and runtime files are mixed together

## What Matters Most Right Now

### 1. Clustering is real and backend-driven

The authoritative implementation is in `aggregator/src/backend/roles/topologyRuntimeRoutes.mjs`.

Current clustering behavior includes:

- explicit cluster CRUD via `/api/clusters`
- automatic free pools:
  - `free-pool`
  - `free-pool-js`
  - `free-pool-esp`
- persisted registries for clusters, sites, topology overrides, and node rename overrides
- cluster lifecycle controls:
  - quiesce
  - start
  - announce
  - deploy to cluster members
- deterministic UDP port-pair assignment for cluster traffic starting at `4200`

### 2. Startup scripts are bootstrap helpers, not the full cluster model

`start-cluster.bat` and `scripts/start-cluster.ps1` help start local primary or backup roles. They do not define cluster membership. Cluster membership and topology come from the backend topology routes and persisted registry files.

### 3. Repository hygiene is the next structural job

The workspace currently mixes:

- maintained code and documentation
- hand-authored DSL and reference assets
- generated pcode and compiled artifacts
- runtime state, logs, queue payloads, topology registries, and experiment output

This is why the cleanup plan is now a first-class deliverable, not a housekeeping note.

## Files To Read First

- `README.md`
- `RUNBOOK.md`
- `aggregator/README.md`
- `documents/FLOW_BUILD_HANDOFF.md`
- `documents/REPOSITORY_HYGIENE_PLAN.md`

## Operational Files You Should Not Treat As Source Of Truth

Examples already present in the repo:

- `aggregator/data/cluster-registry.json`
- `aggregator/data/site-registry.json`
- `aggregator/data/node-topology-overrides.json`
- `aggregator/data/node-rename-overrides.json`
- `aggregator/data/allocator-decisions.jsonl`
- `aggregator/data/*startup*fsm*`
- `aggregator/data/qm-primary/`
- `aggregator/data/qm-secondary/`
- `aggregator/data/run-reports/`
- `aggregator/data/stress-reports/`
- `evolution-generation-*.json`
- `tmp-*`

## Handoff Guidance

- If you need to understand clustering, start with the topology runtime routes and the cluster/site registry files.
- If you need to understand deployment or operator flow, use `RUNBOOK.md` and `aggregator/README.md`.
- If you need to clean the repo, follow `documents/REPOSITORY_HYGIENE_PLAN.md` and do the separation in phases instead of a single mass move.
- If a file looks like a log, queue payload, registry snapshot, generated pcode sidecar, or temporary scratch output, assume it is not canonical source until proven otherwise.
