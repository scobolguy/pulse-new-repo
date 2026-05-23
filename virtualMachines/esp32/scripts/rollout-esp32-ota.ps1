param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [Parameter(Mandatory=$true)]
    [string[]]$Nodes,
    [string]$OtaEnvName = 'esp32dev_ota'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pio = Join-Path ${env:USERPROFILE} '.platformio\penv\Scripts\platformio.exe'

if (-not (Test-Path $pio)) {
    throw "platformio.exe not found at $pio"
}

$buildFlags = "build_flags=-std=gnu++17 -DENABLE_PMACHINE -DFIRMWARE_VERSION=`"$Version`""

Push-Location $repoRoot
try {
    foreach ($node in $Nodes) {
        Write-Host ("[ROLLout] Uploading version {0} to {1}" -f $Version, $node)
        & $pio run --target upload --environment $OtaEnvName --upload-port $node --project-option $buildFlags

        try {
            $status = Invoke-RestMethod -Uri ("http://{0}/status" -f $node) -Method Get -TimeoutSec 5
            $reported = [string]($status.firmwareVersion)
            if ($reported -ne $Version) {
                Write-Host ("[ROLLout] WARNING {0} reports firmwareVersion={1}" -f $node, $reported)
            } else {
                Write-Host ("[ROLLout] OK {0} now reports firmwareVersion={1}" -f $node, $reported)
            }
        } catch {
            Write-Host ("[ROLLout] WARNING failed status check for {0}: {1}" -f $node, $_.Exception.Message)
        }
    }
} finally {
    Pop-Location
}
