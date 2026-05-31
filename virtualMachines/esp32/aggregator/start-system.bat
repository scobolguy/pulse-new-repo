@echo off
setlocal

cd /d "%~dp0"

set "AUTO_STOP=1"
if /I "%~1"=="--no-stop" set "AUTO_STOP=0"

if "%AUTO_STOP%"=="1" (
  if exist "stop-system.bat" (
    echo [startup] Running pre-stop before bringup...
    call stop-system.bat --quiet
  ) else (
    echo [startup] stop-system.bat not found. Continuing without pre-stop.
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo [startup] Node.js is not installed or not on PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [startup] npm is not installed or not on PATH.
  exit /b 1
)

if not exist "node_modules" (
  echo [startup] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [startup] npm install failed.
    exit /b 1
  )
)

set "STARTUP_BACKEND_WAIT_RETRY_COUNT=2"
set "STARTUP_BACKEND_WAIT_RETRY_BACKOFF_MS=2000"
set "STARTUP_BACKEND_WAIT_MAX_TIMEOUT_MS=150000"
set "STARTUP_FRONTEND_WAIT_RETRY_COUNT=2"
set "STARTUP_FRONTEND_WAIT_RETRY_BACKOFF_MS=1500"

echo [startup] Running startup FSM...
call node scripts\startup-fsm-workflow.mjs
set "RUN_EXIT=%ERRORLEVEL%"

if "%RUN_EXIT%"=="0" (
  echo [startup] Startup complete. Opening UI...
  start "" "http://127.0.0.1:5173/"
  exit /b 0
)

echo [startup] Startup failed. Check data\startup-fsm-status.json and data\startup-fsm-notes.jsonl.
exit /b %RUN_EXIT%
