param(
  [string]$ServiceName = "PulseAggregator"
)

$ErrorActionPreference = 'Stop'

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Output "Service '$ServiceName' not found."
  exit 1
}

$details = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"
[PSCustomObject]@{
  Name = $svc.Name
  DisplayName = $svc.DisplayName
  Status = $svc.Status
  StartType = $details.StartMode
  PathName = $details.PathName
  State = $details.State
} | Format-List
