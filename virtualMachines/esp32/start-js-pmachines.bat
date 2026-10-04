@echo off
setlocal

set "ROOT=%~dp0"
set "JS_PM_DIR=%ROOT%pmachines\javascript"

if not exist "%JS_PM_DIR%\server.mjs" (
  echo [ERROR] Missing "%JS_PM_DIR%\server.mjs"
  exit /b 1
)

echo Starting JS PMachine nodes on ports 4111, 4112 and 4113...
start "JS PMachine 01" /D "%JS_PM_DIR%" node server.mjs --port 4111 --name js-pmachine-01
start "JS PMachine 02" /D "%JS_PM_DIR%" node server.mjs --port 4112 --name js-pmachine-02
start "JS PMachine 03" /D "%JS_PM_DIR%" node server.mjs --port 4113 --name js-pmachine-03
exit /b 0
