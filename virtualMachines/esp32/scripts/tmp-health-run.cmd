@echo off
node scripts\tmp-health-check.mjs http://127.0.0.1:4000/status http://127.0.0.1:5173/
