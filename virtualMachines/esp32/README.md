# Pulse ESP32 Workspace

This workspace contains three distinct surfaces that are currently developed together:

- ESP32 firmware and runtime code in `src/`, `include/`, `libraries/`, and `scripts/`
- The Aggregator control plane, UI, DSL tooling, and local orchestration in `aggregator/`
- Design and handoff documentation in `documents/`, `RUNBOOK.md`, and this file

## Standalone ESP32-S3-N16R8 Firmware

Use the `esp32_s3_n16r8` environment in [platformio.ini](platformio.ini) for a
standalone ESP32-S3 development board with 16 MB flash and 8 MB octal PSRAM.
This profile inherits the general-purpose firmware without enabling a display.
The `esp32_jc4827e543` profile is for a display board, not a standalone N16R8 module.

In PlatformIO Project Tasks, select `esp32_s3_n16r8` > General > Upload.
Select the board's current serial port; it may change when entering download mode.
The inherited `huge_app.csv` partition layout uses only part of the 16 MB flash.
On first boot, missing saved configuration files or NVS namespaces can indicate
unprovisioned settings. Repeated watchdog resets are not normal first-boot behavior.

## Rebuilding Generated Files

Source-only checkpoints do not include local parser output, extension output,
VSIX packages, build caches, or runtime/device state. After checking out changes
to the DSL grammars, regenerate the JavaScript parsers before running compiler
tests or starting the Aggregator. This requires Java and the ANTLR 4.13.2 JAR at
`aggregator/tools/antlr-4.13.2-complete.jar`.

From this workspace directory, with the declared Node dependencies installed:

```powershell
Push-Location aggregator
npm run antlr:generate
Pop-Location
Push-Location extensions\pulse-pmachine-debugger
npm run compile
Pop-Location
```

Use Python 3.12 for PlatformIO builds on this Windows development machine:

```powershell
py -3.12 -m platformio run -e esp32_s3_n16r8
```

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

## Repository Hygiene: Current Reality

The workspace is mixing three file classes in the same directories:

- Hand-authored source and reference assets
- Generated build artifacts and compiled outputs
- Operational runtime state, logs, queue payloads, and experiment output

That is the main repository hygiene problem to fix for handoff. The concrete cleanup plan is documented in `documents/REPOSITORY_HYGIENE_PLAN.md`.

## Immediate Working Rules

- Treat `src/`, `include/`, `scripts/`, `documents/`, `aggregator/src/`, `aggregator/scripts/`, and `aggregator/tools/` as code and maintained documentation.
- Treat JSONL logs, queue message stores, cluster registries, FSM status files, `tmp-*` paths, and `evolution-generation-*.json` as operational or generated artifacts unless explicitly promoted.
- Treat `pcode/` as mixed-use today: it contains useful reference artifacts, but most `.pcode` and `.program.json` outputs are generated and should eventually move behind a cleaner artifact boundary.