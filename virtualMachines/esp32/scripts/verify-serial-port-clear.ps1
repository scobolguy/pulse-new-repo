$pattern = '(^|\W)COM5(\W|$)'
$procs = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    return ($cmd -match $pattern)
}

if (-not $procs) {
    Write-Output "COM5_CLEAR"
    exit 0
}

$procs | Select-Object ProcessId, Name, CommandLine | Sort-Object ProcessId | Format-List
