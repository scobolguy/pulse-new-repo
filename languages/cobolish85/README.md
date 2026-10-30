# COBOLish 85

The compiler uses the formal [Cobolish85 ANTLR grammar](grammar/Cobolish85.g4).
Ordinary program compilation and its existing COBOL-85 behavior are unchanged.

## Pathway server extension

Compile with `compileCobolishToPcode(source, { hostServices: true })` to produce
a hosted server for the existing JavaScript/ESP32 hosted-service ABI:

```cobol
IDENTIFICATION DIVISION.
PROGRAM-ID. ECHO-SERVER.
PULSE SERVICE echo.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 REQUEST-TEXT PIC X(40).
PROCEDURE DIVISION.
    PULSE RECEIVE INTO REQUEST-TEXT
    PULSE SEND REQUEST-TEXT.
```

`PULSE RECEIVE INTO` reads the incoming JSON `data` string into an elementary
alphanumeric record with COBOL padding/truncation. `PULSE SEND` replies with
JSON `{code: 0, data: record}` and ends this invocation. These explicit Pulse
extensions require hosted compilation, a simple service name, and one receive
record and one send record. They are not Guardian `$RECEIVE` file procedures.

The service is exposed at `POST /api/pathway/echo`. Each request runs a fresh
invocation; long-running receive loops and process-local state are not implied.
The [Pathway library/demo](../../virtualMachines/esp32/pathway/README.md)
provides discovery, deployment, server-class routing and bounded failover.

The supplied elementary ASCII echo program fits the bounded ESP32 opcode ABI.
General desktop COBOL features, including decimal operations and many file
services, do not automatically become available in that embedded hosted subset.
Native deployment validates the actual generated image and reports unsupported
opcodes/bindings explicitly.

## Native COBOLish server code

The [inventory server](../../virtualMachines/esp32/pathwayDemo/application/inventory.cob)
implements tokenization, validation, reserve/release/inquire rules, reply
formatting and framed database I/O directly in COBOLish paragraphs. It does not
use `PULSE INVENTORY` or link a Pascalish inventory library. Compile it with:

```js
compileCobolishToPcode(source, {
  hostServices: true,
  nativeTarget: true,
  inventoryGateway: { address: '192.168.2.11', port: 4326 },
});
```

`inventoryGateway` supplies the `PULSE-INVENTORY-CONFIG` copybook with the
address and port, never a credential. Both native and JS recovery run the same
compiled program against a data-only MSSQL bridge and durable request ledger.

The explicit native integer profile uses signed 32-bit `PIC S9(5)` through
`PIC S9(9) COMP-5` fields, not display-decimal fields. Arithmetic must stay within
signed 32-bit bounds. Standalone `COMPUTE quotient = integer / integer` truncates
toward zero; fractional literals, scaled fields, `ROUNDED` and division within
compound expressions are rejected. Default compilation retains decimal behavior.
Compilation validates the entire linked program against the extended PHI1 limits.
Compiler temporaries are paragraph-local, not shared WORKING-STORAGE. Native
compilation checks the 128-variable root/procedure frame bounds.

Quoted `CALL "host.name" USING ... RETURNING field` exposes the typed portable
host-binding registry. Arguments are elementary fields or literals, passed by
value/content; explicit `BY REFERENCE`, unknown/internal/desktop-only bindings,
wrong arity/types and exception phrases are rejected. Alphanumeric arguments
lose only trailing ASCII space padding; literals are passed exactly. Returned
strings are padded/truncated to their receiver's PICTURE. Native ASCII records
are bounded to 4096 bytes; string and JSON transport limits still apply.

`PULSE SEND response-field AS JSON` validates and returns a prebuilt JSON
response rather than wrapping it as `{code,data}`. Use `host.http_status` before
sending an error. This lets COBOLish preserve gateway HTTP errors, while transport
loss remains uncertain and must be recovered using the same stable request ID.
Firmware must implement `host.cobol_text` and `host.cobol_unpad`; the demo installer
checks `hostCobolText` before uploading. Streaming uploads accept bounded files up
to 131072 bytes, matching the extended image profile.

## Granted inventory library

The formal grammar also supports `PULSE INVENTORY command-field INTO reply-field`
inside a hosted service. Both fields must be elementary alphanumeric records;
the command is at most 128 characters and the reply at least 96 characters.
The generated binding is `host.inventory_apply(command, requestId)`, with the
stable ID extracted from the incoming JSON `requestId` property. The compiler
declares capability `inventory.transaction` and targets **JavaScript only**.
An ungranted host rejects installation; a program cannot provide its own authority
credential.

The earlier shorthand remains available for compatibility. With an explicit
gateway it uses the earlier portable library; the demo above no longer uses it:

```js
compileCobolishToPcode(source, {
  hostServices: true,
  inventoryGateway: { address: '192.168.2.11', port: 4326 },
});
```

This statically links [the portable inventory library](runtime/cobol-runtime-inventory.pas),
using existing bounded TCP/JSON host bindings, and targets both JS and ESP32. The
library runs command parsing, validation, stock decisions and reply construction
on the executing p-machine, not at the database gateway. Its native image uses
the `extended` hosted-image profile. Installation must
grant that exact network peer. The incoming envelope supplies `requestId` and
`inventoryToken`; no token or SQL credential is embedded in the compiled image.
Only the trusted requester host should supply that token. The gateway checks it
before accessing data. The gateway supplies a row snapshot, then atomically
compares that snapshot and commits the library's row writes and saved reply.
A changed snapshot returns 503 for same-ID recovery; database constraints and an
inventory invariant check reject inconsistent writes. The demo's JS fallback
runs the same compiled library against the same MSSQL request ledger.
Explicit gateway errors retain their HTTP status; transport
loss remains uncertain and must be recovered using the same ID. SQL Server and
the gateway still run on the PC. This does not add general SQL syntax.

See the [inventory application and recovery contract](../../virtualMachines/esp32/pathway/README.md#durable-inventory-requesterserver)
for command syntax, atomic stock/reply storage, deployment grants and limitations.
