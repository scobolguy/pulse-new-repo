# pmachine Evolution Strategy (Rust-Style)

This document defines a long-term, Rust-style evolution strategy for the pmachine running on ESP32-class devices. It establishes a stable core, a flexible extension mechanism, and a multi-tier execution model that allows the language and tooling to evolve without destabilizing deployed devices.

The pmachine is treated as a stable virtual CPU. Language evolution happens in the compiler and libraries, not in the runtime.

## 2. Design Goals
- Stable core instruction set
- Loadable native extensions with zero runtime overhead
- Portable bytecode libraries for complex operations
- Compiler-driven capability detection and lowering
- Support for multiple pmachine variants running the same code
- Minimal RAM/IRAM footprint
- Predictable execution on ESP32

## 3. Three-Tier Execution Model

### Tier 1 — Native C++ Opcode Handlers
Performance-critical and hardware-specific operations are implemented as native C++ functions. These are installed into the opcode dispatch table at boot.

**Characteristics:**
- Zero overhead (direct function pointer dispatch)
- Ideal for arithmetic, memory ops, GPIO, timing, crypto
- Stable ABI
- Optional extensions loaded at boot

### Tier 2 — Bytecode Library Routines
Complex or evolving operations are implemented as pmachine bytecode functions. They are invoked via a dedicated opcode such as OP_CALL_LIB.

**Characteristics:**
- Portable across pmachines
- Updatable without reflashing firmware
- Good for strings, collections, protocols, debouncing, retry logic

### Tier 3 — Compiler Macros
High-level constructs are expanded at compile time into core opcodes or library calls.

**Characteristics:**
- No runtime cost
- Ideal for language sugar and experimental features
- Compiler chooses best lowering strategy

## 4. Opcode Dispatch Table
The pmachine maintains a fixed-size dispatch table in IRAM:

    handler_table[256];

Each entry is a function pointer. Core opcodes are fixed; extension slots are filled at boot.

**Example:**

    handler_table[0] = op_add;
    handler_table[1] = op_sub;
    ...
    handler_table[200] = ext_gpio_write;
    handler_table[201] = ext_pwm_set;

Execution loop:

    handler_table[opcode](vm_state);

This provides native-level performance for both built-in and loadable opcodes.

## 5. Extension Loading
Extensions are registered at boot using a manifest or static table.

**Example registration:**

    register_extension(200, ext_gpio_write);
    register_extension(201, ext_pwm_set);

Extensions may be:
- Compiled into firmware
- Conditionally included based on hardware
- Selected by configuration

## 6. Bytecode Library Calling Convention
A library table maps indices to bytecode entrypoints:

    library_table[32];  // index → bytecode address

The compiler emits:

    OP_CALL_LIB <index>

The pmachine jumps to the bytecode routine, preserving stack discipline.

**Use cases:**
- String operations
- Protocol handlers
- Math utilities
- Device logic not requiring native speed

## 7. Compiler Lowering Strategy
For each high-level operation F, the compiler follows this sequence:

- If pmachine supports native opcode → emit opcode
- Else if library provides implementation → emit OP_CALL_LIB
- Else → expand macro into core opcodes

This ensures:
- Same source code runs everywhere
- High-end pmachines get fast paths
- Low-end pmachines get portable fallbacks

## 8. Capability Model
Each pmachine exposes a descriptor:

    {
      "version": 1,
      "extensions": ["gpio", "math_ext", "crypto"],
      "library_slots": 32
    }

The compiler uses this to determine lowering.

## 9. Stability and Evolution
The pmachine core remains frozen. New features are introduced via:
- New native extensions
- New bytecode libraries
- New compiler macros

This mirrors Rust’s evolution model:
- Stable machine model
- Evolving language and tooling
- Capability-based optimizations

## 10. Summary
This architecture provides:
- High performance on ESP32
- Long-term language evolution
- Portable bytecode across pmachines
- Optional hardware-accelerated extensions
- A stable foundation for tooling and future features

It balances stability, flexibility, and performance for embedded scripting on ESP32-class devices.
