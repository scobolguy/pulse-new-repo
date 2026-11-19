# Native Pascalish service host

This standalone C++17 host runs a constrained, explicitly targeted subset of the
existing hosted Pascalish service contract. It does not require Node.js at
runtime and can run beside the Node and ESP32 hosts. Port `0` (the default)
selects an available port and prints it as `LISTENING ... port=N`; set `--port`
to a fixed port for deployment.

## Build

From this directory:

```powershell
cmake -S . -B build -G Ninja
cmake --build build
```

The project uses the C++ standard library and platform socket/file APIs.
It builds on Windows and Linux with CMake, Ninja, and a C++17 compiler.

## Compile and run a service

Opt into the native target while compiling the same service source used by the
JavaScript host:

```powershell
node ..\..\aggregator\scripts\compile-pascalish-program-antlr-to-pcode.mjs `
  --in path\to\service.pas `
  --out build\service.pcode `
  --map-out build\service.program.json `
  --native-target
.\build\pulse_native_service_host.exe `
  --pcode build\service.pcode `
  --program-map build\service.program.json `
  --storage-root schemas=C:\pulse\data\schemas `
  --writable-storage-root catalog=C:\pulse\data\catalog
```

`--native-target` adds `native` to the program map only after checking that the
service uses supported operations. A native host rejects maps that omit the
native target, request unsupported host capabilities, or contain unsupported
opcodes or bindings. Node and ESP32 target metadata remains unchanged unless
the opt-in flag is provided.

Filesystem roots are opt-in. `--storage-root ALIAS=ABSOLUTE_PATH` grants
read-only access; `--writable-storage-root ALIAS=ABSOLUTE_PATH` grants
read/write access. The host requires real directories, rejects path traversal,
symbolic links, hard-linked files, and reserved Windows device names, and uses
atomic file replacement for writes. A service's P-code and program map must
both declare the corresponding filesystem capabilities. `--max-file-bytes`
sets the per-file text limit (default 262144; maximum 1000000). Only
operator-owned storage roots should be granted.

## Local slot scheduler

The optional `--ffs-root ABSOLUTE_Pmachine_DIRECTORY` enables the native
slot-0 scheduler adapter. It reads uploaded bundles only beneath that granted
PMachine directory and serves:

* `GET /api/pmachine/scheduler`
* `POST /api/pmachine/scheduler/load` with `{"manifestPath": "...", "slot": 1}`
  (`slot` is optional)
* `POST /api/pmachine/scheduler/unload` with `{"slot": 1}`

Slot 0 is reserved; user programs occupy slots 1–16. Requests and boot
restoration run the checked-in Kotlin scheduler P-code through the native
interpreter. Native C++ supplies only its internal storage/lifecycle bindings.
Services are dispatched through their signed `serviceEndpoints`; transient
programs execute synchronously and are then released; daemon programs run once
on activation and are polled from the listener's 250 ms select loop at their
declared interval. No scheduler binding is available to uploaded code.

`--ffs-root` points at the PMachine FFS root (the directory containing
`programs\`), not at the repository or an arbitrary parent directory. Bundle
manifests use `/pmachine/programs/<name>/manifest.json`; their `storagePath`
must be `/pmachine/programs/<name>/versions/v1`. The entry digest and each
program-map HMAC-SHA256 signature are checked before staging. Configure
`PCODE_SIGNING_KEY` and `PCODE_SIGNING_KEY_ID` to match the operator signing
profile; absent variables use the development defaults from
`aggregator/scripts/pcode-signing.mjs`, which must not be used in production.
Scheduler snapshots are atomically written to
`.pmachine-scheduler\slots.json` under the granted root. Only a genuinely
missing snapshot initializes empty state; unreadable or malformed state keeps
the host from becoming ready.

Legacy single-service invocation remains unchanged when `--ffs-root` is not
supplied. Existing daemon bundle metadata with `serviceEntry` /
`serviceProgramMap` is accepted as a companion service; legacy manifest APIs
remain transitional and are not retired by this adapter.

The native filesystem bindings are `host.fs_read_text`,
`host.fs_read_text_auto`, `host.fs_write_text`, `host.fs_exists`, and
`host.fs_resolve_relative`. Auto reads decode UTF-8 and UTF-16 LE/BE text;
ordinary reads and writes require valid UTF-8. Relative schema references are
confined to the granted root and must resolve to an existing path.

## Initial slice and limits

This is an incremental portable runtime, not a replacement for the JavaScript
or ESP32 runtimes. It supports HTTP services with integer `ADD`, `SUB`, and
`MUL` (32-bit wrapping), boolean and comparison operations, calls, string
concatenation, variables, and the service-control opcodes emitted by the
compiler. The supported host bindings cover HTTP event data/status, JSON
values and traversal, text operations, integer parsing/comparison, dates,
SHA-256 text hashing, filesystem text read/write/existence and relative XSD
path resolution, and explicit program errors. The compiler's native-target
allowlist is authoritative; XML streaming bindings are supported, but XML DOM
bindings, division, UDP, timers, and other unavailable host capabilities are
not advertised or silently emulated.
The listener is serial and accepts HTTP/1.x requests with a bounded
`Content-Length`; chunked transfer encoding is not supported.

## Runtime profile

`GET /pmachine/runtime/profile` returns the native runtime's versioned
capability and resource profile. The profile is also included in
`GET /pmachine/service_host/status`. It reports the shared service-host,
host-capability, and runtime-profile contract versions; the native target;
serial execution; a 20,000,000-byte request/response limit; and XML streaming
support. Filesystem capabilities and the number of storage roots reflect the
roots granted at startup. See the [PMachine runtime profile overview](../README.md#runtime-profiles-and-placement)
for how schedulers and deployment preflight use these declarations.

Kotlin hosted services can target this Windows/Linux executable with
`--target native`. The native host serves remote-source virtual-cache snapshots
at `/api/hosted/caches/{cacheName}/snapshot` and resolves every logical source
through Aggregator on each read. Configure the Aggregator with
`--aggregator-url http://aggregator:4000` or `PULSE_AGGREGATOR_URL`. This
runtime currently has no local physical-cache store, so virtual-cache sources
must be hosted by a cache-capable runtime such as the JavaScript host. Native
source requests currently use plain HTTP with Content-Length responses; HTTPS
and chunked response bodies are not supported.

## Portable Cobolish payment parsing

Cobolish `PARSE` links the same scalar P-code engine used by JavaScript.
Application XML/JSON parsing, XSD/MAPL plan compilation, validation, exact
control sums, mapping, serialization and bounded cache management run in
P-code, not C++ parser bindings or external XML/JSON libraries.
See the [PARSE contract](../../../../languages/cobolish85/README.md#sort-style-xml-parse).

Compile the hosted Cobolish source with
`{hostServices: true, nativeTarget: true}`. Configure the Data Librarian with
`--librarian-url http://librarian:4000` or `PULSE_LIBRARIAN_URL`.
Queue output additionally needs `--aggregator-url` or `PULSE_AGGREGATOR_URL`.
The runtime profile advertises `artifact.read` and `broker.publish` only
when their respective origins are configured. Program installation checks
both declared requirements and the actual instructions.

The new host primitives provide raw GET/POST responses, opaque process-local
string storage, Unicode scalar access/encoding and integer-to-text conversion.
All artifact lookup, cache indexing/eviction and broker acknowledgement
validation remain in P-code. Raw transport is restricted to the configured
origins and API prefixes, rejects redirects/non-2xx responses, and bounds
responses to 1,000,000 bytes. It has the HTTP-only/Content-Length restrictions
described above. Existing filesystem grants and atomic replacement apply
unchanged. Cached plans survive invocations, not process restarts.

Run the end-to-end XML/JSON queue/file/procedure parity test:

```powershell
node --test virtualMachines\esp32\testing\pmachines\cobolish-parse-native.test.mjs
```

From the repository root, `PULSE_NATIVE_HOST_EXECUTABLE` may point to an existing
native executable; otherwise the test builds an optimized host in its temporary
directory. On Windows it also validates payment XML with .NET against the full
repository PACS.008 XSD.

Desktop execution is unbounded by default, matching the existing desktop
contract. Supply `--max-steps N` for an explicit instruction budget; SIGINT or
SIGTERM cancels execution and stops the host. The HTTP listener binds to
`127.0.0.1` by default.

Run the cross-runtime HTTP parity and unsupported-deployment checks from the
workspace root:

```powershell
node --test testing\pmachines\native-service-host.test.mjs
```

The test compiles one artifact and compares its HTTP responses in Node and
native runtimes, including variable loads, integer arithmetic and wraparound,
comparisons, JSON handling, hashing, and string concatenation. Existing ESP32
behavior remains on its current PlatformIO targets; this native host does not
alter those target definitions.
