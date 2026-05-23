param(
  [string]$BoneCrusherIp = '',
  [string[]]$ProbeIps = @('192.168.2.115','192.168.2.116','192.168.2.117','192.168.2.118'),
  [string]$SupervisorIp = '',
  [switch]$RequireSupervisorGreen,
  [int]$SupervisorWaitSeconds = 30
)

$ErrorActionPreference = 'Stop'
$ConfirmPreference = 'None'
$repoRoot = Split-Path -Parent $PSScriptRoot
$aggregatorRoot = Join-Path $repoRoot 'aggregator'
$logRoot = Join-Path $aggregatorRoot 'logs'

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Stop-Listeners {
  param([int[]]$Ports)

  foreach ($port in $Ports) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($id in $pids) {
      try {
        $null = & taskkill.exe /PID $id /F
        Write-Output ("Stopped PID {0} on port {1}" -f $id, $port)
      } catch {
        Write-Output ("Failed stop PID {0} on port {1}: {2}" -f $id, $port, $_.Exception.Message)
      }
    }

    if (-not $pids) {
      Write-Output ("No listener on port {0}" -f $port)
    }
  }
}

function Resolve-BoneCrusherIp {
  param([string]$PreferredIp, [string[]]$Candidates)

  if ($PreferredIp) {
    $Candidates = @($PreferredIp) + ($Candidates | Where-Object { $_ -ne $PreferredIp })
  }

  foreach ($ip in $Candidates) {
    try {
      $status = Invoke-RestMethod -Uri ("http://{0}/status" -f $ip) -TimeoutSec 4
      if ("$($status.deviceRole)".ToLowerInvariant() -eq 'bonecrusher') {
        return $ip
      }
    } catch {
    }
  }

  return $null
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$MaxAttempts = 20,
    [int]$DelayMs = 500,
    [scriptblock]$IsReady = { param($Response) $Response.StatusCode -eq 200 }
  )

  for ($attempt = 0; $attempt -lt $MaxAttempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if (& $IsReady $response) {
        return $true
      }
    } catch {
    }

    Start-Sleep -Milliseconds $DelayMs
  }

  return $false
}

function Wait-PortListening {
  param(
    [int]$Port,
    [int]$MaxAttempts = 20,
    [int]$DelayMs = 500
  )

  for ($attempt = 0; $attempt -lt $MaxAttempts; $attempt++) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($listener) {
      return $true
    }

    Start-Sleep -Milliseconds $DelayMs
  }

  return $false
}

function Wait-SupervisorGreen {
  param(
    [string]$SupervisorTargetIp,
    [string]$BackendBaseUrl = 'http://127.0.0.1:4000',
    [int]$TimeoutSeconds = 30
  )

  $attempts = [Math]::Max(1, [Math]::Ceiling($TimeoutSeconds * 2))
  for ($attempt = 0; $attempt -lt $attempts; $attempt++) {
    try {
      $deviceStatus = Invoke-RestMethod -Uri ("http://{0}/status" -f $SupervisorTargetIp) -TimeoutSec 2
      $supervisorStatus = Invoke-RestMethod -Uri ("http://{0}/supervisor/status" -f $SupervisorTargetIp) -TimeoutSec 2

      $payload = [pscustomobject]@{
        nodeId = $deviceStatus.nodeName
        nodeName = $deviceStatus.nodeName
        ip = $SupervisorTargetIp
        deviceRole = $deviceStatus.deviceRole
        overallHealthy = [bool]$supervisorStatus.supervisor.overallHealthy
        supervisor = $supervisorStatus.supervisor
      }

      Invoke-RestMethod -Method Post -Uri ("{0}/api/supervisor/heartbeat" -f $BackendBaseUrl) -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 2 | Out-Null

      $encodedNodeId = [System.Uri]::EscapeDataString([string]$deviceStatus.nodeName)
      $greenProbe = Invoke-WebRequest -Uri ("{0}/api/supervisor/green?nodeId={1}" -f $BackendBaseUrl, $encodedNodeId) -UseBasicParsing -TimeoutSec 2
      if ($greenProbe.StatusCode -eq 200) {
        return [pscustomobject]@{
          nodeId = $deviceStatus.nodeName
          ip = $SupervisorTargetIp
          overallHealthy = [bool]$supervisorStatus.supervisor.overallHealthy
        }
      }
    } catch {
    }

    Start-Sleep -Milliseconds 500
  }

  throw ("Supervisor did not reach green state at {0} within {1}s" -f $SupervisorTargetIp, $TimeoutSeconds)
}

$resolvedBoneCrusherIp = Resolve-BoneCrusherIp -PreferredIp $BoneCrusherIp -Candidates $ProbeIps
if (-not $resolvedBoneCrusherIp) {
  throw 'Unable to find a reachable ESP32 reporting deviceRole=bonecrusher'
}

Write-Output ("BoneCrusher board detected at {0}" -f $resolvedBoneCrusherIp)
Stop-Listeners -Ports @(4000, 5173)

$env:EDGE_ESP32_ENABLED = '1'
$env:EDGE_ESP32_HOST = $resolvedBoneCrusherIp
$env:EDGE_ESP32_PORT = '80'
$env:EDGE_ESP32_BONECRUSHER_NODES = "$resolvedBoneCrusherIp:80"
$env:EDGE_ESP32_NODES = "$resolvedBoneCrusherIp:80"
$env:EDGE_ESP32_FORCED_EVOLUTION_RATE = '0'

$backendOut = Join-Path $logRoot 'clean-start-backend.log'
$backendErr = Join-Path $logRoot 'clean-start-backend.err.log'
$frontendOut = Join-Path $logRoot 'clean-start-frontend.log'
$frontendErr = Join-Path $logRoot 'clean-start-frontend.err.log'

$backend = Start-Process -FilePath 'node.exe' -ArgumentList 'backend.mjs' -WorkingDirectory $aggregatorRoot -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru
$frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $aggregatorRoot -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr -PassThru

$backendOk = Wait-HttpReady -Url 'http://127.0.0.1:4000/status' -MaxAttempts 60
if (-not $backendOk) {
  if (Test-Path $backendErr) { Get-Content $backendErr | Write-Output }
  throw 'Backend did not become healthy on port 4000'
}

$frontendOk = Wait-PortListening -Port 5173 -MaxAttempts 60
if (-not $frontendOk) {
  if (Test-Path $frontendErr) { Get-Content $frontendErr | Write-Output }
  throw 'Frontend did not become ready on port 5173'
}

$supervisorCheckEnabled = $RequireSupervisorGreen.IsPresent -or [bool]$SupervisorIp
$supervisorCheckResult = $null
if ($supervisorCheckEnabled) {
  $supervisorTargetIp = if ($SupervisorIp) { $SupervisorIp } else { $resolvedBoneCrusherIp }
  $supervisorCheckResult = Wait-SupervisorGreen -SupervisorTargetIp $supervisorTargetIp -TimeoutSeconds $SupervisorWaitSeconds
}

$boardStatus = Invoke-RestMethod -Uri ("http://{0}/status" -f $resolvedBoneCrusherIp) -TimeoutSec 4
[pscustomobject]@{
  boneCrusherIp = $resolvedBoneCrusherIp
  deviceRole = $boardStatus.deviceRole
  firmwareVersion = $boardStatus.firmwareVersion
  supervisorChecked = $supervisorCheckEnabled
  supervisorIp = if ($supervisorCheckResult) { $supervisorCheckResult.ip } else { $null }
  supervisorNodeId = if ($supervisorCheckResult) { $supervisorCheckResult.nodeId } else { $null }
  supervisorOverallHealthy = if ($supervisorCheckResult) { $supervisorCheckResult.overallHealthy } else { $null }
  backendUrl = 'http://127.0.0.1:4000'
  frontendUrl = 'http://127.0.0.1:5173'
  backendPid = $backend.Id
  frontendPid = $frontend.Id
} | ConvertTo-Json -Compress