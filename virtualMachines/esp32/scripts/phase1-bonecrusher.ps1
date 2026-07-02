param(
  [ValidateSet('compile','upload','persist-proof','health','full')]
  [string]$Action = 'full',
  [string]$ComPort = 'COM5',
  [string]$BonecrusherHost = 'http://192.168.2.115',
  [switch]$SkipHealth,
  [switch]$SkipPersistProof
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$deployScript = Join-Path $PSScriptRoot 'deploy-esp32.ps1'
$healthScript = Join-Path $PSScriptRoot 'health-check-stack.ps1'
$persistScript = Join-Path $PSScriptRoot 'tmp-bonecrusher-persist-proof.mjs'
$pio = Join-Path ${env:USERPROFILE} '.platformio\penv\Scripts\platformio.exe'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$ScriptBlock
  )

  Write-Host "\n=== $Name ===" -ForegroundColor Cyan
  & $ScriptBlock
}

function Invoke-Compile {
  if (-not (Test-Path $pio)) {
    throw "platformio.exe not found at $pio"
  }

  Push-Location $repoRoot
  try {
    & $pio run --environment esp32_bonecrusher
    if ($LASTEXITCODE -ne 0) {
      throw "Bonecrusher compile failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

function Invoke-Upload {
  if (-not (Test-Path $deployScript)) {
    throw "Missing deploy script: $deployScript"
  }

  & $deployScript -Mode serial -Port $ComPort -EnvName esp32_bonecrusher
  if ($LASTEXITCODE -ne 0) {
    throw "Bonecrusher upload failed with exit code $LASTEXITCODE"
  }
}

function Invoke-PersistProof {
  if (-not (Test-Path $persistScript)) {
    throw "Missing persist proof script: $persistScript"
  }

  $env:BONECRUSHER_BASE_URL = $BonecrusherHost
  try {
    node $persistScript
    if ($LASTEXITCODE -ne 0) {
      throw "Persist proof failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Remove-Item Env:BONECRUSHER_BASE_URL -ErrorAction SilentlyContinue
  }
}

function Invoke-Health {
  if (-not (Test-Path $healthScript)) {
    throw "Missing health check script: $healthScript"
  }

  & $healthScript
  if ($LASTEXITCODE -ne 0) {
    throw "Health check failed with exit code $LASTEXITCODE"
  }
}

switch ($Action) {
  'compile' {
    Invoke-Step -Name 'Compile Bonecrusher firmware' -ScriptBlock { Invoke-Compile }
  }
  'upload' {
    Invoke-Step -Name 'Upload Bonecrusher firmware' -ScriptBlock { Invoke-Upload }
  }
  'persist-proof' {
    Invoke-Step -Name 'Run Bonecrusher persist proof' -ScriptBlock { Invoke-PersistProof }
  }
  'health' {
    Invoke-Step -Name 'Run stack health checks' -ScriptBlock { Invoke-Health }
  }
  'full' {
    Invoke-Step -Name 'Compile Bonecrusher firmware' -ScriptBlock { Invoke-Compile }
    Invoke-Step -Name 'Upload Bonecrusher firmware' -ScriptBlock { Invoke-Upload }

    if (-not $SkipPersistProof) {
      Invoke-Step -Name 'Run Bonecrusher persist proof' -ScriptBlock { Invoke-PersistProof }
    } else {
      Write-Host "\nSkipping persist proof by request" -ForegroundColor Yellow
    }

    if (-not $SkipHealth) {
      Invoke-Step -Name 'Run stack health checks' -ScriptBlock { Invoke-Health }
    } else {
      Write-Host "\nSkipping health checks by request" -ForegroundColor Yellow
    }
  }
}

Write-Host "\nPhase 1 action '$Action' completed successfully." -ForegroundColor Green
