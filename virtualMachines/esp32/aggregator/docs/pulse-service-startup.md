# Pulse Service Startup

Pulse should run one always-on Windows service: `PulseAggregator`. The backend supervises the Filesystem, Data Librarian, and Data Mapper companion services so storage is available before the Librarian starts serving requests.

The gateway remains lean: the Filesystem, Librarian, and Mapper are the always-on child services. Broker, MCP, queue workers, and other auxiliary services remain on-demand through the gateway runtime service manager.

## Recommended Model

- Keep `PulseAggregator` installed.
- Reinstall or repair it with `scripts/windows/repair-pulse-service.ps1` after service-runner changes.
- Start optional child services with `scripts/windows/start-pulse-stack.ps1` or `npm run pulse:stack:start`. The Filesystem, Librarian, and Mapper are started and supervised by the backend.
- Check child services with `scripts/windows/status-pulse-stack.ps1` or `npm run pulse:stack:status`.
- Stop child services with `scripts/windows/stop-pulse-stack.ps1` or `npm run pulse:stack:stop`.

### Start backend services at user login

For automatic startup without enabling the Windows service, create a shortcut to `start-pulse.bat` in the current user's Windows Startup folder and set its arguments to `--backends-only`. This mode launches the backend startup shell asynchronously, starts the gateway if needed, and ensures the broker, queue manager, Mapper, and Librarian are healthy. Startup logs are written to `data\logs\backend-startup.log`.

This runs at user login (not before login). The regular `start-pulse.bat` invocation still starts the full application stack.

## Why

The old big-bang startup path made the Windows service responsible for too many child processes at once. A failure in broker, MCP, SQL, or queue workers could make the whole service hard to restart or diagnose.

The gateway binds port `4000` and exposes `/health`. It supervises the Filesystem on port `4302`, Librarian on port `4300`, and Mapper on port `4200`, checks their `/health` endpoints, and restarts them after failures. The Filesystem service listens on IPv4 interfaces for the ESP32 read-only profile, but accepts only loopback and the configured S3 address (`192.168.2.90` by default). It grants root-confined schema reads and managed-catalog reads/writes; it does not expose general filesystem access. Override the address filter with `FILESYSTEM_ALLOWED_CLIENTS` only when the board's address changes. Other child processes start only when requested.

## Normal Recovery

Run from an elevated PowerShell when the service definition needs repair:

```powershell
cd C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\repair-pulse-service.ps1 -StartStack
```

Run from a normal shell when the service is already installed and running:

```powershell
cd C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator
npm run pulse:stack:start
npm run pulse:stack:status
```

If the gateway has not yet been repaired to allow localhost service-control requests, `pulse:stack:start`, `pulse:stack:status`, and `pulse:stack:stop` fall back to direct user-mode process control for broker, queue manager, mapper, filesystem, and librarian. This path does not require UAC.

The Filesystem watchdog is enabled by default, independently of `BACKEND_AUX_SERVICES_AUTOSTART`. It checks health every five seconds and restarts the service after an exit or repeated health failures. It also monitors an already-running external instance and starts a replacement if that instance disappears. Set `PULSE_FILESYSTEM_AUTOSTART=false` to disable it deliberately; the Windows service runner explicitly enables it. The runtime service manifest includes `filesystem` and makes it a prerequisite for starting `librarian`. Restart an already-running gateway after updating these files so it loads the manifest and watchdog changes.

## Ports

- Gateway: `4000`
- Broker: `4001`
- Queue manager: `4100`
- Mapper: `4200`
- Librarian: `4300`
- Discovery (optional standalone collector): `4301`
- Filesystem: `4302`

The default environment in `config/service-registry.json` uses these ports for service health checks and catalog endpoints. The Librarian's internal storage client defaults to the Filesystem service and can be redirected with `LIBRARIAN_FILESYSTEM_SERVICE_URL`. Override the standalone collector port with `DISCOVERY_HTTP_PORT`; keep collector URLs and the registry consistent with any override. The secondary environment retains Librarian on `4311`, Filesystem on `4312`, and Discovery on `4310`.

Set `PULSE_LIBRARIAN_AUTOSTART=false` or `PULSE_MAPPER_AUTOSTART=false` to opt out of either service in a development run. The Windows service runner explicitly enables both.

## Service Control API

The gateway exposes local service-control endpoints under `/api/runtime/services`. Localhost requests are allowed by default through `PULSE_SERVICE_CONTROL_LOCAL_BYPASS=1` in the Windows service runner. Remote requests still require normal authorization.

### ESP32 machine authentication

An unattended native service can use a dedicated machine bearer credential instead
of an expiring administrator session. The gateway loads
`runtime-machine-credentials.json` from `PULSE_RUNTIME_DATA_ROOT` (the operational
data root by default). `PULSE_RUNTIME_MACHINE_CREDENTIALS_PATH` overrides its path;
an explicitly configured missing file or malformed configuration prevents startup.
With no default file, existing user-session authorization remains unchanged.

The configuration contains SHA-256 digests, not plaintext tokens:

```json
{
  "version": 1,
  "credentials": [{
    "tokenSha256": "<64 lowercase hex characters>",
    "nodeId": "192.168.2.90",
    "serviceId": "pulse-librarian-s3-readonly",
    "ownerAggregatorId": "local-workspace",
    "childRequests": [
      { "serviceId": "pulse-filesystem", "method": "POST", "path": "/health" },
      { "serviceId": "pulse-filesystem", "method": "POST", "path": "/catalogs" },
      { "serviceId": "pulse-filesystem", "method": "POST", "path": "/catalog/page" },
      { "serviceId": "pulse-filesystem", "method": "POST", "path": "/schemas/page" },
      { "serviceId": "pulse-filesystem", "method": "POST", "path": "/schema-tree/page" }
    ]
  }]
}
```

Generate a random token with at least 32 bytes of entropy, encoded as base64url,
and put its SHA-256 digest in that configuration. Keep the plaintext token in a
separate private file outside the repository, shaped as `{"token":"<token>"}`.
Restrict access to both files to the gateway/deployment account and administrators.
Never put the token into source artifacts, task arguments, logs, or status responses.

Set `PULSE_AGGREGATOR_BEARER_TOKEN_FILE` to the private token file when running
`scripts/deploy-librarian-readonly-esp32.mjs`, along with the existing explicit
owner, report URL, and Filesystem binding. The installer supplies `bearerToken`
in the runtime `reportTarget` object, separate from the signed program map.
The native host sends it only to that target's report endpoint and its child
transaction endpoint, not to local health probes or dependencies.

Machine authorization checks the actual TCP peer address (not forwarded headers),
the service/instance/owner identity and HTTP listener address. Child requests must
match an exact configured service, method and path and have an allocated parent
owned by that instance. The credential does not authorize service start/stop,
transaction reads, other services' reports, or unrelated APIs. Existing user
sessions and local service control continue to work.

Native transport currently uses HTTP, not TLS: provision and use these tokens only
on a trusted LAN. Credential support requires updated ESP32 firmware, followed by
reinstalling the hosted service. Tokens live in the hosted service's RAM, not its
public uploaded files, so a board reboot requires redeployment. Gateway restarts
reload the digest configuration. To revoke or rotate a token, update the gateway
configuration and restart it; redeploy the board with the replacement private token.
HTTP 401/403 report failures are exposed in hosted service diagnostics.

### Transaction storage

The 10,000-record transaction admission limit applies to the active store, not
completed history. Completed records move atomically into its `archive` subdirectory
on startup, during reconciliation, and before rejecting an admission at capacity.
Archived results remain queryable through `GET /api/runtime/transactions/:transactionId`;
they are read from disk on demand rather than retained in memory. History is not
automatically deleted, so archive disk usage still needs operational monitoring.

Held, allocated, waiting-child, and uncertain records stay active. A completed
child also stays active while a non-completed parent may still need its result.
Uncertain requests are never automatically replayed. If protected records alone
fill the store, new requests still receive HTTP 503 instead of losing durable work.
Restart an existing gateway to load this behavior and archive its completed backlog.

## VS Code Service Directory and Schema Catalog

VS Code's **Pulse Services** view uses the gateway's `GET /api/services` directory.
It merges configured offerings (including Data Librarian and Data Mapper),
runtime instances, discovered nodes, and configured discovery collectors.
Unreachable node registries produce an explicit degraded status and error list;
they do not hide configured services. Restart the gateway after changing its
routes, then refresh the view.

Use `GET /api/librarian/schemas` through the gateway (port `4000`) or Librarian
(port `4300`) to verify schema availability; `/health` alone does not exercise
catalog parsing. Numeric filename versions such as `camt.003.001.08.xsd` and
`invoice.v003.json` are normalized by Pascalish policy. Physical schema parsing
uses bounded batches, and catalog responses are assembled from bounded PMachine
messages without dropping field trees. An individually oversized entry is an
explicit capacity error rather than a truncated schema.