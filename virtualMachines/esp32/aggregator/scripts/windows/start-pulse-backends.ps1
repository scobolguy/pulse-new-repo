$ErrorActionPreference = 'Stop'

$aggregatorRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dataRoot = Join-Path $aggregatorRoot 'data'
$logsRoot = Join-Path $dataRoot 'logs'
$gatewayUrl = 'http://127.0.0.1:4000'
$gatewayHealthUrl = "$gatewayUrl/health"
$startupLog = Join-Path $logsRoot 'backend-startup.log'
$gatewayStdout = Join-Path $logsRoot 'backend-user-mode.out.log'
$gatewayStderr = Join-Path $logsRoot 'backend-user-mode.err.log'

New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null

function Write-StartupLog {
  param([Parameter(Mandatory = $true)][string]$Message)
  Add-Content -Path $startupLog -Value "[$(Get-Date -Format o)] $Message" -Encoding UTF8
}

function Test-GatewayHealth {
  try {
    $response = Invoke-WebRequest -Uri $gatewayHealthUrl -UseBasicParsing -TimeoutSec 3
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
  } catch {
    return $false
  }
}

try {
  if (-not (Test-GatewayHealth)) {
    $powershell = Get-Command powershell.exe -ErrorAction Stop
    $backendRunner = Join-Path $PSScriptRoot 'run-aggregator-backend.ps1'
    Write-StartupLog 'Starting gateway backend process.'
    $gatewayProcess = Start-Process `
      -FilePath $powershell.Source `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $backendRunner, '-AggregatorRoot', $aggregatorRoot) `
      -WorkingDirectory $aggregatorRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $gatewayStdout `
      -RedirectStandardError $gatewayStderr `
      -PassThru

    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
      if (Test-GatewayHealth) {
        break
      }
      if ($gatewayProcess.HasExited) {
        throw "Gateway process exited with code $($gatewayProcess.ExitCode). Check $gatewayStderr"
      }
      Start-Sleep -Seconds 2
    }

    if (-not (Test-GatewayHealth)) {
      throw "Gateway did not become healthy at $gatewayHealthUrl within 120 seconds."
    }
  } else {
    Write-StartupLog 'Gateway is already healthy.'
  }

  $stackScript = Join-Path $PSScriptRoot 'start-pulse-stack.ps1'
  Write-StartupLog 'Ensuring backend companion services are running.'
  $stackOutput = & $stackScript -GatewayUrl $gatewayUrl -TimeoutSeconds 45 2>&1 | Out-String -Width 240
  $stackOutput.TrimEnd() -split '\r?\n' |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { Write-StartupLog $_ }

  Write-StartupLog 'Backend startup completed.'
} catch {
  Write-StartupLog "ERROR: $($_.Exception.Message)"
  throw
}
