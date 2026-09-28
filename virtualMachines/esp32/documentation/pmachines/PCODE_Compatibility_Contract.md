# PCode Compatibility Contract

## Source and Bytecode Extensions

- Pascalish source files use: `.pas`
- Compiled bytecode files use: `.pcode`

Compilation occurs once, then the same `.pcode` artifact is expected to run on:

1. ESP32 PMachine
2. JavaScript PMachine

No Java PMachine runtime is currently shipped in this workspace. A future target must be explicitly declared in the opcode manifest before it becomes a compatibility requirement.

## Compatibility Rules

1. Opcode numeric IDs are ABI and must remain stable.
2. Opcode additions are allowed only when every declared target implements them or the manifest explicitly narrows `targets`.
3. Existing opcode semantics must not diverge across runtimes.
4. Any operand encoding changes require an explicit manifest/version bump.

## Single Source of Truth

Opcode compatibility contract file:

- `pmachines/shared/contracts/pcode-opcodes.manifest.json`

## CI/Developer Check

Run from the workspace root:

```powershell
npm run test:pmachine:javascript
```

This suite includes the opcode compatibility check. To run only that check from the Aggregator package, use:

```powershell
npm --prefix .\aggregator run check:pcode-compat
```

It validates that every shared opcode matches the `src/pmachine.h` ABI and has both a mnemonic mapping and an executable ESP32 dispatch path.

## Evolution Process

When adding VM features:

1. Update `pmachines/shared/contracts/pcode-opcodes.manifest.json`.
2. Implement on ESP32 PMachine.
3. Implement on JavaScript PMachine.
4. Add or extend parity tests using shared `.pcode` fixtures.
5. Ensure `npm run test:pmachine:javascript` passes.

## Database and Queue Opcodes

- `DB_INSERT`, `DB_SELECT`, `DB_UPDATE`, and `DB_DELETE` are emitted by independent Pascalish, Cobolish, and VBish compilers.
- `QUEUE_WRITE_SYNC` waits for host acknowledgement.
- `QUEUE_WRITE_ASYNC` dispatches without blocking the p-code program.
- Logical queue and database operands are translated through WFL bindings.

See [LANGUAGE_DATABASE_QUEUE_RUNTIME.md](../compilers/LANGUAGE_DATABASE_QUEUE_RUNTIME.md).

## Routing Opcode Subset (Phase 2)

For Pascalish router execution in `.pcode`, both runtimes must support:

- `ROUTE_MATCH_QUEUE "queue.name"`
- `ROUTE_EVAL_WHEN "<when-rule>"`
- `ROUTE_TRANSFORM "<transform-rule>"`
- `ROUTE_EMIT "queue.name"`

These are mapped to `OP_ROUTE_*` entries in `pmachines/shared/contracts/pcode-opcodes.manifest.json`.