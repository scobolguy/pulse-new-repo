param(
  [string]$BoneCrusherIp = '',
  [string[]]$ProbeIps = @('192.168.2.115','192.168.2.116','192.168.2.117','192.168.2.118')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Stop-Listeners {
  param([int[]]$Ports)
  foreach ($port in $Ports) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($id in $pids) {
      try { Stop-Process -Id $id -Force -ErrorAction Stop; Write-Output ("Stopped PID {0} on port {1}" -f $id,$port) } catch { Write-Output ("Failed stop PID {0} on port {1}: {2}" -f $id,$port,$_.Exception.Message) }
    }
    if (-not $pids) { Write-Output ("No listener on port {0}" -f $port) }
  }
}

function Resolve-BoneCrusherIp {
  param([string]$PreferredIp, [string[]]$Candidates)
  if ($PreferredIp) { $Candidates = @($PreferredIp) + ($Candidates | Where-Object { $_ -ne $PreferredIp }) }
  foreach ($ip in $Candidates) {
    try {
      $status = Invoke-RestMethod -Uri ("http://{0}/status" -f $ip) -TimeoutSec 4
      if ("$($status.deviceRole)".ToLowerInvariant() -eq 'bonecrusher') {
        return $ip
      }
    } catch {}
  }
  return $null
}

$resolvedBoneCrusherIp = Resolve-BoneCrusherIp -PreferredIp $BoneCrusherIp -Candidates $ProbeIps
if (-not $resolvedBoneCrusherIp) {
  throw "Unable to find a reachable ESP32 reporting deviceRole=bonecrusher"
}

Write-Output ("BoneCrusher board detected at {0}" -f $resolvedBoneCrusherIp)
Stop-Listeners -Ports @(4000, 5173)

$env:EDGE_ESP32_ENABLED = '1'
$env:EDGE_ESP32_HOST = $resolvedBoneCrusherIp
$env:EDGE_ESP32_PORT = '80'
$env:EDGE_ESP32_BONECRUSHER_NODES = "$resolvedBoneCrusherIp:80"
$env:EDGE_ESP32_NODES = "$resolvedBoneCrusherIp:80"
$env:EDGE_ESP32_FORCED_EVOLUTION_RATE = '0'

$backend = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'cd /d aggregator & node backend.mjs' -WorkingDirectory $repoRoot -PassThru
$frontend = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'cd /d aggregator & npm run dev' -WorkingDirectory $repoRoot -PassThru

$backendOk = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/status' -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $backendOk = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 500
}
if (-not $backendOk) {
  throw 'Backend did not become healthy on port 4000'
}

$frontendOk = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { $frontendOk = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 500
}
if (-not $frontendOk) {
  throw 'Frontend did not become ready on port 5173'
}

$boardStatus = Invoke-RestMethod -Uri ("http://{0}/status" -f $resolvedBoneCrusherIp) -TimeoutSec 4
[pscustomobject]@{
  boneCrusherIp = $resolvedBoneCrusherIp
  deviceRole = $boardStatus.deviceRole
  firmwareVersion = $boardStatus.firmwareVersion
  backendUrl = 'http://127.0.0.1:4000'
  frontendUrl = 'http://127.0.0.1:5173'
  backendPid = $backend.Id
  frontendPid = $frontend.Id
} | ConvertTo-Json -Compress
