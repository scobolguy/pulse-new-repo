@echo off
setlocal

set "ROOT=%~dp0"

call "%ROOT%stop-backend.bat"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-stack.ps1" -Ports 5173
exit /b %ERRORLEVEL%
