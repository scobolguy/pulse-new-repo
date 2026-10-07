# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

`src/runtime.mjs` owns the interpreter. The legacy [Aggregator entrypoint](../../aggregator/scripts/run-js-pmachine.mjs) delegates both API calls and CLI execution to this runtime; it must not contain a separate interpreter copy. Queue-manager and debug helper integrations remain in the Aggregator. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.

Run the shared conformance suite from `aggregator` with `node scripts/test-pmachine-conformance.mjs --target js`. To compare against installed ESP32 firmware, set `ESP32_HOST` and run the same script with `--diff`.

Pascalish supports fixed-point `decimal(precision, scale)` declarations, the `decimal(value)` conversion, and `ROUNDED` assignments. Bare `decimal` defaults to precision 18 and scale 0; `decimal(p)` defaults to scale 0. Precision must be a positive integer, and scale must be an integer from 0 through precision. Assignment fixes the receiving field's scale, truncating by default or rounding half-up away from zero with `ROUNDED`. Decimal literals retain their original digits rather than passing through floating point.

Run the compiler-to-runtime decimal regression from `aggregator` with `node scripts/test-decimal-arithmetic.mjs`. After editing `aggregator/grammar/Pascalish.g4`, regenerate its JavaScript parser with the repository's ANTLR 4.13.2 tool before testing.

## Pulse node discovery daemon

[pulse-node-collector-daemon.pas](../../src/pulse-node-collector-daemon.pas)
is a distinct hosted p-machine daemon, separate from the Kasa/Tuya/SSDP device
collectors. It passively receives `nodeBeacon` and `machineAvailability` JSON
announcements on its assigned UDP intake (Pulse normally uses port 4210).
It does not scan the LAN, send acknowledgements, or control devices. Only nodes
whose announcements reach that intake can be discovered; loopback-only nodes
and nodes on other subnets require a suitable deployment/network arrangement.

The daemon shares the bounded `nodes` host table with the existing
[discovery service](../../src/discovery-collector-service.pas). It merges updates
by stable node identity, preserves previously announced details on lightweight
beacons, and expires observations after the configured TTL (180 seconds by
default). Snapshot reads do not renew that lifetime. Invalid announcements and
table capacity failures are surfaced by the host's daemon diagnostics.

`createPascalishPulseNodeCollector` in [discovery-collector.mjs](./discovery-collector.mjs)
constructs this service/daemon pair for the JavaScript p-machine, with UDP owned
by the daemon rather than the service. The daemon binds UDP with `udpShared`
(`SO_REUSEADDR`), so it can run beside a Network backend that also listens on
4210: both receive broadcast beacons. Pass `udpHost: '0.0.0.0'` to hear LAN
broadcasts while keeping HTTP on `host`. The original
`createPascalishDiscoveryCollector` keeps its existing behavior.

The reporting contract is the paginated `/api/discovery/snapshot` endpoint.
The existing Network backend can consume it through
`PULSE_DISCOVERY_MODE=remote` (collectors only) or `PULSE_DISCOVERY_MODE=hybrid`
(its own shared UDP listener plus collectors; locally heard nodes take
precedence) and
`PULSE_DISCOVERY_COLLECTOR_URLS=http://<collector-ip>:<http-port>`, then publish
the merged nodes through `/api/nodes` to the Infrastructure **Network** view.
`GET /api/discovery/status` reports the active mode and collector health.
This is node discovery, not the device-only **Network (Distributed Cache)**.
No running services, collector settings, or ESP32 deployment are changed here.

Run the focused regression with
`node --test testing\pmachines\pulse-node-collector.test.mjs` from the ESP32 project.