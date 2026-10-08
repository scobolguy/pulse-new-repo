# Pulse Service Startup

Pulse should run one always-on Windows service: `PulseAggregator`. The backend supervises the Data Librarian and Data Mapper companion services by default so both are available whenever Pulse starts.

The gateway remains lean: the Librarian and Mapper are the always-on child services. Broker, MCP, queue workers, and other auxiliary services remain on-demand through the gateway runtime service manager.

## Recommended Model

- Keep `PulseAggregator` installed.
- Reinstall or repair it with `scripts/windows/repair-pulse-service.ps1` after service-runner changes.
- Start optional child services with `scripts/windows/start-pulse-stack.ps1` or `npm run pulse:stack:start`. The Librarian and Mapper are already started and supervised by the backend.
- Check child services with `scripts/windows/status-pulse-stack.ps1` or `npm run pulse:stack:status`.
- Stop child services with `scripts/windows/stop-pulse-stack.ps1` or `npm run pulse:stack:stop`.

### Start backend services at user login

For automatic startup without enabling the Windows service, create a shortcut to `start-pulse.bat` in the current user's Windows Startup folder and set its arguments to `--backends-only`. This mode launches the backend startup shell asynchronously, starts the gateway if needed, and ensures the broker, queue manager, Mapper, and Librarian are healthy. Startup logs are written to `data\logs\backend-startup.log`.

This runs at user login (not before login). The regular `start-pulse.bat` invocation still starts the full application stack.

## Why

The old big-bang startup path made the Windows service responsible for too many child processes at once. A failure in broker, MCP, SQL, or queue workers could make the whole service hard to restart or diagnose.

The gateway binds port `4000` and exposes `/health`. It supervises the Librarian on port `4300` and Mapper on port `4200`, checks their `/health` endpoints, and restarts them after failures. Other child processes start only when requested.

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

If the gateway has not yet been repaired to allow localhost service-control requests, `pulse:stack:start`, `pulse:stack:status`, and `pulse:stack:stop` fall back to direct user-mode process control for broker, queue manager, mapper, and librarian. This path does not require UAC.

## Ports

- Gateway: `4000`
- Broker: `4001`
- Queue manager: `4100`
- Mapper: `4200`
- Librarian: `4300`

Set `PULSE_LIBRARIAN_AUTOSTART=false` or `PULSE_MAPPER_AUTOSTART=false` to opt out of either service in a development run. The Windows service runner explicitly enables both.

## Service Control API

The gateway exposes local service-control endpoints under `/api/runtime/services`. Localhost requests are allowed by default through `PULSE_SERVICE_CONTROL_LOCAL_BYPASS=1` in the Windows service runner. Remote requests still require normal authorization.