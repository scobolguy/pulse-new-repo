$uri = "http://127.0.0.1:4000/api/nodes"
try {
    $nodes = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 5
} catch {
    Write-Output ("ERROR: " + $_.Exception.Message)
    exit 1
}

$withRaw = $nodes | Where-Object { $_.raw -and $_.ip -ne "127.0.0.1" } | Sort-Object -Property lastSeen -Descending
if (-not $withRaw) {
    Write-Output "NO_UDP_NODE_PAYLOADS_FOUND"
    exit 0
}

foreach ($n in $withRaw) {
    Write-Output ("IP=" + $n.ip + " LASTSEEN=" + $n.lastSeen)
    Write-Output ("RAW=" + $n.raw)
    Write-Output "----"
}
