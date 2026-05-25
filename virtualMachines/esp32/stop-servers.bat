@echo off
setlocal

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"

if not exist "%AGGREGATOR_DIR%\scripts\interpret-workflow.mjs" (
  echo [ERROR] Missing "%AGGREGATOR_DIR%\scripts\interpret-workflow.mjs"
  exit /b 1
)

if not exist "%AGGREGATOR_DIR%\data\workflow.wfl" (
  echo [ERROR] Missing "%AGGREGATOR_DIR%\data\workflow.wfl"
  exit /b 1
)

echo Running workflow "stack-stop"...
pushd "%AGGREGATOR_DIR%" >nul
node scripts\interpret-workflow.mjs --in data\workflow.wfl --workflow stack-stop
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul

if not "%EXIT_CODE%"=="0" (
  echo [ERROR] Shutdown workflow failed.
  exit /b %EXIT_CODE%
)

echo Shutdown workflow complete.
