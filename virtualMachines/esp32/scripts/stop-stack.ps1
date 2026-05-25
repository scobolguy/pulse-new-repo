param(
  [switch]$Quiet,
  [int[]]$Ports = @(4000, 4100, 4200, 5173)
)

$ErrorActionPreference = 'Stop'

function Write-Status {
  param([string]$Message)
  if (-not $Quiet) {
    Write-Output $Message
  }
}

function Get-ListenerProcessNumbers {
  param([int[]]$PortList)

  $processSet = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($port in $PortList) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    @($listeners) |
      Where-Object { $_ -is [int] } |
      ForEach-Object {
        $null = $processSet.Add([int]$_)
      }
  }

  return @($processSet)
}

function Wait-PortsClosed {
  param(
    [int[]]$PortList,
    [int]$MaxAttempts = 20,
    [int]$DelayMs = 500
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $remaining = @()
    foreach ($port in $PortList) {
      $hasListener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($hasListener) {
        $remaining += $port
      }
    }

    if ($remaining.Count -eq 0) {
      return $true
    }

    Start-Sleep -Milliseconds $DelayMs
  }

  return $false
}

$targets = @($Ports | Where-Object { $_ -gt 0 } | Sort-Object -Unique)
if ($targets.Count -eq 0) {
  throw 'No valid ports provided to stop-stack.'
}

Write-Status ("Stopping listeners on ports: {0}" -f ($targets -join ', '))

$processNumbers = Get-ListenerProcessNumbers -PortList $targets
if ($processNumbers.Count -eq 0) {
  Write-Status 'No active listeners found for requested ports.'
} else {
  @($processNumbers) | ForEach-Object {
    $proc = [int]$_
    try {
      Stop-Process -Id $proc -Force -ErrorAction Stop
      Write-Status ("Stopped process {0}" -f $proc)
    } catch {
      Write-Status ("Failed to stop process {0}: {1}" -f $proc, $_.Exception.Message)
    }
  }
}

if (-not (Wait-PortsClosed -PortList $targets -MaxAttempts 20 -DelayMs 500)) {
  $stuck = @()
  foreach ($port in $targets) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($listener) {
      $stuck += $port
    }
  }
  throw ("Some ports are still listening after shutdown: {0}" -f ($stuck -join ', '))
}

Write-Status 'Stack listeners stopped successfully.'
