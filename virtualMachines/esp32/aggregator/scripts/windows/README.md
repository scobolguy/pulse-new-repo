# Aggregator Windows Service

This folder contains scripts to run the aggregator backend as a Windows Service.

## Scripts

- install-aggregator-service.ps1
- run-aggregator-backend.ps1
- service-status.ps1
- uninstall-aggregator-service.ps1

## Install

Run from an elevated PowerShell session:

```powershell
Set-Location C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator
.\scripts\windows\install-aggregator-service.ps1 -ServiceName PulseAggregator -StartNow
```

Prerequisite:

- `nssm.exe` must be installed and available on PATH.

Optional parameters:

- -AggregatorRoot "C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator"
- -DataRoot "C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator\data"
- -Role "primary"

## Check Status

```powershell
.\scripts\windows\service-status.ps1 -ServiceName PulseAggregator
```

## Stop / Start

```powershell
Stop-Service PulseAggregator
Start-Service PulseAggregator
```

## Uninstall

Run from an elevated PowerShell session:

```powershell
.\scripts\windows\uninstall-aggregator-service.ps1 -ServiceName PulseAggregator
```

## Notes

- Install always uses NSSM with log files under `aggregator\logs`.
- If you previously created a broken service entry without NSSM, remove it first:

```powershell
.\scripts\windows\uninstall-aggregator-service.ps1 -ServiceName PulseAggregator
```

- Then install again after NSSM is on PATH.
- Service runtime env vars are set by `run-aggregator-backend.ps1`:
  - MODULAR_BACKEND=1
  - PULSE_QUEUE_DATA_ROOT=<DataRoot>
  - PULSE_RUNTIME_DATA_ROOT=<DataRoot>
  - PULSE_BACKEND_ROLE=<Role>
  - GROUP_PROVIDER=file (default in service mode unless already set)
  - ROUTER_STRICT_INPUT_RULES=false (default in service mode unless already set)
