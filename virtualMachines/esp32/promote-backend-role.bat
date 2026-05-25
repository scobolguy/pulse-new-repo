@echo off
setlocal

set "ROOT=%~dp0"
set "PRIMARY_HOST=%~1"
set "BACKUP_HOST=%~2"

if "%PRIMARY_HOST%"=="" set "PRIMARY_HOST=127.0.0.1"

set "ARGS=-PrimaryHost %PRIMARY_HOST%"
if not "%BACKUP_HOST%"=="" set "ARGS=%ARGS% -BackupHost %BACKUP_HOST%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\promote-backend-role.ps1" %ARGS% -ApplyToFrontend
exit /b %ERRORLEVEL%
