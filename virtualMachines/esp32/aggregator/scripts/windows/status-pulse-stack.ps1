param(
  [string]$GatewayUrl = "http://127.0.0.1:4000"
)

$ErrorActionPreference = 'Continue'

function Get-DirectServiceStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$HealthUrl
  )

  $pidValue = $null
  try {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { $pidValue = $conn.OwningProcess }
  } catch {}

  $status = 'stopped'
  $lastError = ''
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { $status = 'running' }
  } catch {
    if ($pidValue) { $status = 'listening-unhealthy' }
    $lastError = $_.Exception.Message
  }

  [PSCustomObject]@{
    id = $Id
    status = $status
    pid = $pidValue
    port = $Port
    healthUrl = $HealthUrl
    lastError = $lastError
  }
}

function Get-DirectStackStatus {
  @(
    Get-DirectServiceStatus -Id 'broker' -Port 4001 -HealthUrl 'http://127.0.0.1:4001/health'
    Get-DirectServiceStatus -Id 'queue-manager-primary' -Port 4100 -HealthUrl 'http://127.0.0.1:4100/health'
    Get-DirectServiceStatus -Id 'mapper' -Port 4200 -HealthUrl 'http://127.0.0.1:4200/health'
    Get-DirectServiceStatus -Id 'librarian' -Port 4300 -HealthUrl 'http://127.0.0.1:4300/health'
  )
}

Write-Output "[pulse] Gateway: $GatewayUrl"
try {
  $health = Invoke-RestMethod -Uri "$GatewayUrl/health" -TimeoutSec 5
  Write-Output ("[pulse]   health={0} service={1}" -f $health.status, $health.service)
} catch {
  Write-Output "[pulse]   health failed: $($_.Exception.Message)"
  exit 1
}

try {
  $services = (Invoke-RestMethod -Uri "$GatewayUrl/api/runtime/services" -TimeoutSec 10).services
  $services | Select-Object id,status,pid,port,healthUrl,lastError | Format-Table -AutoSize
} catch {
  Write-Output "[pulse]   runtime service query failed: $($_.Exception.Message)"
  Write-Output "[pulse]   direct health fallback:"
  Get-DirectStackStatus | Format-Table -AutoSize
}