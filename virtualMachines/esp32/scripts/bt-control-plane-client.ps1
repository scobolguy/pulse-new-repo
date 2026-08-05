param(
    [Parameter(Mandatory = $true)]
    [string]$Port,

    [ValidateSet("PING", "STATUS", "PROVISION")]
    [string]$Action = "STATUS",

    [string]$Ssid,
    [string]$Password,
    [switch]$Connect,
    [switch]$Reboot,
    [int]$TimeoutSec = 20,
    [int]$BaudRate = 115200
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-SerialBurst {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Ports.SerialPort]$SerialPort,
        [int]$TotalTimeoutSec = 10,
        [int]$IdleBreakMs = 1200
    )

    $deadline = (Get-Date).AddSeconds($TotalTimeoutSec)
    $lastDataAt = Get-Date
    $output = New-Object System.Text.StringBuilder

    while ((Get-Date) -lt $deadline) {
        if ($SerialPort.BytesToRead -gt 0) {
            $chunk = $SerialPort.ReadExisting()
            if (-not [string]::IsNullOrEmpty($chunk)) {
                [void]$output.Append($chunk)
                $lastDataAt = Get-Date
                Start-Sleep -Milliseconds 120
                continue
            }
        }

        $idleMs = ((Get-Date) - $lastDataAt).TotalMilliseconds
        if ($idleMs -ge $IdleBreakMs) {
            break
        }

        Start-Sleep -Milliseconds 120
    }

    return $output.ToString()
}

if ($Action -eq "PROVISION") {
    if ([string]::IsNullOrWhiteSpace($Ssid)) {
        throw "Ssid is required when Action=PROVISION"
    }
    if ([string]::IsNullOrWhiteSpace($Password)) {
        throw "Password is required when Action=PROVISION"
    }
}

$line = $Action
if ($Action -eq "PROVISION") {
    $payload = [ordered]@{
        ssid = $Ssid
        password = $Password
        connect = [bool]$Connect
        reboot = [bool]$Reboot
        timeoutSec = $TimeoutSec
    } | ConvertTo-Json -Compress

    $line = "PROVISION $payload"
}

$sp = New-Object System.IO.Ports.SerialPort $Port, $BaudRate, ([System.IO.Ports.Parity]::None), 8, ([System.IO.Ports.StopBits]::One)
$sp.Handshake = [System.IO.Ports.Handshake]::None
$sp.ReadTimeout = 300
$sp.WriteTimeout = 2000

try {
    $sp.Open()
    Start-Sleep -Milliseconds 250

    $sp.DiscardInBuffer()
    $sp.DiscardOutBuffer()

    $sp.WriteLine($line)
    Write-Output ("SENT: " + $line)

    $response = Read-SerialBurst -SerialPort $sp -TotalTimeoutSec $TimeoutSec
    if ([string]::IsNullOrWhiteSpace($response)) {
        Write-Output "RECV: <no response>"
    } else {
        Write-Output "RECV:"
        Write-Output $response
    }
}
finally {
    if ($sp.IsOpen) {
        $sp.Close()
    }
    $sp.Dispose()
}
