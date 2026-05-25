@echo off
setlocal

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"

if not exist "%AGGREGATOR_DIR%\discovery-service.mjs" (
  echo [ERROR] Missing "%AGGREGATOR_DIR%\discovery-service.mjs"
  exit /b 1
)

echo Starting discovery service...
pushd "%AGGREGATOR_DIR%" >nul
node discovery-service.mjs
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul

exit /b %EXIT_CODE%
