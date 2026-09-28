# Language Database and Queue Runtime

Status: implemented and covered by focused regressions.

## Architecture

Pascalish, Cobolish, and VBish have independent frontends and p-code backends. None of the three languages is translated into another source language, and none generates JavaScript as an executable target.

```text
Pascalish -> Pascalish AST -> p-code
Cobolish  -> Cobolish AST  -> p-code
VBish     -> VBish AST      -> p-code

WFL -> deployment binding manifest
```

The same p-code is consumed by PMachine runtimes. JavaScript is a host/runtime implementation, not a compilation target.

## Database DML

All three compilers emit these portable instructions:

```text
DB_INSERT database,table,columns
DB_SELECT database,table,columns,whereColumn,whereOperator
DB_UPDATE database,table,columns,whereColumn,whereOperator
DB_DELETE database,table,whereColumn,whereOperator
```

Language forms:

```pascalish
DbInsert(Ledger, 'Records', 'id,status', id, status);
DbSelect(Ledger, 'Records', 'id,status', 'id', '=', id, id, status);
DbUpdate(Ledger, 'Records', 'status', 'id', '=', id, status);
DbDelete(Ledger, 'Records', 'id', '=', id);
```

```cobol
CALL "DB-INSERT" USING Ledger "Records" "id,status" RECORD-ID RECORD-STATUS.
CALL "DB-SELECT" USING Ledger "Records" "id,status" "id" "=" RECORD-ID RECORD-ID RECORD-STATUS.
CALL "DB-UPDATE" USING Ledger "Records" "status" "id" "=" RECORD-ID RECORD-STATUS.
CALL "DB-DELETE" USING Ledger "Records" "id" "=" RECORD-ID.
```

```vb
DbInsert(Ledger, "Records", "id,status", Id, Status)
DbSelect(Ledger, "Records", "id,status", "id", "=", Id, Id, Status)
DbUpdate(Ledger, "Records", "status", "id", "=", Id, Status)
DbDelete(Ledger, "Records", "id", "=", Id)
```

`UPDATE` and `DELETE` require a predicate. Providers parameterize values and validate identifiers and operators.

## Queue Writes

Portable queue instructions distinguish acknowledgement behavior:

```text
QUEUE_WRITE_SYNC logicalQueue
QUEUE_WRITE_ASYNC logicalQueue
```

`QUEUE_WRITE_SYNC` waits for the host queue adapter acknowledgement. `QUEUE_WRITE_ASYNC` allows dispatch to proceed concurrently; the host still tracks completion before teardown.

Language forms:

```pascalish
QueueWriteSync(Orders, 'confirmed');
QueueWriteAsync(Audit, 'recorded');
```

```cobol
CALL "QUEUE-WRITE-SYNC" USING Orders "confirmed".
CALL "QUEUE-WRITE-ASYNC" USING Audit "recorded".
```

```vb
QueueWriteSync(Orders, "confirmed")
QueueWriteAsync(Audit, "recorded")
```

Pascalish `enqueue queue with value` is the asynchronous form.

## WFL Translation

WFL supplies deployment bindings; it does not compile application logic.

```wfl
DATABASE "SqlLedger" -> "PulseSqlLedger"
  TYPE "PaymentRecord"
  MANAGER "db-mssql"
  CONNECTION "env:MSSQL_DATABASE_CONNECTION_STRING";

QUEUE "Orders" -> "payments.orders"
  MANAGER "qm-primary"
  TYPE "PaymentRecord"
  MODE SYNC;

QUEUE "Audit" -> "payments.audit"
  MANAGER "qm-primary"
  TYPE "AuditTrail"
  MODE ASYNC;
```

Connection values remain outside source and p-code. `CONNECTION` stores a reference such as `env:MSSQL_DATABASE_CONNECTION_STRING`, not the credential itself.

## Runtime Interfaces

The JavaScript PMachine returns queue deliveries with `queueName`, `message`, and `deliveryMode`. Runtime binding resolves the logical queue through the WFL manifest before calling the configured manager.

The Java PMachine uses `aggregator/tools/java-pmachine/QueueBridge.java`. Hosts implement:

```java
CompletionStage<Receipt> write(
    String logicalQueue,
    String payload,
    DeliveryMode mode
);
```

## Verification

Run from `aggregator`:

```powershell
node scripts/test-independent-language-dml-pcode.mjs
node scripts/test-independent-language-queue-pcode.mjs
node scripts/test-wfl-runtime-bindings.mjs

Set-Location tools/java-pmachine
javac QueueBridge.java PmachineRunner.java
java PmachineRunner queue-write-conformance.pcode
```
