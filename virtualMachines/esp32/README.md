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
If WiFi disconnects after startup, the firmware retries saved profiles every 15
seconds and returns to the `Pulse-<node-name>-Provision` access point after ten
failed reconnect attempts.

### ESP32 diagnostic snapshots

Per-operation `[ASYNC]` serial tracing is disabled by default in `esp32dev` and
its inherited profiles, including `esp32_s3_n16r8`. Boot and error messages remain
enabled. To investigate a reachable node, POST to `/ffs/diagnostics`. This returns
and saves a JSON snapshot (less than 2 KB) as `/diagnostics.json` in FFS. It includes
WiFi state, uptime, reset reason, free/minimum heap, largest free block, and a
compact hosted-runtime/discovery summary. No passwords or bearer tokens are included.
Failed hosted JSON parses and serializations still emit concise serial diagnostics:
the binding, input/output sizes, error or failure reason, overflow state, free heap,
and largest contiguous block. Successful operations remain quiet; JSON payloads are
not logged.

The ESP32 only sends its firmware beacon and answers node-details queries; it
does not track sibling nodes. The hosted runtime no longer sends a second beacon,
broadcasts `pulseDiscoveryRequest`, or maintains a discovered-aggregator table.
Instead, a firmware `nodeBeaconAck` carrying the aggregator's `nodeId` and
`httpPort` supplies one lifecycle-report destination, using the UDP sender's IP.
The aggregator must advertise its HTTP port in acknowledgements. Explicit
lifecycle report targets remain supported and override a learned target with the
same identity. Runtime diagnostics identify this mode as `lanDiscovery.policy:
"beacon-ack"`.

The hosted worker reserves a 12 KB managed VM string arena and a
1 KB host-result buffer before starting. JSON serialization reuses that result
buffer. Host-binding JSON documents share a reusable 4 KB parsing arena, reset
between bindings after their documents have been destroyed. Small parses, merges,
and updates use this arena rather than allocating document pools and strings on
the heap each time. Larger documents fall back to the normal allocator and retain
the existing explicit allocation-failure reporting. Other runtime allocations
still require free heap.
Buffer reservation failure explicitly prevents the hosted worker from starting.
JSON output up to 1 KB is serialized into a reusable `char` array using
ArduinoJson's bounds-checked advancing write pointer, then copied to the VM result
once. Larger output is sized once and written directly into the result's character
storage. Neither path serializes by repeated string concatenation.

The shared LAN discovery policy (used outside the ESP32 hosted runtime) also
avoids parse/serialize round trips for fixed
JSON literals, caches repeated field reads, and no longer copies a selected
listener through another JSON document. Runtime inputs still use validated loads,
and variable text still goes through the JSON setters for escaping. For the
representative ESP32 announcement in `discovery-json-work.test.mjs`, JSON binding
calls decrease from 58 to 40 and full-document rewrites from 19 to 16. Discovery
requests decrease from 27 to 20 calls and from 8 to 6 rewrites. These are algorithm
work counts, not measured heap savings or proof of hardware stability. No new
string-concatenation builder or p-machine ABI is introduced.

The native shared-policy wrapper also uses the indexed serializer for request bodies,
target snapshots and outgoing packets. It releases each request document before
executing pcode, and reuses the prepared host-result string for UDP packet output
after execution has completed. This avoids retaining the native request alongside
the VM's parsed copy or growing a fresh packet string character by character.
The response document is released before sending; the serialized packet owns its
bytes independently. The shared policy and wire format are unchanged. This wrapper is not run by the
ESP32, which learns its report destination from firmware beacon acknowledgements.

Hosted variable/call frames now use worker-owned fixed storage: 256 live slots
in total, up to 128 variables per frame, a 4096-byte copied-name arena (including
terminators), and 32 frames including the invocation root. Stores, parameter
binding and call/return do not allocate map nodes, argument vectors or duplicate
numeric name frames. Values retain their string handles and scalar types;
returning releases the local slots and name bytes, while caller bindings remain
live. Invocation reset reuses the same storage. Updating an existing variable
works even when the frame is full. Exhaustion stops the VM with a static error
message and PC, without constructing a C++ exception or allocating a flow-state
error entry; the service host reports the failure as HTTP 503. Other VM and
host-binding paths can still allocate and are not a whole-runtime memory limit.
Diagnostics include `lastInvocationVariables` slot, name-byte and depth peaks.

Hosted VM strings live in a handle-based managed heap
(`pmachines/arduino/src/managed_heap.h`). The VM holds 16-bit handles, never raw
pointers into the arena, so blocks can move. Unreachable handles (not on the
stack or in a frame slot) are swept every 64 allocations or when the arena tail
is too small. Allocation compacts by sliding unpinned blocks down; pinned blocks
stay in place for native borrowers. As a last resort the least recently used
unpinned blocks are evicted to a backing store and paged back in on access:
PSRAM (256 KB budget) when present, otherwise `/pmachine-swap.bin` in FFS
(32 KB budget, opened on first eviction only if a 4 KB block is free). Strings
over 8 KB, 256 live handles, or exhausted arena plus swap stop the VM with a
static error, reported as HTTP 503. The library does not allocate from the
system heap, except for opening the swap file or allocating PSRAM swap blocks.
It cannot compact the general ESP32 heap used by AsyncTCP, ArduinoJson
fallbacks, or other native code. Diagnostics include `lastInvocationStrings`:
arena use, live and peak handles and bytes, compactions, swap-outs/ins,
failures, and the backing name. The hosted service reads flow state by
reference and moves `__response` out, rather than copying the flow-state map
after each invocation.

Run the production storage on a desktop with allocations forbidden:

```powershell
node --test testing\pmachines\hosted-frame-storage.test.mjs
node --test testing\pmachines\discovery-json-work.test.mjs
```

The test exercises exact limits, shadowing, typed values, string-handle liveness,
frame reclamation and 1000 repeated invocations. It also runs the managed heap
tests: compaction, pinning, PSRAM-style and file-style swap with page-in, swap
budget exhaustion and handle sweeping. This detects allocation churn
even on a machine with abundant RAM. The JS discovery regression also executes
advertisements repeatedly under a 32 KB tracked VM budget and checks cleanup
after deliberately denying a 64-byte budget. This budget covers currently tracked
VM slots and values, not all host JSON allocations or process memory.
JS memory-budget tests catch logical budget overruns, but V8 garbage collection
does not model the ESP32 heap.
Desktop C++ has no garbage collector; its larger heap can hide fragmentation
and exhaustion. Neither these component tests nor policy parity tests replace
hardware soak testing with HTTP/HTTPS, WiFi and discovery active.

The runtime summary reports `busy: true` rather than waiting for an active worker;
request another snapshot to collect its details. JSON counters describe the last
hosted invocation, not lifetime totals. Errors and service identifiers are truncated
to keep the snapshot bounded. Memory readings are taken before snapshot allocation.

```powershell
Invoke-RestMethod -Method Post -Uri "http://<node-ip>/ffs/diagnostics"
Invoke-RestMethod -Uri "http://<node-ip>/ffs/get?file=/diagnostics.json"
```

The saved file can also be retrieved using the existing FFS chunk/federation APIs.
Snapshots are written only on request, not per JSON operation or on a background
timer. The saved snapshot survives reboot but may be stale; check `uptimeMs`.
If the node is unreachable over both LAN and its provisioning AP, use serial boot
output instead. For temporary detailed tracing, add `-DPULSE_ASYNC_DIAGNOSTICS`
to the selected environment's `build_flags` and rebuild.

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