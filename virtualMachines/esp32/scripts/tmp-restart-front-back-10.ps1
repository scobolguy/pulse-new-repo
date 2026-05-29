$ErrorActionPreference = 'Stop'

$root = 'C:\dev\pulse-new-repo\virtualMachines\esp32'
$stopScript = Join-Path $root 'scripts\stop-stack.ps1'
$backendScript = Join-Path $root 'start-backend.bat'
$frontendScript = Join-Path $root 'start-frontend.bat'

function Wait-PortListening {
  param(
    [int]$Port,
    [int]$TimeoutMs = 15000
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $listener) {
      return $true
    }
  }

  return $false
}

Set-Location $root

for ($i = 1; $i -le 10; $i++) {
  Write-Host "=== Cycle $i of 10 ==="

  try {
    & $stopScript -Ports 4000 5173 -Quiet
  } catch {
    Write-Host "[WARN] stop-stack reported: $($_.Exception.Message)"
  }

  $backendProc = Start-Process -FilePath $backendScript -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $frontendProc = Start-Process -FilePath $frontendScript -WorkingDirectory $root -WindowStyle Hidden -PassThru

  $backendUp = Wait-PortListening -Port 4000 -TimeoutMs 20000
  $frontendUp = Wait-PortListening -Port 5173 -TimeoutMs 20000

  Write-Host ("Backend PID: {0}, up: {1}" -f $backendProc.Id, $backendUp)
  Write-Host ("Frontend PID: {0}, up: {1}" -f $frontendProc.Id, $frontendUp)
}

Write-Host '=== Completed 10 restart cycles ==='

try {
  $backendCode = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4000/status' -TimeoutSec 5).StatusCode
} catch {
  $backendCode = 0
}

try {
  $frontendCode = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 5).StatusCode
} catch {
  $frontendCode = 0
}

Write-Host ("Final backend HTTP: {0}" -f $backendCode)
Write-Host ("Final frontend HTTP: {0}" -f $frontendCode)
