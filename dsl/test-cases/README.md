# Pascalish Test Cases

This directory contains test cases for the new Pascalish grammar features implemented in Phase 5 of the ESP Virtual P-Machine migration.

## Test Files

### 1. test-objects.pascalish
Tests object-oriented programming features:
- Object type declarations
- Inheritance (Dog extends Animal)
- Method declarations
- Field access
- Method calls

**Features tested:**
- `object` keyword
- Inheritance syntax: `object(ParentType)`
- `method` declarations
- Field and method access via dot notation

### 2. test-concurrency.pascalish
Tests concurrent execution and synchronization:
- COBEGIN/COEND blocks
- Semaphore operations (wait/signal)
- Multiple concurrent tasks
- Shared resource protection

**Features tested:**
- `cobegin` and `coend` keywords
- `wait()` and `signal()` semaphore operations
- `seminit()` for semaphore initialization
- Concurrent procedure execution

**Opcodes generated:**
- `OP_COBEGIN` (0x70)
- `OP_COEND` (0x71)
- `OP_SPAWN` (0x72)
- `OP_SEMWAIT` (0x74)
- `OP_SEMSIGNAL` (0x75)
- `OP_SEMINIT` (0x76)

### 3. test-gateway.pascalish
Tests gateway interface calls:
- Gateway method invocation
- Multiple gateway types
- Parameter passing to gateways

**Features tested:**
- `gateway` keyword
- Gateway call syntax: `gateway GatewayName.methodName(args)`
- Real and string parameter types

**Opcodes generated:**
- `OP_GW_CALL` (0xB0)

### 4. test-dynamic-library.pascalish
Tests dynamic library loading and usage:
- Library declarations
- Library function calls
- Multiple libraries in one program

**Features tested:**
- `library` keyword
- `from librarian` syntax
- Library function calls via dot notation
- Crypto, JSON, and math library examples

**Opcodes generated:**
- `OP_DL_LOAD` (0xA0)
- `OP_DL_CALL` (0xA1)

### 5. test-comprehensive.pascalish
Comprehensive test combining all new features:
- Objects with methods
- Concurrent execution
- Semaphore synchronization
- Gateway calls
- Dynamic library usage
- Complex control flow

**Features tested:**
- All of the above in a realistic scenario
- Transaction processing example
- Multiple concurrent operations
- Resource synchronization

## Running Tests

### Prerequisites
1. ANTLR4 runtime installed
2. Node.js and TypeScript
3. Pascalish grammar compiled

### Compilation Steps

```bash
# 1. Generate ANTLR parser from grammar
cd pulse-new-repo/dsl
antlr4 -Dlanguage=TypeScript Pascalish.g4

# 2. Compile TypeScript files
tsc PascalishCodeGenerator.ts

# 3. Run test compilation
node compile-test.js test-cases/test-objects.pascalish
node compile-test.js test-cases/test-concurrency.pascalish
node compile-test.js test-cases/test-gateway.pascalish
node compile-test.js test-cases/test-dynamic-library.pascalish
node compile-test.js test-cases/test-comprehensive.pascalish
```

### Expected Output

Each test should generate:
1. **JSON AST** - Abstract syntax tree representation
2. **P-code JSON** - Instruction list with opcodes
3. **Binary P-code** - Compiled binary for ESP32 deployment

Example output structure:
```json
{
  "instructions": [
    {
      "opcode": 112,
      "operand1": 0,
      "operand2": "crypto-utils",
      "comment": "Load library: crypto-utils"
    },
    ...
  ],
  "stringPool": ["crypto-utils", "data", "hash", ...],
  "symbols": {...},
  "metadata": {
    "name": "TestDynamicLibrary",
    "version": "2026.06",
    "timestamp": "2026-06-11T14:42:00.000Z",
    "libraries": ["crypto-utils", "json-parser", "math-extended"],
    "gateways": []
  }
}
```

## Validation

### Syntax Validation
All test files should parse without errors using the ANTLR grammar.

### Semantic Validation
- Type checking (if implemented)
- Symbol resolution
- Scope validation

### Code Generation Validation
- Correct opcode generation
- Proper operand encoding
- String pool management
- Label resolution

## Integration with VM

These test cases are designed to work with:
- **pmachine_scheduler.cpp** - Multi-context scheduler
- **pmachine_opcodes_extended.cpp** - Extended opcode handlers
- **pmachine.cpp** - Core VM execution engine

## New Opcodes Used

| Opcode | Hex | Description |
|--------|-----|-------------|
| OP_COBEGIN | 0x70 | Begin concurrent block |
| OP_COEND | 0x71 | End concurrent block |
| OP_SPAWN | 0x72 | Spawn new context |
| OP_SEMWAIT | 0x74 | Wait on semaphore |
| OP_SEMSIGNAL | 0x75 | Signal semaphore |
| OP_SEMINIT | 0x76 | Initialize semaphore |
| OP_DL_LOAD | 0xA0 | Load dynamic library |
| OP_DL_CALL | 0xA1 | Call library function |
| OP_GW_CALL | 0xB0 | Call gateway method |

## Future Enhancements

- [ ] Add file I/O test cases (OP_FILE_* opcodes)
- [ ] Add floating-point arithmetic tests
- [ ] Add array and record tests
- [ ] Add interop tests (WFL, COBOLish)
- [ ] Add error handling tests
- [ ] Add performance benchmarks

## References

- **Grammar:** `../Pascalish.g4`
- **Code Generator:** `../PascalishCodeGenerator.ts`
- **Architecture Spec:** `../../documents/ESP_VIRTUAL_PMACHINE_TARGET_ARCHITECTURE_V2026.md`
- **Scheduler:** `../../virtualMachines/esp32/src/pmachine_scheduler.cpp`
- **Extended Opcodes:** `../../virtualMachines/esp32/src/pmachine_opcodes_extended.cpp`