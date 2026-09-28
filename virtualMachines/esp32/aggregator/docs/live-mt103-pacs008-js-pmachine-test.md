# Live MT103 to PACS008 Test

## Purpose

This document records the end-to-end proof for the generated payment-ingestion solution running on the JavaScript PMachine.

The test uses real infrastructure:

- Windows MSMQ queues
- SQL Server Express
- SQL Server database `PulseDB`
- JavaScript PMachine pcode execution
- Persistent `ConversionService` request/reply semantics
- Data Mapper definition `MT103ToPACS008`
- Data Librarian type IDs `swift-mt103` and `pacs`

The Java service implementation is intentionally deferred. This proof covers the JavaScript PMachine path.

## Source Inputs

### Solution DSL

Source:

```text
aggregator/data/payment-ingestion.solution
```

The solution declares:

```text
queue IncomingMessages type mt103 direction input
  manager qm-secondary
  physical swift.mt103.inbound;

queue OutgoingPayments type pacs008 direction output
  manager qm-secondary
  physical swift.pacs008.outbound;

service ConversionService;
conversion MT103ToPACS008
  input mt103
  output pacs008
  map "mt103-to-pacs";

daemon MessageDaemon
  refresh 2 s
  reads IncomingMessages
  writes MessageStore
  uses ConversionService
  emits OutgoingPayments;
```

The daemon flow is compiled as:

```text
dequeue input
persist input
send service ConversionService synchronously
receive typed PACS reply
enqueue output
```

### External map

Source:

```text
aggregator/data/data-maps/mt103-to-pacs.map
```

The map contains 20 MT103-to-PACS rules. Important mappings include:

| MT103 source | PACS target | Transformation |
|---|---|---|
| field 20 | `GrpHdr.MsgId` | direct |
| field 21 | `PmtId.EndToEndId` | direct |
| field 23B | `PmtTpInf.LclInstrm.Prtry` | uppercase/trim |
| field 32A value date | `IntrBkSttlmDt` | YYMMDD to ISO date |
| field 32A currency | `IntrBkSttlmAmt.@Ccy` | uppercase/trim |
| field 32A amount | `IntrBkSttlmAmt.#text` | MT amount to decimal |
| field 50K | `Dbtr.Nm` | party-name extraction |
| field 59 | `Cdtr.Nm` | party-name extraction |
| field 71A | `ChrgBr` | MT charge bearer to ISO |
| field 72 | `InstrForNxtAgt.InstrInf` | direct |

### WFL bindings

Source:

```text
aggregator/data/mt103-pacs008-daemon.wfl
```

The logical resources are bound to:

```text
IncomingMessages  -> swift.mt103.inbound
OutgoingPayments  -> swift.pacs008.outbound
MessageStore      -> PaymentMessages
```

The queue manager is `qm-secondary` and the database manager is `db-mssql`.

The generated deployment also declares a persistent conversion service with:

```text
persistent = true
minInstances = 1
maxInstances = 4
idleTimeout = 5 minutes
```

## Compilation

The live runner compiles the solution at startup:

```powershell
node .\aggregator\scripts\compile-solution-dsl.mjs .\aggregator\data\payment-ingestion.solution
```

The generated artifact includes:

```text
ORCH_SYNC_SERVICE
ROUTE_EMIT "OutgoingPayments"
DB_INSERT "MessageStore","incoming_messages",...
MAP_ConversionService_MT103ToPACS008
```

The daemon uses a synchronous service call, not asynchronous spawn/wait:

```pascal
send service "ConversionService"
  with message
  timeout 30 s
  reply into converted;
```

The service owns the mapper and returns a `pacs` value.

## Real Connection Configuration

The test uses Windows authentication against local SQL Server Express:

```powershell
$env:MSSQL_DRIVER = 'msnodesqlv8'
$env:MSSQL_DATABASE_CONNECTION_STRING = 'Driver={ODBC Driver 17 for SQL Server};Server=localhost\SQLEXPRESS;Database=PulseDB;Trusted_Connection=Yes;TrustServerCertificate=Yes;'
```

No password is required or stored in the repository.

## Test Runner

Runner:

```text
aggregator/scripts/run-solution-live-js-pmachine.mjs
```

Run it with:

```powershell
$env:MSSQL_DRIVER='msnodesqlv8'
$env:MSSQL_DATABASE_CONNECTION_STRING='Driver={ODBC Driver 17 for SQL Server};Server=localhost\SQLEXPRESS;Database=PulseDB;Trusted_Connection=Yes;TrustServerCertificate=Yes;'
$env:MSMQ_QUEUE_PREFIX='pulse-solution-js-live'
node .\aggregator\scripts\run-solution-live-js-pmachine.mjs
```

The runner:

1. Compiles the solution and WFL.
2. Builds the deployment binding manifest.
3. Creates `PaymentMessages` if necessary.
4. Deletes only prior rows with the `LIVE-JS-PMACHINE-` marker.
5. Creates and truncates dedicated MSMQ test queues.
6. Enqueues ten MT103 JSON messages.
7. Claims each message from real MSMQ.
8. Executes the generated pcode on the JS PMachine.
9. Calls the persistent conversion service synchronously.
10. Executes the real MT103-to-PACS008 mapper.
11. Inserts the incoming row into SQL Server.
12. Applies the logical output binding to the real output queue.
13. Completes the MSMQ claim.
14. Queries SQL Server and checks output queue depth.

The live test fixture uses actual multiline MT103 party fields so `mtpartyname` receives valid input:

```text
:50K:/123456789
ALPHA IMPORTS LTD
:59:/000987654321
BETA SUPPLIES INC
```

## Assertions

For each of the ten service calls, the runner asserts:

```text
field 20 -> PACS GrpHdr.MsgId
field 21 -> PACS EndToEndId
field 23B -> CRED
32A date -> 2026-09-15
32A currency -> CAD
32A amount -> 12500.45
50K -> ALPHA IMPORTS LTD
59 -> BETA SUPPLIES INC
70 -> remittance text
71A -> SHA
72 -> next-agent instruction
```

It also asserts that:

```text
10 input claims are completed
10 database rows exist
all database rows have status received
10 output messages exist
```

## Observed Result

The completed live run returned:

```json
{
  "status": "PASS",
  "execution": "JS PMachine compiled solution with persistent ConversionService request/reply",
  "queues": {
    "prefix": "pulse-solution-js-live",
    "input": ".\\private$\\pulse-solution-js-live.swift.mt103.inbound",
    "output": ".\\private$\\pulse-solution-js-live.swift.pacs008.outbound",
    "outputDepth": 10
  },
  "database": {
    "database": "PulseDB",
    "table": "PaymentMessages",
    "rows": 10,
    "statuses": ["received"]
  },
  "mapper": {
    "sourceType": "swift-mt103",
    "targetType": "pacs",
    "map": "MT103ToPACS008"
  }
}
```

A retained output message contained populated values including:

```text
MsgId: LIVE-JS-PMACHINE-001
EndToEndId: E2E-001
SettlementDate: 2026-09-15
Creditor: BETA SUPPLIES INC
```

The output queue retained the ten messages for inspection. The SQL rows remain in `PulseDB.PaymentMessages` with the `LIVE-JS-PMACHINE-` marker.

## Regression Tests

The following tests pass:

```powershell
node .\aggregator\scripts\test-solution-dsl.mjs
node .\aggregator\scripts\test-persistent-service-wfl.mjs
node .\aggregator\scripts\test-service-request-reply.mjs
node .\aggregator\scripts\test-persistent-service-manager.mjs
node .\aggregator\scripts\test-mt103-pacs008-wfl.mjs
```

Expected result:

```text
[solution-dsl] PASS
[persistent-service-wfl] PASS
[service-request-reply] PASS
[persistent-service-manager] PASS
[mt103-pacs008-wfl] PASS
```

## Scope and Deferred Work

Completed in this proof:

- JavaScript PMachine execution
- Real MSMQ input and output
- Real SQL Server insertion and query
- Typed service request/reply boundary
- Persistent service lifecycle metadata
- Data Librarian type IDs
- External MT103-to-PACS map execution
- Populated PACS008 output

Deferred:

- Live Java service instance implementation
- Java-node deployment proof
- Replacing all legacy quoted Pascalish map-rule syntax with canonical Data Mapper/MAPL imports in generated source

The external JSON map and Data Librarian contracts are the behavioral source of truth for this test.
