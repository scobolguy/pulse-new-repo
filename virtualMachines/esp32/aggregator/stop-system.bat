@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "QUIET=0"
if /I "%~1"=="--quiet" set "QUIET=1"

if "%QUIET%"=="0" echo [stop] Stopping aggregator services on ports 4000 and 5173...

set "KILLED_ANY=0"
call :kill_port 4000
call :kill_port 5173

if "%QUIET%"=="0" (
  if "%KILLED_ANY%"=="1" (
    echo [stop] Stop complete.
  ) else (
    echo [stop] No running services found on target ports.
  )
)

exit /b 0

:kill_port
set "TARGET_PORT=%~1"
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    if "%QUIET%"=="0" echo [stop] Killing PID %%P on port %TARGET_PORT%...
    taskkill /PID %%P /F /T >nul 2>nul
    if not errorlevel 1 set "KILLED_ANY=1"
  )
)
exit /b 0
