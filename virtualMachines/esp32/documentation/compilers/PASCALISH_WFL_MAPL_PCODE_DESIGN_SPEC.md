# Pascalish, WFL, MAPL, and P-Code Design Spec

Version: 2026-09-20
Status: Approved architecture; implementation evolves under the compatibility contract

## 1. Purpose and Scope

This document consolidates the language and runtime updates for:
- Pascalish (program and service language)
- WFL (WorkFlowLanguage deployment and placement language)
- MAPL (mapping language)
- P-Code runtime extensions

It provides a normalized final grammar baseline and calls out open issues that should be resolved before parser/runtime lock.

## 2. Design Principles

- Keep grammar explicit and parser-friendly.
- Keep runtime opcodes small and orthogonal.
- Separate declaration syntax (Pascalish, WFL, MAPL) from execution semantics (P-Code).
- Preserve pcode-driven behavior where possible and avoid hardcoded firmware policy.
- Compile Pascalish, Cobolish, and VBish independently to PMachine p-code.
- Translate WFL into deployment bindings; do not use WFL as an application compiler.
- Keep connection strings and credentials out of source programs and p-code.

The implemented database and queue contract is documented in [LANGUAGE_DATABASE_QUEUE_RUNTIME.md](LANGUAGE_DATABASE_QUEUE_RUNTIME.md).

## 3. Final Grammar Baseline

## 3.1 Pascalish (Normalized BNF)

```bnf
<compilationUnit> ::= <decl>* EOF

<decl> ::= <programDecl>
         | <serviceDecl>
         | <daemonDecl>
         | <typeDecl>
         | <varDecl>
         | <queueDecl>
         | <fileDecl>

<placement> ::= "on" ("local" | "parent" | "child" | "sibling" | "alternate")

<programDecl> ::= "program" <Ident> [<placement>] ";" <block> "."

<serviceDecl> ::= "service" <Ident> [<placement>] ";" <serviceBody> "end" ";"
<serviceBody> ::= <statement>*

<daemonDecl> ::= "daemon" <Ident> [<placement>] <daemonSchedule> ";" <block>
<daemonSchedule> ::= "refresh" <Expr> "ms"
                   | "every" <Expr> ("ms" | "second" | "seconds")

<typeDecl> ::= "type" <Ident> "=" <type> ";"
<varDecl> ::= "var" <Ident> ":" <type> [<placement>] ";"
<fileDecl> ::= "file" <Ident> "of" <type> [<placement>] ";"

<queueDecl> ::= "queue" <Ident> <queueType> [<placement>] ";"

<queueType> ::= "queue" "[" <Expr> ".." <Expr> "]" "of" <type>
              | "queue" "<" <type> ">"

<stackType> ::= "stack" "[" <Expr> ".." <Expr> "]" "of" <type>
              | "stack" "<" <type> ">"

<priorityQueueType> ::= "priorityqueue" "[" <Expr> ".." <Expr> "]" "of" <type>
                      | "priorityqueue" "<" <type> ">"

<recordType> ::= "record" <recordField>* "end"
<recordField> ::= <Ident> ":" <type> ";"

<type> ::= <simpleType>
         | <recordType>
         | <queueType>
         | <stackType>
         | <priorityQueueType>
         | <fixedArrayType>
         | <dynamicArrayType>
         | <userType>

<fixedArrayType> ::= "array" "[" <Expr> ".." <Expr> "]" "of" <type>
<dynamicArrayType> ::= "array" "<" <type> ">" "of" <type>

<block> ::= "begin" <statement>* "end"

<statement> ::= <assignStmt>
              | <callStmt>
              | <ifStmt>
              | <whileStmt>
              | <forStmt>
              | <repeatStmt>
              | <block>
              | <enqueueStmt>
              | <dequeueStmt>
              | <peekStmt>
              | <pushStmt>
              | <popStmt>
              | <concurrentStmt>
              | <fileStmt>

<enqueueStmt> ::= "enqueue" <Ident> "with" <Expr> ";"
<dequeueStmt> ::= "dequeue" <Ident> "into" <Ident> ";"
<peekStmt> ::= "peek" <Ident> "into" <Ident> ";"

<pushStmt> ::= "push" <Ident> "with" <Expr> ";"
<popStmt> ::= "pop" <Ident> "into" <Ident> ";"

<concurrentStmt> ::= <cobeginStmt>
                   | <asyncStmt>
                   | <waitStmt>
                   | <syncStmt>
                   | <subflowStmt>

<cobeginStmt> ::= "cobegin" <statement>* "coend" ";"
<asyncStmt> ::= "async" <statement>
<waitStmt> ::= "wait" "all" ";"
             | "wait" <Ident> ";"
<syncStmt> ::= "sync" <Ident> ";"
<subflowStmt> ::= "subflow" <String> ["with" <exprList>] ";"

<fileStmt> ::= "open" <Ident> "for" ("read" | "write") ";"
             | "read" <Ident> "into" <Ident> ";"
             | "write" <Ident> "with" <Expr> ";"
             | "close" <Ident> ";"
```

## 3.2 WFL (Normalized BNF)

```bnf
<wflUnit> ::= (<clusterDecl> | <deployDecl> | <bindQueueDecl> | <bindFileDecl> | <evictDecl>)* EOF

<clusterDecl> ::= "cluster" <Ident> "{" <clusterBody>* "}"
<clusterBody> ::= <clusterDecl> | <Ident> ";"

<deployDecl> ::= "deploy" <deployTarget> "to" "cluster" <Ident> ";"
<deployTarget> ::= "program" <Ident>
                 | "service" <Ident>
                 | "daemon" <Ident>
                 | "queue" <Ident>
                 | "file" <Ident>

<bindQueueDecl> ::= "bind" "queue" <Ident> <queueBindingBody>
<queueBindingBody> ::= "manager" <Ident>
                     "name" <String>
                     "cluster" <Ident>
                     ["fallback" <Ident>]
                     ["mode" <Ident>]
                     ";"

<bindFileDecl> ::= "bind" "file" <Ident> <fileBindingBody>
<fileBindingBody> ::= ("path" <String> | "device" <String> | "url" <String>)
                     "cluster" <Ident>
                     ["mode" <Ident>]
                     ["rotate" <Ident>]
                     ["maxsize" <Expr>]
                     ";"

<evictDecl> ::= "evict" "service" <Ident> "after" "idle" <Expr> <timeUnit>
                ["warm" "reload" | "cold" "reload"]
                ["fallback" ("parent" | "alternate")]
                ";"

<timeUnit> ::= "ms" | "second" | "seconds" | "minute" | "minutes"
```

### 3.2.1 WFL environment configuration (implemented)

The implemented grammar is [`languages/wfl/grammar/WorkflowDsl.g4`](../../../../languages/wfl/grammar/WorkflowDsl.g4). A WFL file assigns
global names (queues, files, databases, APIs, services). Those assignments can be
computed per environment at compile time, so the same file moves from dev to test to
prod by changing only the selected environment.

```bnf
<item>              ::= ... | <letDecl> | <defaultEnvironmentDecl> | <configIfDecl>
<defaultEnvironmentDecl> ::= "DEFAULT" "ENVIRONMENT" <stringExpr> ";"
<letDecl>           ::= "LET" <Ident> "=" <stringExpr> ";"
<configIfDecl>      ::= "IF" <condition> "THEN" <item>*
                        ("ELSIF" <condition> "THEN" <item>*)*
                        ["ELSE" <item>*] "ENDIF" ";"
<condition>         ::= <andCondition> ("OR" <andCondition>)*
<andCondition>      ::= <notCondition> ("AND" <notCondition>)*
<notCondition>      ::= "NOT" <notCondition> | <primaryCondition>
<primaryCondition>  ::= "(" <condition> ")" | "TRUE" | "FALSE"
                      | <stringExpr> <compareOp> <stringExpr>
                      | <stringExpr> ["NOT"] "IN" "(" <stringExpr> ("," <stringExpr>)* ")"
                      | <stringExpr> ("LIKE" | "MATCHES" | "CONTAINS") <stringExpr>
                      | <stringExpr> ("STARTS" | "ENDS") "WITH" <stringExpr>
<compareOp>         ::= "=" | "EQUALS" | "<>" | "!=" | "<" | "<=" | ">" | ">="
<stringExpr>        ::= <stringAtom> ("&" <stringAtom>)*
<stringAtom>        ::= <String> | <Number> | <Ident> | "ENVIRONMENT"
                      | "ENV" "(" <stringExpr> ["," <stringExpr>] ")"
                      | ("LOWER" | "UPPER") "(" <stringExpr> ")"
```

Semantics:

- Items are evaluated top to bottom, like a preprocessor. `LET` and `IF` affect only the
  items that follow them. `IF` branches do not open a scope.
- Every string literal in the file supports `${name}` interpolation. `${ENVIRONMENT}` is
  the selected environment, and `$${` produces a literal `${`. Referencing an unknown
  variable is a compile error.
- Environment precedence: `--environment` / `options.environment`, then
  `PULSE_ENVIRONMENT`, then `DEFAULT ENVIRONMENT` in the file, then `default`.
  `DEFAULT ENVIRONMENT` may appear at most once, before anything reads `ENVIRONMENT`.
- `--define name=value` (repeatable) / `options.variables` overrides a `LET` of the
  same name.
- Comparisons are ordinal and case-sensitive. Use `LOWER`/`UPPER` for case-insensitive
  tests. `LIKE` is an anchored glob (`*`, `?`). `MATCHES` is a regular expression.
- `ENV("NAME")` fails when the variable is unset. `ENV("NAME", "fallback")` is optional.
- The configuration `IF` is compile time only. The workflow-step `IF FIELD ... ENDIF`
  inside `WORKFLOW` blocks is the separate runtime construct and is unchanged.
- The compile result includes `configuration: { environment, environmentSource, variables }`.

Example:

```wfl
DEFAULT ENVIRONMENT "dev";
LET region = "eu";
LET ledgerConn = ENV("LEDGER_CONN", "Server=localhost");

IF ENVIRONMENT = "prod" THEN
  LET prefix = "PROD";
ELSIF ENVIRONMENT IN ("test", "uat") THEN
  LET prefix = "TEST";
ELSE
  LET prefix = "DEV";
ENDIF;

QUEUE "payments.in" -> "${prefix}.${region}.PAYMENTS.IN" MANAGER "QM.${ENVIRONMENT}";
DATABASE "ledger" -> "ledger_${prefix}" CONNECTION "${ledgerConn}";

IF ENVIRONMENT <> "prod" THEN
  API "mock-bank" BASE "http://localhost:9000/${ENVIRONMENT}";
ENDIF;
```

```text
node ../../languages/wfl/src/compile-workflow-dsl.mjs --in estate.wfl --environment test
node ../../languages/wfl/src/compile-workflow-dsl.mjs --in estate.wfl --environment prod --define region=us
```

### 3.2.2 WFL `FLOW` block (visual designer)

The visual flow designer (formerly JSON `.vfl`) now stores the diagram inside the WFL file
as a `FLOW` block. The compiler emits it as `flows[]`. In VS Code use **Pulse: Open in Flow
Designer** (or *Reopen Editor With… → WFL Flow Designer*). The designer rewrites only the
statements that changed (moving a node edits just its `AT` clause), and all other items in
the file are left untouched. A `FLOW` placed inside a configuration `IF` is not editable by
the designer.

```bnf
<flowDecl>   ::= "FLOW" <String> "BEGIN" <flowStmt>* "END" ";"
<flowStmt>   ::= "@" <Ident> <value> ";"
               | "SEED" <String> ";"
               | "NODE" <String> ["KIND" <String>] ["TYPE" <String>] ["LABEL" <String>]
                 ["CATALOG" <String>] ["SOURCE" <String>] ["AT" <Number> "," <Number>]
                 ["TARGET" <String> ["IP" <String>] ["SERVICES" "(" <String> ("," <String>)* ")"]
                 ["VIA" <String>]] ";"
               | "LINK" <String> "TO" <String> "VIA" <String> ["LABEL" <String>] ";"
```

Embedded `FLOW ... BEGIN ... END;` blocks remain available for existing diagrams.
New visual documents default to `.vfl` (`pulse.catalogStudio.defaultVflExtension`);
configuration/deployment belongs in a separate `.wfl` file.

### 3.2.3 Executable VFL graphs and separate WFL deployment editor

The VFL designer owns nodes, executable source references, positions, and message
links. The WFL configuration/deployment editor owns environment assignments,
global queue names and deployment targets. Neither editor duplicates the other file.
Use **Pulse: New Visual Flow Document**, then **Create WFL Deployment** in the
designer. Open WFL with **Pulse: Open WFL Deployment Editor** or *Reopen Editor
With... > WFL Configuration and Deployment*. The older embedded FLOW editor remains
an optional editor.

A deployment resource references the separate graph:

```wfl
DEFAULT ENVIRONMENT "dev";
LET deploymentTarget = "CHOOSE_NODE";
QUEUE "payments.in" -> "${ENVIRONMENT}.payments.in";
QUEUE "payments.out" -> "${ENVIRONMENT}.payments.out";

DEPLOYMENT "payments" PROJECT "payments" TARGETS ("${deploymentTarget}") BEGIN
  FLOW "forward" FILE "forward.vfl" TARGETS ("${deploymentTarget}") STARTUP TRUE;
END;
```

```bnf
<deploymentItem> ::= ... | "FLOW" <String> "FILE" <String>
                          "TARGETS" <quotedList> "STARTUP" <booleanLiteral> ";"
```

The graph is JSON, using the existing `visual-flow-language` model:

```json
{
  "schemaVersion": 1,
  "kind": "visual-flow-language",
  "nodes": [
    { "id": "in", "kind": "queue", "queue": "payments.in" },
    { "id": "worker", "kind": "service",
      "execution": { "sourceFile": "forwarder.wfl", "workflowId": "forward" } },
    { "id": "out", "kind": "queue", "queue": "payments.out" }
  ],
  "edges": [
    { "from": "in", "to": "worker", "type": "message-broker-call" },
    { "from": "worker", "to": "out", "type": "message-broker-call" }
  ]
}
```

`forwarder.wfl` contains real executable code:

```wfl
WORKFLOW "forward" BEGIN
  STEP "forward" ROUTE QUEUE "flow.output";
END;
```

Execution contract:

- `FILE` is relative to the WFL deployment file; `execution.sourceFile` is relative
  to the VFL file. Windows paths must escape backslashes in quoted WFL/JSON strings.
- Executable node kinds are `service`, `program`, `daemon` and `map`. Source files
  can be Pascalish (`.pas`, `.pash`), MAPL (`.mapl`, exactly one executable map), or
  WFL (`.wfl`). `workflowId` is required for a source with multiple workflows.
  Queue nodes use `queue` to reference a WFL queue symbol or concrete queue name.
- Queue names, source paths and target names support `${ENVIRONMENT}` and outer
  WFL `LET`/define variables. Unknown variables are errors.
- `message-broker-call` links define queues. A code-to-code link uses the
  destination's generated ingress queue. Queue endpoints use their declared
  name, resolved through the WFL queue assignments. An edge's optional `queue`
  overrides the generated name but must agree with any queue endpoint.
- Pascalish/WFL code emits `flow.output`; the builder binds that instruction to
  the linked output queues. Fan-out emits one message per destination. Router
  guards against `flow.input` bind to the node's ingress queue. Pascalish source
  uses a `PROGRAM` with queue-processing `ROUTER` declarations; a VFL service
  node runs that program as a supervised message worker. Native return/HTTP-based
  Pascalish `SERVICE` ABIs require hosted invocation and are rejected here.
  `execution.inputSymbol` / `outputSymbol` select alternative source queue names.
  WFL node sources additionally receive `FLOW_INPUT` and `FLOW_OUTPUT` variables.
- MAPL nodes transform the input payload before publishing. Constructs that the
  MAPL/WFL pcode compiler cannot execute are errors, not no-op deployments.
- Each node has one input queue. Multiple different input queues require an
  explicit merge node. A queue-to-queue link requires a forwarding code node.
  `file-feed`, direct `service-call`, infrastructure/device-only nodes and hosted
  service bindings are not yet supported by this queue-based builder.
- The builder produces a pcode/program-map pair per executable node, expands
  the graph into ordinary WFL deployment resources, and preserves instruction
  source maps (including fan-out). All sources must compile before files are
  written. Builds are stored beneath `.pulse-build`, separated by environment,
  deployment, graph and node identity.
- VFL source navigation opens the actual code file. Sources can be debugged
  separately with the PMachine debugger; a whole-graph distributed debug session
  is not implemented. Deployment-only WFL is not itself a single program.

The WFL editor has **Validate WFL**, **Compile / Preview VFL**, **Build Artifacts**
and **Deploy to Backend JS** actions. Environment and JSON defines controls apply
to the current action without rewriting the source. Preview compiles the source
but writes no files and starts nothing. Build writes artifacts but deploys nothing.
Deploy is workspace-trust gated and separately confirmed, checks registered
targets, writes artifacts and submits the expanded per-node requests to the
existing deployment API. `STARTUP FALSE` must not start a worker.

**Runtime boundary:** the current deployment API starts queue workers through the
backend-local JS supervisor. Target IDs are recorded placement metadata; this
path does not install workers on remote JS nodes or ESP32s. The editor explicitly
states this limitation. An API registration is not proof of successful execution:
startup requests fail explicitly if the response does not report a running worker.
Check deployment runtime status and Node Inventory after submission.

CLI build/preview (no backend required):

```text
node aggregator\scripts\build-vfl-deployment.mjs --in src\visual-flow-example\deployment.wfl --environment test
node aggregator\scripts\build-vfl-deployment.mjs --in src\visual-flow-example\deployment.wfl --environment test --define deploymentTarget=node-1 --write
```

The example files are in `src/visual-flow-example/`. Replace `CHOOSE_NODE` with a
registered target before deploying.

## 3.3 MAPL (Normalized BNF)

```bnf
<mapUnit> ::= <mapDecl>* EOF

<mapDecl> ::= "map" <Ident> "from" <Ident> "to" <Ident> ";" <mapBody> "end" ";"
<mapBody> ::= <mapStmt>*

<mapStmt> ::= <assignStmt>
            | <assignDefaultStmt>
            | <functionAssignStmt>
            | <ifStmt>
            | <forStmt>
            | <validateStmt>

<fieldPath> ::= <Ident> ("." <Ident>)*

<assignStmt> ::= <fieldPath> ":=" <fieldPath> ";"
<assignDefaultStmt> ::= <fieldPath> ":=" <fieldPath> "default" <Expr> ";"
<functionAssignStmt> ::= <fieldPath> ":=" <functionCall> ";"

<functionCall> ::= <Ident> "(" <exprList>? ")"

<ifStmt> ::= "if" <Expr> "then" <mapBody> ["else" <mapBody>] "end" ";"
<forStmt> ::= "for" "each" <fieldPath> "as" <Ident> <mapBody> "end" ";"

<validateStmt> ::= "validate" <Expr> ";"
```

## 4. P-Code Runtime Extensions

## 4.1 Concurrency and Subflows

```text
FORK label                    ; spawn async task
JOIN_ALL                      ; wait for all async tasks
JOIN taskId                   ; wait for specific task
SYNC taskId                   ; synchronize with named task
FORK_SUBFLOW name, args       ; spawn named subflow
```

## 4.2 Queues, Stacks, Priority Queues

```text
; External deployment-bound queues
QUEUE_WRITE_SYNC logicalQueue
QUEUE_WRITE_ASYNC logicalQueue

; Internal queues
BQ_NEW_STATIC base, size
BQ_NEW_DYNAMIC base, type
BQ_ENQ queue, value
BQ_DEQ queue, target
BQ_PEEK queue, target

; Stacks
STK_NEW_STATIC base, size
STK_NEW_DYNAMIC base, type
STK_PUSH stack, value
STK_POP stack, target
STK_PEEK stack, target

; Priority queues
PQ_NEW_STATIC base, size
PQ_NEW_DYNAMIC base, type
PQ_ENQ pq, record
PQ_DEQ pq, target
PQ_PEEK pq, target
```

External queue names are logical symbols translated through WFL. Synchronous writes wait for host acknowledgement; asynchronous writes do not block program execution.

## 4.3 Database DML

```text
DB_INSERT database,table,columns
DB_SELECT database,table,columns,whereColumn,whereOperator
DB_UPDATE database,table,columns,whereColumn,whereOperator
DB_DELETE database,table,whereColumn,whereOperator
```

Database operands use logical symbols. WFL maps those symbols to physical resources, manager IDs, and environment-based connection references.

## 4.4 File Operations

```text
FILE_OPEN handle, mode
FILE_READ handle, target
FILE_WRITE handle, source
FILE_CLOSE handle
```

## 4.5 Mapping and Data Librarian

```text
OP_MAP inputMessage, mapName -> outputMessage
DL_LOAD_SCHEMA name -> schemaHandle
DL_LOAD_MAP name -> mapHandle
```

## 4.6 Service Invocation and Placement

```text
SRV_CALL serviceId, endpoint, input -> output
ROUTE_SERVICE serviceId
ROUTE_QUEUE queueId
ROUTE_FILE fileId
```

Runtime responsibilities:
- Track last-used timestamp per service.
- Evict service stack/context after configured idle time.
- Keep program-level caches (schemas, maps, IR) warm.
- Reload service code on next SRV_CALL while reusing warm caches.

## 5. Open Issues and Decisions Needed

1. Pascalish grammar references serviceBody in multiple places; concrete service-only statements and call surface need explicit definition.
2. queueDecl currently embeds queueType, which implies declarations like "queue Q queue<T>;". Decide whether to keep this or switch to "queue Q: queue<T>;" for consistency with varDecl.
3. dynamicArrayType syntax ("array<T> of U") is unusual. Confirm intended semantics (element type plus allocator type?) or simplify to one type parameter.
4. Expression grammar and lexical rules are not included in this baseline (expr, exprList, Ident, String, EOF). These must be standardized across all three grammars.
5. MAPL for-each semantics need cardinality behavior for null, missing, and scalar values (skip, coerce, or error).
6. WFL clusterBody permits nested clusterDecl and leaf identifiers; validation rules for duplicate cluster names and cycle prevention should be explicit.
7. P-Code task identity model is not yet formalized (numeric task ids vs symbolic names) while JOIN and SYNC support different forms.
8. Eviction policy should define whether in-flight SRV_CALL can race with idle eviction and what lock/order guarantees apply.

## 6. Suggested Next Implementation Steps

1. Freeze lexical grammar shared by Pascalish, WFL, and MAPL.
2. Generate parser-ready g4 files from this normalized baseline.
3. Build a construct-to-opcode compatibility matrix and use it as test oracle input.
4. Add conformance tests for each open-issue decision once resolved.
