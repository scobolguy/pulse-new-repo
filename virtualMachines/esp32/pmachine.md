# pmachine: ESP Virtual P Machine

## Overview
The pmachine is a portable pcode runtime for constrained embedded systems, designed for the ESP32/ESP8266 platform. It executes a simple stack-based instruction set, with pcode programs loaded from text files and parsed into an internal instruction vector (`pinstructions`).

## Pcode Format
Pcode files are plain text, one instruction per line. Supported instructions:

- `PUSH_STR "string"` — Push a string onto the stack
- `PRINT` — Pop and print the top string from the stack
- `HALT` — Stop execution

Example pcode file:
```
PUSH_STR "hello, world"
PRINT
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

For the example above, the resulting `pinstructions` vector is:
```cpp
{
    { 0x01, -1, "hello, world" },
    { 0x02, -1, "" },
    { 0xFF, -1, "" }
}
```

## Debugging and Tracing
When `pm.run()` is called, each instruction is printed to the serial console along with the current stack state. The `PRINT` instruction outputs the string value popped from the stack.

## Extending the Instruction Set
To add new instructions, update the `Opcode` enum, extend the parser in `loadTextPCode`, and implement the new behavior in `run()`.

## Example Serial Output
```
[DEBUG] Executing pinstructions:
[STEP] 0: opcode=0x1, operand=-1, strOperand='hello, world' | stack: []
[STEP] 1: opcode=0x2, operand=-1, strOperand='' | stack: ["hello, world"]
[PRINT] hello, world
[STEP] 2: opcode=0xFF, operand=-1, strOperand='' | stack: []
[HALT]
[DEBUG] Execution finished.
```

## See Also
- `src/pmachine.h` — Instruction and VM definitions
- `src/pmachine.cpp` — Implementation and parser
- `data/pcode/test` — Example pcode file
