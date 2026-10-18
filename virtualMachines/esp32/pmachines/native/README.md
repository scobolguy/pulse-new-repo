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
allowlist is authoritative; XML bindings, division, UDP, timers, and other
host capabilities are not advertised or silently emulated.
The listener is serial and accepts HTTP/1.x requests with a bounded
`Content-Length`; chunked transfer encoding is not supported.

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
