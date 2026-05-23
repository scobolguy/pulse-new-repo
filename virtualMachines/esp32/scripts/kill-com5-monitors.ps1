$targets = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    $isCom5 = $cmd -like "*COM5*"
    $isMonitor = $cmd -like "*device monitor*"
    $isPlatformio = $cmd -like "*platformio*"
    return $isCom5 -and ($isMonitor -or $isPlatformio)
}

if (-not $targets) {
    Write-Output "NO_TARGETS_FOUND"
    exit 0
}

foreach ($p in $targets) {
    try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        Write-Output ("KILLED PID=" + $p.ProcessId + " NAME=" + $p.Name)
    } catch {
        Write-Output ("FAILED PID=" + $p.ProcessId + " NAME=" + $p.Name + " ERR=" + $_.Exception.Message)
    }
}
