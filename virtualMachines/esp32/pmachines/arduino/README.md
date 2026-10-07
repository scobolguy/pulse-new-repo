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

The `esp32dev` profile enables this runtime and discovers it through `lib_extra_dirs = pmachines`. Build it with `pio run -e esp32dev`; upload firmware only after a successful build. Do not upload a filesystem image when preserving the board's existing configuration and programs.

Bluetooth control-plane support is disabled in `esp32dev` to leave heap available for the HTTP routes and hosted services. Serial provisioning remains available. Firmware uploads also write the partition table: preserving filesystem contents requires matching the layout already installed on the board.

## Pascalish legacy Kasa service

The protocol implementation is [kasa-legacy-service.pas](../../src/kasa-legacy-service.pas).
It constructs Kasa JSON commands, performs the rolling XOR cipher (initial key
171), constructs the four-byte big-endian TCP request header, decrypts replies,
checks device errors, and maintains discovered device observations. No Python
bridge or JavaScript Kasa driver is involved. Generic host bindings provide
hex-encoded bytes, byte XOR, JSON access, and bounded socket exchanges.

Run these commands from the ESP32 project directory:

```powershell
node --test testing\pmachines\kasa-legacy-service.test.mjs
node testing\pmachines\run-kasa-service.mjs --target js --devices 192.168.2.28,192.168.2.29 --check
```

After building/uploading the updated `esp32dev` firmware, install the service:

```powershell
node testing\pmachines\run-kasa-service.mjs --target esp32 --esp32 http://192.168.2.115 --devices 192.168.2.28,192.168.2.29
```

Installation writes four signed service/daemon artifacts through FFS. It refuses
to replace an already-running Kasa installation; the ESP32 host supports up to
two installed service/daemon pairs. Installation is not automatic after a reboot: rerun the
installer to reload the persisted artifacts. No filesystem image upload is needed.
The installer performs only read-only status and discovery requests.

### ESP32 execution ownership

The Pascalish service host has one persistent 16 KB worker task. Only this task
runs the hosted interpreter, for HTTP events, UDP events and daemon ticks.
HTTP callbacks enqueue work and attach a deferred response; the web-server
task polls completion and sends the original HTTP status/body asynchronously.
The worker never retains an HTTP request pointer.
Deferred responses send at most 256 bytes per acknowledgement-paced write,
referencing their retained event body instead of allocating a combined transmit
buffer. Dynamic POST storage is sized to the received body rather than always
allocating the full 2048-byte limit; allocation failure returns HTTP 503.

Three bounded HTTP slots cover queued, running and undelivered completed
responses. Full ingress returns HTTP 429; stopped/unavailable ingress returns
503. Bodies and serialized queries are limited to 2048 bytes each.
These limits apply after TCP acceptance. Hardware testing with six simultaneous
new connections still triggers an uncaught allocation exception in AsyncTCP's
connection-accept handler under fragmented heap, resetting the board before
ingress can reject excess work. Full multi-service load verification remains
blocked by that transport failure.
HTTP events have a 12-second deadline; expired queued work is not executed.
Disconnecting skips work that has not started. An already-started action may
finish even if the caller disconnects or receives a 504, so do not blindly retry
relay actions. Response state is retained safely until both tasks release it.

The worker processes at most one HTTP event, then gives one installed service
a background turn (one UDP datagram and one due daemon tick). Background turns
alternate between services; missed ticks are coalesced. Network waits still yield
to the system tasks, but a slow exchange delays both hosted services.
Each service owns its tables, image caches, UDP socket, collector/boot identity,
sequence, daemon deadline, network allowlist, error state and counters. The
interpreter, network scratch and byte-buffer backing store remain shared.
Stop refuses while execution owns the host; otherwise it rejects queued work
for the selected installation, retaining the idle worker for reuse.
`POST /pmachine/service_host/stop?collectorId=<id>` stops only that service;
without the selector it stops all services, preserving the original behavior.
Status is nonblocking and may return 503/busy during execution; idle status
exposes `executionModel`, `httpEventCapacity`, `pendingHttpEvents`,
`serviceCapacity`, `serviceCount`, `workerTaskCount` and a `services` array.
Legacy top-level fields describe the first occupied slot, or the service
selected by `GET /pmachine/service_host/status?collectorId=<id>`.
The unselected response's `services` array contains compact identities, image and
invocation counters. With one service, full legacy network/JSON metrics appear for
the primary service; with two, the overview includes compact network counters instead.
A `collectorId`-selected response omits the array and returns that service's
compact counters, last error and allowed-peer count. Status responses own the
serialized text in 256-byte chunks, releasing the contiguous serialization buffer
before transmission. One chunk is queued at a time, advancing only after ACKs,
without a combined header/body allocation.
AsyncTCP queues stable references rather than copied transmit buffers; both
header and body storage are retained until acknowledgement or disconnection.
This consolidation does not change the separate legacy execution, debugger or
gateway workers, or the JavaScript host.

Compact signed-image metadata retains each endpoint's exact `verb` and `path`.
Distinct GET/POST `/api/...` routes dispatch to their owning service; POST bodies
must be valid JSON and no larger than 2048 bytes. Use vendor-specific paths that
do not overlap firmware management routes. Duplicate collector IDs, UDP ports
and hosted HTTP routes are rejected with HTTP 409, as is a third installation.
`/health` may be shared (the first occupied slot handles it); `/events/udp`
is dispatched by each service's own UDP socket rather than a dynamic HTTP route.
An older image without endpoint metadata remains usable alone, but cannot share
the host with another installation. Rejected image loads or installations leave
existing services running.

### Shared context with multiple daemons

POST /pmachine/service_host/install also accepts daemons (instead of
daemonFile/daemonMap): a JSON array (<= 1024 bytes) of 1..2
{"file","map","udpPort"?} entries. All daemons share the service's context,
typed caches, collector identity and network allowlist; each keeps its own refresh
schedule (intervalMs from its image), counters and optional owned UDP port
(udpPort 0/absent = none; the service UDP port may be 0 in this mode). UDP ports
are checked for conflicts across all contexts. The legacy single-daemon parameters
and the two-context limit are unchanged.
The worker serializes everything: each background turn handles the service UDP
socket or one daemon (UDP datagram first, otherwise a due tick), round-robin.
Daemon datagrams above 1024 bytes are dropped (droppedDatagrams). If the largest
free heap block is below 8 KB they are shed (shedDatagrams). Failed daemon runs,
including the startup run, increment ailures and set lastError without stopping
the context. Status (?collectorId=) reports a daemons array with
index, intervalMs, udpPort, timerRuns, udpEvents, failures, droppedDatagrams,
shedDatagrams, lastError, instructionCount.

Hosted string pool: buffers grow by doubling to 512 bytes, then in 512-byte steps.
Dead buffers of 512 bytes or more that are smaller than a new request are released
before allocating, and a failed reserve releases every dead buffer and retries once.
Even so, growing one response body through repeated JSON rewrites fragments the heap.
Keep response bodies to about 1 KB or less; use cursor-paged endpoints for lists.
See pmachines\shared\contracts\host-cache.md for the shared Kasa/Tuya device
cache, its paged GET /api/devices/names endpoint and the hardware proof
	esting\pmachines\verify-esp32-shared-device-cache.mjs.

After installing Kasa, run the harmless two-service hardware probe:

```powershell
node --test testing\pmachines\multi-service-probe.test.mjs
node testing\pmachines\verify-esp32-multi-service.mjs http://192.168.2.115
```

The probe exercises isolated tables and permissions, UDP replies, both daemon
schedules, a shared bounded HTTP queue, failed/duplicate/over-capacity installs,
and selective stop/reinstall. It makes six read-only Kasa requests across roughly
two minutes, removes only its temporary service/artifacts, and leaves Kasa running.
The second service is a test fixture, not a Tuya protocol implementation.

Endpoints:

- `GET /api/kasa/status?ip=<allowed IPv4>`: TCP status with a compact device
  descriptor plus `relay_state`, in the existing status/protocol/IP envelope.
- `GET /api/kasa/discover?ip=<allowed IPv4>`: unicast UDP discovery returning
  only `{"deviceName":"Bedroom","ipAddress":"192.168.2.28","deviceType":"wallSwitch"}`.
- `GET /api/kasa/devices?cursor=<optional cursor>`: paginated observed devices.
- `POST /api/kasa/action`, JSON `{"ip":"192.168.2.28","action":"on"}`:
  `status`, `on`, `off`, or `toggle`. Relay actions affect real devices.

This first version targets legacy HS200-style devices on port 9999. It does not
implement broadcast scanning or newer authenticated Kasa/Tapo protocols.
Stored observations and each device-list node contain exactly the same three
vendor-neutral fields as discovery. Pagination retains `nodes`, `continuation`
and `nextCursor`; expiry still applies, but TTL metadata is not exposed.
The generic `host.table_snapshot_values` binding omits TTL metadata without
changing `host.table_snapshot` for existing services.
HS2/KS2 model families are `wallSwitch`; HS1/KP1/KP4/EP1/EP2/EP4 are `smartPlug`.
Unrecognized families are explicitly `unknown`, not guessed. These fields are
intended for other vendors such as Tuya too; no Tuya protocol is implemented.
The Data Librarian contract is
[`device-descriptor.v1.json-schema`](../../aggregator/data/services/librarian/schemas/device-descriptor.v1.json-schema),
type ID `device-descriptor`, canonical ID `type:device-descriptor`. It requires
the three fields, accepts literal IPv4 addresses and rejects extra properties.
Register it in an existing operational Librarian without overwriting a
different v1 contract (run from the ESP32 project directory):

```powershell
node aggregator\scripts\register-device-descriptor.mjs http://127.0.0.1:4300
node --test aggregator\scripts\test-device-descriptor.mjs
```

The schema appears in the catalog and exposes the three Pascalish field paths.
The repository catalog includes the type; operational catalogs use the
registration command above. Schema/version metadata stays in the Librarian,
not in each device's compact wire message.
MAC, firmware, hardware IDs, coordinates and other vendor details are no longer
returned or stored on successful reads. Raw Kasa replies still need to be
received/decrypted before projection, so this does not shorten network waits.
Network access is disabled by default; installation explicitly allowlists up to
eight IPv4/port pairs. Exchanges allow at most 4096 bytes and 2000 ms, with Kasa
using 2048-byte replies and 1500 ms. TCP receives a configurable 1-4-byte
big-endian length-prefixed frame; UDP accepts only the selected peer's reply.
Passive Tuya discovery is implemented in `src/tuya-discovery-service.pas`.
Install it in a free hosted-service slot with
`node testing\pmachines\run-tuya-discovery.mjs http://192.168.2.115`.
Use `--observe-only` to recheck an installed service without overwriting its
open images, and `--report <path>` to save hardware observations.
It listens on UDP 6667, checks 55AA frame lengths/CRC or 6699 GCM authentication,
and stores up to 16 observations with three-minute expiry and two-entry pagination
at `/api/tuya/devices`. Labels are `Tuya <last-six-ID-characters>`; IPs come from
the datagram source, not the advertised JSON. No TCP connection, status query,
UDP reply or control command is sent. The public discovery key is not a device
local key. Unencrypted UDP 6666 and active discovery on UDP 7000 are not supported.
The host adds generic `event_bytes` (lossless event-body hex), `bytes_crc32`
(IEEE CRC-32 as eight big-endian hex digits), `bytes_aes_ecb_decrypt`
(ciphertext/key hex, AES-128 with checked PKCS#7 padding), and
`bytes_aes_gcm_decrypt` (ciphertext/key/12-byte-nonce/AAD/16-byte-tag hex).
Decryption returns hex bytes and fails explicitly for malformed input or failed
authentication; Tuya framing and observation logic remain Pascalish.
Hosted programs are bounded to 100000 executed instructions and eight seconds
per invocation to allow byte-by-byte Pascalish decoding and bounded network
waits. ESP32 hosted instructions use segmented storage to avoid requiring one
large contiguous heap block for the legacy text loader. The Kasa installer now
uploads a signed PHI1 executable image instead: resolved 12-byte instruction
records and a deduplicated UTF-8 constant pool. The transport-safe hex image
is uploaded through `POST /ffs/upload_stream?file=<path>` with content type
`application/octet-stream`, a known nonzero content length and a 32768-byte
maximum. This streams directly to local FFS storage rather than buffering
large form values. Interrupted uploads may leave an incomplete file, which
cannot pass the signed-image install checks.
The worker's 16 KB stack is reserved before artifact
loading. Four small service/daemon image control objects are statically reserved
for the two-service ceiling. Each preallocates four separate 512-byte FFS cache
pages at image load, plus only the hashes required by its file (maximum 64 pages),
not a fully decoded instruction array or one large contiguous image-cache block.
A shared-ownership lease returns a slot after a failed installation or stop,
closing its file, invalidating the old cache and releasing page/hash allocations.
Instruction reads do not grow the cache. Ownership, metadata, constant decoding
and runtime JSON allocations still remain.
The `esp32dev` build uses 32-slot ArduinoJson pools instead of the 128-slot default,
reducing each contiguous pool allocation without changing JSON field/value limits.
This applies consistently to the entire profile to preserve ArduinoJson ABI
compatibility. Host status reserves its measured output size before serialization.
Signatures are checked by streaming the file; cache refills verify page hashes
to reject changed or unreadable storage rather than execute replacement bytes.
The open image must remain on local FFS storage for the service's lifetime.
Status exposes instruction page reads, cache hits, heap and worker stack
headroom. This does not turn the separate program-image paging API into a
disk-backed executor, and does not eliminate runtime JSON/socket allocations.
With no host running, exercise image validation and paging on hardware with
`node testing\pmachines\verify-esp32-hosted-image.mjs http://192.168.2.115`.
Add `--single-worker` to also test concurrent requests, queue overflow,
web-server responsiveness and cancellation before execution.
The hardware probe and Kasa installer use a 60-second HTTP deadline, including
connection establishment; override it with `--timeout-ms <milliseconds>`.
This does not change the firmware's network or invocation deadlines.
Streaming FFS uploads also allow 60 seconds of receive inactivity instead of
the web server's 3-second default; the 32 KiB upload limit is unchanged.
The `esp32dev` profile enables `PULSE_ASYNC_DIAGNOSTICS` serial traces for FFS
upload chunks, completion/disconnect, HTTP queueing, worker execution, and
deferred response polling/sending. Traces include elapsed time and free heap,
but not request bodies or Kasa replies. Remove the build flag to disable them.
Network traces identify connect, write, frame-prefix/body, and UDP receive
phases, with request/reply byte counts, advertised frame length, elapsed
time versus the existing whole-exchange deadline, Wi-Fi status and RSSI.
JSON traces report parse errors/overflow, measure/write times in microseconds,
output capacity growth, largest free heap block and per-HTTP totals.
Status retains `network` exchange counters/last result and `lastHttpJson`
totals even when serial traces are disabled; daemon ticks do not overwrite the
last HTTP JSON totals. Diagnostic printing itself adds latency, so compare
with traces disabled before drawing performance conclusions.
Hosted allocation failure logs include the current instruction PC, allocation
stage and requested/estimated byte count. Stages distinguish instruction fetch,
host argument copying/vector growth, binding execution and VM string storage.
The binding name is the last entered binding, not necessarily the failing one
when argument construction fails before entry; byte counts are estimates for
container growth and zero for allocations inside a binding.
Host argument-vector storage and the host result buffer are reused within each
invocation. Clearing values retains string capacity, so bytewise cipher calls
do not repeatedly allocate the same argument/result buffers. Argument strings
still copy VM values; this preserves the owning host ABI and avoids references
escaping into reclaimed VM storage. Buffers remain invocation-local and are
released when execution ends; this is not allocation-free execution.
The Kasa cipher now uses a host-backed byte-buffer object: `buffer_create(capacity)`
returns an integer handle, and `buffer_append(handle, byte)` writes in place and
returns that handle without growing VM strings. `buffer_hex(handle)` converts
encrypted bytes to the existing hex socket ABI; `buffer_text(handle)` validates
UTF-8 and copies plaintext once into an ordinary VM string. Both conversions
consume the handle after success. `buffer_release(handle)` explicitly discards
it. One buffer is allowed per invocation, capacity 0..4096; invalid handles,
invalid bytes, overflow and invalid UTF-8 are explicit errors. ESP32 owns a fixed
4096-byte backing array; JS uses one bounded Buffer per invocation. Invocation
completion/failure releases the object. Cipher/framing logic remains Pascalish.
The final conversion and VM result storage can still allocate, but bytewise
append no longer allocates a growing string on each iteration.
Discovery UDP sends (`nodeBeacon`, replies/details and broker discovery) label
failures with the send phase, destination, byte counts, captured errno, heap,
largest free block and Wi-Fi state. ESP32 errno 12 is `ENOMEM`; it reports a
socket/network resource failure, not proof that JSON serialization failed.
Outgoing node/broker discovery beacons wait for a nonblocking five-second
warm-up after firmware setup completes and after a detected Wi-Fi disconnect/
reconnect. Serial output marks warm-up start/completion. HTTP, incoming
discovery replies and the Pascalish worker are not delayed. Existing beacon
intervals apply afterward; failed sends do not report successful delivery.

Parent/sibling discovery sockets are best-effort: application packets larger
than 1024 bytes, or received with less than 32768 bytes free heap or an 8192-byte
largest free block, are discarded before copying/parsing. Reception uses one
fixed 1025-byte buffer instead of bytewise String growth. The cap is below the
Arduino ESP32 UDP driver's 1460-byte receive/truncation limit; the driver still
allocates internally before the application admission check. Short reads and
String/JSON allocation failures also drop the packet. `/status` exposes
boot-lifetime `udpIngress` counters by reason and actual `boundParentPort`/
`boundSiblingPort` (which can differ from configured cluster ports); drop logs are limited to one per
five seconds to avoid making congestion worse. Each loop still processes at
most one packet per discovery socket. These sockets also carry node ACK/details
and alert notifications, which are therefore best-effort under pressure.
Requested Kasa TCP/UDP exchanges, HTTP requests and relay actions are unchanged
and retain explicit success/error handling. The current Kasa service performs
unicast discovery on request; it is not yet a passive broadcast listener.
Multiple future listeners improve coverage, not guaranteed delivery; observation
expiry must still remove devices that have not been seen recently.

Run the non-mutating UDP admission hardware probe against both bound discovery
sockets (it sends only unknown probe messages, not device or relay commands):

```powershell
node testing\pmachines\verify-esp32-udp-ingress.mjs http://192.168.2.115
```

Network request decoding and raw reply reception share a fixed 4100-byte
scratch array owned by the serialized service worker (4096-byte limit plus
up to four TCP framing bytes). No pointer into that array escapes a call.
Hex results, VM strings, JSON documents and deferred HTTP response bodies
still allocate; this is not an allocation-free runtime. A shared response
buffer would be unsafe while multiple deferred responses remain in flight.
The probe stops itself and deletes only its temporary artifacts; install Kasa
afterward using the command above.
Hosted string storage reclaims unreachable
temporaries and reuses geometrically sized buffers while retaining the
512-handle and 32768-byte storage limits. Hosted invocations do not collect
per-instruction diagnostic traces unless debugging is enabled, avoiding trace
allocations in production cipher loops. Generic hex-byte indexing and length
operations validate without allocating decoded copies.
Treat these unauthenticated relay endpoints as trusted-LAN
interfaces; do not expose them to the Internet.