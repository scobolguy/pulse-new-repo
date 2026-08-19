@echo off
setlocal

set "AGGREGATOR_DIR=C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator"

if not exist "%AGGREGATOR_DIR%" (
  echo [aux] ERROR: Aggregator directory not found: %AGGREGATOR_DIR%
  pause
  exit /b 1
)

cd /d "%AGGREGATOR_DIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo [aux] ERROR: Node.js is not installed or not on PATH.
  pause
  exit /b 1
)

:: Kill any stale instances already occupying these ports
echo [aux] Releasing ports 4300 and 4200 if occupied...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4300 " ^| findstr "LISTENING"') do (
  echo [aux]   Killing PID %%p on port 4300
  taskkill /PID %%p /F >nul 2>nul
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4200 " ^| findstr "LISTENING"') do (
  echo [aux]   Killing PID %%p on port 4200
  taskkill /PID %%p /F >nul 2>nul
)

:: Small pause to let ports clear
ping -n 2 127.0.0.1 >nul

:: Start Data Librarian in its own window (port 4300)
echo [aux] Starting Data Librarian on port 4300...
start "Pulse - Data Librarian :4300" cmd /k "cd /d "%AGGREGATOR_DIR%" && node --env-file=.env.local data-librarian.mjs"

:: Start Data Mapper in its own window (port 4200)
echo [aux] Starting Data Mapper on port 4200...
start "Pulse - Data Mapper :4200" cmd /k "cd /d "%AGGREGATOR_DIR%" && node --env-file=.env.local data-mapper.mjs"

:: Poll until both are healthy (up to 20 s each)
echo [aux] Waiting for services to become healthy...

set /a WAIT=0
:wait_librarian
ping -n 2 127.0.0.1 >nul
set /a WAIT+=1
curl -s --max-time 1 http://127.0.0.1:4300/health >nul 2>nul
if not errorlevel 1 goto librarian_ok
if %WAIT% lss 10 goto wait_librarian
echo [aux] WARNING: Librarian did not respond on :4300 within 20 s — check its window for errors.
goto check_mapper

:librarian_ok
echo [aux] Librarian ready  http://127.0.0.1:4300/health

:check_mapper
set /a WAIT=0
:wait_mapper
ping -n 2 127.0.0.1 >nul
set /a WAIT+=1
curl -s --max-time 1 http://127.0.0.1:4200/health >nul 2>nul
if not errorlevel 1 goto mapper_ok
if %WAIT% lss 10 goto wait_mapper
echo [aux] WARNING: Mapper did not respond on :4200 within 20 s — check its window for errors.
goto done

:mapper_ok
echo [aux] Mapper ready     http://127.0.0.1:4200/health

:done
echo.
echo [aux] Done.
echo [aux]   Librarian  http://127.0.0.1:4300/health
echo [aux]   Mapper     http://127.0.0.1:4200/health
echo.
echo [aux] Close the two service windows to stop them.
exit /b 0
