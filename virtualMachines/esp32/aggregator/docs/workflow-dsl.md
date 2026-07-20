# Workflow DSL (Separate Compiler)

This DSL is intentionally compiled by a separate compiler from the routing-mapper DSL so it can evolve independently.

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

QUEUE "symbol" -> "physical.queue.name" TYPE "type-id";
QUEUE "symbol" -> "physical.queue.name" TYPES ("type-a", "type-b");

File symbol:

FILE "symbol" -> "/absolute/or/virtual/path";

API symbol:

API "symbol" BASE "http://host:port";

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

<symbol_decl> ::= <queue_decl> | <file_decl> | <api_decl>

<queue_decl> ::= 'QUEUE' <qstring> '->' <qstring> [ 'TYPE' <qstring> | 'TYPES' '(' <qstring_list> ')' ] ';'
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

Compile one workflow to PMachine pcode (ESP32-compatible runtime path):

node scripts/compile-workflow-to-pcode.mjs \
  --in data/workflow.wfl \
  --workflow pain2-routing \
  --out ../pcode/workflow-router.pcode \
  --out-map ../pcode/workflow-router.program.json

Run the generated workflow pcode in JS PMachine simulator:

node scripts/run-js-pmachine.mjs \
  --pcode ../pcode/workflow-router.pcode \
  --program-map ../pcode/workflow-router.program.json \
  --input-queue queue.pain2.in \
  --message-file data/lynx-reply-pacs002.xml
