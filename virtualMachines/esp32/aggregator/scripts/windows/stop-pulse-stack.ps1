param(
  [string]$GatewayUrl = "http://127.0.0.1:4000",
  [string[]]$Services = @("librarian", "mapper", "queue-manager-primary", "broker")
)

$ErrorActionPreference = 'Continue'

function Stop-PortOwner {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceId,
    [Parameter(Mandatory = $true)][int]$Port
  )

  $conn = $null
  try {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  } catch {}

  if (-not $conn -or -not $conn.OwningProcess) {
    Write-Output "[pulse]   $ServiceId is not listening on $Port"
    return
  }

  try {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
    Write-Output "[pulse]   stopped $ServiceId pid=$($conn.OwningProcess) port=$Port"
  } catch {
    Write-Output "[pulse]   failed to stop $ServiceId pid=$($conn.OwningProcess): $($_.Exception.Message)"
  }
}

function Stop-ServiceDirectFallback {
  param([Parameter(Mandatory = $true)][string]$ServiceId)

  switch ($ServiceId) {
    'broker' { Stop-PortOwner -ServiceId $ServiceId -Port 4001; return }
    'queue-manager-primary' { Stop-PortOwner -ServiceId $ServiceId -Port 4100; return }
    'mapper' { Stop-PortOwner -ServiceId $ServiceId -Port 4200; return }
    'librarian' { Stop-PortOwner -ServiceId $ServiceId -Port 4300; return }
    default { Write-Output "[pulse]   no direct fallback for $ServiceId"; return }
  }
}

foreach ($serviceId in $Services) {
  $stopUrl = "$GatewayUrl/api/runtime/services/$serviceId/stop"
  Write-Output "[pulse] Stopping $serviceId..."
  try {
    $result = Invoke-RestMethod -Uri $stopUrl -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 10
    $service = $result.service
    Write-Output ("[pulse]   {0}: status={1} pid={2}" -f $service.id, $service.status, $service.pid)
  } catch {
    Write-Output "[pulse]   gateway supervisor stop failed: $($_.Exception.Message)"
    Write-Output "[pulse]   falling back to direct port-owner stop"
    Stop-ServiceDirectFallback -ServiceId $serviceId
  }
}

Write-Output "[pulse] Requested child-service stop. Gateway service is left running."