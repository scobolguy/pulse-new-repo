@echo off
REM Script to generate ANTLR4 parser for PulseSys (Pulse0)
set ANTLR_JAR=antlr-4.9.2-complete.jar
set GRAMMAR=..\..\languages\PulseSys\PulseSys.g4
set OUTDIR=parser

if not exist %ANTLR_JAR% (
  echo Please download %ANTLR_JAR% and place it in this directory.
  exit /b 1
)

java -jar %ANTLR_JAR% -Dlanguage=Python3 %GRAMMAR% -o %OUTDIR%
