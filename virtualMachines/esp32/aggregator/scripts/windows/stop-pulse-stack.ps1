param(
  [string]$GatewayUrl = "http://127.0.0.1:4000",
  [string[]]$Services = @("mapper", "librarian", "filesystem", "queue-manager-primary", "broker"),
  [switch]$Cascade
)

$ErrorActionPreference = 'Stop'

foreach ($serviceId in $Services) {
  $stopUrl = "$GatewayUrl/api/runtime/services/$serviceId/stop"
  Write-Output "[pulse] Stopping $serviceId..."
  try {
    $body = @{ cascade = [bool]$Cascade } | ConvertTo-Json -Compress
    $result = Invoke-RestMethod -Uri $stopUrl -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30
    $service = $result.service
    Write-Output ("[pulse]   {0}: status={1} pid={2}" -f $service.id, $service.status, $service.pid)
  } catch {
    throw "Owner aggregator could not stop '$serviceId': $($_.Exception.Message). No process was killed by port number."
  }
}

Write-Output "[pulse] Requested child-service stop. Gateway service is left running."