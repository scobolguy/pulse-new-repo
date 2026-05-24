@echo off
setlocal

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"

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
