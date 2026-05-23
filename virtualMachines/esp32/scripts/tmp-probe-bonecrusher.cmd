@echo off
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $targets=@('192.168.2.115','192.168.2.116','192.168.2.117','192.168.2.118'); foreach($ip in $targets){ try { $r=Invoke-RestMethod -Uri ('http://'+$ip+'/status') -TimeoutSec 3; if($r.deviceRole -eq 'bonecrusher'){ Write-Output $ip; exit 0 } } catch {} }; exit 1"
