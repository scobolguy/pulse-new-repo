param(
  [string]$ServiceName = "PulseAggregator",
  [switch]$StartStack
)

$ErrorActionPreference = 'Stop'

$repairScript = Join-Path $PSScriptRoot 'repair-pulse-service.ps1'
$workingDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-NoExit',
  '-File', $repairScript,
  '-ServiceName', $ServiceName
)

if ($StartStack) {
  $arguments += '-StartStack'
}

Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $workingDirectory -Verb RunAs
Write-Output "Opened elevated PowerShell for Pulse service repair. Approve the UAC prompt, then watch that window for completion."