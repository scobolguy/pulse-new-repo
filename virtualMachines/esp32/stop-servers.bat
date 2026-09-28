@echo off
setlocal

set "ROOT=%~dp0"

echo Stopping configured stack listeners...
taskkill /FI "WINDOWTITLE eq Aggregator Frontend" /T /F >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-stack.ps1" -Ports 5173
exit /b %ERRORLEVEL%
