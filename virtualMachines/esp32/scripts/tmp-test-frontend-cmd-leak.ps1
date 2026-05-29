$ErrorActionPreference = 'Stop'

$root = 'C:\dev\pulse-new-repo\virtualMachines\esp32'
$stopScript = Join-Path $root 'scripts\stop-stack.ps1'
$startFrontend = Join-Path $root 'start-frontend.bat'

function Get-CmdPids {
  $procs = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue
  if ($null -eq $procs) { return @() }
  return @($procs | Select-Object -ExpandProperty ProcessId)
}

$before = Get-CmdPids
Write-Host ("Before cmd.exe count: {0}" -f $before.Count)

try {
  & $stopScript -Ports 5173 -Quiet
} catch {
  Write-Host ("[WARN] stop-stack: {0}" -f $_.Exception.Message)
}

$runner = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',"Set-Location '$root'; .\\start-frontend.bat") -WindowStyle Hidden -PassThru

$up = $false
for ($i = 0; $i -lt 40; $i++) {
  $listener = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $listener) {
    $up = $true
    break
  }
  Start-Sleep -Milliseconds 500
}

$after = Get-CmdPids
Write-Host ("After cmd.exe count: {0}" -f $after.Count)

$beforeMap = @{}
foreach ($pid in $before) { $beforeMap[$pid] = $true }
$newPids = @()
foreach ($pid in $after) {
  if (-not $beforeMap.ContainsKey($pid)) {
    $newPids += $pid
  }
}

Write-Host ("Frontend up on 5173: {0}" -f $up)
Write-Host ("New cmd.exe PIDs after startup: {0}" -f (($newPids -join ', ')))

if ($newPids.Count -gt 0) {
  Write-Host '[DETAIL] New cmd.exe command lines:'
  foreach ($pid in $newPids) {
    $cmd = Get-CimInstance Win32_Process -Filter "ProcessId=$pid" -ErrorAction SilentlyContinue
    if ($null -ne $cmd) {
      Write-Host ("PID {0}: {1}" -f $pid, $cmd.CommandLine)
    }
  }
}
