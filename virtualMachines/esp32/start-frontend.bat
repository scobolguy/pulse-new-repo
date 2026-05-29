@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"
set "FRONTEND_PORT=5173"

call :ensure_port_free "%FRONTEND_PORT%" "frontend"
if errorlevel 1 exit /b 1

if "%PULSE_RUNTIME_DATA_ROOT%"=="" (
  set "PULSE_RUNTIME_DATA_ROOT=C:\pulse-data\esp32\aggregator-data"
)
if "%VITE_CACHE_DIR%"=="" (
  set "VITE_CACHE_DIR=%PULSE_RUNTIME_DATA_ROOT%\vite-cache"
)

if not exist "%PULSE_RUNTIME_DATA_ROOT%" (
  mkdir "%PULSE_RUNTIME_DATA_ROOT%" >nul 2>&1
)
if not exist "%VITE_CACHE_DIR%" (
  mkdir "%VITE_CACHE_DIR%" >nul 2>&1
)

if not exist "%AGGREGATOR_DIR%\package.json" (
  echo [ERROR] Could not find package.json in "%AGGREGATOR_DIR%".
  exit /b 1
)

if "%PULSE_FRONTEND_MODE%"=="" (
  set "PULSE_FRONTEND_MODE=preview"
)

echo Starting frontend from "%AGGREGATOR_DIR%"...
echo Frontend mode "%PULSE_FRONTEND_MODE%" (set PULSE_FRONTEND_MODE=dev to run Vite dev server)...
echo Using runtime data root "%PULSE_RUNTIME_DATA_ROOT%"...
echo Using Vite cache dir "%VITE_CACHE_DIR%"...
cd /d "%AGGREGATOR_DIR%"
set "PULSE_RUNTIME_DATA_ROOT=%PULSE_RUNTIME_DATA_ROOT%"
set "VITE_CACHE_DIR=%VITE_CACHE_DIR%"

if /I "%PULSE_FRONTEND_MODE%"=="dev" (
  npm run dev
  exit /b %ERRORLEVEL%
)

if not exist "%AGGREGATOR_DIR%\dist\index.html" (
  echo [INFO] Frontend build missing; running npm run build...
  npm run build
  if errorlevel 1 exit /b %ERRORLEVEL%
)

npm run preview -- --host 0.0.0.0 --port 5173

exit /b %ERRORLEVEL%

:ensure_port_free
set "TARGET_PORT=%~1"
set "SERVICE_NAME=%~2"
set "ATTEMPT=1"

:ensure_port_free_loop
set "PID_LIST="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  if not "%%~P"=="" set "PID_LIST=!PID_LIST! %%~P"
)

if "%PID_LIST%"=="" (
  echo [INFO] Port %TARGET_PORT% is free for %SERVICE_NAME% startup.
  exit /b 0
)

echo [WARN] Port %TARGET_PORT% is busy for %SERVICE_NAME% startup (attempt %ATTEMPT% of 3). Stopping PID(s): %PID_LIST%
for %%P in (%PID_LIST%) do (
  if not "%%~P"=="" taskkill /PID %%P /F >nul 2>&1
)

timeout /t 1 /nobreak >nul

set /a ATTEMPT+=1
if %ATTEMPT% LEQ 3 goto :ensure_port_free_loop

set "PID_LIST="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  if not "%%~P"=="" set "PID_LIST=!PID_LIST! %%~P"
)

if "%PID_LIST%"=="" (
  echo [INFO] Port %TARGET_PORT% is free for %SERVICE_NAME% startup.
  exit /b 0
)

echo [ERROR] Unable to clear port %TARGET_PORT% for %SERVICE_NAME% after 3 attempts.
echo [ERROR] Operator action required: stop PID(s) %PID_LIST% and retry startup.
exit /b 1
