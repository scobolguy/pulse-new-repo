# Testing

Executable tests, test-only harnesses, fixtures, and golden outputs will be consolidated here without changing their current runner technology.

- `aggregator/` for Node.js unit, integration, and end-to-end tests.
- `pmachines/` for JavaScript, Arduino, and cross-runtime conformance checks.
- `hardware/` for opt-in device tests.
- `fixtures/`, `golden/`, and `support/` for reusable test data and helpers.

Tests must write transient output to `runtime/test-results/` or an operating-system temporary directory, never into source directories.

The Librarian HTTP fixture allows up to 60 seconds for process startup, which
compiles its Pascalish units. The parallel full suite has exceeded its previous
15-second startup budget on Windows even though isolated startup passes. Each
fixture reports its measured startup time and fails explicitly on child exit,
spawn failure, or an unhealthy response. This is a test startup allowance, not
a desktop VM execution limit; mutation request deadlines remain unchanged.

Run `npm run test:aggregator:modules` to verify the existing Aggregator module families and its backend composition seams before or after a migration slice.

Run `npm run test:pmachine:arduino-layout` to verify the current Arduino PMachine source inventory and PlatformIO exclusion contracts before its local-library migration.

The standalone Arduino scheduler and dynamic-library test sources live in `testing/pmachines/`; production PlatformIO profiles continue to exclude their former source filenames until the local-library migration removes those legacy filters.

## ESP32 PSRAM extended-table proof

Build and upload the `esp32_s3_n16r8` PlatformIO environment, connect the board
to the network, then run this opt-in hardware proof from the ESP32 workspace:

```powershell
py -3.12 -m platformio run -e esp32_s3_n16r8 -t upload
node testing\pmachines\verify-esp32-psram-extended-table.mjs http://<board-address>
```

The proof uploads a signed P-code program and map, allocates a 32,768-element
extendable integer table, writes and reads the first, middle, and last entries,
and requires every reported table-allocation byte to be in PSRAM. Large tables
are excluded from the response's globals snapshot so their values are not
duplicated into internal heap; the response reports the omitted element count.
Uploaded probe files are removed afterward. Use `--elements <count>` to choose
a different allocation size (1,024 through 1,000,000 elements). Execution
responses include `extendedStorage` counters for declarations, elements,
allocated bytes, PSRAM bytes, internal-heap bytes, and omitted snapshot values.

## ESP32 read-only Data Librarian profile

The constrained S3 profile exposes `/api/librarian/health`,
`/api/librarian/filesystem/health`, `/api/librarian/catalogs`,
`/api/librarian/catalog/page`, and `/api/librarian/schemas/page`. Catalog entries are paged in groups of at most four; schema directory pages are limited to eight entries. The profile
does not implement the full desktop Librarian API, catalog writes, or embedded
XSD parsing. Its proxied endpoints return an envelope with the Filesystem
Service HTTP `status` and JSON response text in `body`.

The Filesystem Service defaults to binding on all IPv4 interfaces at port 4302,
but only accepts loopback and the configured S3 address (`192.168.2.90` by
default). It shares the desktop Librarian's operational data root. Verify that
the board's current address is still `192.168.2.90` before deployment.

Build and flash the updated firmware over COM4, start the Filesystem Service,
then install the hosted profile over the board's HTTP management endpoint:

```powershell
py -3.12 -m platformio run -e esp32_s3_n16r8 -t upload --upload-port COM4
npm --prefix aggregator run dev:filesystem
npm --prefix aggregator run deploy:esp32:librarian:readonly
```

The deploy script installs a peer allowlist containing only the desktop
Filesystem Service IPv4 address and port. Set `ESP32_NODE_NAME`,
`LIBRARIAN_FILESYSTEM_HOST`, and `FILESYSTEM_PORT` only when the device or
service network configuration differs from the defaults. Check the device
health and browse a small page before treating the deployment as available.

Run `npm run test:pmachine:javascript` for the offline JavaScript PMachine compatibility, opcode, negative-path, canonical-type, debugger, and deployment-supervisor suite.

Run `npm run test:pmachine:javascript-package` to verify the public JavaScript PMachine package exports.

### Managed reference objects (offline)

```powershell
node --test testing\pmachines\managed-objects.test.mjs testing\pmachines\memory-management.test.mjs testing\pmachines\hosted-frame-storage.test.mjs
```

The hosted-storage runner builds four standalone C++11 tests with `g++`, including
`managed-objects.test.cpp`, then denies system allocations during object operations.
Generated executables live under `runtime/test-results/` and are removed afterward.
These tests cover the native arena/ownership primitives, not the complete Arduino
VM or hardware. The JavaScript tests execute hand-written bytecode independently
of the Pascalish compiler and exercise calls, aliases, local shadowing, legacy
record roots, strings, reclamation, allocation failure, and cleanup on errors.

Both runtimes intercept `CALL_EXT object.new 1`, `object.get 2`, `object.set 3`,
`object.length 1`, and `object.resize 2` before host dispatch. Each object has at
most 64 zero-initialized typed fields; each invocation has at most 128 live
objects and 8192 arena bytes (8 bytes per field, with a one-field minimum for
empty objects). Integer zero is nil: length accepts it and returns zero; resize
accepts it as an empty source; get/set reject nil. Resize returns a new buffer
with a copied prefix and leaves existing aliases unchanged. Cyclic assignments
are rejected explicitly. Roots and owned edges are counted at instruction
boundaries; dead nodes cascade-release without timers. Compaction runs only
with holes, on contiguous allocation pressure or after 64 allocation attempts.
Object handles are invocation-private and never valid across runs. JavaScript
results expose pre-teardown `managedObjects` counters; even when globals still
contain handles, the invocation heap is freed in `finally`.

Run `npm run test:runtime-data-policy` to verify launchers and backend defaults keep operational data outside source-controlled directories.