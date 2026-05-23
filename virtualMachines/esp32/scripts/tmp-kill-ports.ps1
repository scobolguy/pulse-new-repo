$ports = 4000,5173
foreach ($p in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($id in $listeners) {
    try { Stop-Process -Id $id -Force -ErrorAction Stop; Write-Output ("Stopped process {0} on port {1}" -f $id,$p) } catch { Write-Output ("Failed stop process {0} on port {1}: {2}" -f $id,$p,$_.Exception.Message) }
  }
  if (-not $listeners) { Write-Output ("No listener on port {0}" -f $p) }
}
