# Pulse0CompilerJS

A minimal JavaScript compiler for the Pulse0 language, using the ANTLR4-generated parser.

## Structure
- parser/: ANTLR4-generated parser code (JavaScript target)
- compiler.js: Main entry point for compiling Pulse0 source to pcode
- codegen.js: Walks the AST and emits PL/0-style pcode
- README.md: Usage and integration notes
