@echo off
echo Building for ESP32 CYD (Cheap Yellow Display)...
platformio run --target upload --target monitor --environment esp32_cyd

@REM Made with Bob
