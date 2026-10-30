# Pulse Pathway: first requester/server slice

A standalone, Pathway-inspired controller and reusable Node.js library. It does
not require a running aggregator and does not remove or reconfigure one.
It reuses the repository's compilers, signing convention, and p-machine ABI.

## Run the screen application

From the repository root:

```powershell
node .\virtualMachines\esp32\pathway\demo.mjs
```

Open <http://127.0.0.1:4320>. Enter a request and press **Send request**.
The SCREEN COBOL requester executes on the existing JavaScript p-machine;
its `SEND` addresses logical server class `echo`, not a physical URL.
The COBOLish server receives a fixed-width record and replies with it.
The browser displays the reply in the output field.

The demo creates three real JavaScript p-machine HTTP nodes, discovers their
UDP beacons, deploys two replicas, and keeps the third as a replacement
candidate. It defaults to loopback-only HTTP and explicitly allowed loopback
deployment hosts. No ESP32 service is overwritten.

Definitions and the controller identity survive graceful restart in
`.state/controller.json`. Stop with Ctrl+C, then run the same command again.
Ctrl+C stops the demo nodes and controller; independently running external
nodes retain their hosted services.

## Library

```js
import { PathwayController } from './src/controller.mjs';
import { compileCobolishToPcode } from '../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';

const controller = await new PathwayController({
  stateFile: 'C:\\pulse-state\\pathway.json',
  allowedHosts: ['127.0.0.1', '192.168.2.90'],
}).open();
await controller.listen({ udpPort: 4210 });
await controller.define({
  name: 'echo',
  replicas: 2,
  idempotent: true,
  artifact: compileCobolishToPcode(source, { hostServices: true }),
});
const reply = await controller.send('echo', 'hello');
await controller.close();
```

`runRequester()` in `src/requester.mjs` executes a compiled SCREEN COBOL
artifact with screen input/output bindings and an injected server-class
sender. `createPathwayHttpServer()` supplies the small browser host.
There is deliberately no unauthenticated remote deployment/configuration API.

## Durable inventory requester/server

Inventory uses **Microsoft SQL Server only**, with the aggregator's installed
`mssql` / `msnodesqlv8` drivers. The obsolete SQLite implementation, migration
command and database files have been removed after verifying their data in MSSQL.

```powershell
node .\virtualMachines\esp32\pathwayDemo\demo.mjs
```

Open <http://127.0.0.1:4322>. This separate demo leaves the echo application and
existing ESP32 services untouched. It starts two COBOLish inventory replicas,
two portable stock replicas, two spare JS nodes, and one shared MSSQL database
with data-only bridges.
Initial stock on a newly provisioned inventory schema is WIDGET 100, SENSOR 25,
and RELAY 50. Try these commands in order:

```text
INQUIRE WIDGET
RESERVE WIDGET 2 ORDER1
INQUIRE WIDGET
RELEASE ORDER1
```

Reservation IDs and item names are case-insensitive, 1-16 characters, starting
with a letter and containing letters, digits, hyphens or underscores. Quantity
is a positive integer up to 999999. Reservation IDs cannot be reused, even
after release. Business refusals, such as insufficient stock, are saved replies.

The [inventory server](../pathwayDemo/application/inventory.cob) is implemented
entirely in formally parsed COBOLish. Its entry point is:

```cobol
PROCEDURE DIVISION.
    PERFORM HANDLE-REQUEST
    STOP RUN.
```

Its paragraphs receive the command, tokenize and validate it, apply inventory
rules, format the reply and exchange bounded authenticated row snapshots/writes.
There is no Pascalish business library or `host.inventory_apply` in this build.
Native execution and JS recovery use identical P-code.
The COBOLish server extracts the stable request ID from the incoming JSON envelope.
The data-only bridge atomically commits the proposed stock change, reservation and saved reply
in one serializable SQL Server transaction. Reusing an ID with
the same canonical command returns its original reply, even after restart;
using it for a different command is an explicit conflict. Failed ledger writes
roll back stock changes. Inventory is marked replay-safe only because of this
durable request ledger, not because independent replica memory is reliable.

The browser saves the exact command and random request ID in local storage
**before** sending. On a lost reply or reload, **Retry saved request** reuses
that pair. Pending inputs are locked. A Web Lock coordinates tabs for the same
application; use a current browser on localhost. **Start new request** requires
confirmation before abandoning an uncertain request: it does not undo a commit.
Clearing browser storage loses browser recovery data; it does not undo stock.
Requester execution derives a stable ID for each SEND ordinal/server class.
Library callers must supply their own stable ID:

```js
await controller.send('inventory-service', 'RESERVE WIDGET 2 ORDER1', {
  requestId: 'a-persisted-unique-operation-id',
});
```

Database state persists in MSSQL; controller state remains in
`.state/inventory-controller.json`. Inventory defaults to HTTP 4322 and UDP 4323;
the existing `PATHWAY_HTTP_PORT`, `PATHWAY_UDP_PORT` and `PATHWAY_STATE_FILE`
overrides apply. The demo closes its authorities and SQL connection on graceful
shutdown. No database outage causes a fallback to a different database.

Inventory access is an **operator grant**, not an artifact-provided credential.
`createJsPmachineNodeServer({inventoryGrants})` accepts grants keyed by logical
service ID, each containing an explicitly configured loopback `/apply` endpoint
and bearer token. Only that service receives the binding. Capability placement
uses the service-specific grants verified through node HTTP status, not beacon
claims. Tokens remain process-local, out of artifacts, controller state, browser
responses and status. This demo provisions local nodes only; `--external-nodes`
is intentionally unavailable for inventory. Node deployment endpoints still
require the trusted-network boundary described below.

**Limits:** this is one database authority, not database HA, TMF or a blanket
exactly-once guarantee. An authority outage prevents stock operations; restored
availability plus the same database/ID allows recovery. Configure SQL Server
backup, recovery and availability according to the deployment's requirements.
The default ledger holds 10,000 requests, including inquiries and refusals.
At capacity, new IDs fail explicitly; existing IDs still replay. There is no
automatic eviction or archival tool: deleting ledger rows would remove their
replay protection and requires a separately designed retention policy.

Tests simulate reply loss **after commit**, retry through another actual COBOL
replica, lose both routing replies, recover the original requester ID, and
restart both controller and authority without applying a reservation twice.
They also verify rollback on ledger failure.

## SQL Server inventory demo

The inventory demo always uses the configured SQL Server:

```powershell
node .\virtualMachines\esp32\pathwayDemo\demo.mjs
```

Its operator configuration is
`virtualMachines/esp32/pathwayDemo/config.json` (Git-ignored). The local setup
uses `.\SQLEXPRESS`, database `PathwayDemo`, ODBC Driver 17 for SQL Server and
Windows integrated authentication as the process user; no password is stored.
It reuses the aggregator's installed `mssql` / `msnodesqlv8` dependencies.
`database.connectionStringEnvironment` optionally overrides the connection
string through the named environment variable. Controller/requester settings
and stock gateway settings also come from this JSON; relative paths resolve
against `pathwayDemo`, not the shell's working directory.
For another checkout, copy `pathwayDemo/config.example.json` to
`pathwayDemo/config.json` and configure the local SQL instance and LAN addresses.
The example is loopback-only with ESP32 preference disabled; for a board, set
the gateway bind/address and allowed clients explicitly before building.

Provision the target database beforehand and grant the Windows user access.
The store creates only its `dbo.pathway_inventory_*` tables; it does not modify
other application tables. Initial demo stock is seeded only when that inventory
schema is first created. Restarting never resets existing stock or saved replies.
The prior inventory data has already been migrated; there is no parallel local
database to fall back to.

SQL operations use parameterized requests, serializable transactions and a
transaction-owned application lock shared by all SQL authorities. Stock changes
and reply insertion commit together; the same request ID returns the same saved
reply. The Windows-authenticated authority uses a one-connection pool because
inventory operations are serialized anyway; cross-process safety comes from
SQL locks, not the pool. Lost HTTP replies still require recovery with the
original ID. Database downtime is an explicit failure.
SQL Server availability/backup configuration remains the operator's responsibility.

The real SQL integration test creates and removes its own randomly named test
database, requiring database-creation permissions. It is opt-in via
`PATHWAY_TEST_MSSQL_CONNECTION_STRING` (an ODBC Windows-auth connection string
without a database selection). It verifies competing replay requests,
ledger-write rollback, authority restart, conflicts and ledger capacity.
Use `--test-concurrency=1` when enabling the live SQL tests so simultaneous
compiler/database provisioning tests do not consume the bounded HTTP client's
latency budget. Replay concurrency itself is exercised within the SQL test,
including separate authority connection pools.

## Portable stock inquiry and ESP32

The application sources are in `../pathwayDemo/application`. Run
`node .\virtualMachines\esp32\pathwayDemo\build.mjs` from the repository root to
build `../pathwayDemo/artifacts`: requester and server P-code, compact maps,
native `PHI1` images and a target manifest. There are no SQL credentials in these
artifacts. The server source uses the existing formal Pascalish grammar; the
requesters use the formal SCREEN COBOL grammar.

Open <http://127.0.0.1:4324> and enter an item such as `WIDGET`.
The reply contains **two integer values**:

```json
{"inStock":100,"committed":7}
```

`inStock` is total physical stock, including committed units. `committed` is the
sum held by all active orders (released reservations no longer count).
Available-to-promise is their difference. Unknown items return 404, not zero
stock. Inquiry reads current committed data and does not consume request-ledger
capacity or replay stale inquiry results.

`stock-service.pas` runs unchanged on JS or ESP32 after build-time substitution
of the operator-configured gateway IPv4/port. It uses existing bounded
`host.tcp_exchange` and JSON bindings, so current firmware needs **no new build**.
The PC gateway accepts only a length-prefixed JSON item query and returns numeric
counts from MSSQL; it cannot reserve, release, execute SQL supplied by a client,
or expose database credentials. Frames are capped at 128 request / 512 response
bytes, one query per connection, with timeouts and at most 16 connections.
The native installation grants only that specific gateway IP/port.

The read-only TCP gateway is restricted to `stockGateway.allowedClients` and
defaults to the configured private network; it is **not authenticated or
encrypted**. Deploy only on a trusted isolated LAN, with firewall rules for
the configured clients and port (default 4325); do not expose it to the Internet.
An IP allowlist is not a cryptographic identity. The separate mutating inventory
authority remains bearer-authenticated and loopback-only.

With the MSSQL demo/gateway running, install the stock service:

```powershell
node .\virtualMachines\esp32\pathwayDemo\install-esp32.mjs
```

The installer refuses a full board or replacement of an existing named stock
context; it never stops other services. It uploads signed native service and
maintenance-daemon images into a free hosted slot. The physical S3 runs this
alongside the COBOL inventory server. The source request APIs are:

```text
POST http://board-address/api/inventory/stock
{"item":"WIDGET"}
```

This returns the two numeric properties directly. The Pathway endpoint
`POST /api/pathway/inventory-stock` takes `{"data":"WIDGET"}` and returns the
standard `{code:0,data:"...JSON counts..."}` record envelope.
When `esp32.preferForStock` is true, the stock browser tries that named ESP32
context first; failures are reported and retried on the controller's JS replicas.
This explicit native-first route does not make the board an automatically placed
multi-slot node. JS replica placement/recovery remains beacon-driven.

## Native COBOLish inventory server

The same `application/inventory.cob` now also builds as
`artifacts/inventory-native-server.phi`, alongside its P-code and compact map.
`inventoryGateway.address` and `.port` select an explicitly granted transaction
gateway (default port 4326); the compiler option is `inventoryGateway`.
The [server source](../pathwayDemo/application/inventory.cob) contains the complete
inventory algorithm in COBOLish paragraphs, including parsing, validation,
reserve/release/inquire decisions, reply formatting and framed database exchange.
There is no linked Pascalish inventory library and no `host.inventory_apply`.
The explicit `nativeTarget` integer profile, typed quoted host `CALL`s and
`PULSE SEND ... AS JSON` compile to an `extended` PHI1 image.
The JS fallback runs this same compiled COBOLish code.
The demo no longer starts a PC command-processing inventory authority.
The installer requests `hostImageResident=true` for both services and their
maintenance daemons: firmware authenticates each
complete image before executing it from an immutable PSRAM snapshot. This avoids
remote-storage page thrashing during validation and execution. Resident images
require PSRAM and firmware with this option implemented; paged installations keep
their existing storage-change checks. The board currently uses remote FFS for
artifact delivery at installation, not instruction fetching after installation.
Hosted installation runs on a separate worker, so remote artifact reads cannot
block the AsyncTCP event task or trigger its watchdog. Compact maps preserve
procedure-local and global declarations; native call frames consume those
declarations so nested library calls cannot overwrite their caller's variables.
The installer checks these firmware features and `hostCobolText` before changing
board files. Bounded COBOL text bindings preserve PICTURE padding/truncation,
unpadding only trailing ASCII spaces at typed host-call boundaries. Streamed
uploads accept files up to the extended image profile's 131072-byte limit.

The PC gateway provides only row reads and atomic conditional writes. The server
reads a stock/reservation snapshot and proposes row values plus its reply.
Inside a serializable transaction the bridge checks the durable request ledger,
rejects a changed snapshot with 503, and commits the writes and reply together.
Constraints and a stock/reservation sum check protect database integrity.
No SQL transaction remains open while waiting for the ESP32. Lost replies,
competing requests and board resets therefore cannot leave an open transaction.

With the demo running, install it into a free board slot:

```powershell
node .\virtualMachines\esp32\pathwayDemo\install-esp32.mjs --inventory
```

`esp32.inventoryCollectorId` names its context. With
`esp32.preferForInventory=true`, the inventory requester at port 4322 sends
commands to that native COBOL server first, including its stable derived request
ID and a process-local gateway token. On transport/server failure the host logs
the failure and retries through JS replicas **with the same ID**. The gateway and
the JS COBOLish server use the same MSSQL ledger, so a native commit followed by a lost
reply does not reserve stock twice. Definitive application errors are returned,
not silently retried as successful operations.

The transaction gateway is separate from the unauthenticated read-only stock
gateway. It requires both an allowlisted client IP and a timing-safe bearer-token
check before any mutation. The token is generated at demo startup and is neither
stored in configuration/artifacts/controller state nor sent to the browser. The
trusted requester host includes it in the board's event envelope; the compiled
COBOL forwards it to the gateway. Requests use bounded 4-byte length-prefixed
frames (2048-byte request limit, 1024-byte response limit). Bad IDs, conflicting ID
reuse, exhausted ledger, and database failure all fail explicitly.

**Transport is still plaintext TCP/HTTP on the trusted LAN**, not TLS. Isolate
the network and restrict the gateway/board ports with a firewall; possession of
the gateway token authorizes inventory mutations. Do not expose either service
publicly. This is not a general-purpose remote SQL endpoint.

The dot timer is no longer installed. The two S3 slots now run the native COBOL
inventory server and the Pascalish stock inquiry service. These volatile hosted
contexts must be reinstalled after a board restart; start the PC demo/gateways
first, then run each installer. The installers never stop unrelated contexts.

**What stays on the PC:** SQL Server, its gateways, controller and
browser host. The compiled stock service runs on ESP32, but SQL Server and a
browser requester host cannot themselves run there. Both the mutating COBOLish
inventory server and the read-only stock service can execute on the ESP32.

**Placement boundary:** the current demo still executes SCREEN COBOL requesters
and beacon-based coordination on the PC. Moving those to ESP32 is separate from
moving the inventory server; this build does not claim that only terminal
control remains off-board. The intended off-board exceptions are terminal control,
MSSQL with a data-only bridge, and explicitly enabled JS recovery.
The all-COBOLish inventory build uses a new controller state file
`inventory-cobol-v4-controller.json`; earlier controller states are retained unchanged.

## Discovery and placement

- Accepts existing `nodeBeacon` and `machineAvailability` UDP announcements.
  The source address must be explicitly allowed and match any advertised IP.
- Handles both full JavaScript beacons and minimal firmware beacons.
  A bounded `/status` and `/pmachine/service_host/status` probe verifies runtime
  and hosted ABI; a beacon's claimed runtime alone cannot authorize placement.
- Matches artifact targets and required host capabilities. Unsupported or
  capability-restricted artifacts are not silently downgraded.
- Places replicas on distinct nodes. This version uses one hosted-service slot
  per node; it refuses a slot occupied by another collector.
- Signs compact maps and uploads P-code through the existing FFS and hosted
  install endpoints. ESP32 receives the validated bounded `PHI1` representation;
  JavaScript receives text P-code. Both execute the same compiled COBOL logic.
- Periodically checks existing hosted instances, excludes unavailable/draining
  nodes, expires missing beacons, and deploys a replacement on a free candidate.
- Retires a recovered, superseded owned replica once the desired live replica
  count has been restored. Foreign hosted services are never retired.
- Startup adopts matching owned instances only after a fresh beacon and
  verification of the instance identity. Saved liveness is never trusted.

The current ESP32 installer requires a companion daemon. The adapter supplies
a low-frequency maintenance daemon using the existing host ABI. ESP32 needs
working FFS storage and current hosted-service firmware. Its compiled opcode
subset is narrower than the general desktop COBOLish runtime: the supplied
alphanumeric echo server fits the bounded native image.

To use independent nodes rather than the three local demo nodes:

```powershell
$env:PATHWAY_ALLOWED_HOSTS = '127.0.0.1,192.168.2.90'
$env:PATHWAY_UDP_PORT = '4210'
node .\virtualMachines\esp32\pathway\demo.mjs --external-nodes
```

Configure JavaScript node beacons to the controller's listening port, for example:

```powershell
node .\virtualMachines\esp32\pmachines\javascript\server.mjs --name worker-one --port 4112 --udp-announce-host 127.0.0.1 --udp-announce-port 4210
```

For slow firmware beacons use the library's default 180-second expiry; the
self-contained demo uses 10 seconds because its local nodes announce every
second. A LAN controller should have its own stable state file and exclusive
ownership of the configured deployment nodes. Beacons and existing deployment
HTTP are not authenticated; an IP allowlist is a trust boundary, not a substitute
for an isolated trusted network or authenticated transport.

## Resiliency contract

The tests exercise actual UDP discovery, signed upload/install, real hosted
COBOLish execution, HTTP requester submission, server loss, spare deployment,
and controller restart/re-adoption.

The supplied server was also installed on a physical ESP32-S3. Three requests,
including quotes and a backslash, completed through the SCREEN COBOL requester
and native COBOLish p-machine server. The prior dot timer was restored afterward.
To repeat on an idle board:

```powershell
node .\virtualMachines\esp32\pathway\verify-esp32.mjs --url http://board-address --confirm-test
```

This opt-in verifier refuses an active hosted service and removes its own
temporary service and uploaded files after testing.

- Requests have bounded timeouts and admission limits.
- Idempotent classes may retry once on a different replica. The demo echo
  operation is explicitly idempotent.
- Non-idempotent requests are **never automatically replayed**. If the reply is
  lost, the requester receives an explicit uncertain-outcome error: the server
  might already have executed the request.
- No general exactly-once processing, TMF transactions, replicated application data,
  active/standby controller, or Guardian process-pair emulation is claimed.
- Controller outage stops new routing until that single controller restarts.
- A state-file lock prevents concurrent controllers. After an ungraceful process
  kill, confirm the prior owner is dead before manually removing the adjacent
  `.lock` file, then restart. This is not automatic controller failover.
- Live artifact replacement and scale-down are rejected in this first slice;
  use a new class name for a new revision. Unused uploaded FFS artifacts are
  retained; deployment retries overwrite only their deterministic owned names.

## Languages and vendor model

`examples/echo.cob` uses the formal COBOLish grammar with explicit Pulse server
extensions: `PULSE SERVICE`, `PULSE RECEIVE INTO`, and `PULSE SEND`. These are
Pulse extensions, not claims to implement Guardian `$RECEIVE` file procedures.

`examples/echo.scob` uses the new formal ANTLR SCREEN COBOL grammar at
`languages/screencobol/grammar/ScreenCobol.g4`. Supported syntax and intentional
differences are documented in the language's README. The browser is a small
terminal-style renderer, not a 6530 terminal emulator.

References consulted:

- *Compaq NonStop Pathway/iTS SCREEN COBOL Reference Manual*, 426750-001,
  chapter 5 (Screen Section, `AT`, `FROM`/`TO`/`USING`) and chapter 6,
  `DISPLAY` and `SEND` (6-68 onward):
  <http://www.nonstoptools.com/manuals/Scobol.pdf>.
- *HP NonStop Pathway/iTS System Management Manual*, 426748-005,
  the Pathway environment and SERVER/server-class model:
  <http://www.nonstoptools.com/manuals/Pathway.pdf>.

These are references for an independently implemented subset, not a claim of
full source, protocol, or operational compatibility with HP NonStop.

## Verify

```powershell
node --test .\languages\screencobol\test\*.test.mjs .\languages\cobolish85\tests\pathway-server.test.mjs .\virtualMachines\esp32\pathway\test\*.test.mjs
```
