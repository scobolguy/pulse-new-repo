param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('speak', 'voices')]
  [string]$Mode,

  [string]$Text = '',
  [string]$Voice = '',
  [int]$Rate = 0,
  [int]$Volume = 100,
  [string]$OutputPath = '',
  [switch]$NoPlay
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ($Mode -eq 'voices') {
    $voices = @()
    foreach ($installed in $synth.GetInstalledVoices()) {
      $info = $installed.VoiceInfo
      $voices += [pscustomobject]@{
        name = $info.Name
        culture = $info.Culture.Name
        gender = [string]$info.Gender
        age = [string]$info.Age
        description = $info.Description
      }
    }

    [pscustomobject]@{
      ok = $true
      engine = 'windows-sapi'
      voices = $voices
    } | ConvertTo-Json -Compress
    exit 0
  }

  if ([string]::IsNullOrWhiteSpace($Text)) {
    throw 'Text is required for speak mode.'
  }

  if (-not [string]::IsNullOrWhiteSpace($Voice)) {
    $synth.SelectVoice($Voice)
  }

  $safeRate = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $safeVolume = [Math]::Max(0, [Math]::Min(100, $Volume))
  $synth.Rate = $safeRate
  $synth.Volume = $safeVolume

  $savedToFile = $false
  if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $targetDir = Split-Path -Parent $OutputPath
    if (-not [string]::IsNullOrWhiteSpace($targetDir) -and -not (Test-Path $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    $synth.SetOutputToWaveFile($OutputPath)
    $synth.Speak($Text)
    $savedToFile = $true
    $synth.SetOutputToDefaultAudioDevice()
  }

  if (-not $NoPlay) {
    if ($savedToFile) {
      $player = New-Object System.Media.SoundPlayer $OutputPath
      $player.PlaySync()
      $player.Dispose()
    } else {
      $synth.Speak($Text)
    }
  }

  [pscustomobject]@{
    ok = $true
    engine = 'windows-sapi'
    voice = $synth.Voice.Name
    rate = $safeRate
    volume = $safeVolume
    outputFile = if ($savedToFile) { $OutputPath } else { $null }
    played = (-not $NoPlay)
  } | ConvertTo-Json -Compress
}
finally {
  $synth.Dispose()
}
