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

### 3. Ollama query interface now handles live operations

`aggregator/src/backend/ollamaRoutes.mjs` is not just a Q&A proxy. It handles several deterministic commands before falling back to the LLM:

- **Queue create**: `create queue <name>` → creates queue in the active queue manager
- **Gateway bridge create**: `create gateway from queue <a> to queue <b>` → creates queues and starts a bridge worker; persists Pascalish + pcode artifacts in `data/projects/`
- **Queue type assignment**: `assign <dataTypeIds> to queue <name>` → validates types, assigns, persists artifact
- **Project rename**: `rename project <old> to <new>`
- **Subproject rename**: `rename subproject <old> to <new> in project <id>`
- **Project deploy**: `deploy project <id> subproject <path> to node <nodeId>` → resolves node, reads project artifacts, calls `/api/nodes/:nodeId/deploy`
- **Gateway/queue state query**: asks for runtime dashboard of gateways and queue depths
- **Device control**: LED/GPIO commands for known child ESP32 nodes
- **Relay control**: hardware relay execution via structured Ollama response

All commands use a 5-minute in-memory response cache that is invalidated on writes. Slow queries (> 60 s) are logged to `logs/slow-queries.jsonl`.

### 4. Project workspace artifacts live under aggregator/data/projects/

When gateway or queue-type commands are executed, artifacts are written to:

```
aggregator/data/projects/<projectId>/
  gateways/<workerId>.pas
  gateways/<workerId>.pcode
  gateways/<workerId>.program.json
  gateway-bridges.json
  queue-type-assignments.json
  subprojects/<path>/...
```

Examples already present: `data/projects/mytestgateway/`, `data/projects/tradecore/`.

This directory is operational runtime output. It follows the same hygiene rules as the rest of `aggregator/data/`.

### 5. Service provider registry now includes IAM

`aggregator/src/backend/providers/serviceProviderRegistry.mjs` registers ten service providers:

- broker
- router
- queue
- lifecycle
- observability
- topology
- librarian
- mapper
- platform
- **iam** (new)

A new `findServiceProviderActionByHttp(method, path)` function allows looking up a provider action by its HTTP method and path, used for route-manifest and API catalog integration.

### 6. Ollama mentor loop has active sessions and escalations

The mentor loop is running and producing session artifacts under `data/ollama-mentor-*`:

- `data/ollama-mentor-sessions/` — per-session JSON record
- `data/ollama-mentor-candidates/` — raw `.pas` output from Ollama
- `data/ollama-mentor-results/` — validation result including errors and repair flag
- `data/ollama-copilot-escalations/` — escalation packet when `status: needs-copilot`

See `aggregator/docs/ollama-copilot-mentor-loop.md` for the full workflow and field reference.

### 7. helloService pcode artifact is now committed

`pcode/helloService.artifact.json` and `pcode/helloService.router-rules.json` are compiled Pascalish service artifacts for a simple GET/POST echo service. These are reference artifacts, not source of truth. The source lives in the DSL files.

### 8. Repository hygiene is the next structural job

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
- `aggregator/data/projects/`
- `aggregator/data/ollama-mentor-sessions/`
- `aggregator/data/ollama-mentor-candidates/`
- `aggregator/data/ollama-mentor-results/`
- `aggregator/data/ollama-copilot-escalations/`
- `evolution-generation-*.json`
- `tmp-*`

## Handoff Guidance

- If you need to understand clustering, start with the topology runtime routes and the cluster/site registry files.
- If you need to understand deployment or operator flow, use `RUNBOOK.md` and `aggregator/README.md`.
- If you need to understand the natural language command interface, read `aggregator/QUERY_PAGE_GUIDE.md`.
- If you need to clean the repo, follow `documents/REPOSITORY_HYGIENE_PLAN.md` and do the separation in phases instead of a single mass move.
- If a file looks like a log, queue payload, registry snapshot, generated pcode sidecar, mentor session, or temporary scratch output, assume it is not canonical source until proven otherwise.
