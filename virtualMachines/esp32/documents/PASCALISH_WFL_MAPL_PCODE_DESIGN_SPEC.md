# Pascalish, WFL, MAPL, and P-Code Design Spec

Version: 2026-07-05
Status: Draft for implementation alignment

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

## 4.3 File Operations

```text
FILE_OPEN handle, mode
FILE_READ handle, target
FILE_WRITE handle, source
FILE_CLOSE handle
```

## 4.4 Mapping and Data Librarian

```text
OP_MAP inputMessage, mapName -> outputMessage
DL_LOAD_SCHEMA name -> schemaHandle
DL_LOAD_MAP name -> mapHandle
```

## 4.5 Service Invocation and Placement

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
