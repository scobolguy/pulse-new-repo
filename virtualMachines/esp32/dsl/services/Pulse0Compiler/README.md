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
This service is designed for integration with the ESP32 PMachine runtime.
