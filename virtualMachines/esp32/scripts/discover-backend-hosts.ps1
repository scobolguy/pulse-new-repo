param(
  [string]$SubnetPrefix = '',
  [int]$StartNode = 2,
  [int]$EndNode = 254,
  [int]$TimeoutMs = 800
)

$ErrorActionPreference = 'SilentlyContinue'

function Get-DefaultSubnetPrefix {
  $ipv4 = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $ipv4) {
    return '192.168.2'
  }

  $parts = $ipv4.Split('.')
  if ($parts.Length -ne 4) {
    return '192.168.2'
  }
  return ("{0}.{1}.{2}" -f $parts[0], $parts[1], $parts[2])
}

if (-not $SubnetPrefix) {
  $SubnetPrefix = Get-DefaultSubnetPrefix
}


$results = New-Object System.Collections.Generic.List[object]

($StartNode..$EndNode) | ForEach-Object {
  $ip = "${SubnetPrefix}.${_}"
  $uri = "http://${ip}:4000/status"

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec ([Math]::Max(1, [Math]::Ceiling($TimeoutMs / 1000.0)))
    if ($response.StatusCode -eq 200) {
      $payload = $null
      try { $payload = $response.Content | ConvertFrom-Json } catch {}
      $results.Add([pscustomobject]@{
        ip = $ip
        statusCode = $response.StatusCode
        nodeName = if ($payload) { $payload.nodeName } else { $null }
        service = if ($payload) { $payload.serviceName } else { $null }
        raw = if ($payload) { $payload } else { $null }
      }) | Out-Null
    }
  } catch {
  }
}

$results | Sort-Object ip | ConvertTo-Json -Depth 6
