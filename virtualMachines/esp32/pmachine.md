# pmachine: ESP Virtual P Machine

## Overview
The pmachine is a portable pcode runtime for constrained embedded systems, designed for the ESP32/ESP8266 platform. It executes a simple stack-based instruction set, with pcode programs loaded from text files and parsed into an internal instruction vector (`pinstructions`).


## Pcode Format
Pcode files are plain text, one instruction per line. Supported instructions:

- `PUSH_STR "string"` — Push a string onto the stack
- `PUSH_INT <int>` — Push an integer onto the stack
- `ADD` — Pop two integers, push their sum
- `SUB` — Pop two integers, push their difference
- `MUL` — Pop two integers, push their product
- `DIV` — Pop two integers, push their quotient (integer division)
- `PRINT` — Pop and print the top string from the stack
- `PRINT_INT` — Pop and print the top integer from the stack
- `ROUTE_MATCH_QUEUE "queue.name"` — Push 1 if runtime input queue matches, else 0
- `ROUTE_EVAL_WHEN "<rule>"` — Evaluate WHEN rule against runtime message, push 1/0
- `ROUTE_TRANSFORM "<rule>"` — Apply TRANSFORM rule to runtime message
- `ROUTE_EMIT "queue.name"` — Emit current runtime message to output queue delivery list
- `HALT` — Stop execution

Example pcode file:
```
PUSH_STR "hello, world"
PRINT
# Integer operations
PUSH_INT 10
PUSH_INT 32
ADD
PRINT_INT
PUSH_INT 100
PUSH_INT 7
SUB
PRINT_INT
PUSH_INT 6
PUSH_INT 7
MUL
PRINT_INT
PUSH_INT 42
PUSH_INT 2
DIV
PRINT_INT
HALT
```

## Internal Representation
Each instruction is parsed into a `PInstruction` struct:
```cpp
struct PInstruction {
    uint8_t opcode;        // e.g., OP_PUSH_STR = 0x01
    int operand;           // -1 if not used
    std::string strOperand;// Used for PUSH_STR
};
```


For the example above, the resulting `pinstructions` vector contains both string and integer instructions, e.g.:
```cpp
{
    { 0x01, OperandType::STRING, 0, "hello, world" },
    { 0x02, OperandType::NONE, 0, "" },
    { 0x10, OperandType::INT, 10, "" },
    { 0x10, OperandType::INT, 32, "" },
    { 0x11, OperandType::NONE, 0, "" },
    { 0x15, OperandType::NONE, 0, "" },
    ...
    { 0xFF, OperandType::NONE, 0, "" }
}
```

## Debugging and Tracing

When `pm.run()` is called, each instruction is printed to the serial console along with the current stack state. The `PRINT` and `PRINT_INT` instructions output the value popped from the stack.

## Extending the Instruction Set
To add new instructions, update the `Opcode` enum, extend the parser in `loadTextPCode`, and implement the new behavior in `run()`.


## Example Serial Output
```
[DEBUG] Executing pinstructions:
[STEP] 0: opcode=0x1, type=2, intOperand=0, strOperand='hello, world' | stack: []
[STEP] 1: opcode=0x2, type=0, intOperand=0, strOperand='' | stack: ["hello, world"]
[PRINT] hello, world
[STEP] 2: opcode=0x10, type=1, intOperand=10, strOperand='' | stack: []
[STEP] 3: opcode=0x10, type=1, intOperand=32, strOperand='' | stack: [10]
[STEP] 4: opcode=0x11, type=0, intOperand=0, strOperand='' | stack: [10, 32]
[STEP] 5: opcode=0x15, type=0, intOperand=0, strOperand='' | stack: [42]
[PRINT_INT] 42
...
[HALT]
[DEBUG] Execution finished.
```

## See Also
- `src/pmachine.h` — Instruction and VM definitions
- `src/pmachine.cpp` — Implementation and parser
- `data/pcode/test` — Example pcode file
