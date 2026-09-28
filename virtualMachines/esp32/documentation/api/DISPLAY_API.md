# ESP32 CYD Display Service API Documentation

## Overview

The Display Service provides comprehensive display and touch functionality for ESP32 CYD (Cheap Yellow Display) devices with ILI9341 320x240 TFT and XPT2046 touch controller.

## Hardware Specifications

- **Display:** ILI9341 320x240 TFT LCD
- **Touch:** XPT2046 resistive touch controller
- **Board:** ESP32-2432S028R (CYD)
- **Interface:** SPI

## Pin Configuration

```cpp
TFT_MISO = 12
TFT_MOSI = 13
TFT_SCLK = 14
TFT_CS   = 15
TFT_DC   = 2
TFT_RST  = -1
TFT_BL   = 21
TOUCH_CS = 33
```

## Conditional Compilation

The display module is conditionally compiled using the `ENABLE_DISPLAY` flag:

```cpp
#ifdef ENABLE_DISPLAY
// Display code here
#endif
```

## C++ API Usage

### Basic Initialization

```cpp
#ifdef ENABLE_DISPLAY
#include "DisplayService.h"

void setup() {
    if (displayService.begin()) {
        Serial.println("Display initialized");
        
        // Show welcome message
        displayService.clear(COLOR_BLACK);
        displayService.setTextColor(COLOR_WHITE, COLOR_BLACK);
        displayService.setTextSize(TEXT_MEDIUM);
        displayService.setCursor(10, 10);
        displayService.println("Hello, World!");
    }
}
#endif
```

### Text Operations

```cpp
// Set text properties
displayService.setTextColor(COLOR_GREEN, COLOR_BLACK);
displayService.setTextSize(TEXT_LARGE);
displayService.setCursor(50, 100);

// Print text
displayService.print("Temperature: ");
displayService.println("25.5°C");

// Printf-style formatting
displayService.printf("Value: %d\n", 42);
```

### Graphics Operations

```cpp
// Draw shapes
displayService.drawLine(0, 0, 320, 240, COLOR_RED);
displayService.drawRect(10, 10, 100, 50, COLOR_BLUE);
displayService.fillRect(20, 20, 80, 30, COLOR_GREEN);
displayService.drawCircle(160, 120, 50, COLOR_YELLOW);
displayService.fillCircle(160, 120, 40, COLOR_CYAN);

// Draw rounded rectangles
displayService.drawRoundRect(50, 50, 100, 60, 10, COLOR_WHITE);
displayService.fillRoundRect(60, 60, 80, 40, 8, COLOR_ORANGE);

// Draw triangles
displayService.drawTriangle(160, 50, 100, 150, 220, 150, COLOR_MAGENTA);
displayService.fillTriangle(160, 60, 110, 140, 210, 140, COLOR_PURPLE);
```

### Touch Operations

```cpp
void loop() {
    if (displayService.touchAvailable()) {
        TouchPoint touch = displayService.getTouch();
        
        if (touch.pressed) {
            Serial.printf("Touch at: %d, %d\n", touch.x, touch.y);
            
            // Draw a circle where touched
            displayService.fillCircle(touch.x, touch.y, 5, COLOR_RED);
        }
    }
}
```

### Status Display Helpers

```cpp
// Show status messages
displayService.showInfo("System starting...");
delay(1000);

displayService.showSuccess("Connected to WiFi");
delay(1000);

displayService.showError("Sensor not found");
delay(1000);

// Custom status
displayService.showStatus("CUSTOM", "My message", COLOR_YELLOW);
```

### Color Operations

```cpp
// Predefined colors
COLOR_BLACK, COLOR_WHITE, COLOR_RED, COLOR_GREEN, COLOR_BLUE
COLOR_YELLOW, COLOR_CYAN, COLOR_MAGENTA, COLOR_GRAY
COLOR_ORANGE, COLOR_PURPLE

// Create custom colors (RGB565)
uint16_t myColor = displayService.color565(128, 64, 255);
displayService.fillRect(0, 0, 100, 100, myColor);
```

## Text Sizes

```cpp
TEXT_SMALL   = 1  // 8 pixels high
TEXT_MEDIUM  = 2  // 16 pixels high
TEXT_LARGE   = 3  // 24 pixels high
TEXT_XLARGE  = 4  // 32 pixels high
```

## Complete Example: Dashboard

```cpp
#ifdef ENABLE_DISPLAY

void displayDashboard() {
    displayService.clear(COLOR_BLACK);
    
    // Title bar
    displayService.fillRect(0, 0, 320, 30, COLOR_BLUE);
    displayService.setTextColor(COLOR_WHITE, COLOR_BLUE);
    displayService.setTextSize(TEXT_MEDIUM);
    displayService.setCursor(10, 8);
    displayService.print("ESP32 Dashboard");
    
    // Status section
    displayService.setTextColor(COLOR_CYAN, COLOR_BLACK);
    displayService.setTextSize(TEXT_SMALL);
    displayService.setCursor(10, 40);
    displayService.printf("IP: %s", WiFi.localIP().toString().c_str());
    
    displayService.setCursor(10, 60);
    displayService.printf("Uptime: %lu sec", millis() / 1000);
    
    displayService.setCursor(10, 80);
    displayService.printf("Free Heap: %d bytes", ESP.getFreeHeap());
    
    // Draw a graph
    displayService.drawRect(10, 100, 300, 120, COLOR_WHITE);
    displayService.setTextColor(COLOR_GREEN, COLOR_BLACK);
    displayService.setCursor(15, 105);
    displayService.print("Sensor Data");
    
    // Draw some sample data points
    for (int i = 0; i < 290; i += 10) {
        int y = 210 - random(0, 100);
        displayService.drawPixel(20 + i, y, COLOR_GREEN);
    }
}

void loop() {
    static unsigned long lastUpdate = 0;
    
    // Update display every second
    if (millis() - lastUpdate > 1000) {
        displayDashboard();
        lastUpdate = millis();
    }
    
    // Handle touch
    if (displayService.touchAvailable()) {
        TouchPoint touch = displayService.getTouch();
        if (touch.pressed) {
            // Touch detected - do something
            displayService.fillCircle(touch.x, touch.y, 3, COLOR_RED);
        }
    }
}

#endif
```

## Touch Calibration

```cpp
// Run touch calibration (follow on-screen instructions)
displayService.calibrateTouch();
```

## Advanced: Direct TFT Access

For advanced operations not covered by the DisplayService API:

```cpp
TFT_eSPI* tft = displayService.getTFT();
tft->setSwapBytes(true);
tft->pushImage(0, 0, 320, 240, myImageArray);
```

## Integration with Main Application

Add to `main.cpp`:

```cpp
#ifdef ENABLE_DISPLAY
#include "DisplayService.h"
#endif

void setup() {
    // ... other initialization ...
    
    #ifdef ENABLE_DISPLAY
    if (displayService.begin()) {
        Serial.println("[Main] Display initialized");
        
        // Show boot screen
        displayService.showInfo("Booting...");
        delay(1000);
        
        // Show system info
        displayService.clear(COLOR_BLACK);
        displayService.setTextColor(COLOR_GREEN, COLOR_BLACK);
        displayService.setTextSize(TEXT_MEDIUM);
        displayService.setCursor(10, 10);
        displayService.println("ESP32 VM Ready");
        displayService.setCursor(10, 40);
        displayService.printf("IP: %s", WiFi.localIP().toString().c_str());
    }
    #endif
}

void loop() {
    #ifdef ENABLE_DISPLAY
    // Update display periodically
    static unsigned long lastDisplayUpdate = 0;
    if (millis() - lastDisplayUpdate > 5000) {
        displayService.setCursor(10, 70);
        displayService.printf("Uptime: %lu", millis() / 1000);
        lastDisplayUpdate = millis();
    }
    
    // Handle touch input
    if (displayService.touchAvailable()) {
        TouchPoint touch = displayService.getTouch();
        if (touch.pressed) {
            Serial.printf("Touch: %d, %d\n", touch.x, touch.y);
        }
    }
    #endif
}
```

## Building for CYD

Use the dedicated environment:

```bash
# Windows
build-esp32cyd.bat

# Linux/Mac
pio run --target upload --environment esp32_cyd
```

## Performance Considerations

1. **Display Updates:** Full screen clears are slow. Use partial updates when possible.
2. **Touch Polling:** Check touch at reasonable intervals (50-100ms).
3. **Text Rendering:** Larger fonts are slower. Use appropriate sizes.
4. **Graphics:** Filled shapes are faster than outlined shapes with thick lines.

## Troubleshooting

### Display Not Working

```cpp
// Check initialization
if (!displayService.isInitialized()) {
    Serial.println("Display failed to initialize");
    // Check wiring and power supply
}
```

### Touch Not Responding

```cpp
// Run calibration
displayService.calibrateTouch();

// Check if touch is available
if (!displayService.touchAvailable()) {
    Serial.println("Touch not detected");
}
```

### Display Flickering

- Reduce update frequency
- Use double buffering for animations
- Avoid full screen clears

## Future Enhancements

Potential additions:
- Sprite support for smooth animations
- Image loading from SD card
- Custom fonts
- GUI widgets (buttons, sliders, etc.)
- Screen rotation support
- Power management
- Backlight PWM control

## License

Part of the ESP32 Virtual Machine project.

// Made with Bob