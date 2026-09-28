# PMachines

This directory is the future source of truth for reusable PMachine runtimes.

- `arduino/` will provide the portable C++ runtime as a PlatformIO-compatible local library plus ESP32 integration adapters.
- `javascript/` will provide the JavaScript runtime, CLI, and backend integration exports as a workspace package.
- `shared/` will contain the one canonical opcode contract and deliberately shared PMachine fixtures.

The existing firmware and Aggregator locations remain authoritative until each runtime is migrated and its conformance checks pass.

The JavaScript runtime is now implemented at `pmachines/javascript/src/runtime.mjs`. The legacy `aggregator/scripts/run-js-pmachine.mjs` path remains as a compatibility wrapper, while tracing is injectable and the Aggregator queue manager is loaded only for polling mode. Direct backend consumers use the package façade.