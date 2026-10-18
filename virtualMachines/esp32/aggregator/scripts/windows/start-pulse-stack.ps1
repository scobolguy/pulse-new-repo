param(
  [string]$ServiceName = "PulseAggregator",
  [string]$GatewayUrl = "http://127.0.0.1:4000",
  [string[]]$Services = @("broker", "queue-manager-primary", "mapper", "filesystem", "librarian"),
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
    throw "Owner aggregator could not start '$serviceId': $($_.Exception.Message). No direct process fallback was attempted."
  }
}

Write-Output "[pulse] Stack ready."
& (Join-Path $PSScriptRoot 'status-pulse-stack.ps1') -GatewayUrl $GatewayUrl