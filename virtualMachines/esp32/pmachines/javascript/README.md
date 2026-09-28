# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

The interpreter currently delegates to the established Aggregator runtime while queue-manager and debug helper dependencies are separated. The opcode loader has already moved into this package; the old Aggregator module is a compatibility re-export. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.