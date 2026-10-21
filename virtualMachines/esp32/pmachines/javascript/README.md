# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

`src/runtime.mjs` owns the interpreter. The legacy [Aggregator entrypoint](../../aggregator/scripts/run-js-pmachine.mjs) delegates both API calls and CLI execution to this runtime; it must not contain a separate interpreter copy. Queue-manager and debug helper integrations remain in the Aggregator. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.

Run the shared conformance suite from `aggregator` with `node scripts/test-pmachine-conformance.mjs --target js`. To compare against installed ESP32 firmware, set `ESP32_HOST` and run the same script with `--diff`.

Pascalish supports fixed-point `decimal(precision, scale)` declarations, the `decimal(value)` conversion, and `ROUNDED` assignments. Bare `decimal` defaults to precision 18 and scale 0; `decimal(p)` defaults to scale 0. Precision must be a positive integer, and scale must be an integer from 0 through precision. Assignment fixes the receiving field's scale, truncating by default or rounding half-up away from zero with `ROUNDED`. Decimal literals retain their original digits rather than passing through floating point.

Run the compiler-to-runtime decimal regression from `aggregator` with `node scripts/test-decimal-arithmetic.mjs`. After editing `aggregator/grammar/Pascalish.g4`, regenerate its JavaScript parser with the repository's ANTLR 4.13.2 tool before testing.

## Managed VM storage (initial integration)

The package exports `PMachineMemory` and `PMachineMemoryError`. The memory owner
supports bounded byte blocks, lazy first-access allocation, checked reads/writes,
resizing, ownership transfer, and program/invocation/procedure scopes. Closing a
scope recursively releases its descendants. Failed allocation or growth preserves
existing blocks and throws an explicit error; configured limits never spill into
an unbudgeted allocation.

Pass `runtimeContext.memoryLimitBytes` to `executeProgram`, or pass a
`PMachineMemory` instance as `runtimeContext.memoryManager` to retain allocator
diagnostics across runs. The initial interpreter integration covers operand-stack
slots and global/local variable slots. Each slot costs 16 VM bytes, plus UTF-8
payload bytes for strings. Procedure storage is released on return; invocation
storage is released on success, cancellation, or exceptions. A successful result's
`memory` field describes usage before invocation cleanup; the manager's
`diagnostics()` reports usage after cleanup, with lifetime totals and cumulative
high-water/failure counters. Without either configuration option, execution keeps
its existing allocation behavior.

This is a VM-storage model, not a limit on V8's physical heap. JavaScript metadata,
objects referenced by slots, host-owned tables/caches, file resources, JSON
temporaries, output snapshots, and compiler data are not yet covered by this
integration. Byte-block reads return caller-owned copies outside the budget.
It must not yet be used as a sandbox-wide memory limit.

The allocator API supports lazy blocks and program-lifetime ownership, but
`static`/`lazy` declaration syntax, service-lifetime integration, and the C++/ESP32
ports are not implemented by this initial integration.

Run the focused tests from the ESP32 workspace:

```powershell
node --test testing\pmachines\memory-management.test.mjs
```