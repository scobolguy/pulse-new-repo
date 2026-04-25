@echo off
REM Deploy Pulse Compiler REST API using uvicorn (Windows Batch)
REM This script will download ANTLR if not present, generate Python files, and launch the API.
REM Usage: deploy_pulse_api.bat [host] [port]

setlocal
set ROOTDIR=%~dp0\..\..
set DSLDIR=%ROOTDIR%\pulse\dsl
set ANTLRDIR=%ROOTDIR%\antlr
set ANTLR_JAR=%ANTLRDIR%\antlr-4.13.2-complete.jar
set HOST=%1
if "%HOST%"=="" set HOST=0.0.0.0
set PORT=%2
if "%PORT%"=="" set PORT=8000

REM Create antlr directory if it doesn't exist
if not exist "%ANTLRDIR%" mkdir "%ANTLRDIR%"

REM Download ANTLR jar if not present
if not exist "%ANTLR_JAR%" (
	echo Downloading ANTLR4 jar...
	powershell -Command "Invoke-WebRequest -Uri https://www.antlr.org/download/antlr-4.13.2-complete.jar -OutFile '%ANTLR_JAR%'"
)

REM Change to DSL directory
cd /d "%DSLDIR%"

REM Generate ANTLR Python files if missing
if not exist PulseLexer.py (
	echo Generating ANTLR Python files...
	java -jar "%ANTLR_JAR%" -Dlanguage=Python3 Pulse.g4
)

REM Install dependencies if needed
pip show fastapi >nul 2>&1 || pip install fastapi
pip show uvicorn >nul 2>&1 || pip install uvicorn
pip show antlr4-python3-runtime >nul 2>&1 || pip install antlr4-python3-runtime

REM Run the API
uvicorn pulse_api:app --host %HOST% --port %PORT%
endlocal
