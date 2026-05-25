param(
  [string]$RepoRoot = '',
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Write-Status {
  param([string]$Message)
  if (-not $Quiet) {
    Write-Output $Message
  }
}

function Stop-ByPid {
  param([int]$ProcessId)

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
    Write-Status ("Stopped PID {0} ({1})" -f $process.Id, $process.ProcessName)
  } catch {
  }
}

function Stop-Listeners {
  param([int[]]$Ports)

  foreach ($port in $Ports) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($ownerPid in @($owners)) {
      Stop-ByPid -ProcessId $ownerPid
    }
  }
}

if (-not $RepoRoot) {
  $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$logsRoot = Join-Path (Join-Path $RepoRoot 'aggregator') 'logs'
$manifestPath = Join-Path $logsRoot 'split-backend-processes.json'

if (Test-Path $manifestPath) {
  try {
    $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
    foreach ($entry in @($manifest.processes)) {
      if ($entry.pid) {
        Stop-ByPid -ProcessId ([int]$entry.pid)
      }
    }
  } catch {
    Write-Status ("Failed to parse process manifest: {0}" -f $_.Exception.Message)
  }
}

Stop-Listeners -Ports @(4000, 4001, 4100, 4101, 4200)

$result = [pscustomobject]@{
  status = 'stopped'
  host = $env:COMPUTERNAME
  checkedPorts = @(4000, 4001, 4100, 4101, 4200)
}

$result | ConvertTo-Json -Depth 3
