param(
  [string]$ServiceName = "PulseAggregator",
  [string]$GatewayUrl = "http://127.0.0.1:4000",
  [string[]]$Services = @("broker", "queue-manager-primary", "mapper", "librarian"),
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'

function Test-HttpOk {
  param([Parameter(Mandatory = $true)][string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
  } catch {
    return $false
  }
}

function Wait-HttpOk {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk -Url $Url) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Start-LocalProcessService {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceId,
    [Parameter(Mandatory = $true)][string]$HealthUrl,
    [Parameter(Mandatory = $true)][string]$ScriptName,
    [string[]]$ScriptArgs = @(),
    [int]$TimeoutSeconds = 30
  )

  if (Test-HttpOk -Url $HealthUrl) {
    Write-Output "[pulse]   $ServiceId already healthy: $HealthUrl"
    return
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "node.exe not found on PATH. Install Node.js or add it to PATH."
  }

  $aggregatorRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  $arguments = @($ScriptName) + $ScriptArgs
  $logsDir = Join-Path $aggregatorRoot 'data\logs'
  New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
  $stdout = Join-Path $logsDir "$ServiceId.out.log"
  $stderr = Join-Path $logsDir "$ServiceId.err.log"

  Write-Output "[pulse]   starting $ServiceId directly as user process"
  Start-Process -FilePath $node.Source -ArgumentList $arguments -WorkingDirectory $aggregatorRoot -WindowStyle Minimized -RedirectStandardOutput $stdout -RedirectStandardError $stderr | Out-Null

  if (-not (Wait-HttpOk -Url $HealthUrl -TimeoutSeconds $TimeoutSeconds)) {
    throw "$ServiceId did not become healthy at $HealthUrl. Check $stderr"
  }

  Write-Output "[pulse]   $ServiceId healthy: $HealthUrl"
}

function Start-ServiceDirectFallback {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceId,
    [int]$TimeoutSeconds = 30
  )

  switch ($ServiceId) {
    'broker' {
      Start-LocalProcessService -ServiceId $ServiceId -HealthUrl 'http://127.0.0.1:4001/health' -ScriptName 'broker-service.mjs' -TimeoutSeconds $TimeoutSeconds
      return
    }
    'queue-manager-primary' {
      Start-LocalProcessService -ServiceId $ServiceId -HealthUrl 'http://127.0.0.1:4100/health' -ScriptName 'queue-manager-node.mjs' -ScriptArgs @('--aggregator=http://127.0.0.1:4000', '--port=4100', '--manager-id=qm-local-4100', '--node-id=local-qm-4100', '--advertise-ip=127.0.0.1') -TimeoutSeconds $TimeoutSeconds
      return
    }
    'mapper' {
      Start-LocalProcessService -ServiceId $ServiceId -HealthUrl 'http://127.0.0.1:4200/health' -ScriptName 'data-mapper.mjs' -TimeoutSeconds $TimeoutSeconds
      return
    }
    'librarian' {
      Start-LocalProcessService -ServiceId $ServiceId -HealthUrl 'http://127.0.0.1:4300/health' -ScriptName 'data-librarian.mjs' -TimeoutSeconds $TimeoutSeconds
      return
    }
    default {
      throw "No direct fallback is defined for service '$ServiceId'"
    }
  }
}

$healthUrl = "$GatewayUrl/health"
if (-not (Test-HttpOk -Url $healthUrl)) {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Running') {
    try {
      Start-Service -Name $ServiceName -ErrorAction Stop
      Write-Output "[pulse] Started service $ServiceName"
    } catch {
      Write-Output "[pulse] Unable to start $ServiceName from this session: $($_.Exception.Message)"
    }
  }
}

if (-not (Wait-HttpOk -Url $healthUrl -TimeoutSeconds $TimeoutSeconds)) {
  throw "Gateway did not become healthy at $healthUrl"
}

Write-Output "[pulse] Gateway healthy: $healthUrl"

foreach ($serviceId in $Services) {
  $startUrl = "$GatewayUrl/api/runtime/services/$serviceId/start"
  Write-Output "[pulse] Ensuring $serviceId..."
  try {
    $result = Invoke-RestMethod -Uri $startUrl -Method Post -ContentType 'application/json' -Body '{"waitForHealthy":true}' -TimeoutSec $TimeoutSeconds
    $service = $result.service
    Write-Output ("[pulse]   {0}: status={1} pid={2} port={3}" -f $service.id, $service.status, $service.pid, $service.port)
  } catch {
    Write-Output "[pulse]   gateway supervisor start failed: $($_.Exception.Message)"
    Write-Output "[pulse]   falling back to direct user-mode start"
    Start-ServiceDirectFallback -ServiceId $serviceId -TimeoutSeconds $TimeoutSeconds
  }
}

Write-Output "[pulse] Stack ready."
& (Join-Path $PSScriptRoot 'status-pulse-stack.ps1') -GatewayUrl $GatewayUrl