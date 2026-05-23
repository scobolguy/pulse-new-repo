@echo off
setlocal

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"

if not exist "%AGGREGATOR_DIR%\package.json" (
  echo [ERROR] Could not find package.json in "%AGGREGATOR_DIR%".
  exit /b 1
)

echo Starting frontend (Vite dev server) from "%AGGREGATOR_DIR%"...
cmd /k "cd /d \"%AGGREGATOR_DIR%\" && npm run dev"
