$targets = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }

    $isUploadMonitor = $cmd -like "*run --target upload --target monitor*" -and $cmd -like "*COM5*"
    $isEsptoolCom5 = $cmd -like "*esptool.py*" -and $cmd -like "*COM5*"

    return $isUploadMonitor -or $isEsptoolCom5
}

if (-not $targets) {
    Write-Output "NO_UPLOAD_MONITOR_TARGETS"
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
