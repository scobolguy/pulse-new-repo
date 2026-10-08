# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

`src/runtime.mjs` owns the interpreter. The legacy [Aggregator entrypoint](../../aggregator/scripts/run-js-pmachine.mjs) delegates both API calls and CLI execution to this runtime; it must not contain a separate interpreter copy. Queue-manager and debug helper integrations remain in the Aggregator. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.

Run the shared conformance suite from `aggregator` with `node scripts/test-pmachine-conformance.mjs --target js`. To compare against installed ESP32 firmware, set `ESP32_HOST` and run the same script with `--diff`.

Pascalish supports fixed-point `decimal(precision, scale)` declarations, the `decimal(value)` conversion, and `ROUNDED` assignments. Bare `decimal` defaults to precision 18 and scale 0; `decimal(p)` defaults to scale 0. Precision must be a positive integer, and scale must be an integer from 0 through precision. Assignment fixes the receiving field's scale, truncating by default or rounding half-up away from zero with `ROUNDED`. Decimal literals retain their original digits rather than passing through floating point.

Run the compiler-to-runtime decimal regression from `aggregator` with `node scripts/test-decimal-arithmetic.mjs`. After editing `aggregator/grammar/Pascalish.g4`, regenerate its JavaScript parser with the repository's ANTLR 4.13.2 tool before testing.