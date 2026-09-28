# Pulse Service Startup

Pulse should run one always-on Windows service: `PulseAggregator`.

That service is the gateway/supervisor only. It should not start broker, mapper, librarian, MCP, queue workers, or auxiliary services during Windows service boot. Those processes are started on demand through the gateway runtime service manager.

## Recommended Model

- Keep `PulseAggregator` installed.
- Reinstall or repair it with `scripts/windows/repair-pulse-service.ps1` after service-runner changes.
- Start child services with `scripts/windows/start-pulse-stack.ps1` or `npm run pulse:stack:start`.
- Check child services with `scripts/windows/status-pulse-stack.ps1` or `npm run pulse:stack:status`.
- Stop child services with `scripts/windows/stop-pulse-stack.ps1` or `npm run pulse:stack:stop`.

## Why

The old big-bang startup path made the Windows service responsible for too many child processes at once. A failure in mapper, librarian, broker, MCP, SQL, or queue workers could make the whole service hard to restart or diagnose.

The gateway-only service is smaller and more reliable. It binds port `4000`, exposes `/health`, and starts child processes only when requested or required.

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

## Service Control API

The gateway exposes local service-control endpoints under `/api/runtime/services`. Localhost requests are allowed by default through `PULSE_SERVICE_CONTROL_LOCAL_BYPASS=1` in the Windows service runner. Remote requests still require normal authorization.