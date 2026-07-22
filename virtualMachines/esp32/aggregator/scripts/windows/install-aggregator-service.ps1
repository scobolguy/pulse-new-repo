param(
  [string]$ServiceName = "PulseAggregator",
  [string]$DisplayName = "Pulse Aggregator Backend",
  [string]$Description = "PULSE aggregator backend gateway",
  [string]$AggregatorRoot = "",
  [string]$DataRoot = "",
  [string]$Role = "primary",
  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$groupOutput = (whoami /groups) 2>$null
$isAdmin = ($LASTEXITCODE -eq 0) -and ($groupOutput | Select-String 'S-1-5-32-544' -Quiet)
if (-not $isAdmin) {
  throw "Run this script in an elevated PowerShell session (Administrator)."
}

if ([string]::IsNullOrWhiteSpace($AggregatorRoot)) {
  $AggregatorRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\")).Path
} else {
  $AggregatorRoot = (Resolve-Path $AggregatorRoot).Path
}

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
  $DataRoot = Join-Path $AggregatorRoot "data"
}

function Invoke-ExternalOrThrow {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Action
  )

  $text = & $FilePath @Arguments 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "$Action failed (exit $LASTEXITCODE). Output: $text"
  }
  return $text
}

function Get-ServiceWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [int]$Attempts = 8,
    [int]$DelayMs = 500
  )

  for ($i = 0; $i -lt $Attempts; $i += 1) {
    $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($svc) {
      return $svc
    }
    Start-Sleep -Milliseconds $DelayMs
  }
  return $null
}

function Get-PortOwnerPid {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  try {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) {
      return [int]$conn.OwningProcess
    }
  } catch {}

  $line = netstat -ano -p tcp | Select-String (":$Port") | Select-String "LISTENING" | Select-Object -First 1
  if (-not $line) {
    return $null
  }
  $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
  if ($parts.Length -ge 5) {
    $pid = 0
    if ([int]::TryParse($parts[4], [ref]$pid) -and $pid -gt 0) {
      return $pid
    }
  }
  return $null
}

$runner = (Resolve-Path (Join-Path $PSScriptRoot "run-aggregator-backend.ps1")).Path
$logsDir = Join-Path $AggregatorRoot "logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

$nssm = Get-Command nssm -ErrorAction SilentlyContinue
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if (-not $nssm) {
  throw "NSSM is required to run aggregator as a Windows Service. Install nssm.exe, add it to PATH, then rerun this script."
}

$nssmPath = $nssm.Source
if ($existing) {
  try { Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('stop', $ServiceName) -Action "nssm stop $ServiceName" | Out-Null } catch {}
  try { Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('remove', $ServiceName, 'confirm') -Action "nssm remove $ServiceName" | Out-Null } catch {}
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -File $runner -AggregatorRoot $AggregatorRoot -DataRoot $DataRoot -Role $Role"

Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('install', $ServiceName, 'powershell.exe') -Action "nssm install $ServiceName" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppParameters', $arguments) -Action "nssm set AppParameters" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'DisplayName', $DisplayName) -Action "nssm set DisplayName" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'Description', $Description) -Action "nssm set Description" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppDirectory', $AggregatorRoot) -Action "nssm set AppDirectory" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'Start', 'SERVICE_AUTO_START') -Action "nssm set Start" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppStdout', (Join-Path $logsDir 'service-backend.out.log')) -Action "nssm set AppStdout" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppStderr', (Join-Path $logsDir 'service-backend.err.log')) -Action "nssm set AppStderr" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppRotateFiles', '1') -Action "nssm set AppRotateFiles" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppRotateOnline', '1') -Action "nssm set AppRotateOnline" | Out-Null
Invoke-ExternalOrThrow -FilePath $nssmPath -Arguments @('set', $ServiceName, 'AppRotateBytes', '10485760') -Action "nssm set AppRotateBytes" | Out-Null

$installed = Get-ServiceWithRetry -Name $ServiceName
if (-not $installed) {
  throw "Service '$ServiceName' was not created. Check script output and run elevated."
}

if ($StartNow) {
  $portPid = Get-PortOwnerPid -Port 4000
  if ($portPid) {
    $pName = ''
    try {
      $pName = (Get-Process -Id $portPid -ErrorAction SilentlyContinue).ProcessName
    } catch {}
    $nameSuffix = if ([string]::IsNullOrWhiteSpace($pName)) { '' } else { " ($pName)" }
    throw "Port 4000 is already in use by PID $portPid$nameSuffix. Stop that process first, then start service '$ServiceName'."
  }
  Start-Service -Name $ServiceName -ErrorAction Stop
}

Get-Service -Name $ServiceName | Select-Object Name, DisplayName, Status, StartType
Write-Output "Installed with NSSM. Logs: $logsDir"
