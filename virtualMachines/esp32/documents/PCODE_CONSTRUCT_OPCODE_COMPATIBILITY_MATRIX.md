# P-Code Construct to Opcode Compatibility Matrix

Version: 2026-07-05
Source Spec: documents/PASCALISH_WFL_MAPL_PCODE_DESIGN_SPEC.md

## Legend

- Implemented: Available and wired in the current VM execution path.
- Partial: Exists in code or close analog exists, but not fully aligned to the new contract.
- Missing: No concrete opcode-level support yet.

## 1. Pascalish Concurrent Constructs

| Language Construct | Target Opcode(s) | Current Status | Current Analog | Gap to Close |
| --- | --- | --- | --- | --- |
| async statement | FORK | Partial | OP_ORCH_SPAWN, scheduler context spawn patterns | Add canonical FORK opcode and handler wiring in PMachine dispatch |
| wait all | JOIN_ALL | Partial | OP_ORCH_WAIT_ALL | Add JOIN_ALL semantics over task model, not only orchestration hook |
| wait taskId | JOIN taskId | Missing | None | Add task-id wait primitive in scheduler and VM opcode layer |
| sync taskId | SYNC taskId | Missing | Semaphore primitives (SEMWAIT/SEMSIGNAL) | Add named/specific sync contract and runtime resolver |
| subflow name with args | FORK_SUBFLOW name,args | Partial | OP_ORCH_SPAWN metadata path | Add direct opcode with argument marshaling and result handle model |

## 2. Queue and Collection Constructs

| Language Construct | Target Opcode(s) | Current Status | Current Analog | Gap to Close |
| --- | --- | --- | --- | --- |
| queue static create | BQ_NEW_STATIC | Missing | None | Implement queue allocation and bounds metadata in VM memory model |
| queue dynamic create | BQ_NEW_DYNAMIC | Missing | None | Implement runtime typed queue allocation |
| enqueue | BQ_ENQ | Missing | None | Implement push semantics and overflow behavior |
| dequeue | BQ_DEQ | Missing | None | Implement pop semantics and underflow behavior |
| peek queue | BQ_PEEK | Missing | None | Implement non-destructive read |
| stack static create | STK_NEW_STATIC | Missing | None | Implement stack allocation with bounds |
| stack dynamic create | STK_NEW_DYNAMIC | Missing | None | Implement runtime stack allocation |
| push stack | STK_PUSH | Missing | None | Implement stack push semantics |
| pop stack | STK_POP | Missing | None | Implement stack pop semantics |
| peek stack | STK_PEEK | Missing | None | Implement stack peek semantics |
| priority queue create | PQ_NEW_STATIC / PQ_NEW_DYNAMIC | Missing | None | Implement priority heap storage model |
| priority queue enqueue | PQ_ENQ | Missing | None | Implement keyed enqueue with comparator rule |
| priority queue dequeue | PQ_DEQ | Missing | None | Implement highest-priority pop |
| priority queue peek | PQ_PEEK | Missing | None | Implement non-destructive top read |

## 3. File Constructs

| Language Construct | Target Opcode(s) | Current Status | Current Analog | Gap to Close |
| --- | --- | --- | --- | --- |
| open file | FILE_OPEN | Partial | OP_FILE_OPEN in extended opcodes | Wire into VM handler table and align operand contract to spec |
| read file | FILE_READ | Partial | OP_FILE_READ | Complete buffer and type-safe record read behavior |
| write file | FILE_WRITE | Partial | OP_FILE_WRITE | Complete record write behavior and error reporting |
| close file | FILE_CLOSE | Partial | OP_FILE_CLOSE | Ensure lifecycle cleanup and failure propagation |

## 4. Mapping and Librarian Constructs

| Language Construct | Target Opcode(s) | Current Status | Current Analog | Gap to Close |
| --- | --- | --- | --- | --- |
| execute map | OP_MAP input,map | Partial | Mapping logic in PMachine runtime and map service routes | Add explicit OP_MAP opcode and deterministic stack/operand contract |
| load schema | DL_LOAD_SCHEMA name | Missing | Data-librarian API endpoints | Add VM opcode that resolves schema handles through runtime cache |
| load map | DL_LOAD_MAP name | Missing | Mapping registry/service API | Add VM opcode and handle lifecycle semantics |

## 5. Service and Placement Constructs

| Language Construct | Target Opcode(s) | Current Status | Current Analog | Gap to Close |
| --- | --- | --- | --- | --- |
| service call | SRV_CALL service,endpoint,input | Missing | HTTP routes and map service endpoints | Add VM opcode for service invocation + return/error protocol |
| service placement route | ROUTE_SERVICE serviceId | Partial | Existing route-oriented opcodes (ROUTE_MATCH_QUEUE, ROUTE_EMIT, etc.) | Add explicit placement opcode tied to WFL cluster policy |
| queue placement route | ROUTE_QUEUE queueId | Partial | Existing routing state machinery | Add queue-manager resolver opcode semantics |
| file placement route | ROUTE_FILE fileId | Partial | Existing FFS and route layers | Add file placement opcode semantics and physical binding lookup |

## 6. Integration and Wiring Checklist

| Work Item | Status | Notes |
| --- | --- | --- |
| Add opcode constants to canonical enum used by PMachine dispatch | Missing | Extended header exists but currently separate from core execution enum |
| Register new handlers into PMachine handler table | Missing | registerExtendedOpcodes currently documentation placeholder |
| Normalize task identity model for FORK/JOIN/SYNC | Missing | Required to support both join-all and join-specific semantics |
| Add conformance tests per opcode family | Missing | Needed for parser-to-pcode regression safety |
| Add negative tests (underflow, invalid handle, timeout, missing map/schema) | Missing | Required for runtime hardening |

## 7. Recommended Delivery Order

1. Dispatch wiring and canonical opcode registration.
2. File opcode hardening to full status.
3. Concurrency model completion (FORK/JOIN/JOIN_ALL/SYNC/FORK_SUBFLOW).
4. Queue/stack/priority-queue opcode family.
5. OP_MAP, DL_LOAD_SCHEMA, DL_LOAD_MAP.
6. SRV_CALL and ROUTE_* placement opcodes.
7. End-to-end parser->IR->pcode conformance suite.
