@echo off
netstat -ano | findstr :4000
netstat -ano | findstr :5173
