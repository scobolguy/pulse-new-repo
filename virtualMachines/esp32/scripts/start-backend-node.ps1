param(
  [ValidateSet('primary', 'backup')]
  [string]$Role = 'primary',
  [string]$RepoRoot = '',
  [string]$DataRoot = 'C:\pulse-data\esp32\aggregator-data',
  [string]$StartQueueManager = '1',
  [switch]$CleanPorts,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Write-Status {
  param([string]$Message)
  if (-not $Quiet) {
    Write-Output $Message
  }
}

function Wait-HttpReady {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$Attempts = 60,
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

function Stop-Ports {
  param([int[]]$Ports)

  foreach ($port in $Ports) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($ownerPid in @($owners)) {
      try {
        Stop-Process -Id $ownerPid -Force -ErrorAction Stop
        Write-Status ("Stopped PID {0} on port {1}" -f $ownerPid, $port)
      } catch {
        Write-Status ("Failed to stop PID {0} on port {1}: {2}" -f $ownerPid, $port, $_.Exception.Message)
      }
    }
  }
}

function Get-LocalIpv4 {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress

  foreach ($address in @($addresses)) {
    if ($address) {
      return $address
    }
  }

  return '127.0.0.1'
}

function Load-RoleProfile {
  param(
    [Parameter(Mandatory = $true)][string]$ProfilePath,
    [Parameter(Mandatory = $true)][string]$RoleName
  )

  if (-not (Test-Path $ProfilePath)) {
    throw "Missing role profile file: $ProfilePath"
  }

  $profiles = Get-Content -Raw -Path $ProfilePath | ConvertFrom-Json
  $profile = $profiles.$RoleName
  if (-not $profile) {
    throw "Role profile not found for role '$RoleName'"
  }

  return $profile
}

if (-not $RepoRoot) {
  $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$aggregatorRoot = Join-Path $RepoRoot 'aggregator'
if (-not (Test-Path (Join-Path $aggregatorRoot 'backend.mjs'))) {
  throw "Could not find backend.mjs under $aggregatorRoot"
}

$startQueueManagerNormalized = ([string]$StartQueueManager).Trim().ToLowerInvariant()
$enableQueueManager = -not ($startQueueManagerNormalized -in @('0', 'false', 'no', 'off'))

$logsRoot = Join-Path $DataRoot 'logs'
New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataRoot 'compliance') -Force | Out-Null

if ($CleanPorts) {
  Stop-Ports -Ports @(4000, 4001, 4100, 4101, 4200)
}

$roleProfilesPath = Join-Path $PSScriptRoot 'backend-role-profiles.json'
$roleProfile = Load-RoleProfile -ProfilePath $roleProfilesPath -RoleName $Role
$localIp = Get-LocalIpv4

$brokerOut = Join-Path $logsRoot 'split-broker.out.log'
$brokerErr = Join-Path $logsRoot 'split-broker.err.log'
$backendOut = Join-Path $logsRoot 'split-backend.out.log'
$backendErr = Join-Path $logsRoot 'split-backend.err.log'
$qmOut = Join-Path $logsRoot 'split-queue-manager.out.log'
$qmErr = Join-Path $logsRoot 'split-queue-manager.err.log'

Write-Status 'Starting standalone broker service on port 4001...'
$brokerProcess = Start-Process -FilePath 'node.exe' -ArgumentList 'broker-service.mjs' -WorkingDirectory $aggregatorRoot -RedirectStandardOutput $brokerOut -RedirectStandardError $brokerErr -PassThru

if (-not (Wait-HttpReady -Url 'http://127.0.0.1:4001/health' -Attempts 60 -DelayMs 500 -ExpectedStatus 200)) {
  throw 'Broker service did not become healthy on port 4001.'
}

Write-Status 'Starting modular backend gateway on port 4000...'
$envKeys = @('MODULAR_BACKEND', 'PULSE_QUEUE_DATA_ROOT', 'PULSE_RUNTIME_DATA_ROOT', 'PULSE_BACKEND_ROLE')
$previousEnv = @{}
foreach ($key in $envKeys) {
  $previousEnv[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}

try {
  $env:MODULAR_BACKEND = '1'
  $env:PULSE_QUEUE_DATA_ROOT = $DataRoot
  $env:PULSE_RUNTIME_DATA_ROOT = $DataRoot
  $env:PULSE_BACKEND_ROLE = $Role

  $backendProcess = Start-Process -FilePath 'node.exe' -ArgumentList 'backend.mjs' -WorkingDirectory $aggregatorRoot -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru
} finally {
  foreach ($key in $envKeys) {
    $value = $previousEnv[$key]
    if ($null -eq $value) {
      [Environment]::SetEnvironmentVariable($key, $null, 'Process')
    } else {
      [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
  }
}

if (-not (Wait-HttpReady -Url 'http://127.0.0.1:4000/status' -Attempts 80 -DelayMs 500 -ExpectedStatus 200)) {
  throw 'Backend gateway did not become healthy on port 4000.'
}

$queueManagerProcess = $null
$queueManagerUrl = $null
if ($enableQueueManager) {
  $queueManagerPort = [int]$roleProfile.queueManagerPort
  $queueManagerId = [string]$roleProfile.queueManagerId
  $queueManagerName = [string]$roleProfile.queueManagerName
  $queueManagerNodeId = ("{0}-{1}" -f $env:COMPUTERNAME, $Role)

  Write-Status ("Starting queue-manager service on port {0}..." -f $queueManagerPort)
  $qmArgs = @(
    'queue-manager-node.mjs',
    ("--aggregator=http://127.0.0.1:4000"),
    ("--port={0}" -f $queueManagerPort),
    ("--manager-id={0}" -f $queueManagerId),
    ("--name={0}" -f $queueManagerName),
    ("--node-id={0}" -f $queueManagerNodeId),
    ("--advertise-ip={0}" -f $localIp)
  )

  $queueManagerProcess = Start-Process -FilePath 'node.exe' -ArgumentList $qmArgs -WorkingDirectory $aggregatorRoot -RedirectStandardOutput $qmOut -RedirectStandardError $qmErr -PassThru
  $queueManagerUrl = ("http://127.0.0.1:{0}" -f $queueManagerPort)

  if (-not (Wait-HttpReady -Url ("{0}/health" -f $queueManagerUrl) -Attempts 80 -DelayMs 500 -ExpectedStatus 200)) {
    throw ("Queue-manager did not become healthy on port {0}." -f $queueManagerPort)
  }
}

$manifest = [pscustomobject]@{
  startedAt = (Get-Date).ToString('o')
  role = $Role
  hostName = $env:COMPUTERNAME
  dataRoot = $DataRoot
  localIp = $localIp
  queueManagerEnabled = [bool]$enableQueueManager
  processes = @(
    [pscustomobject]@{ name = 'broker-service'; pid = $brokerProcess.Id; port = 4001; outLog = $brokerOut; errLog = $brokerErr },
    [pscustomobject]@{ name = 'backend-gateway'; pid = $backendProcess.Id; port = 4000; outLog = $backendOut; errLog = $backendErr }
  )
}

if ($queueManagerProcess) {
  $manifest.processes += [pscustomobject]@{ name = 'queue-manager-node'; pid = $queueManagerProcess.Id; port = [int]$roleProfile.queueManagerPort; outLog = $qmOut; errLog = $qmErr }
}

$manifestPath = Join-Path $logsRoot 'split-backend-processes.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

$result = [pscustomobject]@{
  status = 'ok'
  role = $Role
  host = $env:COMPUTERNAME
  backendUrl = 'http://127.0.0.1:4000'
  brokerUrl = 'http://127.0.0.1:4001'
  queueManagerUrl = $queueManagerUrl
  manifest = $manifestPath
  backendPid = $backendProcess.Id
  brokerPid = $brokerProcess.Id
  queueManagerPid = if ($queueManagerProcess) { $queueManagerProcess.Id } else { $null }
}

$result | ConvertTo-Json -Depth 4
