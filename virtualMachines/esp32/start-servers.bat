@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%start-backend.bat" (
  echo [ERROR] Missing "%ROOT%start-backend.bat"
  exit /b 1
)

if not exist "%ROOT%start-frontend.bat" (
  echo [ERROR] Missing "%ROOT%start-frontend.bat"
  exit /b 1
)

echo Launching backend and frontend in separate windows...
start "Aggregator Backend" "%ROOT%start-backend.bat"
timeout /t 2 /nobreak >nul
start "Aggregator Frontend" "%ROOT%start-frontend.bat"

echo Done.
echo Backend and frontend were started in new terminal windows.
