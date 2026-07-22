# ESP32 vs JavaScript PMachine Compiler & Runtime Issues - Resolution Summary

**Date**: 2026-07-22  
**Status**: In-Progress - Systematic parity improvement initiative

---

## Executive Summary

This document provides a systematic analysis of all identified compiler and pmachine compatibility issues between the ESP32 (C++) and JavaScript (Node.js) implementations, including resolution strategies for each issue.

**Key Achievements**:
- ✅ Created comprehensive parity matrix (pmachine-parity-matrix.md)
- ✅ Implemented OP_TRIM opcode on both platforms
- ✅ Implemented OP_PARSE_INT opcode on both platforms
- ✅ Created test framework for new opcodes
- ⏳ Identified critical blocking issues preventing factorial service deployment

**Critical Blockers**:
1. String literals in Pascal if-conditions (parser limitation)
2. Named variable `src` not accessible in programs
3. Logical operators (or/and) not supported in conditionals

---

## Detailed Issues & Resolutions

### Issue #1: String Literal Comparisons in Pascal
**Severity**: HIGH  
**Blocking**: Factorial service (can't parse message parameter)  
**Root Cause**: ANTLR grammar doesn't allow STRING() tokens in expressions (visitPrimary)

#### Current Behavior
```pascal
{ This FAILS - parser error }
if src = "0" then writeln('Input is zero');

{ This WORKS - but only in writeln }
writeln('Value: ', someValue);
```

#### Root Cause Analysis
- **Parser**: visitPrimary() only handles NUMBER() and IDENT(), not STRING()
- **Codegen**: emitExpr() only emits PUSH_INT (not PUSH_STR for comparisons)
- **Pmachine**: Comparison opcodes (EQ, NEQ, etc.) only work on integer stack
- **Grammar**: Primary rule doesn't include STRING production

#### Solution Options
**Option A: Quick Fix (Recommended for immediate unblock)**
- Add STRING() support to visitPrimary() → returns StringLiteral AST node
- Modify emitExpr() to handle StringLiteral → emits PUSH_STR
- For comparisons: Create temporary wrapper that converts to WHEN rules at runtime

**Option B: Full Implementation (Better long-term)**
- Add STRING production to ANTLR grammar
- Create new opcodes: STR_EQ, STR_NEQ for string comparison
- Implement string stack operations in both pmachine implementations
- Estimated effort: HIGH (3-4 days)

**Option C: Workaround (Immediate)**
- Use WHEN rules for string matching instead of Pascal logic
- Pre-parse message into named variables before execution
- Requires service deployment pattern change

#### Proposed Implementation (Option A)
```javascript
// In AstBuilder.visitPrimary()
visitPrimary(ctx) {
  if (ctx.NUMBER()) {
    return { type: 'NumberLiteral', value: Number.parseInt(ctx.NUMBER().getText(), 10) };
  }
  if (ctx.STRING()) {  // NEW
    return { type: 'StringLiteral', value: unquote(ctx.STRING().getText()) };
  }
  if (ctx.IDENT()) {
    return { type: 'Identifier', name: ctx.IDENT().getText() };
  }
  return this.visit(ctx.expr());
}

// In Codegen.emitExpr()
if (expr.type === 'StringLiteral') {  // NEW
  this.emit(`PUSH_STR "${this.escapeString(expr.value)}"`);
  return;
}

// In Codegen.emitExpr() Binary case, handle string comparisons:
if (expr.type === 'Binary') {
  const leftIsString = expr.left.type === 'StringLiteral';
  const rightIsString = expr.right.type === 'StringLiteral';
  
  this.emitExpr(expr.left);
  this.emitExpr(expr.right);
  
  // If both strings, emit TRIM + PARSE_INT workaround OR
  // emit new opcode (STR_EQ, etc.)
  const opMap = { /* existing + new string ops */ };
  // ...
}
```

---

### Issue #2: Logical Operators (or/and)
**Severity**: HIGH  
**Blocking**: Complex factorial validation patterns  
**Root Cause**: ANTLR grammar doesn't define OR/AND operators

#### Current Behavior
```pascal
{ This FAILS }
if (n >= 0) and (n <= 10) then writeln('Valid');

{ This WORKS - but verbose }
if n >= 0 then
  if n <= 10 then
    writeln('Valid');
```

#### Root Cause Analysis
- **Grammar**: No ANDOP or OROP token definitions
- **Parser**: No logical operator handling in visitExpr()
- **Codegen**: No code generation for compound boolean logic
- **Standard**: Pascal standard includes these operators, but implementation is incomplete

#### Solution Implementation
1. **Add tokens to grammar**:
   ```
   ANDOP: ('AND' | 'and');
   OROP: ('OR' | 'or');
   ```

2. **Add grammar rules**:
   ```
   logicalOrExpr: logicalAndExpr (OROP logicalAndExpr)*;
   logicalAndExpr: comparisonExpr (ANDOP comparisonExpr)*;
   ```

3. **Update parser**:
   ```javascript
   visitLogicalOrExpr(ctx) {
     // Handle OR combinations with label jumps
   }
   visitLogicalAndExpr(ctx) {
     // Handle AND combinations with label jumps
   }
   ```

4. **Codegen pattern** (short-circuit evaluation):
   ```
   // AND: if left is false, jump to false label
   // OR: if left is true, jump to true label
   ```

#### Estimated Effort
- Grammar changes: 1-2 hours
- Parser modifications: 2-3 hours
- Testing: 1-2 hours
- **Total**: 4-7 hours

---

### Issue #3: Named Variable `src` Access
**Severity**: MEDIUM  
**Blocking**: Dynamic message parameter reading  
**Root Cause**: pmachine doesn't pre-load message into named variables

#### Current Behavior
```pascal
{ Pascal programs can use declared variables }
var n: integer;
begin
  n := 5;
  { ... }
end

{ But cannot access message directly }
{ This FAILS - src undefined }
if src = '0' then writeln('Zero');
```

#### Root Cause Analysis
- **pmachine**: Doesn't have runtime hook to inject message as named variable
- **Deployment**: No mechanism to declare `src` as input variable
- **Scope**: Message parameter not in program's named variable space

#### Solution Implementation
1. **Add message injection hook to execute_file endpoint**:
   ```javascript
   // Before pmachine execution
   if (message && !programMap.globals.includes('src')) {
     programMap.globals.push('src');
     // Initialize src with message value
     namedVariables.set('src', JSON.stringify(message));
   }
   ```

2. **Update OP_LOAD_NAME handler** in both pmachines:
   - Check if loading 'src'
   - Return message value if available

3. **Document in deployment guide**:
   - Implicit `src` variable available in all programs
   - Contains serialized input message
   - Read-only (attempting to STORE to `src` is no-op)

#### Estimated Effort
- Backend modification: 1-2 hours
- pmachine updates: 30 minutes each (both platforms)
- Testing: 1 hour
- **Total**: 2-3 hours
- **Blocking**: None
- **Risk**: LOW

---

### Issue #4: ✅ OP_TRIM Opcode
**Status**: IMPLEMENTED  
**Severity**: HIGH (was)  
**Implementation**: Complete on both platforms

**Details**:
- Added to opcode manifest: 0x49
- ESP32 handler: pops strStack, trims, pushes back
- JS handler: pops stack, trims, pushes back
- Tests: test-trim-parse-int-opcodes.mjs

---

### Issue #5: ✅ OP_PARSE_INT Opcode
**Status**: IMPLEMENTED  
**Severity**: HIGH (was)  
**Implementation**: Complete on both platforms

**Details**:
- Added to opcode manifest: 0x4A
- ESP32 handler: pops strStack, parses, pushes to intStack
- JS handler: pops stack, parses, pushes to stack
- Tests: test-trim-parse-int-opcodes.mjs
- Error handling: Returns 0 on parse failure (NaN)

---

### Issue #6: File I/O on ESP32
**Severity**: MEDIUM  
**Effort**: HIGH  
**Status**: DEFER  
**Reason**: Not blocking current deployments; JS implementation exists

**Future**: Integrate ESP32 file I/O with Chunkstore/FFS once persistence requirements materialize.

---

### Issue #7: Dynamic Data Structures on ESP32
**Severity**: MEDIUM  
**Effort**: HIGH  
**Status**: DEFER  
**Reason**: Advanced use cases only; current algorithms don't require

**Structures missing**:
- BQ_* (blocking queues)
- STK_* (dynamic stacks)
- PQ_* (priority queues)

**JS Implementation**: Full support available (test-spec-opcodes.mjs passes)

---

## Recommended Implementation Roadmap

### Phase 1 (IMMEDIATE - 1-2 days)
1. ✅ Add OP_TRIM and OP_PARSE_INT (DONE)
2. ⏳ Enable `src` variable access (2-3 hours) → Unblocks factorial service
3. ⏳ Create factorial service deployment with `src` variable

**Deliverable**: Factorial service working with dynamic `n` parameter

### Phase 2 (SHORT-TERM - 1 week)
1. Add string literal support to Pascal parser (4-6 hours)
2. Implement string comparison opcodes or workaround (2-3 hours)
3. Add logical operators (or/and) to grammar and codegen (4-7 hours)

**Deliverable**: Full string and logical expression support in Pascal

### Phase 3 (MID-TERM - Later)
1. Implement File I/O on ESP32 with Chunkstore
2. Add dynamic data structure support to ESP32 pmachine
3. Comprehensive parity test suite for all opcodes

**Deliverable**: Feature parity between platforms for advanced scenarios

---

## Testing Strategy

### Immediate Tests (Phase 1)
```bash
# Test new opcodes
node aggregator/scripts/test-trim-parse-int-opcodes.mjs

# Deploy factorial with src variable
node aggregator/scripts/deploy-factorial-service.mjs
# Should accept n=0..10 from message parameter
```

### Comprehensive Tests (Phase 2)
```bash
# Run existing spec tests
node aggregator/scripts/test-js-pmachine-spec-opcodes.mjs
node aggregator/scripts/test-js-pmachine-negative-opcodes.mjs

# New tests for string/logical operations
node aggregator/scripts/test-string-comparisons.mjs
node aggregator/scripts/test-logical-operators.mjs

# ESP32 parity tests
# (Compile and upload test pcode to device)
```

### Cross-Platform Validation
- Deploy same Pascal programs to both platforms
- Verify identical output/behavior
- Document any platform-specific differences

---

## Known Limitations & Workarounds

### Parser Limitations
| Issue | Workaround | Effort |
|-------|-----------|--------|
| No string literals in if | Use WHEN rules + routing | LOW |
| No logical or/and | Nested if-else chains | MEDIUM |
| No function returns | Use procedures + state | LOW |
| No TRIM in Pascal | Use TRIM opcode directly | LOW |
| No INT parsing in Pascal | Use PARSE_INT opcode | LOW |

### Runtime Limitations
| Issue | Workaround | Status |
|-------|-----------|--------|
| src variable not accessible | Pre-parse into named var | PENDING |
| String comparisons in pmachine | Emit WHEN rules instead | Documented |
| No persistence on ESP32 | Use backend queue storage | Acceptable |
| No dynamic DS on ESP32 | Keep state in JS layer | Acceptable |

---

## Documentation References

- **Parity Matrix**: `documents/pmachine-parity-matrix.md`
- **Future Enhancements**: `documents/future-enhancements.md`
- **PMachine Docs**: `docs/pmachine.md`
- **Test Files**: `aggregator/scripts/test-*-pmachine*.mjs`

---

## Sign-Off & Next Steps

### Current Status
- ✅ Parity audit complete
- ✅ Critical opcodes implemented (TRIM, PARSE_INT)
- ⏳ Blocking issues identified and documented
- 🔄 Implementation roadmap created

### Next Immediate Steps (24-48 hours)
1. Implement `src` variable injection (backend + pmachine)
2. Update factorial service to use `src` for dynamic `n`
3. Test and verify parity between ESP32 and JS deployments
4. Commit changes and document in runbooks

### Follow-up Work (1-2 weeks)
1. String literal support in Pascal
2. Logical operator grammar extensions
3. Comprehensive parity test suite
4. Document all known issues in runbooks

---

**Document Owner**: Development Team  
**Last Updated**: 2026-07-22  
**Version**: 1.0 (Initial comprehensive audit)
