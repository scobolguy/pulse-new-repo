param(
    [ValidateSet('serial','ota')]
    [string]$Mode = 'serial',
    [string]$Port = 'COM5',
    [string]$EnvName = 'esp32dev',
    [string]$OtaEnvName = 'esp32dev_ota',
    [string]$Version = '1.0.0',
    [switch]$UploadFs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pio = Join-Path ${env:USERPROFILE} '.platformio\penv\Scripts\platformio.exe'

if (-not (Test-Path $pio)) {
    throw "platformio.exe not found at $pio"
}

function Stop-ComPortHolders {
    param([string]$ComPort)

    $selfPid = $PID
    $pattern = [Regex]::Escape($ComPort)
    $targets = Get-CimInstance Win32_Process | Where-Object {
        ($_.ProcessId -ne $selfPid) -and (
            ($_.CommandLine -match $pattern) -or
            ($_.Name -match 'platformio|python|putty|arduino|esptool|miniterm')
        )
    }

    $ids = $targets | Select-Object -ExpandProperty ProcessId -Unique
    if (-not $ids) {
        Write-Host "No likely $ComPort holders found"
        return
    }

    foreach ($id in $ids) {
        try {
            Stop-Process -Id $id -Force -ErrorAction Stop
            Write-Host "Stopped PID $id"
        } catch {
            $errMsg = $_.Exception.Message
            Write-Host ("Failed to stop PID {0} -- {1}" -f $id, $errMsg)
        }
    }
}

Push-Location $repoRoot
try {
    $buildFlags = "build_flags=-std=gnu++17 -DENABLE_PMACHINE -DFIRMWARE_VERSION=\`\"$Version\`\""

    if ($Mode -eq 'serial') {
        Stop-ComPortHolders -ComPort $Port

        if ($UploadFs) {
            & $pio run --target uploadfs --environment $EnvName
        }

        & $pio run --target upload --environment $EnvName --upload-port $Port --project-option $buildFlags
    } else {
        if ($UploadFs) {
            Write-Host 'Skipping uploadfs in OTA mode (requires serial or explicit OTA FS workflow).'
        }
        & $pio run --target upload --environment $OtaEnvName --project-option $buildFlags
    }
} finally {
    Pop-Location
}
