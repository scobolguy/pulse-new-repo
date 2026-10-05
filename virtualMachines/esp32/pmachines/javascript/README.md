# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

The interpreter currently delegates to the established Aggregator runtime while queue-manager and debug helper dependencies are separated. The opcode loader has already moved into this package; the old Aggregator module is a compatibility re-export. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.

## Standalone nodes

Run `start-js-pmachines.bat` from the workspace root to start `js-pmachine-01`,
`js-pmachine-02`, and `js-pmachine-03` on ports 4111, 4112, and 4113.
Each serves `/status` and announces to the Aggregator on startup and every
60 seconds. Nodes disappear from discovery after three minutes without a
heartbeat.

The default announcement backend is `http://127.0.0.1:4000`. Override it with
`--backend` or `JS_PMACHINE_BACKEND_URL`. For a remote backend, set
`--advertise-host` or `JS_PMACHINE_ADVERTISE_HOST` to an address reachable by
that backend (the default is `127.0.0.1`).

## Hosted Pascalish service and daemon

The JS PMachine now provides a bounded service host for the discovery split.
The request-handling policy is in
[`discovery-collector-service.pas`](../../artifactPrograms/discovery-collector-service.pas);
expiry maintenance is a separate
[`discovery-maintenance-daemon.pas`](../../artifactPrograms/discovery-maintenance-daemon.pas)
declared as `daemon 'discovery-maintenance' every 1 second`.
HTTP/UDP transport, monotonic timing, bounded storage and scheduling remain
native host responsibilities. This is the first JS implementation of the
ESP32-oriented model, not ESP32 firmware or a full Aggregator port.

Run from this package directory:

```powershell
$env:PULSE_DISCOVERY_COLLECTOR_ID = 'pascalish-collector-a'
$env:DISCOVERY_HTTP_PORT = '4300'
$env:UDP_PORT = '4210'
npm run discovery
```

The launcher binds to `0.0.0.0`; set `DISCOVERY_HOST` to restrict it. Use unique
collector IDs and distinct ports when running multiple instances on one PC.
Do not collide with a local Aggregator's UDP listener. In remote Aggregator mode,
add the collector's origin to `PULSE_DISCOVERY_COLLECTOR_URLS`.
See the [Aggregator discovery setup](../../aggregator/README.md#splitting-node-discovery-from-the-aggregator).
Endpoints use the existing unauthenticated trusted-network model; do not expose
them to untrusted networks.

### Lifecycle and limits

- Service invocations and daemon cycles run serially against shared host tables.
  Pascalish globals/locals are fresh for each invocation; persistent state belongs
  in the bounded tables, not program globals.
- Daemons execute once at startup and then on their declared schedule. Each cycle
  must finish. Missed ticks coalesce while a cycle is pending/running; they do not
  create an unlimited backlog. Schedule intervals must be constant, 10--180000 ms.
  Seconds and minutes are converted to milliseconds in hosted mode.
- Defaults: 255 entries per table, 4 tables, 16 pending invocations, 8 daemons,
  4096-byte incoming/normalized bodies, 128 KiB total serialized table payload
  plus keys, 256 KiB results/responses, 10000 instructions, 256 operand-stack
  slots, 32 call frames and 2000 ms per invocation. Serialized storage accounting
  is a payload budget, not a guarantee about JS heap usage.
- Hosted services may declare tables in Pascalish with `table nodes capacity 255;`.
  The declaration is carried in the program map and bounds that named host-backed
  RAM table; the ESP32 permits at most two declared tables with up to 255 entries
  each. Actual storage remains bounded by serialized storage and response limits.
  Observation expiry remains configured by the service host.
- `createPascalishServiceHost` accepts corresponding limit overrides
  (`maxEntries`, `maxTables`, `maxEvents`, `maxTimers`, `maxBodyBytes`,
  `maxStorageBytes`, `maxResponseBytes`, `maxSteps`, `maxExecutionMs`) and an
  injectable monotonic `clock`. Table capacity errors return 503; oversized bodies
  return 413; invalid announcements return 400. Runtime failures are explicit.
- Async injected bindings receive a final `{ signal }` context and must honour
  cancellation for their own I/O. A timed-out invocation cannot resume host-table
  mutations. Stopping cancels execution, drains rejected work, closes both
  transports and releases tables/timers. A stopped host cannot restart.
- Node deadlines are based on announcement ingress, not delayed queue execution.
  Nodes expire exactly at 180000 ms without a new announcement; polling never
  renews them. Snapshot sequence numbers increase within a unique boot ID.

### Host binding ABI v1

Compile with `compilePascalishProgramWithAntlr(source, { hostServices: true })`
to enable hosted service/daemon execution. Ordinary compilation remains unchanged.
Hosted artifacts carry `hostBindingsVersion: 1` and `targets: ['js', 'esp32']`.
The existing `CALL_EXT` opcode checks the allowlist, arity, argument types and
return types. No new opcode IDs are introduced.

The [contract](../shared/contracts/service-host-bindings.mjs) exposes:

| Binding group | Operations |
| --- | --- |
| Clock and event | `clock`, `event_body`, `event_peer`, `event_port`, `event_method`, `event_path`, `event_query` |
| Collector metadata | `collector_id`, `boot_id`, `next_sequence`, `observation_ttl` |
| JSON | `json_text`, `json_set`, `json_embed`, `json_merge` |
| Shared bounded tables | `table_get`, `table_put`, `table_expire`, `table_snapshot` |
| Transport | `http_status`, `udp_reply` |
| Injected announcement adapter | `announcement` |

All calls are qualified with `host.`. The adapter validates/normalizes wire
announcements; Pascalish selects accepted events, stable keys, the three-minute
lifetime and snapshot contents. The UDP adapter dispatches internally to the
service; `/events/*` is not accessible over HTTP. Beacons and availability
announcements get a targeted ACK; ACK/control packets are ignored, avoiding
reply loops.
`json_merge` shallow-merges two objects, with the new object's fields winning;
`table_get` returns `{}` for a missing/expired key without renewing it.

The standalone JS PMachine node also accepts signed hosted service artifacts
at `/pmachine/service_host/install`, reports them at
`/pmachine/service_host/status`, and stops them at
`/pmachine/service_host/stop`. Hosted HTTP routes share the node's configured
HTTP port; UDP binds the requested port (or an ephemeral port when `udpPort` is
`0`). Ordinary programs continue to run through `/pmachine/execute_file`.
`table_snapshot(name, cursor, limit)` returns a page with a stable exclusive
cursor, limited to five entries per call, and a `continuation` value of
`continue` or `end`. Pascalish uses these helpers to preserve previously
advertised capabilities when a later minimal beacon contains presence only.
`/health` is a service-liveness endpoint; scheduled daemon failures are
reported through host logs.

This collector advertises **presence and capabilities included in announcements**.
It does not yet fetch `/status`, request detailed firmware capabilities, or run
the native PC collector's enrichment probes. Minimal ESP32 beacons therefore
provide presence only; use complete availability announcements or the native
collector when placement requires enriched capabilities.

Pascalish supports `import dataTypes, schemas from data librarian;` to declare
read-only Data Librarian imports. Importing `dataTypes` makes the librarian's
data-type IDs available as Pascalish user-defined types, for example
`var paymentMessage: swift-mt103;`. `/api/develop/compile` resolves these
imports and their schema fields at compile time; the running collector does not
fetch catalogs. Dotted field paths on declared record variables can be read or
assigned, for example `paymentMessage.amount := 125;` and
`writeln(paymentMessage.amount);`. Imported schema field paths are checked
against the resolved Data Librarian definitions during compilation.

The [ESP32 host](../arduino/README.md#pascalish-discovery-service-host-esp32)
implements this ABI with smaller bounded storage, rollover-safe observation
deadlines, native UDP/HTTP and scheduled daemon execution. The same Pascalish
units remain service/daemon policy; install their signed artifacts explicitly.

Validate with `npm run test:service-host`. Tests create isolated real collectors
and a standalone JS PMachine on ephemeral ports, announce/discover it, upload and
execute the emit-proof artifact over HTTP, then destroy it and verify expiry.
They also cover dual-collector failover, UDP ACKs, scheduled expiry, ABI/limit
failures, startup/shutdown races and timeout cancellation. No existing node or
Windows service is restarted.
An additional test launches both CLI entry points as separate OS processes,
checks real announcements and program execution, then terminates both and
verifies their HTTP ports are no longer reachable.
The collector factory also accepts a test profile (`observationTtlMs`,
`announcementIntervalMs`). It rejects TTLs at or below the supplied heartbeat
interval or above three minutes. The default remains 180000 ms against a
60000 ms heartbeat; CLI/production settings are unchanged. Real-time UDP tests
use a 1500 ms TTL and 100 ms announcements, verify presence beyond one full TTL,
then stop announcements and verify expiry. Fake-clock tests still verify the
exact three-minute production boundary. The supplied interval must cover the
slowest announcing node when selecting a shortened profile.