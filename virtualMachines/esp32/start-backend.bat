@echo off
setlocal

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"

if not exist "%AGGREGATOR_DIR%\backend.mjs" (
  echo [ERROR] Could not find backend.mjs in "%AGGREGATOR_DIR%".
  exit /b 1
)

echo Starting backend from "%AGGREGATOR_DIR%"...
cmd /k "cd /d \"%AGGREGATOR_DIR%\" && node backend.mjs"
