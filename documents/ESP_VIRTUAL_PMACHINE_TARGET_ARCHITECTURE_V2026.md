# ESP Virtual P-Machine: Language and Architecture Specification (Migration Edition)

**Version:** 2026-06  
**Target:** IBM BOB Migration Engine  
**Authoritative Source:** Richard + Copilot Architecture Sessions (April–June 2026)  
**Status:** SPECIFICATION FOR IMPLEMENTATION

---

## 1. Purpose of This Document

This document defines the complete target architecture for the ESP Virtual P-Machine ecosystem, including:

- **Pascalish language grammar** (full BNF with objects, inheritance, gateways)
- **COBOLish semantic model** (unified with Pascalish runtime)
- **Unified P-Machine instruction set** (60+ opcodes)
- **Runtime architecture** (scheduler, contexts, queues, broker, SD chunkstore)
- **Dynamic library model** (thunk-based binding, manifests)
- **Configuration system** (registry-driven, schema-enforced)
- **Migration mapping** (existing system → target system)

This document is designed for **automated ingestion by IBM BOB** to perform static analysis, code transformation, and system migration.

---

## 2. Existing System Overview

### 2.1 Languages

#### Pascalish (Legacy)
- **Parser:** PEG.js
- **Output:** JSON AST
- **Code Generation:** Emits p-code for legacy VM
- **Type System:** Limited (integer, string, basic arrays)
- **Missing Features:** No inheritance, interfaces, gateways, dynamic libraries, objects with methods

#### COBOLish (Existing)
- **Parser:** ANTLR
- **Output:** JSON AST
- **Features:** Queue statements, broker integration
- **Integration:** Uses same VM as Pascalish
- **Limitations:** No unified runtime with Pascalish

### 2.2 Virtual Machine (Legacy)

**Current Implementation:** `virtualMachines/esp32/src/pmachine.cpp`

**Characteristics:**
- Single execution context
- No scheduler
- No semaphores or synchronization primitives
- No COBEGIN/COEND support
- Limited opcode set (~40 opcodes)
- No dynamic library loader
- No SD chunkstore abstraction
- No unified FILE_* API
- Stack-based execution model (retained in target)

**Current Opcodes:**
```
OP_NOP, OP_LIT, OP_OPR, OP_LOD, OP_STO, OP_CAL, OP_INT, OP_JMP, OP_JZ,
OP_PUSH_INT, OP_PUSH_STR, OP_PUSH_ENUM, OP_ADD, OP_SUB, OP_MUL, OP_DIV,
OP_PRINT_INT, OP_PRINT_ENUM, OP_ROUTE_MATCH_QUEUE, OP_ROUTE_EVAL_WHEN,
OP_ROUTE_TRANSFORM, OP_ROUTE_EMIT, OP_PARSE_FIN_TEXT, OP_ROUTE_SET_STATE,
OP_ROUTE_SET_MESSAGE, OP_LOAD_NAME, OP_STORE_NAME, OP_CALL_LABEL, OP_RET,
OP_EQ, OP_NEQ, OP_LT, OP_LE, OP_GT, OP_GE, OP_PRINT, OP_PRINT_NL,
OP_ORCH_SPAWN, OP_ORCH_WAIT_ALL, OP_ORCH_FAIL_TXN, OP_ORCH_RETURN_SUCCESS,
OP_CALL_EXT, OP_HALT
```

### 2.3 Runtime (Legacy)

**Configuration:**
- Ad-hoc JSON configuration files
- No registry-driven configuration
- No schema enforcement
- No soft-driven behavior

**Missing Components:**
- Device mediator
- Abstract types
- SYS boundary abstraction
- Broker discovery protocol
- SD chunkstore

---

## 3. Target System Overview

### 3.1 High-Level Goals

The target system provides:

1. **Unified language toolchain:** Pascalish + COBOLish → ANTLR → JSON AST → p-code
2. **Modernized P-Machine:** Scheduler, multiple contexts, semaphores
3. **Registry-driven configuration:** Schema-based, soft-driven
4. **Dynamic library model:** Thunk-based binding, manifest-driven
5. **Broker API:** Inter-device messaging, discovery
6. **Soft-driven architecture:** Device mediator, abstract types
7. **Portable, offline-capable runtime:** ESP32/ESP8266 optimized

### 3.2 Key Architectural Principles

- **Backward compatibility NOT required** - clean break from legacy
- **Stack-based execution model retained** - proven, efficient
- **Preemptive multitasking** - scheduler-driven context switching
- **Zero-copy message passing** - queue-based, reference semantics
- **Wear-leveling storage** - SD chunkstore for flash longevity
- **Late binding** - dynamic library thunks resolved at runtime

---

## 4. Pascalish Language Specification (Target)

### 4.1 Complete BNF Grammar

```bnf
<program> ::= "program" <identifier> ";" <block> "."

<block> ::= <declarations> <compound_statement>

<declarations> ::= { <const_decl> | <type_decl> | <var_decl> | <proc_decl> | <library_decl> | <interop_decl> }

<const_decl> ::= "const" <identifier> "=" <expression> ";"

<type_decl> ::= "type" <identifier> "=" <type> ";"

<var_decl> ::= "var" <identifier_list> ":" <type> ";"

<proc_decl> ::= "procedure" <identifier> "(" <param_list> ")" [ ":" <type> ] ";" <block> ";"

<library_decl> ::= "library" <string_literal> "from" <identifier> ";"

<interop_decl> ::= "interop" <language_id> <string_literal> "as" <identifier> ";"

<language_id> ::= "wfl" | "cobolish" | "pascalish"

<param_list> ::= [ <param> { ";" <param> } ]

<param> ::= [ "var" ] <identifier_list> ":" <type>

<type> ::= <simple_type> | <structured_type> | <object_type>

<simple_type> ::= "integer" | "real" | "boolean" | "string" | <identifier>

<structured_type> ::= <array_type> | <record_type>

<array_type> ::= "array" "[" <expression> ".." <expression> "]" "of" <type>

<record_type> ::= "record" { <field_decl> } "end"

<field_decl> ::= <identifier_list> ":" <type> ";"

<object_type> ::= "object" [ "(" <identifier> ")" ] <object_body>

<object_body> ::= { <field_decl> | <method_decl> } "end"

<method_decl> ::= "method" <identifier> "(" <param_list> ")" [ ":" <type> ] ";" <block> ";"

<compound_statement> ::= "begin" <statement_list> "end"

<statement_list> ::= <statement> { ";" <statement> }

<statement> ::= <assignment>
               | <if_statement>
               | <while_statement>
               | <for_statement>
               | <repeat_statement>
               | <case_statement>
               | <procedure_call>
               | <compound_statement>
               | <queue_statement>
               | <gateway_call>
               | <cobegin_statement>
               | <semaphore_statement>
               | <empty>

<assignment> ::= <variable> ":=" <expression>

<if_statement> ::= "if" <expression> "then" <statement> [ "else" <statement> ]

<while_statement> ::= "while" <expression> "do" <statement>

<for_statement> ::= "for" <identifier> ":=" <expression> ("to" | "downto") <expression> "do" <statement>

<repeat_statement> ::= "repeat" <statement_list> "until" <expression>

<case_statement> ::= "case" <expression> "of" <case_list> [ "else" <statement_list> ] "end"

<case_list> ::= <case_item> { ";" <case_item> }

<case_item> ::= <constant_list> ":" <statement>

<constant_list> ::= <constant> { "," <constant> }

<procedure_call> ::= <identifier> [ "(" <expression_list> ")" ]

<queue_statement> ::= "queue" <identifier> "(" [ <expression_list> ] ")"

<gateway_call> ::= "gateway" <identifier> "." <identifier> "(" [ <expression_list> ] ")"

<cobegin_statement> ::= "cobegin" <statement_list> "coend"

<semaphore_statement> ::= <sem_wait> | <sem_signal>

<sem_wait> ::= "wait" "(" <identifier> ")"

<sem_signal> ::= "signal" "(" <identifier> ")"

<expression_list> ::= <expression> { "," <expression> }

<expression> ::= <simple_expression> [ <relop> <simple_expression> ]

<simple_expression> ::= [ <sign> ] <term> { <addop> <term> }

<term> ::= <factor> { <mulop> <factor> }

<factor> ::= <identifier>
            | <number>
            | <string_literal>
            | "(" <expression> ")"
            | "not" <factor>
            | <function_call>
            | <field_access>
            | <array_access>

<function_call> ::= <identifier> "(" [ <expression_list> ] ")"

<field_access> ::= <identifier> "." <identifier>

<array_access> ::= <identifier> "[" <expression> "]"

<variable> ::= <identifier> [ <field_access> | <array_access> ]

<relop> ::= "=" | "<>" | "<" | "<=" | ">" | ">="

<addop> ::= "+" | "-" | "or"

<mulop> ::= "*" | "/" | "div" | "mod" | "and"

<sign> ::= "+" | "-"

<identifier_list> ::= <identifier> { "," <identifier> }

<identifier> ::= <letter> { <letter> | <digit> | "_" }

<number> ::= <integer> | <real>

<integer> ::= <digit> { <digit> }

<real> ::= <integer> "." <integer> [ "e" [ <sign> ] <integer> ]

<string_literal> ::= '"' { <character> } '"'

<constant> ::= <number> | <string_literal> | <identifier>
```

### 4.2 New Language Features

#### Objects with Inheritance
```pascal
type
  Animal = object
    name: string;
    age: integer;
    method speak(): string;
  end;

  Dog = object(Animal)
    breed: string;
    method speak(): string;  // Override
  end;
```

#### Gateway Interfaces
```pascal
gateway PaymentGateway.processPayment(amount: real, currency: string);
gateway NotificationGateway.sendAlert(message: string, priority: integer);
```

#### Dynamic Library Calls
```pascal
library "crypto-utils" from librarian;
library "json-parser" from librarian;

// Later in code:
result := crypto_utils.sha256(data);
```

#### Concurrent Execution
```pascal
cobegin
  task1();
  task2();
  task3();
coend;  // Wait for all to complete
```

#### Semaphores
```pascal
var mutex: semaphore;

wait(mutex);
  // Critical section
signal(mutex);
```

---

## 5. P-Machine Specification (Target)

### 5.1 Execution Model

**Core Characteristics:**
- Stack-based virtual machine
- Multiple execution contexts (threads)
- Preemptive scheduler with round-robin or priority-based scheduling
- Semaphore-based synchronization
- Message queue system
- Dynamic library loader
- SYS boundary for host services

**Memory Model:**
- **Code Segment:** P-code instructions (read-only)
- **Data Segment:** Global variables
- **Stack Segment:** Per-context stacks (locals, temporaries, return addresses)
- **Heap Segment:** Dynamic allocations (optional, for advanced features)

### 5.2 Execution Context Structure

```cpp
struct ExecutionContext {
    uint16_t contextId;
    uint16_t pc;                    // Program counter
    uint16_t sp;                    // Stack pointer
    uint16_t bp;                    // Base pointer (frame pointer)
    uint8_t priority;               // Scheduling priority (0-255)
    ContextState state;             // READY, RUNNING, BLOCKED, TERMINATED
    uint32_t blockedUntilMs;        // For timed waits
    uint16_t blockedOnSemaphore;    // Semaphore ID if blocked
    std::vector<int> stack;         // Execution stack
    std::map<std::string, int> locals; // Named local variables
};

enum ContextState {
    READY,
    RUNNING,
    BLOCKED,
    TERMINATED
};
```

### 5.3 Scheduler

**Algorithm:** Round-robin with optional priority levels

**Behavior:**
1. Maintain queue of READY contexts
2. Select next context (highest priority or round-robin)
3. Execute quantum (configurable instruction count or time slice)
4. Context switch on:
   - Quantum expiration
   - YIELD instruction
   - Blocking operation (SEMWAIT, MSGRECV)
   - COEND (wait for spawned contexts)

**Preemption:** Enabled by default, can be disabled for critical sections

### 5.4 Unified Instruction Set (60+ Opcodes)

#### Arithmetic Operations
```
OP_ADD      = 0x10  // Pop b, pop a, push a+b (integer)
OP_SUB      = 0x11  // Pop b, pop a, push a-b
OP_MUL      = 0x12  // Pop b, pop a, push a*b
OP_DIV      = 0x13  // Pop b, pop a, push a/b (integer division)
OP_MOD      = 0x14  // Pop b, pop a, push a%b
OP_NEG      = 0x15  // Pop a, push -a
OP_FADD     = 0x16  // Floating-point add
OP_FSUB     = 0x17  // Floating-point subtract
OP_FMUL     = 0x18  // Floating-point multiply
OP_FDIV     = 0x19  // Floating-point divide
```

#### Stack Operations
```
OP_PUSH_INT = 0x20  // Push integer literal
OP_PUSH_STR = 0x21  // Push string literal
OP_PUSH_REAL= 0x22  // Push real literal
OP_POP      = 0x23  // Discard top of stack
OP_DUP      = 0x24  // Duplicate top of stack
OP_SWAP     = 0x25  // Swap top two stack items
```

#### Load/Store Operations
```
OP_LOAD     = 0x30  // Load variable by name
OP_STORE    = 0x31  // Store to variable by name
OP_LOADL    = 0x32  // Load local variable (level, offset)
OP_STOREL   = 0x33  // Store local variable (level, offset)
OP_LODX     = 0x34  // Load array element (indexed)
OP_STOX     = 0x35  // Store array element (indexed)
OP_LOADF    = 0x36  // Load record field
OP_STOREF   = 0x37  // Store record field
```

#### Control Flow
```
OP_JMP      = 0x40  // Unconditional jump
OP_JZ       = 0x41  // Jump if zero
OP_JNZ      = 0x42  // Jump if not zero
OP_CALL     = 0x43  // Call procedure
OP_RET      = 0x44  // Return from procedure
OP_HALT     = 0xFF  // Stop execution
```

#### Comparison Operations
```
OP_EQ       = 0x50  // Equal
OP_NEQ      = 0x51  // Not equal
OP_LT       = 0x52  // Less than
OP_LE       = 0x53  // Less or equal
OP_GT       = 0x54  // Greater than
OP_GE       = 0x55  // Greater or equal
```

#### Logical Operations
```
OP_AND      = 0x60  // Logical AND
OP_OR       = 0x61  // Logical OR
OP_NOT      = 0x62  // Logical NOT
```

#### Context/Scheduler Operations (NEW)
```
OP_COBEGIN  = 0x70  // Begin concurrent block
OP_COEND    = 0x71  // End concurrent block (wait for all)
OP_SPAWN    = 0x72  // Spawn new context
OP_YIELD    = 0x73  // Yield to scheduler
OP_SEMWAIT  = 0x74  // Wait on semaphore
OP_SEMSIGNAL= 0x75  // Signal semaphore
OP_SEMINIT  = 0x76  // Initialize semaphore
```

#### Queue/Broker Operations
```
OP_BQINIT   = 0x80  // Initialize broker queue
OP_BQPUSH   = 0x81  // Push message to queue
OP_BQPOP    = 0x82  // Pop message from queue
OP_MSGSEND  = 0x83  // Send message via broker
OP_MSGRECV  = 0x84  // Receive message (blocking)
OP_MSGRECV_NB=0x85  // Receive message (non-blocking)
```

#### File/IO Operations (NEW)
```
OP_FILE_OPEN  = 0x90  // Open file (SD chunkstore)
OP_FILE_READ  = 0x91  // Read from file
OP_FILE_WRITE = 0x92  // Write to file
OP_FILE_CLOSE = 0x93  // Close file
OP_FILE_SEEK  = 0x94  // Seek to position
OP_FILE_TELL  = 0x95  // Get current position
```

#### Dynamic Library Operations (NEW)
```
OP_DL_LOAD  = 0xA0  // Load dynamic library
OP_DL_CALL  = 0xA1  // Call library function via thunk
OP_DL_UNLOAD= 0xA2  // Unload library
```

#### Gateway Operations (NEW)
```
OP_GW_CALL  = 0xB0  // Call gateway method
OP_GW_REG   = 0xB1  // Register gateway implementation
```

#### System Operations
```
OP_SYSCALL  = 0xC0  // Generic system call
OP_PRINT    = 0xC1  // Print to console
OP_PRINT_NL = 0xC2  // Print newline
```

### 5.5 Instruction Format

**Fixed-width format (8 bytes):**
```
Byte 0:     Opcode (uint8_t)
Byte 1:     Flags (uint8_t)
Bytes 2-3:  Operand1 (int16_t)
Bytes 4-7:  Operand2 (int32_t) or string pool index
```

**Variable-width format (for strings):**
```
Byte 0:     Opcode
Byte 1:     Length (uint8_t)
Bytes 2-N:  String data
```

---

## 6. Runtime Architecture

### 6.1 Scheduler

**Implementation:** `PMachineScheduler` class

**Responsibilities:**
- Maintain context table
- Select next context to run
- Perform context switches
- Handle blocking/unblocking
- Manage semaphores

**Configuration:**
```json
{
  "scheduler": {
    "algorithm": "round-robin",
    "quantum": 100,
    "maxContexts": 16,
    "priorityLevels": 4
  }
}
```

### 6.2 Broker

**Purpose:** Inter-device messaging and discovery

**Features:**
- HTTP-based communication
- Device discovery via UDP broadcast
- Queue-based message delivery
- Request/response pattern
- Fire-and-forget pattern
- Broadcast pattern

**API:**
```cpp
class BrokerClient {
public:
    bool sendMessage(const std::string& targetDevice, 
                     const std::string& queue, 
                     const std::string& message);
    
    bool receiveMessage(const std::string& queue, 
                        std::string& outMessage, 
                        uint32_t timeoutMs);
    
    std::vector<DeviceInfo> discoverDevices();
};
```

### 6.3 SD Chunkstore

**Purpose:** Wear-leveling storage for flash memory

**Features:**
- Chunked allocation (configurable chunk size)
- Wear leveling across sectors
- Metadata tracking
- Garbage collection
- File abstraction layer

**Structure:**
```
Chunk Header (16 bytes):
  - Magic number (4 bytes)
  - Chunk ID (4 bytes)
  - Next chunk ID (4 bytes)
  - Data length (2 bytes)
  - Checksum (2 bytes)

Chunk Data (variable):
  - User data (up to chunk size - header size)
```

### 6.4 Registry-Driven Configuration

**Schema Example:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "device": {
      "type": "object",
      "properties": {
        "id": {"type": "string"},
        "role": {"enum": ["frontend", "backend", "edge"]},
        "sensors": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {"type": "string"},
              "type": {"type": "string"},
              "pin": {"type": "integer"},
              "sampleRate": {"type": "integer"}
            }
          }
        }
      }
    }
  }
}
```

**Device Mediator:**
- Binds abstract types to concrete implementations
- Manages sensor/actuator lifecycle
- Provides unified API for hardware access

---

## 7. Dynamic Library Model

### 7.1 Library Structure

**Manifest Format (JSON):**
```json
{
  "name": "crypto-utils",
  "version": "1.0.0",
  "exports": [
    {
      "name": "sha256",
      "signature": "(string) -> string",
      "entryPoint": 100
    },
    {
      "name": "aes_encrypt",
      "signature": "(string, string) -> string",
      "entryPoint": 200
    }
  ],
  "dependencies": [],
  "pcodeSegments": [
    {
      "offset": 0,
      "length": 500,
      "checksum": "abc123"
    }
  ]
}
```

### 7.2 Thunk-Based Binding

**Thunk Table:**
```cpp
struct Thunk {
    std::string libraryName;
    std::string functionName;
    uint16_t targetPC;
    bool resolved;
};

std::map<std::string, Thunk> thunkTable;
```

**Resolution Process:**
1. Compiler emits `OP_DL_CALL` with thunk ID
2. At runtime, VM checks if thunk is resolved
3. If not, load library and resolve entry point
4. Cache resolved address
5. Jump to target PC

### 7.3 Loading Process

```cpp
bool loadLibrary(const std::string& name) {
    // 1. Load manifest from SD chunkstore
    Manifest manifest = loadManifest(name);
    
    // 2. Verify dependencies
    for (auto& dep : manifest.dependencies) {
        if (!isLibraryLoaded(dep)) {
            loadLibrary(dep);
        }
    }
    
    // 3. Load pcode segments into memory
    for (auto& segment : manifest.pcodeSegments) {
        loadPCodeSegment(segment);
    }
    
    // 4. Register exports in thunk table
    for (auto& exp : manifest.exports) {
        registerThunk(name, exp.name, exp.entryPoint);
    }
    
    return true;
}
```

---

## 8. Migration Mapping (Existing → Target)

### 8.1 Language Migration

| Component | Existing | Target | Migration Strategy |
|-----------|----------|--------|-------------------|
| Parser | PEG.js | ANTLR | Complete rewrite, grammar expansion |
| Grammar | Limited Pascal | Full Pascalish BNF | Add objects, inheritance, gateways |
| Type System | Basic | Rich (objects, interfaces) | Extend type checker |
| Interop | Ad-hoc | Formal declarations | Add `interop` keyword |
| Libraries | None | Dynamic loading | Add `library` keyword |

### 8.2 VM Migration

| Feature | Existing | Target | Migration Strategy |
|---------|----------|--------|-------------------|
| Contexts | Single | Multiple | Add context table, scheduler |
| Scheduling | None | Preemptive | Implement scheduler loop |
| Semaphores | None | Full support | Add SEMWAIT/SEMSIGNAL opcodes |
| Concurrency | None | COBEGIN/COEND | Add spawn/join mechanism |
| Libraries | None | Dynamic loading | Add DL_LOAD/DL_CALL opcodes |
| File I/O | Ad-hoc | Unified FILE_* API | Add FILE_* opcodes |
| Opcodes | ~40 | 60+ | Add new opcodes, maintain compatibility where possible |

### 8.3 Configuration Migration

| Aspect | Existing | Target | Migration Strategy |
|--------|----------|--------|-------------------|
| Format | Ad-hoc JSON | Schema-enforced JSON | Define schemas, validate |
| Loading | Manual parsing | Registry-driven | Implement registry system |
| Behavior | Hard-coded | Soft-driven | Add device mediator |
| Validation | None | Schema validation | Integrate JSON schema validator |

### 8.4 Code Transformation Rules

**Rule 1: Simple procedure calls remain unchanged**
```pascal
// Before and After:
myProcedure(arg1, arg2);
```

**Rule 2: Add library declarations**
```pascal
// Before: (implicit)
result := sha256(data);

// After:
library "crypto-utils" from librarian;
result := crypto_utils.sha256(data);
```

**Rule 3: Convert ad-hoc concurrency to COBEGIN/COEND**
```pascal
// Before: (manual spawn)
spawn_task(task1);
spawn_task(task2);
wait_all();

// After:
cobegin
  task1();
  task2();
coend;
```

**Rule 4: Add semaphore declarations**
```pascal
// Before: (no synchronization)
critical_section();

// After:
var mutex: semaphore;
wait(mutex);
critical_section();
signal(mutex);
```

---

## 9. Implementation Phases

### Phase 1: Core VM Enhancement
- Implement execution context structure
- Add scheduler with round-robin algorithm
- Implement context switching
- Add COBEGIN/COEND/YIELD opcodes
- Test with simple concurrent programs

### Phase 2: Semaphore System
- Implement semaphore data structure
- Add SEMWAIT/SEMSIGNAL opcodes
- Implement blocking/unblocking logic
- Test with producer-consumer patterns

### Phase 3: Dynamic Library System
- Design manifest format
- Implement library loader
- Add thunk table and resolution
- Implement DL_LOAD/DL_CALL opcodes
- Test with sample libraries

### Phase 4: File I/O System
- Implement SD chunkstore
- Add FILE_* opcodes
- Integrate with dynamic library storage
- Test with file operations

### Phase 5: Language Migration
- Implement ANTLR Pascalish grammar
- Add object/inheritance support
- Add gateway syntax
- Add library declaration syntax
- Update code generator

### Phase 6: Registry System
- Define configuration schemas
- Implement schema validator
- Build device mediator
- Add soft-driven behavior engine

### Phase 7: Broker Integration
- Implement broker client
- Add device discovery
- Implement queue operations
- Add MSGSEND/MSGRECV opcodes

### Phase 8: Testing & Validation
- Create comprehensive test suite
- Performance benchmarking
- Migration validation
- Documentation

---

## 10. IBM BOB Integration Specification

### 10.1 Input Requirements

BOB requires:
1. **Legacy source code** (Pascalish .pas files, COBOLish .cob files)
2. **Legacy AST** (JSON format from PEG.js parser)
3. **Target grammar** (ANTLR .g4 file)
4. **Transformation rules** (this document, Section 8.4)
5. **Validation rules** (test cases, expected outputs)

### 10.2 Output Requirements

BOB produces:
1. **Migrated source code** (new Pascalish syntax)
2. **Migration report** (changes made, warnings, errors)
3. **Test results** (validation against expected behavior)
4. **Dependency graph** (library dependencies, interop relationships)

### 10.3 Transformation Pipeline

```
Legacy Source → Parse (PEG.js) → Legacy AST → 
Transform (BOB) → Target AST → Generate (ANTLR) → 
Target Source → Compile → Target Pcode → Validate
```

### 10.4 Validation Strategy

**Static Analysis:**
- Type checking
- Undefined variable detection
- Dead code elimination
- Control flow analysis

**Dynamic Analysis:**
- Test case execution
- Performance comparison (legacy vs. target)
- Memory usage analysis
- Concurrency correctness

---

## 11. Deliverables Checklist

- [x] Complete Pascalish BNF grammar
- [x] Unified P-Machine instruction set (60+ opcodes)
- [x] Execution context structure
- [x] Scheduler specification
- [x] Semaphore system design
- [x] Dynamic library model
- [x] SD chunkstore specification
- [x] Registry-driven configuration
- [x] Broker API design
- [x] Migration mapping tables
- [x] Transformation rules
- [x] IBM BOB integration specification
- [ ] ANTLR grammar file (.g4)
- [ ] Implementation code (C++ for VM)
- [ ] Test suite
- [ ] Migration tooling

---

## 12. References

**Existing System:**
- `virtualMachines/esp32/src/pmachine.h` - Current VM header
- `virtualMachines/esp32/src/pmachine.cpp` - Current VM implementation
- `documents/PASCALISH_USER_GUIDE.md` - Legacy Pascalish guide
- `documents/COBOLISH_USER_GUIDE.md` - Legacy COBOLish guide

**Target System:**
- This document (authoritative specification)
- Future: ANTLR grammar files
- Future: Implementation code

---

## Appendix A: Example Programs

### A.1 Concurrent Task Example

```pascal
program ConcurrentExample;

var
  result1, result2, result3: integer;
  mutex: semaphore;

procedure task1();
begin
  wait(mutex);
  result1 := compute1();
  signal(mutex);
end;

procedure task2();
begin
  wait(mutex);
  result2 := compute2();
  signal(mutex);
end;

procedure task3();
begin
  wait(mutex);
  result3 := compute3();
  signal(mutex);
end;

begin
  seminit(mutex, 1);
  
  cobegin
    task1();
    task2();
    task3();
  coend;
  
  writeln('Results: ', result1, result2, result3);
end.
```

### A.2 Dynamic Library Example

```pascal
program LibraryExample;

library "crypto-utils" from librarian;
library "json-parser" from librarian;

var
  data: string;
  hash: string;
  jsonObj: object;

begin
  data := 'Hello, World!';
  hash := crypto_utils.sha256(data);
  writeln('Hash: ', hash);
  
  jsonObj := json_parser.parse('{"key": "value"}');
  writeln('Key: ', jsonObj.get('key'));
end.
```

### A.3 Gateway Example

```pascal
program GatewayExample;

var
  amount: real;
  result: boolean;

begin
  amount := 1000.50;
  result := gateway PaymentGateway.processPayment(amount, 'USD');
  
  if result then
    writeln('Payment successful')
  else
    writeln('Payment failed');
end.
```

---

## Appendix B: Opcode Reference Table

| Opcode | Hex | Name | Operands | Stack Effect | Description |
|--------|-----|------|----------|--------------|-------------|
| OP_ADD | 0x10 | ADD | - | [a,b] → [a+b] | Integer addition |
| OP_SUB | 0x11 | SUB | - | [a,b] → [a-b] | Integer subtraction |
| OP_MUL | 0x12 | MUL | - | [a,b] → [a*b] | Integer multiplication |
| OP_DIV | 0x13 | DIV | - | [a,b] → [a/b] | Integer division |
| OP_MOD | 0x14 | MOD | - | [a,b] → [a%b] | Modulo |
| OP_NEG | 0x15 | NEG | - | [a] → [-a] | Negation |
| OP_FADD | 0x16 | FADD | - | [a,b] → [a+b] | Float addition |
| OP_FSUB | 0x17 | FSUB | - | [a,b] → [a-b] | Float subtraction |
| OP_FMUL | 0x18 | FMUL | - | [a,b] → [a*b] | Float multiplication |
| OP_FDIV | 0x19 | FDIV | - | [a,b] → [a/b] | Float division |
| OP_PUSH_INT | 0x20 | PUSH_INT | value | [] → [value] | Push integer |
| OP_PUSH_STR | 0x21 | PUSH_STR | string | [] → [string] | Push string |
| OP_PUSH_REAL | 0x22 | PUSH_REAL | value | [] → [value] | Push real |
| OP_POP | 0x23 | POP | - | [a] → [] | Discard top |
| OP_DUP | 0x24 | DUP | - | [a] → [a,a] | Duplicate top |
| OP_SWAP | 0x25 | SWAP | - | [a,b] → [b,a] | Swap top two |
| OP_LOAD | 0x30 | LOAD | name | [] → [value] | Load variable |
| OP_STORE | 0x31 | STORE | name | [value] → [] | Store variable |
| OP_JMP | 0x40 | JMP | addr | - | Jump unconditional |
| OP_JZ | 0x41 | JZ | addr | [cond] → [] | Jump if zero |
| OP_JNZ | 0x42 | JNZ | addr | [cond] → [] | Jump if not zero |
| OP_CALL | 0x43 | CALL | addr | - | Call procedure |
| OP_RET | 0x44 | RET | - | - | Return |
| OP_EQ | 0x50 | EQ | - | [a,b] → [a==b] | Equal |
| OP_NEQ | 0x51 | NEQ | - | [a,b] → [a!=b] | Not equal |
| OP_LT | 0x52 | LT | - | [a,b] → [a<b] | Less than |
| OP_LE | 0x53 | LE | - | [a,b] → [a<=b] | Less or equal |
| OP_GT | 0x54 | GT | - | [a,b] → [a>b] | Greater than |
| OP_GE | 0x55 | GE | - | [a,b] → [a>=b] | Greater or equal |
| OP_AND | 0x60 | AND | - | [a,b] → [a&&b] | Logical AND |
| OP_OR | 0x61 | OR | - | [a,b] → [a\|\|b] | Logical OR |
| OP_NOT | 0x62 | NOT | - | [a] → [!a] | Logical NOT |
| OP_COBEGIN | 0x70 | COBEGIN | count | - | Begin concurrent block |
| OP_COEND | 0x71 | COEND | - | - | End concurrent block |
| OP_SPAWN | 0x72 | SPAWN | addr | - | Spawn context |
| OP_YIELD | 0x73 | YIELD | - | - | Yield to scheduler |
| OP_SEMWAIT | 0x74 | SEMWAIT | id | - | Wait on semaphore |
| OP_SEMSIGNAL | 0x75 | SEMSIGNAL | id | - | Signal semaphore |
| OP_SEMINIT | 0x76 | SEMINIT | id, val | - | Initialize semaphore |
| OP_DL_LOAD | 0xA0 | DL_LOAD | name | - | Load library |
| OP_DL_CALL | 0xA1 | DL_CALL | thunk | - | Call library function |
| OP_FILE_OPEN | 0x90 | FILE_OPEN | name, mode | [] → [handle] | Open file |
| OP_FILE_READ | 0x91 | FILE_READ | handle | [] → [data] | Read file |
| OP_FILE_WRITE | 0x92 | FILE_WRITE | handle | [data] → [] | Write file |
| OP_FILE_CLOSE | 0x93 | FILE_CLOSE | handle | - | Close file |
| OP_HALT | 0xFF | HALT | - | - | Stop execution |

---

**END OF SPECIFICATION**

**Status:** Ready for implementation and IBM BOB ingestion  
**Next Steps:** Begin Phase 1 (Core VM Enhancement)