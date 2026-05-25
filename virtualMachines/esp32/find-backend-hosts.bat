@echo off
setlocal

set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\discover-backend-hosts.ps1"
exit /b %ERRORLEVEL%
