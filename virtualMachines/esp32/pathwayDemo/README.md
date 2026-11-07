# Pathway inventory demo

**A SCREEN COBOL front end, a COBOLish inventory server on ESP32, and durable
inventory in Microsoft SQL Server.**

Use the demo to inquire about stock, reserve items for an order, release a
reservation, and recover a request without applying it twice.

| Open | Purpose |
| --- | --- |
| [Inventory screen](http://127.0.0.1:4322/) | Submit `INQUIRE`, `RESERVE`, and `RELEASE` commands |
| [Stock screen](http://127.0.0.1:4324/) | Query physical stock and committed quantities |
| [ESP32 status](http://192.168.2.90/pmachine/service_host/status) | Check installed services, native invocation counts, and errors |
| [Controller status](http://127.0.0.1:4322/api/status) | Check JS replicas, spare nodes, and placement |

## 1. The application at a glance

```text
Browser terminal
       |
       v
SCREEN COBOL requester + terminal host       PC, port 4322 / 4324
       |
       +--> Primary server                   ESP32, 192.168.2.90
       |       |
       |       +--> Data-only TCP bridge     PC, 192.168.2.11
       |               |
       |               +--> Microsoft SQL Server
       |
       +--> JS p-machine replicas            PC, same durable database
            on recoverable primary failure
```

Inventory business rules execute in the server's compiled COBOLish P-code.
SQL Server and its bridges stay on the PC. The mutating bridge accepts row
reads and conditional commits, not inventory commands to interpret.

**Current boundary:** the browser terminal, SCREEN COBOL execution, Pathway
discovery/placement controller, SQL Server, data bridges, remote file storage,
and explicitly retained JS fallback all run on the PC. Only the primary servers
and their maintenance daemons run on ESP32. Moving requester execution and
primary coordination onto ESP32 remains unfinished.

## 2. The COBOLish inventory server

Source: [application/inventory.cob](application/inventory.cob).

The service is named `inventory-service`. Its entry point makes the three
application stages explicit:

```cobol
       PROCEDURE DIVISION.
           PERFORM PARSE-COMMAND
           PERFORM DISPATCH-COMMAND
           PERFORM FINISH-REPLY
           STOP RUN.
```

| Section | Responsibilities |
| --- | --- |
| `COMMAND-PARSING` | Receive the command, check printable ASCII, normalize case, split words, validate identifiers/quantity, and build the canonical command |
| `COMMAND-DISPATCH` | Read the durable ledger/snapshot, apply stock rules locally, and submit proposed row changes with the reply |
| `REPLY-HANDLING` | Preserve error status, return successful/saved replies, and provide shared number formatting |

Parsing uses `UNSTRING ... DELIMITED BY ALL SPACE` with a pointer, a tally,
and explicit overflow handling. Reply sentences use `STRING`. JSON uses typed
host bindings so values are escaped correctly rather than assembled by hand.
There is no linked Pascalish inventory business library in this server.

The source follows fixed-format COBOL layout: blank sequence columns 1-6,
indicator column 7, Area A in columns 8-11, and Area B in columns 12-72.
Long literals use column-7 continuation indicators. Builds explicitly select
`sourceFormat: 'fixed'`.

The native numeric subset uses signed whole-number `COMP-5` fields. The
compiler produces a PHI1 hosted image for ESP32 and the same P-code for JS
recovery. Host calls provide JSON, bytes, TCP exchange, and HTTP response
facilities; the application decisions remain visible in COBOLish.

### Supported commands

| Command | Result |
| --- | --- |
| `INQUIRE WIDGET` | Available and reserved quantities for the item |
| `RESERVE WIDGET 50 DEMO50A` | Hold 50 units under reservation `DEMO50A`, if enough are available |
| `RELEASE DEMO50A` | Return that reservation's units to available stock |

Item and reservation names are case-insensitive, 1-16 characters, begin with a
letter, and contain letters, digits, hyphens, or underscores. Quantities are
1-999999 with no leading zeros. A reservation ID cannot be reused, even after
release. Use a fresh ID each time you start a genuinely new reservation.

## 3. The SCREEN COBOL front end

Sources:

- [application/inventory.scob](application/inventory.scob): command entry and reply.
- [application/stock.scob](application/stock.scob): item entry and numeric stock counts.

SCREEN COBOL declares the screen size, labels, field positions, and the
WORKING-STORAGE items linked to input/output fields. Its requester flow is:

```cobol
DISPLAY BASE INVENTORY-SCREEN.
ACCEPT INVENTORY-SCREEN.
SEND REQUEST-TEXT TO "inventory-service"
    REPLY CODE 0 YIELDS REPLY-TEXT.
DISPLAY INVENTORY-SCREEN.
STOP RUN.
```

The browser renders the compiled screen definition. The PC executes the
requester's P-code and routes its `SEND` to the named service. The inventory
screen has a 64-character command field and a 96-character reply field.

Before sending, the browser saves the exact inputs and a random request ID.
After a lost reply, **Retry saved request** sends the same request again.
Do not start a new request merely because the first reply was lost.

## 4. Services running, and where

**Observed on 30 October 2026, approximately 15:24 local time.** Addresses below
describe the current local configuration, not defaults for every installation.
JS listener ports and replica placement can change after restart.

| Component | Runtime / language | Location | Role |
| --- | --- | --- | --- |
| `pathway-inventory` / `inventory-service` | Native p-machine / COBOLish | ESP32-S3, `192.168.2.90:80` | Primary mutating inventory server |
| `pathway-stock` / `inventory-stock` | Native p-machine / Pascalish | Same ESP32-S3 | Primary read-only stock-count service |
| Maintenance daemon, one per board service | Native p-machine / Pascalish | Same ESP32-S3 | Every 60 seconds, expires entries in the local `nodes` table |
| Inventory requester / terminal host | SCREEN COBOL + Node.js | PC, `127.0.0.1:4322` | Browser command screen and native-first routing |
| Stock requester / terminal host | SCREEN COBOL + Node.js | PC, `127.0.0.1:4324` | Browser stock-count screen and native-first routing |
| Pathway controller | JavaScript | PC, beacon UDP port `4323` | Discovery, two replicas per server class, and spare placement |
| Inventory transaction bridge | Node.js / framed TCP | PC, `192.168.2.11:4326` | Authenticated snapshot reads and atomic conditional commits |
| Stock bridge | Node.js / framed TCP | PC, `192.168.2.11:4325` | Allowlisted read-only stock queries |
| Microsoft SQL Server | MSSQL | PC, local `.\SQLEXPRESS`, database `PathwayDemo` | Stock, reservations, and durable request/reply ledger |
| Remote federated file storage | HTTP | PC, `192.168.2.11:4015` | Artifact delivery during board installation |

Both board services were running without errors and executing their images
from PSRAM. Instruction-page reads were zero. There is one shared hosted worker
for the board's two service contexts, not a separate worker per service.
The dot timer is not installed.

### JS fallback and spare nodes

| Node | Observed listener | Current placement |
| --- | --- | --- |
| `pathway-inventory-js-1` | `127.0.0.1:51214` | Inventory replica |
| `pathway-inventory-js-2` | `127.0.0.1:51215` | Inventory replica |
| `pathway-inventory-js-3` | `127.0.0.1:51216` | Stock replica |
| `pathway-inventory-js-4` | `127.0.0.1:51217` | Stock replica |
| `pathway-inventory-js-5` | `127.0.0.1:51218` | Spare |
| `pathway-inventory-js-6` | `127.0.0.1:51219` | Spare |

### Source versus live deployment

Updated on **30 October 2026**: the ESP32 now
runs the latest **2658-instruction** inventory image, including the three-section
refactor, Area A/B formatting, and `UNSTRING` changes. Stock was also restored
because the board had no installed contexts when the update began.

All seven focused tests passed with MSSQL. Physical checks verified whitespace
parsing, same-ID inquiry replay, excess-argument rejection, and the stock screen.
Invocation counters confirmed native execution without JS fallback; both
services had empty error fields and zero instruction-page reads. Existing
reservations were not changed.

The running PC JS inventory replicas still use the earlier revision
`ed115d5a3728902c`; they were not replaced by this ESP32-only update.

## 5. A short demonstration

1. Open the inventory screen and submit `INQUIRE WIDGET`.
2. Note its available quantity.
3. Submit a **new request**: `RESERVE WIDGET 50 DEMO50A`.
4. Open the stock screen and query `WIDGET`.
5. Submit another new request: `RELEASE DEMO50A`.
6. Query again to confirm the reservation was released.

Use an unused reservation ID instead of `DEMO50A` if it was used previously.
If fewer than 50 widgets are available, the reservation returns an insufficient
stock reply and does not change stock.

The stock service returns:

```json
{"inStock":100,"committed":50}
```

Those numbers are an example with 100 physical units and exactly 50 committed.
Actual counts include all existing orders. `inStock` means physical total,
not available quantity:

```text
available to promise = inStock - committed
```

To verify execution on the board, compare `pathway-inventory.httpInvocations`
before and after a command. It should increase; `lastError` should remain empty.
An attempted native call can also increase the counter before failing, so check
the error field and the controller's fallback log as well.

## 6. Recovery and database integrity

Each logical requester send has a stable ID. The MSSQL ledger saves the
canonical command and reply in the same transaction as its row changes.

- Same ID, same command: return the original saved reply.
- Same ID, different command: reject with a conflict.
- Changed snapshot before commit: reject for same-ID recovery.
- Lost native reply: JS recovery uses the same ID and ledger, avoiding a
  second reservation.
- An inquiry replay can return its historical saved reply; use a new request
  or the stock screen for a fresh reading.

The bridge compares snapshots and enforces stock/reservation consistency in a
serializable transaction. It does not hold an SQL transaction open across the
ESP32 network round trip.

## 7. Configuration, builds, and checks

Local settings are in ignored `config.json`; the reusable template is
[config.example.json](config.example.json). Both configurations try ESP32 first
for inventory and stock, retaining JS fallback for recoverable native failures.
Before using the template with a board, change each gateway's `address` to the
PC's LAN IPv4 address, set its listening `host` to that address or `0.0.0.0`,
and add the board's IP to `allowedClients`. The template's loopback-only bridges
are not reachable from ESP32.

`esp32.origin` set to `"any"` lets the server run on any live ESP32 node.
`install-esp32.mjs` reads live nodes from `esp32.nodesUrl` (the aggregator's
`/api/nodes`) and installs on the first with a free hosted-service slot; the
controller likewise places replicas on any beaconing node. Set `origin` to a
URL such as `http://192.168.2.90` to pin one node. In a gateway's
`allowedClients`, `"*"` admits any private-LAN IPv4 client, so whichever ESP32
node hosts the server can reach the bridges.

No bearer token is stored in the
configuration or compiled artifacts. The demo creates its token in memory and
the trusted PC routing layer supplies it to the server.

From the repository root:

```powershell
# Build the latest source; does not deploy or replace running services.
node .\virtualMachines\esp32\pathwayDemo\build.mjs

# Start the demo when it is not already running.
node .\virtualMachines\esp32\pathwayDemo\demo.mjs

# Install services into free ESP32 contexts, with gateways already running.
node .\virtualMachines\esp32\pathwayDemo\install-esp32.mjs --inventory
node .\virtualMachines\esp32\pathwayDemo\install-esp32.mjs
```

Do not start a second demo on occupied ports. The controller preserves deployed
revisions and rejects incompatible live replacement; changing source requires
a deliberate controller-state migration or new state file. The current live
state is `inventory-cobol-v4-controller.json`. Preserve earlier state files.

Installers do not replace an occupied context automatically. Stop only the
named context when deliberately updating it, and retain unrelated services.
Board contexts are volatile: after reboot, reinstall both services. SQL
inventory and the request ledger survive board resets.

Focused validation:

```powershell
$env:PATHWAY_TEST_MSSQL_CONNECTION_STRING = 'Driver={ODBC Driver 17 for SQL Server};Server=.\SQLEXPRESS;Trusted_Connection=Yes;'
node --test .\virtualMachines\esp32\pathway\test\inventory-native.test.mjs
```

**Trusted-LAN demo only:** HTTP/TCP transport is plaintext, not TLS. Restrict
the board and bridge ports with network isolation, firewall rules, and exact
client allowlists. Do not expose the mutation bridge publicly.

For implementation details, see the [Pathway guide](../pathway/README.md),
[build script](build.mjs), and [ESP32 installer](install-esp32.mjs).
