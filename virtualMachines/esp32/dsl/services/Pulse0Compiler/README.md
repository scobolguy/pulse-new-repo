# Pulse0Compiler Service

This service compiles Pulse0 (PulseSys) source code into PCODE for execution on the PMachine (ESP32).

## Features
- Accepts Pulse0 source code as input (via HTTP API or CLI)
- Parses using the PulseSys.g4 grammar (ANTLR4)
- Performs semantic analysis and type checking
- Generates PCODE bytecode compatible with the PMachine
- Returns PCODE as a binary or hex output

## Directory Structure
- `Pulse0CompilerService.py` — Main service entry point (Flask API)
- `parser/` — ANTLR4-generated parser and lexer
- `compiler/` — Semantic analysis and code generation logic
- `tests/` — Example Pulse0 programs and test scripts

## Usage
1. Start the service: `python Pulse0CompilerService.py`
2. POST Pulse0 source to `/compile` endpoint
3. Receive PCODE output for the PMachine

---

## File Naming and Language Separation

- **Pulse0 source files** use the `.pulse0` suffix (e.g., `test_preprocessor.pulse0`).
- **Pcode files** use the `.pcode` suffix (e.g., `hello.pcode`).
- **Pulse0 and pcode cannot be intermixed** in a single file. Pulse0 is a high-level, Pascal-like language, while pcode is the compiled/intermediate bytecode.
- **Linking:** Pulse0 and pcode modules can be bound together at the linker stage, but not within the same source file.

This service is designed for integration with the ESP32 PMachine runtime.
