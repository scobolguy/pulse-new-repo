# Arduino PMachine

This directory is the PlatformIO-compatible local library for the reusable C++ PMachine runtime.

The library implementation lives in `src/`:

- `pmachine.{h,cpp}` is the interpreter core and public runtime API.
- `pmachine_scheduler.{h,cpp}` provides PMachine scheduling.
- `pmachine_dynamic_library.{h,cpp}` provides runtime symbol resolution.
- `pmachine_opcodes_extended.{h,cpp}` provides extended opcode behavior.
- `pmachine_routes.{h,cpp}` adapts the runtime to ESP32 HTTP and Federated File System services.

`main.cpp` stays firmware-owned. It includes the PMachine headers only when `ENABLE_PMACHINE` is enabled. PlatformIO discovers this local library through `lib_extra_dirs = pmachines`, while firmware-owned headers remain available through the shared `-I src` flag.

Standalone scheduler and dynamic-library C++ tests are already consolidated under `../../testing/pmachines/`.

Run `npm run test:pmachine:arduino-layout` before and after that migration slice.

## Pascalish discovery service host (ESP32)

With `ENABLE_PMACHINE`, `service_host.{h,cpp}` provides host binding ABI v1 on a
separate interpreter and FreeRTOS worker. Normal PMachine programs and legacy
external thunks retain their existing path. Compile the shared
`artifactPrograms/discovery-collector-service.pas` and
`artifactPrograms/discovery-maintenance-daemon.pas` with `hostServices: true`,
sign their program maps with the existing pcode-signing helper, and upload all
four artifacts through FFS.

POST form parameters to `/pmachine/service_host/install`:

- `serviceFile`, `serviceMap`, `daemonFile`, `daemonMap`: FFS artifact paths.
- `collectorId`: unique stable identity for this collector.
- `udpPort`: default 4210; do not share it with another listener.
- `observationTtlMs`: default 180000, maximum 180000.
- `announcementIntervalMs`: default 60000; TTL must exceed the slowest node's
  announcement interval.

Both signatures, the ABI version, ESP32 target, local branch targets, host arities
and a nonblocking opcode allowlist are checked before installation. Network
dispatch is serialized; busy requests fail with 503 rather than growing a queue.
HTTP endpoints are `/api/pmachine/announce` (JSON POST),
`/api/discovery/snapshot` and `/health`. Snapshot pages contain up to five
nodes; request the next page with its opaque `cursor` query value and follow
`continuation` until it is `end`. UDP events stay internal.
The daemon runs immediately and periodically, coalescing missed ticks.
Hosted tables are declared in Pascalish (for example, `table nodes capacity 255;`)
and included in the signed program map. Their entries are held in bounded RAM;
the ESP32 supports at most two declared tables with up to 255 entries each,
subject to the 16 KiB shared serialized-storage and 20 KiB response limits.
Observation TTL is supplied by the service host installation.

ESP32 bounds are intentionally smaller than the JS host: two tables, 255 declared
entries per table, 16 KiB serialized shared storage, 2 KiB announcements, 20 KiB responses,
512 instructions per artifact, 10000 executed steps, 256 operands, 32 call frames,
32 KiB run-local strings and 500 ms per invocation. Unsupported opcodes, overflow,
invalid JSON and failed network replies fail explicitly. Observation deadlines
use the 64-bit monotonic ESP timer, so they survive `millis()` rollover.
The integer `host.clock` binding reports an explicit exhaustion error after
INT32_MAX milliseconds; collector expiry itself does not use that binding.

GET `/pmachine/service_host/status` reports running state, bounds-related errors
and stored entry count. POST `/pmachine/service_host/stop` releases the worker,
UDP socket and shared tables; reinstall generates a fresh boot ID. Installation
is currently volatile: artifacts remain in FFS, but reboot requires reinstalling
the signed units. HTTP uses the firmware's existing server/port.
Advertised capabilities are retained; native enrichment probes are not added.

The destructive-to-test-state hardware test is explicitly opt-in. With no host
already installed, run from the ESP32 project directory:

```powershell
$env:PULSE_ESP32_TEST_URL = 'http://192.168.2.115'
node testing\pmachines\verify-esp32-service-host.mjs
```

It installs signed units with a 2000 ms TTL / 200 ms UDP heartbeat, checks HTTP,
targeted ACKs, repeated presence, daemon-driven expiry without polling, and remote
Aggregator ingestion. It stops the host and deletes only its uniquely named
test artifacts afterwards. To run production discovery, install again with the
default three-minute TTL and appropriate node heartbeat interval.

The production installer compiles/signs/uploads the shared units and leaves the
collector running with the default TTL (refuses to overwrite an active host):

```powershell
node pmachines\arduino\install-discovery-collector.mjs http://192.168.2.115
```

It uses `PULSE_DISCOVERY_COLLECTOR_ID` and `UDP_PORT` when supplied. Signing uses
the repository helper and its existing signing environment variables. Uploaded
production artifacts are retained for reinstall after reboot.