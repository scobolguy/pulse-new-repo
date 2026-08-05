# PCode Compatibility Contract

## Source and Bytecode Extensions

- Pascalish source files use: `.pas`
- Compiled bytecode files use: `.pcode`

Compilation occurs once, then the same `.pcode` artifact is expected to run on:

1. ESP32 PMachine
2. JavaScript PMachine

## Compatibility Rules

1. Opcode numeric IDs are ABI and must remain stable.
2. Opcode additions are allowed only if both PMachines implement them.
3. Existing opcode semantics must not diverge across runtimes.
4. Any operand encoding changes require an explicit manifest/version bump.

## Single Source of Truth

Opcode compatibility contract file:

- pcode/pcode-opcodes.manifest.json

## CI/Developer Check

Run from the aggregator folder:

`npm run check:pcode-compat`

This validates that every shared opcode matches the `src/pmachine.h` ABI and has both a mnemonic mapping and an executable ESP32 dispatch path.

## Evolution Process

When adding VM features:

1. Update `pcode/pcode-opcodes.manifest.json`
2. Implement on ESP32 PMachine
3. Implement on JavaScript PMachine
4. Add/extend parity tests using shared `.pcode` fixtures
5. Ensure `npm run check:pcode-compat` passes

## Routing Opcode Subset (Phase 2)

For Pascalish router execution in `.pcode`, both runtimes must support:

- `ROUTE_MATCH_QUEUE "queue.name"`
- `ROUTE_EVAL_WHEN "<when-rule>"`
- `ROUTE_TRANSFORM "<transform-rule>"`
- `ROUTE_EMIT "queue.name"`

These are mapped to `OP_ROUTE_*` entries in `pcode/pcode-opcodes.manifest.json`.
