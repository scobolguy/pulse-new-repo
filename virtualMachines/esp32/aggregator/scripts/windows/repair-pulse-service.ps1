param(
  [string]$ServiceName = "PulseAggregator",
  [switch]$StartStack
)

$ErrorActionPreference = 'Stop'

$install = Join-Path $PSScriptRoot 'install-aggregator-service.ps1'
& $install -ServiceName $ServiceName -StartNow

if ($StartStack) {
  & (Join-Path $PSScriptRoot 'start-pulse-stack.ps1') -ServiceName $ServiceName
}