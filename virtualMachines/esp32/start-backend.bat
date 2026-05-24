@echo off
setlocal

set "ROOT=%~dp0"
set "AGGREGATOR_DIR=%ROOT%aggregator"

if "%PULSE_QUEUE_DATA_ROOT%"=="" (
  set "PULSE_QUEUE_DATA_ROOT=C:\pulse-data\esp32\aggregator-data"
)
if "%PULSE_RUNTIME_DATA_ROOT%"=="" (
  set "PULSE_RUNTIME_DATA_ROOT=%PULSE_QUEUE_DATA_ROOT%"
)

if not exist "%PULSE_QUEUE_DATA_ROOT%" (
  mkdir "%PULSE_QUEUE_DATA_ROOT%" >nul 2>&1
)
if not exist "%PULSE_RUNTIME_DATA_ROOT%" (
  mkdir "%PULSE_RUNTIME_DATA_ROOT%" >nul 2>&1
)
if not exist "%PULSE_RUNTIME_DATA_ROOT%\compliance" (
  mkdir "%PULSE_RUNTIME_DATA_ROOT%\compliance" >nul 2>&1
)

if not exist "%PULSE_RUNTIME_DATA_ROOT%\worker-config.json" if exist "%AGGREGATOR_DIR%\data\worker-config.json" copy /y "%AGGREGATOR_DIR%\data\worker-config.json" "%PULSE_RUNTIME_DATA_ROOT%\worker-config.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\router-rules.json" if exist "%AGGREGATOR_DIR%\data\router-rules.json" copy /y "%AGGREGATOR_DIR%\data\router-rules.json" "%PULSE_RUNTIME_DATA_ROOT%\router-rules.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\data-mappings.json" if exist "%AGGREGATOR_DIR%\data\data-mappings.json" copy /y "%AGGREGATOR_DIR%\data\data-mappings.json" "%PULSE_RUNTIME_DATA_ROOT%\data-mappings.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\user-management.json" if exist "%AGGREGATOR_DIR%\data\user-management.json" copy /y "%AGGREGATOR_DIR%\data\user-management.json" "%PULSE_RUNTIME_DATA_ROOT%\user-management.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\user-groups.json" if exist "%AGGREGATOR_DIR%\data\user-groups.json" copy /y "%AGGREGATOR_DIR%\data\user-groups.json" "%PULSE_RUNTIME_DATA_ROOT%\user-groups.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\monitor-classes.json" if exist "%AGGREGATOR_DIR%\data\monitor-classes.json" copy /y "%AGGREGATOR_DIR%\data\monitor-classes.json" "%PULSE_RUNTIME_DATA_ROOT%\monitor-classes.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\process-governance.json" if exist "%AGGREGATOR_DIR%\data\process-governance.json" copy /y "%AGGREGATOR_DIR%\data\process-governance.json" "%PULSE_RUNTIME_DATA_ROOT%\process-governance.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\compliance\sanctions-cache.json" if exist "%AGGREGATOR_DIR%\data\compliance\sanctions-cache.json" copy /y "%AGGREGATOR_DIR%\data\compliance\sanctions-cache.json" "%PULSE_RUNTIME_DATA_ROOT%\compliance\sanctions-cache.json" >nul
if not exist "%PULSE_RUNTIME_DATA_ROOT%\transaction-lifecycle.tsl" if exist "%AGGREGATOR_DIR%\data\transaction-lifecycle.tsl" copy /y "%AGGREGATOR_DIR%\data\transaction-lifecycle.tsl" "%PULSE_RUNTIME_DATA_ROOT%\transaction-lifecycle.tsl" >nul

if not exist "%PULSE_RUNTIME_DATA_ROOT%\transaction-lifecycle-compiled.json" (
  if exist "%PULSE_RUNTIME_DATA_ROOT%\transaction-lifecycle.tsl" (
    pushd "%AGGREGATOR_DIR%" >nul
    node scripts\compile-transaction-lifecycle-dsl.mjs --in "%PULSE_RUNTIME_DATA_ROOT%\transaction-lifecycle.tsl"
    popd >nul
  )
)

if not exist "%AGGREGATOR_DIR%\backend.mjs" (
  echo [ERROR] Could not find backend.mjs in "%AGGREGATOR_DIR%".
  exit /b 1
)

echo Starting backend from "%AGGREGATOR_DIR%"...
echo Using queue data root "%PULSE_QUEUE_DATA_ROOT%"...
echo Using runtime data root "%PULSE_RUNTIME_DATA_ROOT%"...
cd /d "%AGGREGATOR_DIR%"
set "PULSE_QUEUE_DATA_ROOT=%PULSE_QUEUE_DATA_ROOT%"
set "PULSE_RUNTIME_DATA_ROOT=%PULSE_RUNTIME_DATA_ROOT%"
node backend.mjs
