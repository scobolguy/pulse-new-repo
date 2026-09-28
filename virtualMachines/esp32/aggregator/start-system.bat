@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

if not defined QUEUE_MANAGER_PRIMARY_PROVIDER set "QUEUE_MANAGER_PRIMARY_PROVIDER=rabbitmq"
if not defined QUEUE_MANAGER_SECONDARY_PROVIDER set "QUEUE_MANAGER_SECONDARY_PROVIDER=msmq"
if not defined RABBITMQ_URL set "RABBITMQ_URL=amqp://127.0.0.1:5672"
if not defined RABBITMQ_QUEUE_PREFIX set "RABBITMQ_QUEUE_PREFIX=pulse-rabbit"
if not defined MSMQ_BASE_QUEUE_PATH set "MSMQ_BASE_QUEUE_PATH=.\private$"
if not defined MSMQ_QUEUE_PREFIX set "MSMQ_QUEUE_PREFIX=pulse-msmq"

echo [startup] Queue managers: qm-primary=%QUEUE_MANAGER_PRIMARY_PROVIDER%, qm-secondary=%QUEUE_MANAGER_SECONDARY_PROVIDER%
echo [startup] Database managers: db-mssql=mssql, db-access=access
echo [startup] Database manager: db-mysql=mysql

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
set "STARTUP_STEP_TIMEOUT_MS=60000"
set "STARTUP_FRONTEND_WAIT_RETRY_COUNT=2"
set "STARTUP_FRONTEND_WAIT_RETRY_BACKOFF_MS=1500"
set STARTUP_BACKEND_CMD=node --env-file="%~dp0.env.local" "%~dp0backend.mjs"

echo [startup] Running startup FSM...
call node scripts\startup-fsm-workflow.mjs
set "RUN_EXIT=%ERRORLEVEL%"

if "%RUN_EXIT%"=="0" (
  echo [startup] Starting frontend...
  call node scripts\frontend-startup-fsm-workflow.mjs
  set "FRONTEND_EXIT=%ERRORLEVEL%"
  if not "!FRONTEND_EXIT!"=="0" (
    echo [startup] Frontend startup failed. Check frontend startup status.
    exit /b !FRONTEND_EXIT!
  )
  echo [startup] Startup complete.
  node scripts\process-interaction-log.mjs --summary-only
  echo [startup] Opening UI...
  start "" "http://127.0.0.1:5173/"
  exit /b 0
)

echo [startup] Startup failed. Check data\startup-fsm-status.json and data\startup-fsm-notes.jsonl.
exit /b %RUN_EXIT%
