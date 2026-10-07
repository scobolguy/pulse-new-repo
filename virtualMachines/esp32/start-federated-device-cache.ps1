param([string]$Config = "$PSScriptRoot\config\federated-device-cache.json")
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
& node "$PSScriptRoot\pmachines\javascript\federated-device-cache.mjs" $Config
exit $LASTEXITCODE
