$patterns = @('COM5', 'platformio', 'esptool', 'device monitor', '--monitor-port')

$procs = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    foreach ($p in $patterns) {
        if ($cmd -match [regex]::Escape($p)) { return $true }
    }
    return $false
}

$procs |
    Select-Object ProcessId, Name, CommandLine |
    Sort-Object ProcessId |
    Format-List
