param(
  [string]$ServiceName = "PulseAggregator"
)

$ErrorActionPreference = 'Stop'

$groupOutput = & whoami.exe '/groups'
$isAdmin = ($LASTEXITCODE -eq 0) -and ($groupOutput | Select-String 'S-1-5-32-544' -Quiet)
if (-not $isAdmin) {
  throw "Run this script in an elevated PowerShell session (Administrator)."
}

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Output "Service '$ServiceName' not found."
  exit 0
}

try {
  if ($svc.Status -ne 'Stopped') {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
} catch {}

$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
  try {
    & nssm remove $ServiceName confirm | Out-Null
  } catch {
    sc.exe delete $ServiceName | Out-Null
  }
} else {
  sc.exe delete $ServiceName | Out-Null
}

Write-Output "Service '$ServiceName' removed."
