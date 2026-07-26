# Pulse ESP32 Workspace

This workspace contains three distinct surfaces that are currently developed together:

- ESP32 firmware and runtime code in `src/`, `include/`, `libraries/`, and `scripts/`
- The Aggregator control plane, UI, DSL tooling, and local orchestration in `aggregator/`
- Design and handoff documentation in `documents/`, `RUNBOOK.md`, and this file

## Current Architecture

- Firmware/runtime:
  - Portable pcode runtime, ESP32 services, Federated File System support, and device HTTP routes
- Aggregator:
  - Backend orchestration on port `4000`
  - Broker on port `4001`
  - Queue manager on port `4100` with optional backup on `4101`
  - Frontend on port `5173`
- Shared development model:
  - DSL source and reference payloads live under `aggregator/data/`
  - Compiled or generated outputs are produced into `pcode/` and `aggregator/data/`
  - Runtime and operator state is also currently being written into `aggregator/data/` and the workspace root

## Clustering: Current Source Of Truth

Clustering is controlled by the Aggregator backend topology runtime routes, not by the batch files alone.

- Implementation:
  - `aggregator/src/backend/roles/topologyRuntimeRoutes.mjs`
- Local bootstrap scripts:
  - `start-cluster.bat`
  - `stop-cluster.bat`
  - `scripts/start-cluster.ps1`
- Persisted cluster and topology state:
  - `aggregator/data/cluster-registry.json`
  - `aggregator/data/site-registry.json`
  - `aggregator/data/node-topology-overrides.json`
  - `aggregator/data/node-rename-overrides.json`

### What The Cluster Runtime Does Today

- Maintains explicit clusters through `/api/clusters`
- Auto-manages three free pools:
  - `free-pool`
  - `free-pool-js`
  - `free-pool-esp`
- Assigns deterministic UDP parent/sibling port pairs per cluster, starting at `4200`
- Persists cluster membership and site metadata in JSON registry files
- Supports cluster lifecycle actions:
  - create/delete cluster
  - quiesce/start cluster
  - announce cluster members, services, and devices
  - deploy files/programs/services across cluster members

## Documentation To Read First

- `COMPLETION_SUMMARY.md`
- `RUNBOOK.md`
- `documents/FLOW_BUILD_HANDOFF.md`
- `documents/REPOSITORY_HYGIENE_PLAN.md`
- `aggregator/README.md`

## Natural Language Command Interface

The Aggregator backend exposes a natural language command interface via `/api/ollama/ask`. Deterministic commands (queue create, gateway bridge, project deploy, etc.) are resolved without LLM inference. See `aggregator/QUERY_PAGE_GUIDE.md` for the full command reference.

## Repository Hygiene: Current Reality

The workspace is mixing three file classes in the same directories:

- Hand-authored source and reference assets
- Generated build artifacts and compiled outputs
- Operational runtime state, logs, queue payloads, and experiment output

That is the main repository hygiene problem to fix for handoff. The concrete cleanup plan is documented in `documents/REPOSITORY_HYGIENE_PLAN.md`.

Additional operational directories that have grown since initial handoff:
- `aggregator/data/projects/` — project workspace artifacts (gateway/queue assignments, Pascalish/pcode)
- `aggregator/data/ollama-mentor-sessions/` — Ollama mentor loop session records
- `aggregator/data/ollama-mentor-candidates/` — raw Pascal candidate files from Ollama
- `aggregator/data/ollama-mentor-results/` — validation results
- `aggregator/data/ollama-copilot-escalations/` — escalation packets for human review

## Immediate Working Rules

- Treat `src/`, `include/`, `scripts/`, `documents/`, `aggregator/src/`, `aggregator/scripts/`, and `aggregator/tools/` as code and maintained documentation.
- Treat JSONL logs, queue message stores, cluster registries, FSM status files, `tmp-*` paths, `evolution-generation-*.json`, `aggregator/data/projects/`, and `aggregator/data/ollama-mentor-*` as operational or generated artifacts unless explicitly promoted.
- Treat `pcode/` as mixed-use today: it contains useful reference artifacts, but most `.pcode` and `.program.json` outputs are generated and should eventually move behind a cleaner artifact boundary.