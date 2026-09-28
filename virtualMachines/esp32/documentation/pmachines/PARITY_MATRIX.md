# PMachine Parity Matrix

> Historical gap register, last updated 2026-07-22. The current normative contract is [PCODE_Compatibility_Contract.md](PCODE_Compatibility_Contract.md), enforced by `npm run test:pmachine:javascript` and `npm --prefix .\aggregator run check:pcode-compat`.

## Overview

This document tracks compatibility among ESP32 (C++), JavaScript (Node.js), and historical Java PMachine implementation discussions. The opcode manifest is authoritative; this file summarizes behavior recorded during the July 2026 parity initiative.

## Opcode Parity Status

### Queue and Routing Opcodes
| Opcode | ESP32 (C++) | JS Node | Java | Status | Notes |
|--------|-----------|---------|------|--------|-------|
| `QUEUE_WRITE_SYNC` | ✅ | ✅ | ✅ | **PARITY** | Logical queue write with acknowledgement mode |
| `QUEUE_WRITE_ASYNC` | ✅ | ✅ | ✅ | **PARITY** | Logical queue write with asynchronous mode |
| `BQ_NEW_STATIC` / `BQ_NEW_DYNAMIC` | ✅ | ✅ | N/A | **PARITY** | Bounded and dynamic queues |
| `BQ_ENQ` / `BQ_PEEK` / `BQ_DEQ` | ✅ | ✅ | N/A | **PARITY** | Overflow and underflow state markers |
| `STK_NEW_STATIC` / `STK_NEW_DYNAMIC` | ✅ | ✅ | N/A | **PARITY** | Bounded and dynamic stacks |
| `STK_PUSH` / `STK_PEEK` / `STK_POP` | ✅ | ✅ | N/A | **PARITY** | Overflow and underflow state markers |
| `PQ_NEW_STATIC` / `PQ_NEW_DYNAMIC` | ✅ | ✅ | N/A | **PARITY** | Highest numeric priority first |
| `PQ_ENQ` / `PQ_PEEK` / `PQ_DEQ` | ✅ | ✅ | N/A | **PARITY** | Overflow and underflow state markers |
| `FILE_OPEN` | ✅ | ✅ | N/A | **PARITY** | ESP32 delegates persistence to FederatedFileSystem |
| `FILE_READ` | ✅ | ✅ | N/A | **PARITY** | Line-oriented reads |
| `FILE_WRITE` | ✅ | ✅ | N/A | **PARITY** | VM handle lifecycle |
| `FILE_CLOSE` | ✅ | ✅ | N/A | **PARITY** | VM handle lifecycle |
| `FORK` | ✅ | ✅ | N/A | **PARITY** | Completion-handle task semantics |
| `JOIN` | ✅ | ✅ | N/A | **PARITY** | Completion-handle task semantics |
| `SYNC` | ✅ | ✅ | N/A | **PARITY** | Completion-handle synchronization |
| `FORK_SUBFLOW` | ✅ | ✅ | N/A | **PARITY** | Subflow completion handles |

Java currently provides the external queue bridge subset used by `QUEUE_WRITE_SYNC` and `QUEUE_WRITE_ASYNC`; other cells are intentionally omitted rather than implied.

### Service Call Opcodes
| Opcode | ESP32 (C++) | JS Node | Status | Notes |
|--------|-----------|---------|--------|-------|
| `SRV_CALL` | ✅ | ✅ | **PARTIAL** | JS: mock:// and http(s)://, ESP32: HTTP only |
| `DL_LOAD_SCHEMA` | ✅ | ✅ | **PARITY** | Both handle schema loading |
| `DL_LOAD_MAP` | ✅ | ✅ | **PARITY** | Both handle mapper loading |
| `OP_MAP` | ✅ | ✅ | **PARITY** | Both apply transformations |

## WHEN Rule Evaluation Parity

### Comparison Matrix

| Rule Type | ESP32 Implementation | JS Implementation | Status | Issue |
|-----------|---------------------|------------------|--------|-------|
| **STARTSWITH(UPPER(SRC), "prefix")** | ✅ | ✅ | **PARITY** | Core routing pattern works identically |
| **FIELD_EQUALS(field, value)** | ✅ | ✅ | **PARITY** | Both support JSON path traversal |
| **FIELD_CONTAINS(field, value)** | ✅ | ✅ | **PARITY** | Both support array/string contains |
| **state.fieldname access** | ⚠️ | ✅ | **ESP32 GAP** | JS uses state.__ prefix for metadata |
| **message.fieldname access** | ✅ | ✅ | **PARITY** | Both support dot notation |
| **Logical OR combos** | ❌ | ⚠️ | **NOT SUPPORTED** | Both require separate WHEN clauses or nested if-else |
| **Logical AND combos** | ❌ | ⚠️ | **NOT SUPPORTED** | Both require separate WHEN clauses or nested if-else |
| **Case sensitivity** | ✅ | ⚠️ | **PARTIAL** | JS: case-insensitive WHEN parser but sensitive UPPER() |

### Known WHEN Rule Issues

1. **OR Operator**
   - Current: `STARTSWITH(UPPER(SRC), "MT103") OR STARTSWITH(UPPER(SRC), "MT202")` NOT supported.
   - Workaround: Two separate `ROUTE_EVAL_WHEN` instructions with separate outputs.
   - Impact: Code verbosity in routers.
2. **State Metadata Access**
   - ESP32: No direct state.__ access (metadata stored opaquely).
   - JS: state.__placement, state.__last_service_call available.
   - Impact: Cannot conditionally route based on last service result on ESP32.
3. **String Literal Support**
   - Both: Require double quotes "text", not single quotes 'text'.
   - Both: Require string literals in RULE context, not in IF conditions.
   - Impact: Cannot use string comparisons directly in Pascal programs.

## Arithmetic & Comparison Opcodes

| Opcode | ESP32 | JS | Status |
|--------|-------|-----|--------|
| `ADD` | ✅ | ✅ | PARITY |
| `SUB` | ✅ | ✅ | PARITY |
| `MUL` | ✅ | ✅ | PARITY |
| `DIV` | ✅ | ✅ | PARITY |
| `EQ` | ✅ | ✅ | PARITY |
| `NEQ` | ✅ | ✅ | PARITY |
| `LT` | ✅ | ✅ | PARITY |
| `LE` | ✅ | ✅ | PARITY |
| `GT` | ✅ | ✅ | PARITY |
| `GE` | ✅ | ✅ | PARITY |

## String Operations

| Operation | ESP32 | JS | Status | Issue |
|-----------|-------|-----|--------|-------|
| `UPPER(text)` | ✅ | ✅ | PARITY | Both in WHEN rules |
| `TRIM(text)` | ⚠️ | ⚠️ | **MISSING** | Not implemented as opcode |
| `MTAMOUNTTODECIMAL()` | ✅ | ❌ | **JS GAP** | MT FIN text amount normalization |
| String concat | ❌ | ⚠️ | **NOT STANDARD** | Not in core opcodes |

## Historical High-Priority Gaps

### 1. String Literal Support in Expressions

- Impact: HIGH - blocks dynamic message parsing in Pascal programs.
- Effort: MEDIUM - requires parser/codegen changes plus new opcodes.
- Platforms: BOTH (compiler level).
- Current Workaround: Use WHEN rules for string matching instead of Pascal if-statements.
- Issue: Parser (visitPrimary) doesn't handle STRING tokens; comparison operators only work on integer stack.

### 2. Named Variable Access (src)

- Impact: MEDIUM - blocks read-only message parameter access.
- Effort: LOW - add loadable variable during PMachine initialization.
- Platforms: BOTH (PMachine level).
- Current Workaround: Pre-parse message into named variable before program execution.
- Issue: `src` variable not initialized; need runtime hook to load message as named variable.

### 3. Logical Operators (or/and)

- Impact: HIGH - blocks factorial service and other complex routing.
- Effort: MEDIUM - requires ANTLR grammar changes.
- Platforms: BOTH (Pascal compiler level).
- Current Workaround: Use nested if-else chains or separate WHEN clauses.
- Issue: Parser doesn't support `or`/`and` - requires grammar extension and codegen for compound conditions.

### 4. String Trim Opcode (OP_TRIM) COMPLETE

- Status: IMPLEMENTED on both ESP32 (C++) and JavaScript.
- Opcode: `0x49`.
- Tests: `test-trim-parse-int-opcodes.mjs`.

### 5. String-to-Int Parsing (OP_PARSE_INT) COMPLETE

- Status: IMPLEMENTED on both ESP32 (C++) and JavaScript.
- Opcode: `0x4A`.
- Tests: `test-trim-parse-int-opcodes.mjs`.

### 6. File I/O on ESP32

- Impact: MEDIUM - enables persistence on device.
- Effort: HIGH - requires SD/Chunkstore integration.
- Platforms: ESP32 only (JS has working implementation).

### 7. Dynamic Data Structures on ESP32

- Impact: MEDIUM - blocks advanced algorithms.
- Effort: HIGH - complex runtime data structure management.
- Platforms: ESP32 only (JS has working implementation).

## Historical Test Record

### Passing Tests

- `test-js-pmachine-spec-opcodes.mjs` - routing plus service calls.
- `test-js-pmachine-negative-opcodes.mjs` - error handling.
- `test-js-pmachine-failure-paths.mjs` - service failures.

### Missing Tests

- ESP32 equivalent of spec-opcodes test.
- Cross-platform WHEN rule validation.
- Numeric operation parity test.
- Service call result handling parity.

## Historical Recommendations

### Phase 1

1. Add OP_TRIM and OP_PARSE_INT to both platforms.
2. Create unified test suite for new opcodes.
3. Document implementation differences in code comments.

### Phase 2

1. Add logical operators to Pascal compiler.
2. Enable string literal comparisons.
3. Implement File I/O on ESP32 with Chunkstore integration.

### Phase 3

1. Dynamic data structures on ESP32.
2. State metadata access on ESP32.
3. Complete concurrency opcode set on JS.

**Last Updated**: 2026-07-22  
**Maintainer**: GPU Development Team