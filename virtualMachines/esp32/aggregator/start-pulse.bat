@echo off
setlocal

:: ============================================================
::  Pulse — Full Stack Launcher
::  Starts all services in the correct order:
::    1. Backend (port 4000)          via startup-fsm-workflow.mjs
::    2. Data Librarian (port 4300)   \__ auto-started by backend
::    3. Data Mapper (port 4200)      /   when BACKEND_AUX_SERVICES_AUTOSTART=true
::    4. Discovery Service (port 4300 HTTP / UDP 4210)
::    5. MCP Server (port 4011)       via frontend-startup-fsm-workflow.mjs
::    6. Vite frontend (port 5173)    /
::    7. Caddy HTTPS edge (port 443)  /
:: ============================================================

set "AGGREGATOR_DIR=C:\dev\pulse-new-repo\virtualMachines\esp32\aggregator"

if not exist "%AGGREGATOR_DIR%" (
  echo [pulse] ERROR: Aggregator directory not found: %AGGREGATOR_DIR%
  echo [pulse] Update AGGREGATOR_DIR at the top of this file if the repo has moved.
  pause
  exit /b 1
)

cd /d "%AGGREGATOR_DIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo [pulse] ERROR: Node.js is not installed or not on PATH.
  pause
  exit /b 1
)

:: ---- pre-flight: install deps if needed ----
if not exist "node_modules" (
  echo [pulse] node_modules not found — running npm install...
  call npm install
  if errorlevel 1 (
    echo [pulse] npm install failed.
    pause
    exit /b 1
  )
)

:: ---- Step 1: Backend + companion services (librarian, mapper, discovery) ----
echo.
echo [pulse] Starting backend + companion services...
echo [pulse]   Backend:    http://127.0.0.1:4000
echo [pulse]   Librarian:  http://127.0.0.1:4300  (auto-started by backend)
echo [pulse]   Mapper:     http://127.0.0.1:4200  (auto-started by backend)
echo [pulse]   Discovery:  http://127.0.0.1:4300 / UDP 4210
echo.
call node scripts\startup-fsm-workflow.mjs
set "BACKEND_EXIT=%ERRORLEVEL%"

if not "%BACKEND_EXIT%"=="0" (
  echo [pulse] Backend startup FSM failed (exit %BACKEND_EXIT%).
  echo [pulse] Check data\startup-fsm-status.json and data\startup-fsm-notes.jsonl for details.
  pause
  exit /b %BACKEND_EXIT%
)

echo [pulse] Backend ready.

:: ---- Step 2: MCP server + Vite frontend + Caddy edge ----
echo.
echo [pulse] Starting MCP server, Vite frontend, and Caddy edge...
echo [pulse]   MCP:      http://127.0.0.1:4011
echo [pulse]   Frontend: http://127.0.0.1:5173
echo [pulse]   HTTPS:    https://localhost
echo.
call node scripts\frontend-startup-fsm-workflow.mjs
set "FRONTEND_EXIT=%ERRORLEVEL%"

if not "%FRONTEND_EXIT%"=="0" (
  echo [pulse] Frontend startup FSM failed (exit %FRONTEND_EXIT%).
  echo [pulse] Check data\frontend-startup-fsm-status.json for details.
  pause
  exit /b %FRONTEND_EXIT%
)

:: ---- All services up ----
echo.
echo [pulse] ============================================================
echo [pulse]  All services are running.
echo [pulse]
echo [pulse]    UI          http://127.0.0.1:5173/
echo [pulse]    Bob Console http://127.0.0.1:5173/bob-console.html
echo [pulse]    HTTPS edge  https://localhost/bob-console.html
echo [pulse]    Backend API http://127.0.0.1:4000/api/
echo [pulse]    MCP server  http://127.0.0.1:4011/
echo [pulse] ============================================================
echo.

node scripts\process-interaction-log.mjs --summary-only 2>nul

start "" "http://127.0.0.1:5173/"

exit /b 0
