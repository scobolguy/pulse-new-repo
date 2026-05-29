$ErrorActionPreference = 'Stop'

$root = 'C:\dev\pulse-new-repo\virtualMachines\esp32'
$agg = Join-Path $root 'aggregator'
$stopScript = Join-Path $root 'scripts\stop-stack.ps1'
$viteCli = Join-Path $agg 'node_modules\vite\bin\vite.js'
$runtimeRoot = 'C:\pulse-data\esp32\aggregator-data'
$queueRoot = $runtimeRoot

function Get-CmdProcesses {
  Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue
}

function Stop-StalePulseCmd {
  $cmds = @(Get-CmdProcesses)
  if ($cmds.Count -eq 0) { return 0 }

  $killed = 0
  foreach ($proc in $cmds) {
    $line = [string]($proc.CommandLine)
    if ($line -match 'pulse-new-repo|vite preview|start-frontend\.bat|start-backend\.bat|start-servers\.bat') {
      try {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
        $killed += 1
      } catch {
      }
    }
  }

  return $killed
}

function Wait-PortListening {
  param(
    [int]$Port,
    [int]$TimeoutMs = 20000
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $listener) {
      return $true
    }
    Start-Sleep -Milliseconds 250
  }

  return $false
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutMs = 20000
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    try {
      $status = (Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3).StatusCode
      if ($status -ge 200 -and $status -lt 300) {
        return $true
      }
    } catch {
    }
    Start-Sleep -Milliseconds 300
  }

  return $false
}

function New-IdSet {
  param([object[]]$Items)
  $set = @{}
  foreach ($item in @($Items)) {
    $set[[int]$item.ProcessId] = $true
  }
  return $set
}

Set-Location $root

Write-Host 'Cleaning stale Pulse cmd.exe processes...'
$killed = Stop-StalePulseCmd
Write-Host ("Killed stale cmd.exe: {0}" -f $killed)

try {
  & $stopScript -Ports 4000 5173 -Quiet
} catch {
  Write-Host ("[WARN] stop-stack during cleanup: {0}" -f $_.Exception.Message)
}

Start-Sleep -Milliseconds 700

$baselineCmd = @(Get-CmdProcesses)
$baselineSet = New-IdSet -Items $baselineCmd
$baselineCount = $baselineCmd.Count
Write-Host ("Baseline cmd.exe count: {0}" -f $baselineCount)

if (-not (Test-Path $viteCli)) {
  throw "Missing Vite CLI at $viteCli"
}

for ($i = 1; $i -le 10; $i++) {
  Write-Host ("=== Startup cycle {0} of 10 ===" -f $i)

  try {
    & $stopScript -Ports 4000 5173 -Quiet
  } catch {
    Write-Host ("[WARN] stop-stack before cycle {0}: {1}" -f $i, $_.Exception.Message)
  }

  $backendCmd = "Set-Location '$agg'; `$env:PULSE_QUEUE_DATA_ROOT='$queueRoot'; `$env:PULSE_RUNTIME_DATA_ROOT='$runtimeRoot'; node backend.mjs"
  $frontendCmd = "Set-Location '$agg'; node '$viteCli' preview --host 0.0.0.0 --port 5173"

  $backendPs = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$backendCmd) -WindowStyle Hidden -PassThru
  $frontendPs = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$frontendCmd) -WindowStyle Hidden -PassThru

  $bUp = Wait-HttpOk -Url 'http://127.0.0.1:4000/status' -TimeoutMs 30000
  $fUp = Wait-HttpOk -Url 'http://127.0.0.1:5173/' -TimeoutMs 30000

  Write-Host ("Backend up: {0}; Frontend up: {1}" -f $bUp, $fUp)
  if (-not $bUp -or -not $fUp) {
    throw "Startup failed on cycle $i (backend=$bUp frontend=$fUp)."
  }

  $currentCmd = @(Get-CmdProcesses)
  $newCmd = @()
  foreach ($proc in $currentCmd) {
    if (-not $baselineSet.ContainsKey([int]$proc.ProcessId)) {
      $newCmd += $proc
    }
  }

  if ($newCmd.Count -gt 0) {
    Write-Host ("[WARN] New cmd.exe count after cycle {0}: {1}" -f $i, $newCmd.Count)
    foreach ($proc in $newCmd) {
      $line = [string]$proc.CommandLine
      if ($line -match 'pulse-new-repo|vite preview|start-frontend\.bat|start-backend\.bat|start-servers\.bat') {
        try {
          Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
          Write-Host ("[FIX] Stopped leaked cmd.exe PID {0}" -f $proc.ProcessId)
        } catch {
          Write-Host ("[WARN] Failed to stop leaked cmd.exe PID {0}" -f $proc.ProcessId)
        }
      }
    }
  }

  if ($i -lt 10) {
    try {
      & $stopScript -Ports 4000 5173 -Quiet
    } catch {
      Write-Host ("[WARN] stop-stack end cycle {0}: {1}" -f $i, $_.Exception.Message)
    }
  }
}

$finalCmd = @(Get-CmdProcesses)
$finalNew = @()
foreach ($proc in $finalCmd) {
  if (-not $baselineSet.ContainsKey([int]$proc.ProcessId)) {
    $finalNew += $proc
  }
}

if ($finalNew.Count -gt 0) {
  Write-Host ("Final extra cmd.exe detected: {0}" -f $finalNew.Count)
  foreach ($proc in $finalNew) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
      Write-Host ("[FIX] Stopped final extra cmd.exe PID {0}" -f $proc.ProcessId)
    } catch {
      Write-Host ("[WARN] Could not stop final extra cmd.exe PID {0}" -f $proc.ProcessId)
    }
  }
}

Start-Sleep -Milliseconds 500
$endCount = @(Get-CmdProcesses).Count
$backendCode = 0
$frontendCode = 0
try { $backendCode = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4000/status' -TimeoutSec 5).StatusCode } catch {}
try { $frontendCode = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 5).StatusCode } catch {}

Write-Host '=== Summary ==='
Write-Host ("Baseline cmd.exe: {0}" -f $baselineCount)
Write-Host ("Final cmd.exe: {0}" -f $endCount)
Write-Host ("Backend HTTP: {0}" -f $backendCode)
Write-Host ("Frontend HTTP: {0}" -f $frontendCode)
if ($endCount -gt $baselineCount) {
  throw "cmd.exe count increased from $baselineCount to $endCount"
}
Write-Host 'No additional cmd.exe processes left after 10 startups.'
