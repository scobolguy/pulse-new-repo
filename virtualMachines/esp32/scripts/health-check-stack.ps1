param(
  [string]$BackendUrl = 'http://127.0.0.1:4000/status',
  [string]$BrokerUrl = 'http://127.0.0.1:4001/health',
  [string]$QueueManagerUrl = 'http://127.0.0.1:4100/health',
  [string]$FrontendUrl = 'http://127.0.0.1:5173/'
)

$ErrorActionPreference = 'Stop'

function Test-Endpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSec = 5
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method GET -TimeoutSec $TimeoutSec
    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      Status = 'OK'
      HttpCode = [int]$response.StatusCode
    }
  }
  catch {
    $code = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      Status = 'FAIL'
      HttpCode = $code
    }
  }
}

$results = @(
  Test-Endpoint -Name 'backend' -Url $BackendUrl
  Test-Endpoint -Name 'broker' -Url $BrokerUrl
  Test-Endpoint -Name 'queue-manager' -Url $QueueManagerUrl
  Test-Endpoint -Name 'frontend' -Url $FrontendUrl
)

$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -ne 'OK' })
if ($failed.Count -gt 0) {
  Write-Host "\nHealth check failed: $($failed.Count) endpoint(s) not OK." -ForegroundColor Red
  exit 1
}

Write-Host "\nHealth check passed: all endpoints responded successfully." -ForegroundColor Green
exit 0
