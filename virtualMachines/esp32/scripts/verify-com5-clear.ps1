$procs = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    return $cmd -like "*COM5*"
}

if (-not $procs) {
    Write-Output "COM5_CLEAR"
    exit 0
}

$procs | Select-Object ProcessId, Name, CommandLine | Sort-Object ProcessId | Format-List
