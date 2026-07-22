# PMachine Parity Matrix: ESP32 vs JavaScript

## Overview
This document tracks the compatibility and parity between the ESP32 (C++) pmachine and JavaScript (Node.js) pmachine implementations.

## Opcode Parity Status

### Routing Opcodes (Implemented on Both)
| Opcode | ESP32 (C++) | JS Node | Status | Notes |
|--------|-----------|---------|--------|-------|
| `ROUTE_MATCH_QUEUE` | ✅ | ✅ | **PARITY** | Both test with swift.mt103.parsed queue names |
| `ROUTE_EVAL_WHEN` | ⚠️ | ✅ | **DIVERGENCE** | See WHEN Rule Evaluation section |
| `ROUTE_TRANSFORM` | ✅ | ✅ | **PARITY** | Both apply transformation rules |
| `ROUTE_EMIT` | ✅ | ✅ | **PARITY** | Both deliver to output queues |
| `PARSE_FIN_TEXT` | ✅ | ✅ | **PARITY** | Both parse MT103 FIN text into JSON |
| `ROUTE_SET_STATE` | ⚠️ | ✅ | **DIVERGENCE** | JS: state.\_\_placement, \_\_last_service_call |
| `ROUTE_SET_MESSAGE` | ⚠️ | ✅ | **DIVERGENCE** | Need to verify ESP32 implementation |

### Data Structure Opcodes (Implemented on JS Only)
| Opcode | ESP32 (C++) | JS Node | Status | Notes |
|--------|-----------|---------|--------|-------|
| `BQ_NEW_DYNAMIC` | ❌ | ✅ | **MISSING ESP32** | Priority: Medium |
| `BQ_ENQ` | ❌ | ✅ | **MISSING ESP32** | Dynamic queue operations |
| `BQ_PEEK` | ❌ | ✅ | **MISSING ESP32** | Dynamic queue operations |
| `BQ_DEQ` | ❌ | ✅ | **MISSING ESP32** | Dynamic queue operations |
| `STK_NEW_DYNAMIC` | ❌ | ✅ | **MISSING ESP32** | Dynamic stack operations |
| `STK_PUSH` | ❌ | ✅ | **MISSING ESP32** | Dynamic stack operations |
| `STK_PEEK` | ❌ | ✅ | **MISSING ESP32** | Dynamic stack operations |
| `STK_POP` | ❌ | ✅ | **MISSING ESP32** | Dynamic stack operations |
| `PQ_NEW_DYNAMIC` | ❌ | ✅ | **MISSING ESP32** | Priority queue operations |
| `PQ_ENQ` | ❌ | ✅ | **MISSING ESP32** | Priority queue operations |
| `PQ_PEEK` | ❌ | ✅ | **MISSING ESP32** | Priority queue operations |
| `PQ_DEQ` | ❌ | ✅ | **MISSING ESP32** | Priority queue operations |

### File I/O Opcodes (Implemented on JS Only)
| Opcode | ESP32 (C++) | JS Node | Status | Notes |
|--------|-----------|---------|--------|-------|
| `FILE_OPEN` | ❌ | ✅ | **MISSING ESP32** | Priority: Medium (SD integration needed) |
| `FILE_READ` | ❌ | ✅ | **MISSING ESP32** | Chunkstore integration needed |
| `FILE_WRITE` | ❌ | ✅ | **MISSING ESP32** | Chunkstore integration needed |
| `FILE_CLOSE` | ❌ | ✅ | **MISSING ESP32** | File handle management |
| `FILE_SEEK` | ❌ | ✅ | **MISSING ESP32** | File pointer operations |
| `FILE_TELL` | ❌ | ✅ | **MISSING ESP32** | File position query |
| `FILE_SIZE` | ❌ | ✅ | **MISSING ESP32** | File size query |
| `FILE_EXISTS` | ❌ | ✅ | **MISSING ESP32** | File existence check |
| `FILE_DELETE` | ❌ | ✅ | **MISSING ESP32** | File deletion |

### Concurrency Opcodes (Implemented on ESP32 Only)
| Opcode | ESP32 (C++) | JS Node | Status | Notes |
|--------|-----------|---------|--------|-------|
| `FORK` | ✅ | ❌ | **MISSING JS** | May be mapped to context spawn |
| `JOIN` | ✅ | ❌ | **MISSING JS** | May be mapped to context join |
| `SYNC` | ✅ | ❌ | **MISSING JS** | Synchronization primitive |
| `FORK_SUBFLOW` | ✅ | ❌ | **MISSING JS** | Orchestration spawn |
| `ORCH_SPAWN` | ✅ | ❌ | **MISSING JS** | Scheduled via test-spec-opcodes |
| `ORCH_WAIT_ALL` | ✅ | ❌ | **MISSING JS** | Wait all orchestration tasks |
| `ORCH_FAIL_TXN` | ✅ | ❌ | **MISSING JS** | Transaction failure on result |
| `ORCH_RETURN_SUCCESS` | ✅ | ❌ | **MISSING JS** | Return orchestration success |

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
| **state.fieldname access** | ⚠️ | ✅ | **ESP32 GAP** | JS uses state.\_\_ prefix for metadata |
| **message.fieldname access** | ✅ | ✅ | **PARITY** | Both support dot notation |
| **Logical OR combos** | ❌ | ⚠️ | **NOT SUPPORTED** | Both require separate WHEN clauses or nested if-else |
| **Logical AND combos** | ❌ | ⚠️ | **NOT SUPPORTED** | Both require separate WHEN clauses or nested if-else |
| **Case sensitivity** | ✅ | ⚠️ | **PARTIAL** | JS: case-insensitive WHEN parser but sensitive UPPER() |

### Known WHEN Rule Issues

1. **OR Operator**
   - Current: `STARTSWITH(UPPER(SRC), "MT103") OR STARTSWITH(UPPER(SRC), "MT202")` NOT supported
   - Workaround: Two separate `ROUTE_EVAL_WHEN` instructions with separate outputs
   - Impact: Code verbosity in routers

2. **State Metadata Access**
   - ESP32: No direct state.\_\_ access (metadata stored opaquely)
   - JS: state.\_\_placement, state.\_\_last_service_call available
   - Impact: Cannot conditionally route based on last service result on ESP32

3. **String Literal Support**
   - Both: Require double quotes "text", not single quotes 'text'
   - Both: Require string literals in RULE context, not in IF conditions
   - Impact: Cannot use string comparisons directly in Pascal programs

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

## High-Priority Gaps to Fix

### 1. **String Literal Support in Expressions** 
- **Impact**: HIGH - blocks dynamic message parsing in Pascal programs
- **Effort**: MEDIUM - requires parser/codegen changes + new opcodes
- **Platforms**: BOTH (compiler level)
- **Current Workaround**: Use WHEN rules for string matching instead of Pascal if-statements
- **Issue**: Parser (visitPrimary) doesn't handle STRING tokens; comparison operators only work on integer stack

### 2. **Named Variable Access (src)** 
- **Impact**: MEDIUM - blocks read-only message parameter access
- **Effort**: LOW - add loadable variable during pmachine init
- **Platforms**: BOTH (pmachine level)
- **Current Workaround**: Pre-parse message into named variable before program execution
- **Issue**: `src` variable not initialized; need runtime hook to load message as named variable

### 3. **Logical Operators (or/and)** 
- **Impact**: HIGH - blocks factorial service and other complex routing
- **Effort**: MEDIUM - requires ANTLR grammar changes
- **Platforms**: BOTH (Pascal compiler level)
- **Current Workaround**: Use nested if-else chains or separate WHEN clauses
- **Issue**: Parser doesn't support `or`/`and` - requires grammar extension + codegen for compound conditions

### 4. **String Trim Opcode (OP_TRIM)** ✅ COMPLETE
- **Status**: IMPLEMENTED on both ESP32 (C++) and JavaScript
- **Opcodes**: 0x49
- **Tests**: test-trim-parse-int-opcodes.mjs (created)

### 5. **String-to-Int Parsing (OP_PARSE_INT)** ✅ COMPLETE
- **Status**: IMPLEMENTED on both ESP32 (C++) and JavaScript
- **Opcodes**: 0x4A
- **Tests**: test-trim-parse-int-opcodes.mjs (created)

### 6. **File I/O on ESP32**
- **Impact**: MEDIUM - enables persistence on device
- **Effort**: HIGH - requires SD/Chunkstore integration
- **Platforms**: ESP32 only (JS has working implementation)

### 7. **Dynamic Data Structures on ESP32**
- **Impact**: MEDIUM - blocks advanced algorithms
- **Effort**: HIGH - complex runtime data structure management
- **Platforms**: ESP32 only (JS has working implementation)

## Interop Testing

### Passing Tests
- `test-js-pmachine-spec-opcodes.mjs` - ✅ (routing + service calls)
- `test-js-pmachine-negative-opcodes.mjs` - ✅ (error handling)
- `test-js-pmachine-failure-paths.mjs` - ✅ (service failures)

### Missing Tests
- ESP32 equivalent of spec-opcodes test
- Cross-platform WHEN rule validation
- Numeric operation parity test
- Service call result handling parity

## Recommendations

### Phase 1 (Current Sprint) - CRITICAL
1. Add OP_TRIM and OP_PARSE_INT to both platforms
2. Create unified test suite for new opcodes
3. Document implementation differences in code comments

### Phase 2 (Next Sprint) - HIGH
1. Add logical operators to Pascal compiler
2. Enable string literal comparisons
3. Implement File I/O on ESP32 with Chunkstore integration

### Phase 3 (Later) - MEDIUM
1. Dynamic data structures on ESP32
2. State metadata access on ESP32
3. Complete concurrency opcode set on JS

---

**Last Updated**: 2026-07-22
**Maintainer**: GPU Development Team
