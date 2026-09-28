# Aggregator Module Topology

The Aggregator is a modular application. Its current package location, `../../aggregator/`, remains authoritative until the package relocation slice is complete.

The migration must preserve these module families:

- `src/backend/roles/` contains domain-oriented route registration modules.
- `src/backend/modules/` contains reusable backend services, adapters, and route modules.
- `src/backend/databaseProviders/` contains database provider implementations.
- `src/broker/` contains broker and queue-manager providers.
- `src/esp32/` contains ESP32 node registry integration.
- `src/pascal/` contains compiler integration.
- `src/compliance/` and `src/mcp/` contain independent domain integrations.

`backend.mjs` is the composition root: it imports and registers the module interfaces. It must not be treated as the implementation location for those module families.

Before relocating the package to this directory, update path resolution, scripts, batch launchers, deployment assets, and package metadata together. The module-boundary test in `../../testing/aggregator/module-boundaries.test.mjs` is the minimum guardrail for that work.