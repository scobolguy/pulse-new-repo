@echo off
setlocal

cd /d "%~dp0"

set "SKIP_PULL=0"
set "SKIP_START=0"
set "NO_CLEAN_INSTALL=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--skip-pull" (
  set "SKIP_PULL=1"
  shift
  goto parse_args
)
if /I "%~1"=="--skip-start" (
  set "SKIP_START=1"
  shift
  goto parse_args
)
if /I "%~1"=="--no-clean-install" (
  set "NO_CLEAN_INSTALL=1"
  shift
  goto parse_args
)
if /I "%~1"=="--help" goto usage
if /I "%~1"=="-h" goto usage
echo [deploy] Unknown option: %~1
goto usage

:args_done
where node >nul 2>nul
if errorlevel 1 (
  echo [deploy] Node.js is not installed or not on PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [deploy] npm is not installed or not on PATH.
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo [deploy] git is not installed or not on PATH.
  exit /b 1
)

if %SKIP_PULL%==0 (
  if not exist ".git" (
    echo [deploy] .git not found. Cannot pull updates.
    exit /b 1
  )

  echo [deploy] Fetching latest refs...
  git fetch --all --prune
  if errorlevel 1 (
    echo [deploy] git fetch failed.
    exit /b 1
  )

  for /f "usebackq delims=" %%i in (`git rev-parse --abbrev-ref HEAD`) do set "CURRENT_BRANCH=%%i"
  if "%CURRENT_BRANCH%"=="" (
    echo [deploy] Could not determine current branch.
    exit /b 1
  )

  echo [deploy] Pulling latest on branch %CURRENT_BRANCH%...
  git pull --ff-only origin %CURRENT_BRANCH%
  if errorlevel 1 (
    echo [deploy] git pull failed. Resolve merge/divergence and retry.
    exit /b 1
  )
) else (
  echo [deploy] Skipping git pull as requested.
)

if %NO_CLEAN_INSTALL%==0 (
  echo [deploy] Installing dependencies with npm ci...
  call npm ci
  set "NPM_CI_EXIT=%ERRORLEVEL%"
  if not "%NPM_CI_EXIT%"=="0" (
    echo [deploy] npm ci failed. Retrying with npm install to recover from local file locks...
    call npm install
    if errorlevel 1 (
      echo [deploy] npm install fallback also failed.
      exit /b 1
    )
  )
) else (
  echo [deploy] Installing dependencies with npm install...
  call npm install
  if errorlevel 1 (
    echo [deploy] npm install failed.
    exit /b 1
  )
)

if not exist "node_modules\.bin\vite.cmd" (
  echo [deploy] Dependencies incomplete after install step. Running npm install repair...
  call npm install
  if errorlevel 1 (
    echo [deploy] npm install repair failed.
    exit /b 1
  )
)

echo [deploy] Building frontend...
call npm run build
if errorlevel 1 (
  echo [deploy] npm run build failed.
  exit /b 1
)

if %SKIP_START%==1 (
  echo [deploy] Build complete. Startup skipped (--skip-start).
  exit /b 0
)

if not exist "start-system.bat" (
  echo [deploy] start-system.bat not found.
  exit /b 1
)

echo [deploy] Starting system...
call start-system.bat
set "RUN_EXIT=%ERRORLEVEL%"
if not "%RUN_EXIT%"=="0" (
  echo [deploy] Startup failed with exit code %RUN_EXIT%.
  exit /b %RUN_EXIT%
)

echo [deploy] Deploy and startup completed.
exit /b 0

:usage
echo Usage: deploy-system.bat [--skip-pull] [--skip-start] [--no-clean-install]
echo   --skip-pull: do not fetch/pull from git
echo   --skip-start: only update deps/build; do not start services
echo   --no-clean-install: use npm install instead of npm ci
exit /b 1
