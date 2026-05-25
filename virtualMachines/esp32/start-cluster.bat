@echo off
setlocal

set "ROOT=%~dp0"
set "ROLE=%~1"
set "PEER=%~2"

if "%ROLE%"=="" set "ROLE=primary"

set "ARGS=-Role %ROLE% -Clean"
if not "%PEER%"=="" set "ARGS=%ARGS% -PeerHost %PEER% -Promote"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-cluster.ps1" %ARGS%
exit /b %ERRORLEVEL%
