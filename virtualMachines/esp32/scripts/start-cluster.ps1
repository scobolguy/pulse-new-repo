param(
  [ValidateSet('primary', 'backup')]
  [string]$Role = 'primary',
  [Nullable[bool]]$StartFrontend = $null,
  [switch]$Clean,
  [string]$PeerHost = '',
  [switch]$Promote
)

$ErrorActionPreference = 'Stop'

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$Attempts = 80,
    [int]$DelayMs = 500,
    [int]$ExpectedStatus = 200
  )

  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -eq $ExpectedStatus) {
        return $true
      }
    } catch {
    }
    Start-Sleep -Milliseconds $DelayMs
  }

  return $false
}

function Get-EndpointStatus {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
    return [pscustomobject]@{ url = $Url; healthy = ($response.StatusCode -eq 200); statusCode = $response.StatusCode }
  } catch {
    return [pscustomobject]@{ url = $Url; healthy = $false; statusCode = $null; error = $_.Exception.Message }
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$shouldStartFrontend = if ($null -ne $StartFrontend) { [bool]$StartFrontend } else { $Role -eq 'primary' }

if ($Clean) {
  & (Join-Path $repoRoot 'stop-backend.bat') | Out-Null
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\stop-stack.ps1') -Quiet -Ports @(5173) | Out-Null
  } catch {
  }
}

$startBat = if ($Role -eq 'primary') { 'start-backend-primary.bat' } else { 'start-backend-backup.bat' }
& (Join-Path $repoRoot $startBat) | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw ("Failed to start backend role '{0}'" -f $Role)
}

if (-not (Wait-HttpReady -Url 'http://127.0.0.1:4000/status' -Attempts 80 -DelayMs 500 -ExpectedStatus 200)) {
  throw 'Local backend did not become healthy on port 4000.'
}

if ($shouldStartFrontend) {
  $frontendScript = Join-Path $repoRoot 'start-frontend.bat'
  Start-Process -FilePath $frontendScript -WorkingDirectory $repoRoot | Out-Null
}

$frontendReady = if ($shouldStartFrontend) {
  Wait-HttpReady -Url 'http://127.0.0.1:5173/' -Attempts 120 -DelayMs 500 -ExpectedStatus 200
} else {
  $false
}

$peerProbe = $null
if ($PeerHost) {
  $peerProbe = Get-EndpointStatus -Url ("http://{0}:4000/status" -f $PeerHost)
}

$promotion = $null
if ($Promote -and $PeerHost) {
  $promotionScript = Join-Path $repoRoot 'scripts\promote-backend-role.ps1'
  $promotion = & powershell -NoProfile -ExecutionPolicy Bypass -File $promotionScript -PrimaryHost '127.0.0.1' -BackupHost $PeerHost -ApplyToFrontend | ConvertFrom-Json
}

$summary = [pscustomobject]@{
  startedAt = (Get-Date).ToString('o')
  host = $env:COMPUTERNAME
  role = $Role
  backend = Get-EndpointStatus -Url 'http://127.0.0.1:4000/status'
  broker = Get-EndpointStatus -Url 'http://127.0.0.1:4001/health'
  queueManagerPrimaryPort = Get-EndpointStatus -Url 'http://127.0.0.1:4100/health'
  queueManagerBackupPort = Get-EndpointStatus -Url 'http://127.0.0.1:4101/health'
  frontend = [pscustomobject]@{
    expected = $shouldStartFrontend
    healthy = $frontendReady
    url = 'http://127.0.0.1:5173/'
  }
  peer = $peerProbe
  promotion = $promotion
}

$summary | ConvertTo-Json -Depth 8
