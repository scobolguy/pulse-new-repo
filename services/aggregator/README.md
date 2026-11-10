# Live aggregator

Replacement for `virtualMachines/esp32/aggregator`. It lists active swarm nodes and their advertised execution capabilities. It has no dependencies and stores nothing.

- Listens for `nodeBeacon` / `machineAvailability` UDP beacons on 4210 (`reuseAddr`, so it coexists with the pathway controller) and acks them.
- A node is listed only if its beacon is within the TTL (default 180 s), `available` is not false, it is not `draining`, and it is either ESP firmware (`firmwareBuildStamp` present, or `hardware`/`runtime` names an ESP) or advertises a P-machine capability (`pmachine-pcode-v1`, `pmachine`, or `pascalish-dag-v1`).
- `GET /api/nodes` probes `http://<ip>:<httpPort>/status` and drops nodes that don't answer. Responses are `no-store`. `PROBE=0` skips the probe. P-machine nodes include a normalized `pmachine` descriptor.
- `GET /api/pmachines` returns only active, reachable nodes with `pmachine.available === true`; clients should use this endpoint to choose an execution target for generated P-code.
- State is in memory only, so a restart starts empty.

```
npm start      # UDP_PORT=4210 HTTP_PORT=4000 BEACON_TTL_MS=180000 PROBE=0|1
npm test
```

`GET /api/health` returns the settings in use.
