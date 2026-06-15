@echo off
echo ========================================
echo Building for ESP32-CAM with Camera Support
echo ========================================
echo.

cd /d "%~dp0"

echo Cleaning previous build...
platformio run -e esp32cam --target clean

echo.
echo Building and uploading...
platformio run -e esp32cam --target upload

echo.
echo Opening serial monitor...
echo Press Ctrl+C to exit monitor
echo.
platformio device monitor -e esp32cam

pause

@REM Made with Bob
