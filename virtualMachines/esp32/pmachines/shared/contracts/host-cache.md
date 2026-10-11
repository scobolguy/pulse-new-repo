# Pascalish hosted caches

To enable the existing real passive SSDP collector alongside an installed
`shared-devices` Kasa/Tuya context, run
`node testing\pmachines\install-passive-ssdp.mjs http://192.168.2.115`.
This uploads uniquely named signed images before replacing that context, sends
no synthetic notifications, and leaves all three collectors installed. Replacing
the context clears its RAM cache. Installation or observation errors are reported;
the script does not automatically roll back a failed replacement. A successful
installation does not guarantee reception: inspect daemon shedding counters and
the reported real SSDP names, particularly under memory pressure.

```pascal
type SomeItem = record count: integer; label: string; end;
var table: cache of SomeItem;
    item, found: SomeItem;

item.count := 42;
item.label := 'answer';
table.put('explicit-key', item, 60000);
found := table.get('explicit-key');
item.count := table.get('explicit-key').count;
table.remove('explicit-key');
```

Compile with `hostServices: true`. `cache of T` is a context-owned, process-local
host resource, not an array. `put(key, item, ttlMs)` returns integer 1, replaces
the value and TTL, and records a new successful observation. `get(key)` returns
a typed copy or fails explicitly for an absent/expired key: there is no default
record sentinel. `remove(key)` returns 1 when a live entry was removed, otherwise
0. Method names are case-insensitive. Reads never refresh TTL or observation order.

Each cache holds at most **50 entries**. Writes reclaim expired entries first,
then evict the oldest successful put (including replacements) if full. Equal
clock observations retain put order. TTL starts at put on the monotonic clock,
with inclusive expiration (`now >= deadline`). TTL must be an integer in
1..2147483647; keys must be nonblank and at most 256 UTF-8 bytes.

Both hosts support at most two caches per service context, a separate aggregate
**16384-byte key/item budget**, and a **2048-byte serialized item limit**.
Invalid/oversized writes fail without evicting live data. Supported item types
are signed 32-bit integers, strings, booleans and nested records (at most 32
scalar leaves). Aliases resolve structurally; unsupported types fail compilation.
The host also checks keys, schemas and TTLs.

Compiler `hostCaches` metadata retains names, capacity and typed leaf schemas
in compact signed maps. Internal `host.cache_put/get/remove` ABI values are JSON
objects with dotted field-path keys (`__value` for a scalar); booleans use integer
0/1. Source cannot call these internal bindings. Legacy `host.table_*` is unchanged.

Caches survive invocations but not stop/reinstall/reboot; different contexts do
not share data. Up to **three daemons per context** may access matching service
cache declarations. Each daemon has its own refresh schedule and optional owned
UDP intake. ESP32 retains **two contexts, one serialized worker, six total image
leases**, and the existing shared 4096-byte byte buffer / 4100-byte network scratch.
Thus a service plus three collectors fits four leases; two legacy service/daemon
pairs still fit. This does not reserve eight full image caches. Exhausted leases,
invalid multicast metadata, schema mismatches and port/route conflicts reject
installation without stopping or replacing existing contexts; candidate leases
and sockets are released on failure. Explicit stop/reinstall is still required.
Hosted maps stream from their file with a 32768-byte file bound rather than
materializing an unbounded FFS byte vector. Allocation/parse failure rejects the
candidate explicitly; unrelated non-hosted mapper loading is unchanged.

All leased images share one **four-page, 2048-byte instruction-data cache**.
Pages are tagged with their owning image, checked against that image's signed
page hashes on a miss, and invalidated when its lease is released. A static
mutex protects cache reads and installation validation, which can run alongside
the serialized worker. Per-image signatures and page hashes remain independent;
installation does not retain four dynamically allocated pages for every image.
Legacy text instructions allocate their deque only when used: empty PHI1 units
and unused daemon slots do not each allocate an unused deque node/map.

There is no persistence, replication, distributed backing, multi-key transaction,
or cache-handle assignment/passing.

## Distributed tables and replicated caches

**Status:** implemented for hosted JS PMachines with string keys and typed
scalar/record values. The supplied adapter is an atomic file-backed authority;
database-table and remote-service connectors are extension points, not supplied
production adapters. Table declarations are separate global resources; this
release exposes Pascalish operations through their backed caches, not direct
`DeviceDirectory.get()` calls.
The existing `cache of T` above remains unchanged. Device federation below
aggregates independently collected observations; it is not an authoritative
datastore and must not be silently converted into one.

### Separate global resource and local generic cache

The declaration shape is:

```pascal
type Device = record
  name: string;
  protocol: string;
  address: string;
  deviceType: string;
end;

distributed table DeviceDirectory: map<string, Device>;

service 'device-reader';
var devices: cache<string, Device> backed by DeviceDirectory;
    device: Device;

get '/example';
begin
  device := devices.get('kasa:192.168.2.28');
  return device.name
end
end.
```

`DeviceDirectory` is a named top-level resource, outside any service, daemon,
class or variable section. It defines the authoritative key/value schema, not a
process-local variable or a copy of the datastore. Its identity is the qualified
table name resolved by deployment, never just the local cache variable name.
Units declaring/referencing the same backing resource must agree on its schema.

`map<TKey, TValue>` specifies the table's typed mapping. `cache<TKey, TValue>`
is a node/context-local resource with a backing-table reference and a deployed
replica identity. The cache exposes map-like operations plus local residency
and replication. Generics are resolved at compile time.
The first implementation supports `string` keys and the existing hosted-cache
scalar/record value types. Other key types must be rejected explicitly, not
coerced to strings. Cache/table handles are not ordinary assignable records.

The compiler records table declarations, schemas, cache bindings and required
capabilities in signed program metadata. Deployment resolves the table name to
a datastore adapter and registers replica identities/endpoints. The backing
datastore may be a file, a database table, or a service exposing keyed data.
The initial implementation can use a file-backed authority on a JS PMachine;
a dedicated datastore service is one deployment choice, not a language requirement.
File paths, table identifiers, endpoint URLs, credentials, node membership, memory
capacity and transport retry policies are deployment concerns, not literals
embedded in Pascalish application code. Unsupported targets must reject these
capabilities before installation; no process-local fallback is permitted.

### Operations and read-through behavior

| Operation | Authority semantics (not direct Pascalish methods) | Backed local cache |
|---|---|---|
| `get(key)` | Read the authoritative value or raise `KeyNotFound`. | Return an unexpired resident value; on a miss, fetch the authoritative value, install it locally and enqueue distribution to the other registered replicas. |
| `put(key, value)` | Commit a validated durable update and its replication work. | Write through to the table; install locally only after the authoritative commit is acknowledged. |
| `remove(key)` | Commit a versioned deletion and its replication work; return whether a live value existed. | Perform the authoritative deletion, then remove the local resident value. |
| `contains(key)` | A missing read raises `KeyNotFound`. | Check through the backing table on a local miss; not merely local residency. |
| `count()` / `next(cursor)` | The internal synchronization protocol returns a full revision-fenced latest-state snapshot; public authoritative enumeration is not implemented. | Enumerate resident keys only; not a claim of full table coverage. |
| `clearLocal()` | Not applicable. | Evict local values without deleting table data or sending distributed deletions. |

Cache-wide authoritative deletion is not an implicit `clear()` operation.
Administrative table clearing must be separately authorized and explicit.
Resident inspection and replication health are runtime diagnostics, distinct
from logical map membership.

Only one backing fetch per table/key is active in a cache context at a time;
concurrent misses share its result or error. A missing authoritative key raises
`KeyNotFound`, not an empty/default record. Timeouts, unavailable storage,
schema mismatches and replication failures remain distinguishable errors.
No negative result is distributed as a fabricated value.

A cache fill distributes the authoritative value's existing version; it is
not a new table write and does not advance that version. If the key changes
while a miss is being filled, newer observed state wins. A stale fill must not
overwrite a newer value or deletion. Receiver application never rebroadcasts
an update, preventing replication loops.

### Authority, versions and asynchronous replication

The logical table has one write authority, regardless of backing adapter.
The authority serializes writes and
durably commits the value/deletion, its monotonically increasing table revision,
and replication outbox work before acknowledging success. A crash must not
leave an acknowledged write without durable data or recoverable propagation.
The initial implementation has one durable authority, not multi-writer
consensus or automatic authority failover.

The authority implements keyed reads, versioned writes/deletions, and fenced
synchronization. Adapters implement asynchronous `load()`, `commit(state)` and
`close()` for the complete authority snapshot. A file adapter provides atomic
replacement after flushing file contents; a database
adapter can use transactions; a service adapter must provide an equivalent
commit/recovery contract. An arbitrary file or unversioned service is not
automatically a valid replication authority. An adapter that cannot satisfy
these guarantees is rejected explicitly. Direct edits outside the authority
require a defined reconciliation/versioning mechanism before replicas can be
declared synchronized.

Replication is asynchronous: a successful write means **durable authoritative
commit**, not acknowledgment from every cache replica. The writer may therefore
read its acknowledged update immediately while another node briefly sees an
older cached value. A bounded local TTL limits how long an unreachable replica
can serve resident state; after expiry a backing-store outage produces an error.
Ordinary cached reads provide eventual consistency, not cross-node linearizable
reads or multi-key transactions.

Each replication envelope includes table identity, schema identity, datastore
generation, authoritative revision, key, and either a typed value or deletion
tombstone. Replicas apply envelopes idempotently and never replace a newer
key version with an older one. Deletion versions survive resident eviction so a
delayed fill cannot resurrect a removed key. Generation changes require a
resynchronization handshake; revisions from different generations are not
numerically compared or trusted in arrival order.

The authority retains latest values/tombstones, delivery revisions and replica
acknowledgments durably, including fills requested by readers. Each replica
polls a complete snapshot every second and retries failed synchronizations.
This is recoverable latest-state propagation, not a durable log of every
intermediate write or a push callback queue. Replica outages do not roll
back committed writes. Delivery lag and failure are exposed explicitly through
status/metrics, and retry work survives authority restarts. Slow/offline
replicas always recover through a revision-fenced full snapshot. A replica
acknowledges the previously applied revision on its next poll, never the newly
received revision before successful application. Failed snapshot application
rolls local residency and version guards back atomically.

TTL is a residency/freshness policy, not datastore deletion. Resident reads,
duplicate delivery and retries do not extend the same delivery's lifetime.
A read-through miss creates a new durable delivery revision with a fresh
residency TTL, without changing the value's authoritative version.
Cross-node expiry uses an explicitly defined age/remaining-lifetime protocol,
never a raw timestamp from another process's monotonic clock. Restarted
replicas resynchronize rather than advertising lost RAM state as current.

Capacity eviction is local and does not remove authoritative data. If an
individual value cannot fit the declared replica schema/storage limits, that
replica reports failure instead of acknowledging a retained copy. Retry queues,
version guards and retained tombstones are bounded; exhaustion requires
backpressure or explicit resynchronization, never silent success.

### Deployment and limits

The [example](../../../src/replicated-device-directory.pas) and
[runner](../../javascript/deploy-replicated-cache.mjs) start one authority and
two **separate-process** JS replicas:

```powershell
node pmachines\javascript\deploy-replicated-cache.mjs --file C:\PulseData\device-directory.json
```

Default ports are 4340 (authority), 4341 and 4342 (replicas). The runner generates
an ephemeral deployment bearer token, uploads signed Pascalish p-code/maps and
grants only the named collector access. Use `POST /directory/device?key=example`
with JSON `{name, protocol, address}`, `GET` or `DELETE` the same route,
`POST /directory/clear-local`, and `GET /directory/count` on either replica.
The directory is independent of discovery/registry observations.

For an independently managed node, `JS_PMACHINE_DISTRIBUTED_GRANTS` maps exact
collector IDs to table-name bindings `{origin, token, replicaId}`. Transport is
currently HTTP on literal loopback `127.0.0.1` only, with a token of at least
32 characters. Remote/LAN replicas require a future authenticated transport.
URLs/tokens cannot be supplied by an arbitrary service-install request.

Defaults: 16 tables, 256 retained keys including tombstones per table,
32 registered replicas, 2 MiB authority file, 50 resident entries and 16 KiB
storage per local replica cache, and 60-second residency TTL (maximum 180s).
Read-through requests time out after 5 seconds. Local byte-budget failures and
version-guard/tombstone exhaustion fail explicitly; tombstones are not silently
garbage-collected. A write that commits but fails local installation reports
`CommittedLocalFailure`; callers must not interpret it as a rolled-back write.

The file authority holds an exclusive `<file>.lock`. After a process crash,
verify no authority is still running before manually removing that exact stale
lock. Never steal a live lock or edit a live snapshot. File contents are flushed
before atomic rename; directory metadata is not fsynced, so this is not a claim
of universal power-loss durability. Normal stop/restart preserves generation,
values, deletions and acknowledgment state.

### Verified acceptance evidence

The [replicated-table tests](../../../testing/pmachines/replicated-table.test.mjs)
verify:

1. Top-level table declarations and generic cache bindings compile to signed,
   schema-checked metadata; invalid placement/types/bindings fail compilation.
2. Two distinct JS PMachine replicas fill an absent resident key from the
   configured backing adapter without using the backend registry as a substitute.
3. Concurrent misses deduplicate; the fetched value reaches other replicas
   under its original authoritative version.
4. Writes and deletions persist across authority restart; duplicate/out-of-order
   delivery and delayed fills cannot roll state backward or resurrect deletions.
5. An offline replica does not block authoritative commits, and catches up
   after reconnect/restart; status remains degraded until it is synchronized.
6. Expiry and eviction cause read-through, not datastore deletion. Missing keys,
   backing outages, invalid data and resource exhaustion fail explicitly.
7. The legacy `cache of T` and observation-federation tests remain unchanged in
   meaning. Separate processes on one PC do not prove physical fault isolation.

## Bounded enumeration

```pascal
cursor := devices.next('');
while cursor <> '' do
begin
  name := devices.get(cursor).name;
  cursor := devices.next(cursor)
end;
total := devices.count()
```

`next(cursor)` finds the smallest live UTF-8 bytewise key strictly greater than
cursor, or `''` at the end. The cursor need not still exist and is bounded to 256
bytes. `next/get/count` share the invocation-start read time and do not refresh
entries. A walk over multiple invocations is not an atomic snapshot: puts and
evictions may change subsequent pages.

## Shared Kasa / Tuya / SSDP device cache

These four Pascalish units declare the same `cache of Device`:

* `src\device-cache-service.pas`: `GET /api/devices/names`.
* `src\kasa-collector-daemon.pas`: read-only TCP 9999 `get_sysinfo`, one configured
  peer per 30-second turn, approximately one minute per device. Keys remain
  `kasa:<ip>`; labels are real Kasa aliases, not inferred labels.
* `src\tuya-collector-daemon.pas`: passive UDP 6667, authenticated/checked 55AA ECB
  and 6699 GCM discovery. Keys are `tuya:<gwId>`, labels `Tuya <last six ID bytes>`.
* `src\ssdp-collector-daemon.pas`: passive UDP 1900 `NOTIFY * HTTP/1.1` only.
  Keys are `ssdp:<canonical lowercase UUID>`, labels `SSDP <UUID>`. These are
  explicitly identity labels, **not fetched friendly names**.

The Pascalish SSDP daemon performs no M-SEARCH, HTTP request, XML description
fetch or relay command. The federated PC launcher optionally enriches its display
names as described below; this does not change the collector ABI or cache schema.
Header names are case-insensitive; frames must terminate in CRLF/CRLF with no
body, fit 1024 bytes, and have at most 32 lines of at most 256 bytes. Generic
ASCII header/text bindings validate framing and reject duplicate requested
headers; Pascalish validates HOST, NT/NTS, canonical UUID USNs and matching
service suffixes. All service variants of a UUID deduplicate to one entry.
`ssdp:byebye` removes it. Alive/update require a positive decimal `max-age=...`
directive; TTL is clamped to **180 seconds before millisecond conversion**, so
large decimal values cannot overflow a host signed integer. Malformed frames
raise visible per-daemon `failures/lastError` and do not refresh existing entries.
The periodic SSDP timer is a no-op.

### Friendly names in the federated PC deployment

`start-federated-device-cache.ps1` enables a JS description helper after successful
Pascalish NOTIFY processing. It captures LOCATION from accepted advertisements,
queues description GETs outside the serialized worker, and overlays friendly names
on `http://127.0.0.1:4310/api/devices/names` and `/api/devices`.
Collector snapshots at port 4308 remain authoritative UUID-label observations.
No firmware flash, M-SEARCH, control request, schema migration or extra collector
vote is involved. Raw evidence remains visible at the central `/api/devices`.

Targets must be HTTP URLs with canonical literal RFC1918 IPv4 matching the
datagram source; helper defaults permit only ports 80 and 8200. The checked-in
deployment explicitly configures `ssdpDescriptionPorts: [80, 9000]`, because its
real router advertises descriptions on port 9000. Unlisted ports remain denied.
The helper also supports explicit trusted-peer policy when constructed directly,
but the launcher does not accept arbitrary remote URLs or peer overrides. DNS, public/loopback/
link-local destinations, credentials, fragments, HTTPS and redirects are denied.
Each GET has an absolute **2-second** deadline and **16-KiB** UTF-8 XML limit.
The bounded XML subset rejects DTD/entity declarations and external entities,
handles namespace prefixes, built-in/numeric escaping and Unicode, and selects
the unique device UDN matching the advertised UUID, including embedded devices.
Names must be nonblank and at most **256 UTF-8 bytes**.

There are at most **50** UUID/location entries and **two** concurrent requests;
successful descriptions are reused for five minutes, failures back off for
30 seconds, and changed location/address invalidates the result. No retry occurs
without another accepted advertisement. Advertisement expiration/byebye removes
the auxiliary identity; late obsolete completions cannot relabel its replacement.
Lookups never write cache observations, refresh device TTL, alter observation
sequence/time, extend central evidence deadlines or affect confidence/voting.
Display changes invalidate central pagination revisions.

Central records contain `naming.status`, `provenance`, `location`,
`descriptionAgeMs` and `error` where applicable. Missing/denied/unreachable/
malformed descriptions retain `SSDP <UUID>` with an explicit fallback reason,
and lookup failures are logged separately as `[SSDP-NAMES]`; they do not
misreport an otherwise healthy passive collector as failed. A fetched name is
device-advertised descriptive data, not authenticated identity or corroboration:
one SSDP collector still yields **PROVISIONAL** confidence.

Install the SSDP daemon with generic ownership metadata:

```json
{"file":"/scd.phi","map":"/scd.map.json","udpPort":1900,"multicastGroup":"239.255.255.250"}
```

ESP32 joins on the current station WiFi IPv4 interface through the socket
membership API, and leaves on stop/failure. Status exposes group
and interface. JavaScript also accepts optional `multicastInterface` and binds
multicast intake to the wildcard address before joining. Multicast requires an
owned nonzero UDP port and literal multicast IPv4 address; duplicate owned ports
are rejected. Intakes process at most one datagram per source per serialized
turn. Oversized packets and low-heap/busy shedding retain explicit counters.
Daemon UDP uses nonblocking socket ingress directly: it peeks at most 1025 bytes
on the worker stack, receives at most 1024, and does not allocate WiFiUDP's
unused 1460-byte transmit buffer or a per-daemon receive buffer. This matters
during four-image installation, where a fragmented heap can have enough total
free RAM but not fit two consecutive WiFiUDP transmit-buffer allocations.
Generic daemon `udp_reply` still sends its one bounded payload as one datagram.
The one pending datagram is received into a bounded stack view first, releasing
the socket's transport buffer before checking the unchanged 8192-byte VM heap
floor and allocating the event string. Checking before receive made transport
storage itself trigger shedding; previous logs measured only after flush, hiding
that transient difference. A dropped or shed datagram also ends that worker
turn, so malformed traffic cannot drain multiple sources in one turn.

### Bounded Kasa allocation fix

Hex replies previously required simultaneously retained oversized TCP hex and
sliced hex strings; removing that copy exposed a second failure while extracting
and reserializing the complete `system` JSON object. The collector now uses
generic `host.tcp_exchange_buffer`: validate the length prefix, load only the
bounded payload into the **existing** byte buffer, and return an integer handle.
Pascalish decrypts in place with `buffer_length/get/set`, then selects JSON leaves
directly from that handle and releases it after extracting the fields. It never
materializes the complete plaintext reply as a VM string or host argument.
No Kasa cipher/protocol parsing moved into native code.

Generic `json_path_text/integer(json, 'object.child.field')` extracts a typed
leaf. Native parsing filters to the requested path instead of materializing and
serializing full intermediate objects. Paths have at most eight nonempty parts
and 128 bytes. Missing/wrong-type fields fail explicitly. JavaScript mirrors
the contract. No heap thresholds were reduced, error fallback added, or large
RAM reservation introduced.

`buffer_json_path_text/integer(handle, path)` has the same typed path semantics,
but borrows the existing buffer without consuming or modifying it. Native UTF-8
validation and filtered JSON parsing operate directly on the bounded byte view,
so there are no full-payload plaintext copies; only selected leaves are returned.
The handle remains valid until explicit `buffer_release` or invocation cleanup.

Three-collector hardware testing also exposed retained per-image instruction
pages fragmenting the heap below the unchanged 8192-byte UDP ingress floor,
despite about 50 KB total free. The shared instruction cache above removes those
per-image page allocations without reducing the four-page execution working set
or weakening signature checks. Total free heap alone is not proof of adequate
contiguous allocation capacity.

### Names API and proof

`GET /api/devices/names[?cursor=<nextCursor>]` returns:

```json
{"count":2,"names":["Bedroom","Den"],"continuation":"end","nextCursor":""}
```

The example shows a two-device cache. Each page
contains **at most ten** live names. Follow `nextCursor` until `continuation` is
`end` and the cursor is empty (at most five pages for 50 entries). The total count
is the invocation's live count. Pagination avoids the previously failing large
whole-cache JSON rewrite and preserves exact labels from all three protocols.

Run focused JS tests:

```text
node --test testing\pmachines\ssdp-collector.test.mjs testing\pmachines\shared-device-cache.test.mjs testing\pmachines\byte-buffer.test.mjs testing\pmachines\pascalish-cache.test.mjs
```

Native standalone g++ tests are `host-cache-native.cpp`, `byte-buffer.test.cpp`
and `bounded-text.test.cpp` in `testing\pmachines`.

Physical installer/proof (firmware must already be flashed):

```text
node testing\pmachines\verify-esp32-shared-device-cache.mjs http://192.168.2.115/ --ssdp --replace --soak-ms 240000 --report <path>
```

It uploads signed PHI1 images/maps through FFS (**no uploadfs**), checks 50 names
over five pages in an isolated temporary context, installs the common host, and
samples real names/status/health. Explicitly synthetic bounded multicast and
unicast NOTIFY tests are recorded separately and removed with byebye/TTL before
the final real-label report. Absence of accepted real SSDP entries describes only
the observation window, not proof that the LAN has no SSDP devices. Transport timeouts do
not retry writes; only explicit preexecution HTTP 503 busy permits three
randomized 250–1000 ms retries.

Retained `/kasa.phi`, `/kasa.map.json`, `/kasad.phi`, `/kasad.map.json` permit
restoration after failure. Installs remain volatile. Hardware reports record
actual durations, turns, failures and shedding; a finite zero-failure observation
is **not an absolute stability claim**. The separately known AsyncTCP accept
allocation crash under six concurrent new TCP connections is not fixed here.

**Earlier shared-context physical blocker:** the three-collector firmware did receive real
multicast advertisements and cache two UUID identities alongside Bedroom, Den
and five Tuya identity labels. However, the names endpoint subsequently returned
HTTP 503 JSON allocation/serialization errors, and SSDP recorded a JSON
allocation failure. Its full synthetic reception/soak proof therefore remains
failed; successful unit tests or multicast membership are not proof of stable
three-collector operation. Separate two-collector Kasa measurements do not
certify SSDP or the three-collector heap envelope.

## Federated device cache and evidence

The resource-relieving deployment is deliberately **not** three protocols in one
ESP32 context. Kasa runs as a signed Pascalish service/daemon on the physical
ESP32. Tuya and passive SSDP run the existing Pascalish programs compiled to
JavaScript p-machines, each with its own typed 50-entry local cache and boot ID.
Both JS logical nodes currently share a PC/process; this does **not** demonstrate
physical failure independence. Central orchestration and the materialized
combined cache are JavaScript, not central Pascalish or transparent distributed
cache reads/writes. There is no consensus, placement, process shedding, majority
rule, automatic quarantine, or cross-protocol physical-device identification.

The implementation follows the existing `discoveryProvider.mjs` design of
configured snapshot pulls, monotonic remaining-TTL deadlines, retained evidence
during outages and authoritative replacement, with stricter device-schema,
source membership, revision-fence and capacity bounds. The discovery provider
continues handling machine announcements; device evidence uses its own contract.

### Run and restore

Edit `config\federated-device-cache.json`. Empty `lanInterface` detects a unique
active IPv4 interface on the ESP32 subnet; set it explicitly if ambiguous.
The default collectors are `kasa-edge`, `tuya-js` and `ssdp-js`. An optional
`sources` array overrides central membership with objects containing
`collectorId`, `protocol` (`kasa`, `tuya`, `ssdp`) and a private IPv4 HTTP
`origin`. It may include multiple independently configured same-protocol
collectors, up to eight. IDs and normalized origins must both be unique; neither
an announcement nor a claimed response identity can create an extra voter.
Configured origins are trusted LAN endpoints, **not cryptographically
authenticated identities**.

```text
node testing\pmachines\install-esp32-kasa-cache.mjs --report <proof-path>
powershell -File .\start-federated-device-cache.ps1
node testing\pmachines\verify-federated-device-cache.mjs --soak-ms 240000 --report <proof-path>
```

Firmware must support typed snapshots. Use the existing **Build ESP32dev
firmware** and **Flash ESP32dev Kasa runtime COM5** VS Code tasks when needed.
Do not upload a filesystem image. The installer preserves `/dcs.phi`,
`/kcd.phi`, `/tcd.phi`, `/scd.phi` and their maps; it uses `/feds.phi` and
`/fedk.phi` in the initial deployment; subsequent installs use uniquely suffixed
`/fs<nonce>.phi` and `/fk<nonce>.phi` paths so open images are never overwritten.
It replaces only the previous shared context/selected Kasa context.
The report captures the old status and recovery install values. Uploads precede
stopping the prior context; a failed installation is explicit, not reported as
an empty successful cache. A transport failure never blindly retries a write.
The real proof script sends **no synthetic UDP, M-SEARCH, XML fetch, or device
control**; only the existing Kasa read-only `get_sysinfo` requests are active.

### Synchronization and confidence

`devices.snapshot(cursor, revision)` is the typed cache snapshot operation.
The Pascalish `/api/devices/snapshot` endpoint returns version 1, the configured
collector ID, boot ID, cache revision/sequence, monotonic `sampledAtMs`, total,
at most two records and `nextCursor`. Each record contains its protocol-qualified
key, typed device, observation time/sequence and remaining TTL. Later pages
must use the first revision. Expiry, deletion, eviction and puts change that
revision, so mixed snapshots are rejected. A complete validated snapshot
atomically replaces one source's evidence, including authoritative deletions.
Malformed/partial snapshots retain the prior source unchanged and mark it
unavailable.

Central deadlines use the first page's **local request-start** time plus each
page's remaining TTL, conservatively charging transport and late-pagination
latency. Remote monotonic times are used only for same-source age validation,
not clock synchronization. Reads/retries/repeated observations and boot changes
alone cannot extend retained observation deadlines or add votes. Same-boot
revision/observation regressions fail; the last eight retired boot IDs are
remembered with an explicit bounded replay guard. True new successful puts can
refresh evidence. No data survives a collector cache reset without re-observation.

One fresh report is **PROVISIONAL**. Two or more distinct configured collector
IDs with consistent fresh reports for the **same stable protocol-qualified
key** are **CORROBORATED**. Meaningful name/address/protocol/device-type
disagreement is **CONFLICTING**, with `conflict: true` and every report retained.
Sequence/timestamp differences are not conflicts. Missed multicast is absence
of evidence, not a contrary vote. Offline but still-fresh reports remain visible
with `sourceAvailable: false` and overall `completeness: false`. Expiration can
demote corroboration and eventually removes the device. There is no majority
winner: the deterministic first report's displayed device is only a convenience
when conflicting; consumers must inspect evidence/confidence.

### Bounded central APIs

Default `http://127.0.0.1:4310` endpoints:

* `/api/devices/names`: at most ten names plus typed device/confidence/collector
  summaries. **Always paginated**; `all=1` cannot bypass the bound.
* `/api/devices`: at most two devices with full per-collector observation,
  remaining TTL, boot, protocol/name/address and availability provenance.
* `/api/devices/source-health` (also `/health`): source freshness, synchronization,
  collection errors, age, boot/revision, counts, limits and completeness.
* `/api/devices/refresh`: await one bounded, coalesced synchronization.

For both listing APIs, pass `nextCursor` as `cursor` and the first `revision`
back as `revision`; an empty next cursor completes enumeration. Revision
changes/expired cursors fail explicitly: restart the bounded walk. Central
queries read retained materialized evidence, never transparent remote reads.
All pages include source health/errors/completeness; names alone are not a
claim of complete discovery.

Limits: 150 unique devices initially from three 50-entry caches; at most eight
configured sources/400 evidence records, 524288 serialized evidence bytes,
plus at most 50 last-observation deadline guards per source within that same
byte budget (expired evidence cannot be revived by unchanged snapshot replay),
25 two-record pages per source snapshot, three full-snapshot attempts, and
30000 ms per source synchronization. Capacity/storage overflow rejects the
candidate source replacement rather than silently dropping existing evidence.
Each HTTP source page is bounded to 2048 bytes (health 4096); central responses
are bounded to 49152 bytes with eight connections. Only an explicit preexecution
busy response permits three randomized 250–1000 ms retries. Other transport,
schema, availability and HTTP errors surface in source health/logs.

```text
node --test testing\pmachines\device-federation.test.mjs testing\pmachines\shared-device-cache.test.mjs testing\pmachines\pascalish-cache.test.mjs
```

Independent same-protocol collector/conflict/expiry coverage is **synthetic
unit testing only**, never live corroboration. With the default one collector
per protocol all observed real devices should remain PROVISIONAL. A successful
finite real-traffic proof records actual names, source health, errors and ESP32
heap/contiguous-block measurements; it is not an absolute stability guarantee.
