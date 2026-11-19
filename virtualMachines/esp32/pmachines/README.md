# PMachines

This directory is the future source of truth for reusable PMachine runtimes.

- `arduino/` will provide the portable C++ runtime as a PlatformIO-compatible local library plus ESP32 integration adapters.
- `javascript/` will provide the JavaScript runtime, CLI, and backend integration exports as a workspace package.
- `shared/` will contain the one canonical opcode contract and deliberately shared PMachine fixtures.

The existing firmware and Aggregator locations remain authoritative until each runtime is migrated and its conformance checks pass.

The JavaScript runtime is now implemented at `pmachines/javascript/src/runtime.mjs`. The legacy `aggregator/scripts/run-js-pmachine.mjs` path remains as a compatibility wrapper, while tracing is injectable and the Aggregator queue manager is loaded only for polling mode. Direct backend consumers use the package façade.

## Runtime profiles and placement

Hosted service runtimes expose `GET /pmachine/runtime/profile`. The same
profile is included in service-host status responses and, for ESP32 nodes, in
node-announcement details. The versioned profile reports the target/runtime,
shared contract versions, supported host capabilities, task capabilities,
execution model/concurrency, configured limits, and available resource data.

All targets use the same service-host binding contract, host-capability
contract, and runtime-profile schema versions. Individual capabilities and
resource limits remain target-specific:

| Target | XML support | Execution | Placement notes |
| --- | --- | --- | --- |
| JavaScript | `xml.dom`, `xml.stream` | Event loop; may use cooperative program scheduling | Configured request/response, event, and scheduler limits are reported. |
| Native C++ | `xml.stream` | Serial | Optional filesystem capabilities depend on granted storage roots; request/response limits are 20,000,000 bytes. |
| ESP32 | No XML host capability | Single worker | Reports request/response, service/event capacity, and current heap/swap resource data; advertises `pascalish-dag-v1` when acting as a DAG worker. |

JavaScript and native C++ run the shared P-code engine for the
[SORT-style Cobolish PARSE statement](../../../languages/cobolish85/README.md#sort-style-xml-parse).
Its explicit Librarian schema and mapper sources are resolved per batch and
compiled into cached validation/mapping plans by P-code; changing either
source invalidates dependent plans. XML/JSON parsing, serialization, validation,
mapping and cache decisions do not use host parser bindings. Deployment
requires raw `artifact.read`, filesystem grants as needed, and `broker.publish`
for native queue output. These grants are advertised only when configured.
ESP32 does not yet support this desktop whole-batch contract.

Program maps declare their host-binding and host-capability contract versions
and required host capabilities. The compiler derives capability requirements
from host bindings. Deployment preflight and DAG worker selection compare those
requirements with the advertised profile; a missing or incompatible profile is
not eligible for work. Schedulers should use the profile for placement, not
assume that matching contract versions imply identical performance or complete
feature parity.

The profile is intentionally a capability and resource declaration, not a
proof that every opcode or binding has identical semantics across runtimes.
Shared conformance tests remain necessary as implementations evolve.

## Local boot supervisor

ESP32 PMachine builds mount LittleFS without automatic formatting, then execute
`/boot/pmachine-boot` locally. The source is
[`boot-supervisor.kt`](../src/boot/boot-supervisor.kt), compiled with Pulse Kotlin.
Rebuild the shipped artifact with
`node languages/kotlin/scripts/build-boot-supervisor.mjs` from the repository root.
The provisioning page and the boot program must both be installed locally.
Legacy profiles use the ordinary LittleFS image; A/B OTA profiles use a separate
boot filesystem and leave mutable node settings in the ordinary LittleFS partition.

The supervisor runs a bounded tick approximately every 100 ms. Its P-code owns
profile selection, connection deadlines, backoff, provisioning AP transitions,
and FFS backend selection. Native bindings expose a single asynchronous Wi-Fi
attempt, AP hardware operations, a monotonic clock, volatile integer slots, and
individual FFS backend initialization operations. These privileged bindings are
not supplied to ordinary hosted services.

The native runner retains the parsed instruction vector rather than copying it
into small deque allocations. On PSRAM-enabled ESP32 profiles this lets the
large instruction buffer use external memory, preserving internal SRAM for
network tasks. Wi-Fi profiles are reloaded when credential storage changes,
not decrypted or probed on every supervisor tick.

No SD, remote FFS, Aggregator, or dynamically downloaded library is needed to
start the supervisor or serve the local provisioning page. FFS initialization
is rejected until Wi-Fi is connected. Persisted FFS services are restored only
after storage becomes available. A configured remote FFS endpoint is retried
without silently switching the node's backing store.

A locally functioning provisioning AP is a healthy offline boot. Wi-Fi loss
does not erase credentials. Corrupt or missing boot files are explicit startup
failures, not an instruction to format flash. Recovery when all local boot
copies or the mutable filesystem are damaged requires a wired reflash.

Run the boot policy simulations and the actual Arduino C++ VM regression from
the repository root:

```powershell
node --test virtualMachines\esp32\testing\pmachines\boot-supervisor.test.mjs virtualMachines\esp32\testing\pmachines\boot-supervisor-native.test.mjs virtualMachines\esp32\testing\pmachines\boot-recovery.test.mjs
```

The native regression requires a C++17 `g++` compiler (or `CXX`) and simulates
hardware; it does not replace on-device Wi-Fi or flash power-cut testing.
See [ESP32 OTA operations](../documentation/operations/ESP32_OTA.md) for image
layouts, signing, first installation, and rollback prerequisites.