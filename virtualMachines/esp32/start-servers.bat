@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%aggregator\service-manager.mjs" (
  echo [ERROR] Missing "%ROOT%aggregator\service-manager.mjs"
  exit /b 1
)

if not exist "%ROOT%start-frontend.bat" (
  echo [ERROR] Missing "%ROOT%start-frontend.bat"
  exit /b 1
)

echo Backend is managed by Windows Services; launching frontend only...
start "Aggregator Frontend" "%ROOT%start-frontend.bat"

echo Done.
echo Frontend was started in a new terminal window.
