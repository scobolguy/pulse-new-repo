#!/bin/bash
# Script to generate ANTLR4 parser for PulseSys (Pulse0)
ANTLR_JAR=antlr-4.9.2-complete.jar
GRAMMAR=../../languages/PulseSys/PulseSys.g4
OUTDIR=parser

if [ ! -f "$ANTLR_JAR" ]; then
  echo "Please download $ANTLR_JAR and place it in this directory."
  exit 1
fi

java -jar $ANTLR_JAR -Dlanguage=Python3 $GRAMMAR -o $OUTDIR
