@echo off
setlocal

set "ROOT=%~dp0"
set "PULSE_BACKEND_MODE=split"
set "PULSE_BACKEND_ROLE=primary"
if "%PULSE_CLEAN_PORTS%"=="" set "PULSE_CLEAN_PORTS=1"

call "%ROOT%start-backend.bat"
exit /b %ERRORLEVEL%
