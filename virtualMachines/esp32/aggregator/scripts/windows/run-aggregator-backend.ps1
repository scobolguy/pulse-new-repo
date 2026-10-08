param(
  [string]$AggregatorRoot = "",
  [string]$DataRoot = "",
  [string]$Role = "primary"
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($AggregatorRoot)) {
  $AggregatorRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\")).Path
} else {
  $AggregatorRoot = (Resolve-Path $AggregatorRoot).Path
}

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
  $DataRoot = Join-Path $AggregatorRoot "data"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "node.exe not found on PATH. Install Node.js and retry."
}

$env:MODULAR_BACKEND = '1'
$env:PULSE_QUEUE_DATA_ROOT = $DataRoot
$env:PULSE_RUNTIME_DATA_ROOT = $DataRoot
$env:PULSE_BACKEND_ROLE = $Role
$env:PULSE_START_POLICY = 'lazy'

# Keep the gateway lean while always supervising the Librarian and Mapper.
$env:PULSE_LIBRARIAN_AUTOSTART = '1'
$env:PULSE_MAPPER_AUTOSTART = '1'
$env:BACKEND_WORKER_AUTOSTART = '0'
$env:PULSE_MCP_AUTOSTART = '0'
$env:PULSE_SERVICE_CONTROL_LOCAL_BYPASS = '1'

# Service defaults: avoid noisy SQL group-provider failures and strict startup-only router prechecks.
# Operators can override by defining machine/user environment variables.
if ([string]::IsNullOrWhiteSpace($env:GROUP_PROVIDER)) {
  $env:GROUP_PROVIDER = 'file'
}
if ([string]::IsNullOrWhiteSpace($env:ROUTER_STRICT_INPUT_RULES)) {
  $env:ROUTER_STRICT_INPUT_RULES = 'false'
}

Set-Location $AggregatorRoot

# Keep process attached so Windows Service manager can supervise it.
& $node.Source "backend.mjs"
exit $LASTEXITCODE
