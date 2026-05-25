param(
  [string]$PrimaryHost = '127.0.0.1',
  [string]$BackupHost = '',
  [int]$Port = 4000,
  [int]$TimeoutMs = 1500,
  [string]$RepoRoot = '',
  [switch]$ApplyToFrontend,
  [string]$FrontendEnvPath = ''
)

$ErrorActionPreference = 'Stop'

function Test-BackendHost {
  param(
    [string]$HostName,
    [int]$BackendPort,
    [int]$ProbeTimeoutMs
  )

  if (-not $HostName) {
    return $null
  }

  $url = "http://${HostName}:${BackendPort}/status"
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec ([Math]::Max(1, [Math]::Ceiling($ProbeTimeoutMs / 1000.0)))
    if ($response.StatusCode -ne 200) {
      return [pscustomobject]@{ host = $HostName; url = $url; healthy = $false; statusCode = $response.StatusCode; payload = $null }
    }

    $payload = $null
    try { $payload = $response.Content | ConvertFrom-Json } catch {}
    return [pscustomobject]@{
      host = $HostName
      url = $url
      healthy = $true
      statusCode = 200
      payload = $payload
    }
  } catch {
    return [pscustomobject]@{ host = $HostName; url = $url; healthy = $false; statusCode = $null; payload = $null; error = $_.Exception.Message }
  }
}

function Update-FrontendEnv {
  param(
    [string]$Path,
    [string]$ActiveBase,
    [string]$PrimaryBase,
    [string]$BackupBase
  )

  $lines = @()
  if (Test-Path $Path) {
    $lines = Get-Content -Path $Path
  }

  $newLines = New-Object System.Collections.Generic.List[string]
  $seenProxy = $false
  $seenBases = $false

  foreach ($line in @($lines)) {
    if ($line -match '^\s*VITE_API_PROXY_TARGET\s*=') {
      $newLines.Add("VITE_API_PROXY_TARGET=${ActiveBase}") | Out-Null
      $seenProxy = $true
      continue
    }

    if ($line -match '^\s*VITE_API_BASES\s*=') {
      if ($BackupBase) {
        $newLines.Add("VITE_API_BASES=${PrimaryBase},${BackupBase}") | Out-Null
      } else {
        $newLines.Add("VITE_API_BASES=${PrimaryBase}") | Out-Null
      }
      $seenBases = $true
      continue
    }

    $newLines.Add($line) | Out-Null
  }

  if (-not $seenProxy) {
    $newLines.Add("VITE_API_PROXY_TARGET=${ActiveBase}") | Out-Null
  }

  if (-not $seenBases) {
    if ($BackupBase) {
      $newLines.Add("VITE_API_BASES=${PrimaryBase},${BackupBase}") | Out-Null
    } else {
      $newLines.Add("VITE_API_BASES=${PrimaryBase}") | Out-Null
    }
  }

  $dir = Split-Path -Parent $Path
  if ($dir) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  Set-Content -Path $Path -Value $newLines -Encoding UTF8
}

if (-not $RepoRoot) {
  $RepoRoot = Split-Path -Parent $PSScriptRoot
}

if (-not $FrontendEnvPath) {
  $FrontendEnvPath = Join-Path (Join-Path $RepoRoot 'aggregator') '.env.local'
}

$primaryProbe = Test-BackendHost -HostName $PrimaryHost -BackendPort $Port -ProbeTimeoutMs $TimeoutMs
$backupProbe = if ($BackupHost) { Test-BackendHost -HostName $BackupHost -BackendPort $Port -ProbeTimeoutMs $TimeoutMs } else { $null }

$active = $null
$reason = ''

if ($primaryProbe -and $primaryProbe.healthy) {
  $active = $primaryProbe
  $reason = 'primary-healthy'
} elseif ($backupProbe -and $backupProbe.healthy) {
  $active = $backupProbe
  $reason = 'primary-down-backup-healthy'
} else {
  throw 'No healthy backend host available for promotion decision.'
}

$activeBase = ("http://{0}:{1}" -f $active.host, $Port)
$primaryBase = ("http://{0}:{1}" -f $PrimaryHost, $Port)
$backupBase = if ($BackupHost) { ("http://{0}:{1}" -f $BackupHost, $Port) } else { $null }

if ($ApplyToFrontend) {
  Update-FrontendEnv -Path $FrontendEnvPath -ActiveBase $activeBase -PrimaryBase $primaryBase -BackupBase $backupBase
}

$statePath = Join-Path (Join-Path (Join-Path $RepoRoot 'aggregator') 'logs') 'active-backend-selection.json'
$state = [pscustomobject]@{
  decidedAt = (Get-Date).ToString('o')
  reason = $reason
  activeBase = $activeBase
  activeHost = $active.host
  primary = $primaryProbe
  backup = $backupProbe
  frontendEnvUpdated = [bool]$ApplyToFrontend
  frontendEnvPath = if ($ApplyToFrontend) { $FrontendEnvPath } else { $null }
}

$state | ConvertTo-Json -Depth 8 | Set-Content -Path $statePath -Encoding UTF8
$state | ConvertTo-Json -Depth 8
