# Workflow DSL (Deployment Translator)

WFL translates logical resources and deployment intent into binding manifests. Application behavior remains p-code produced independently from Pascalish, Cobolish, or VBish.

Source file extension:
- .wfl

Compiler:
- scripts/compile-workflow-dsl.mjs

Default input:
- data/workflow.wfl

Generated outputs:
- data/symbols.generated.json
- data/workflows.generated.json
- data/workflow-compiled.json

## Syntax

Queue symbol:

QUEUE "symbol" -> "physical.queue.name" MANAGER "qm-primary" TYPE "type-id" MODE SYNC;
QUEUE "symbol" -> "physical.queue.name" MANAGER "qm-primary" TYPES ("type-a", "type-b") MODE ASYNC;

Database symbol:

```wfl
DATABASE "SqlLedger" -> "PulseSqlLedger" TYPE "PaymentRecord" MANAGER "db-mssql" CONNECTION "env:MSSQL_DATABASE_CONNECTION_STRING";
```

WFL stores the connection reference, never the secret value.

File symbol:

FILE "symbol" -> "/absolute/or/virtual/path";

API symbol:

API "symbol" BASE "http://host:port";

Service deployment plan:

```wfl
DEPLOYMENT "payments" PROJECT "payments-project" TARGETS ("node-a", "node-b") BEGIN
  SERVICE "mt103-to-pacs008" FILE "mt103.pcode" QUEUE "swift.mt103.inbound" -> "pacs.008.outbound" TARGETS ("node-a", "node-b") STARTUP TRUE;
  REMOVE SERVICE "mt103-to-pacs008" FROM TARGETS ("node-a");
END;
```

`SERVICE`, `PROGRAM`, and `DAEMON` items deploy to their listed nodes when the plan is executed. `REMOVE SERVICE` removes only that service instance from each listed node; instances on other targets remain deployed. Omitting a target from the backend DELETE API continues to remove the whole deployment.

Workflow block:

WORKFLOW "workflow-id" BEGIN
  STEP "step-id" CALL API "api-symbol" POST "/relative/route";
END;

Conditional block with statement groups:

WORKFLOW "pain2-routing" BEGIN
  IF FIELD "message.status" EQUALS "reject" THEN
    BEGIN
      STEP "route-reject" ROUTE QUEUE "pain2RejectQueue";
      STEP "set-reject-state" SET STATE "transactionState" = "rejected";
    END;
  ELSE;
    BEGIN
      STEP "route-accept" ROUTE QUEUE "pain2AcceptedQueue";
      STEP "set-accept-state" SET STATE "transactionState" = "accepted";
    END;
  ENDIF;
END;

## BNF

```bnf
<file> ::= { <symbol_decl> | <workflow_decl> }

<symbol_decl> ::= <queue_decl> | <database_decl> | <file_decl> | <api_decl>

<queue_decl> ::= 'QUEUE' <qstring> '->' <qstring> [ 'MANAGER' <qstring> ] [ 'TYPE' <qstring> | 'TYPES' '(' <qstring_list> ')' ] [ 'MODE' ( 'SYNC' | 'ASYNC' ) ] ';'
<database_decl> ::= 'DATABASE' <qstring> '->' <qstring> [ 'TYPE' <qstring> ] [ 'MANAGER' <qstring> ] [ 'CONNECTION' <qstring> ] ';'
<file_decl> ::= 'FILE' <qstring> '->' <qstring> ';'
<api_decl> ::= 'API' <qstring> 'BASE' <qstring> ';'

<workflow_decl> ::= 'WORKFLOW' <qstring> 'BEGIN' <statement_list> 'END;'

<statement_list> ::= { <statement> }

<statement> ::= <call_api_stmt>
              | <route_queue_stmt>
              | <set_state_stmt>
              | <if_stmt>

<call_api_stmt> ::= 'STEP' <qstring> 'CALL' 'API' <qstring> <http_method> <qstring> ';'
<route_queue_stmt> ::= 'STEP' <qstring> 'ROUTE' 'QUEUE' <qstring> ';'
<set_state_stmt> ::= 'STEP' <qstring> 'SET' 'STATE' <qstring> '=' <qstring> ';'

<if_stmt> ::= 'IF' 'FIELD' <qstring> <cond_op> <qstring> 'THEN' <branch> [ 'ELSE;' <branch> ] 'ENDIF;'
<branch> ::= <statement> | 'BEGIN' <statement_list> 'END;'

<http_method> ::= 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
<cond_op> ::= 'EQUALS' | 'CONTAINS'

<qstring_list> ::= <qstring> { ',' <qstring> }
<qstring> ::= '"..."' | "'...'"
```

Comments:

- `#` for full-line comments
- `--` for inline comments (preferred)
- `//` for inline comments (legacy)

Example:

API "aggregator" BASE "http://localhost:4000"; -- local backend

## Run

npm run compile:workflow
npm run compile:workflow:pcode
npm run interpret:workflow

Or with custom paths:

node scripts/compile-workflow-dsl.mjs \
  --in data/workflow.wfl \
  --symbols-out data/symbols.generated.json \
  --workflow-out data/workflows.generated.json \
  --artifact-out data/workflow-compiled.json

Interpret and execute one workflow:

node scripts/interpret-workflow.mjs \
  --in data/workflow.wfl \
  --workflow enqueue-pacs

Dry run (no API calls):

node scripts/interpret-workflow.mjs \
  --in data/workflow.wfl \
  --workflow enqueue-pacs \
  --dry-run

Evaluate conditional branches with runtime context JSON:

node scripts/interpret-workflow.mjs \
  --in data/workflow.wfl \
  --workflow pain2-routing \
  --dry-run \
  --context '{"message":{"type":"pain2","status":"reject"}}'

PowerShell-safe alternative (recommended on Windows):

node scripts/interpret-workflow.mjs \
  --in data/workflow.wfl \
  --workflow pain2-routing \
  --dry-run \
  --context-file data/workflow-context-reject.json

Workflow control steps may still be lowered to p-code for legacy execution. Resource declarations translate to the binding manifest and are not application instructions.

Compile one workflow control block to PMachine p-code:

node scripts/compile-workflow-to-pcode.mjs \
  --in data/workflow.wfl \
  --workflow pain2-routing \
  --out ../artifacts/pcode/workflow-router.pcode \
  --out-map ../artifacts/pcode/workflow-router.program.json

Run the generated workflow pcode in JS PMachine simulator:

node scripts/run-js-pmachine.mjs \
  --pcode ../artifacts/pcode/workflow-router.pcode \
  --program-map ../artifacts/pcode/workflow-router.program.json \
  --input-queue queue.pain2.in \
  --message-file data/lynx-reply-pacs002.xml
