# Arduino PMachine

This directory is the PlatformIO-compatible local library for the reusable C++ PMachine runtime.

The library implementation lives in `src/`:

- `pmachine.{h,cpp}` is the interpreter core and public runtime API.
- `pmachine_scheduler.{h,cpp}` provides PMachine scheduling.
- `pmachine_dynamic_library.{h,cpp}` provides runtime symbol resolution.
- `pmachine_opcodes_extended.{h,cpp}` provides extended opcode behavior.
- `pmachine_routes.{h,cpp}` adapts the runtime to ESP32 HTTP and Federated File System services.

`main.cpp` stays firmware-owned. It includes the PMachine headers only when `ENABLE_PMACHINE` is enabled. PlatformIO discovers this local library through `lib_extra_dirs = pmachines`, while firmware-owned headers remain available through the shared `-I src` flag.

Standalone scheduler and dynamic-library C++ tests are already consolidated under `../../testing/pmachines/`.

Run `npm run test:pmachine:arduino-layout` before and after that migration slice.