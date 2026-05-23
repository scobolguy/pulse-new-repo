$root = "c:\Users\scobo\OneDrive\Documents\GitHub\pulse-new-repo\virtualMachines\esp32\aggregator\data"
$source = Join-Path $root "transaction-state-log-shipping.jsonl"
$archiveDir = Join-Path $root "archive"

New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null

if (Test-Path $source) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $dest = Join-Path $archiveDir ("transaction-state-log-shipping-" + $timestamp + ".jsonl")
  Move-Item -Path $source -Destination $dest -Force
  New-Item -ItemType File -Path $source -Force | Out-Null
  Write-Output ("ARCHIVED=" + $dest)
  Write-Output ("RESET=" + $source)
} else {
  New-Item -ItemType File -Path $source -Force | Out-Null
  Write-Output ("CREATED_EMPTY=" + $source)
}
