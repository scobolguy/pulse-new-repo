#ifdef ENABLE_DISPLAY

#include <Arduino.h>
#include "serial_compat.h"
#include "DisplayService.h"
#include <stdarg.h>

// Global instance
DisplayService displayService;

// TFT_eSPI pin configuration is in User_Setup.h or platformio.ini

DisplayService::DisplayService()
    : initialized(false), currentBrightness(255)
#ifndef DISPLAY_NO_LVGL
      , touchCalibrated(false), touchType(TOUCH_NONE),
      lvglDisplay(nullptr), lvglBuf1(nullptr), lvglBuf2(nullptr), lvglTouchDev(nullptr)
#endif
{
}

DisplayService::~DisplayService() {
    end();
}

bool DisplayService::begin() {
    if (initialized) {
        SERIAL_PRINTLN("[Display] Already initialized");
        return true;
    }

    SERIAL_PRINTLN("[Display] ===== DISPLAY INIT START =====");
    SERIAL_PRINTF("[Display] TFT_MISO=%d, TFT_MOSI=%d, TFT_SCLK=%d\n", TFT_MISO, TFT_MOSI, TFT_SCLK);
    SERIAL_PRINTF("[Display] TFT_CS=%d, TFT_DC=%d, TFT_RST=%d, TFT_BL=%d\n", TFT_CS, TFT_DC, TFT_RST, TFT_BL);
    // Initialize backlight pin
    SERIAL_PRINTLN("[Display] Initializing backlight pin...");
    pinMode(TFT_BL, OUTPUT);
    digitalWrite(TFT_BL, HIGH); // Turn backlight ON
    SERIAL_PRINTLN("[Display] Backlight turned ON");

    SERIAL_PRINTLN("[Display] Calling tft.init()...");
    tft.init();
    SERIAL_PRINTLN("[Display] tft.init() completed");

    SERIAL_PRINTLN("[Display] Setting rotation to 1 (landscape)...");
    tft.setRotation(1); // Landscape mode

    SERIAL_PRINTLN("[Display] Filling screen black...");
    tft.fillScreen(COLOR_BLACK);
    SERIAL_PRINTLN("[Display] Screen cleared");
    
    // Set default text properties
    tft.setTextColor(COLOR_WHITE, COLOR_BLACK);
    tft.setTextSize(TEXT_MEDIUM);
    Serial.println("[Display] Text properties set");
    
#ifndef DISPLAY_NO_LVGL
    // Initialize touch
    Serial.println("[Display] Initializing touch...");
    initTouch();
#endif
    
    initialized = true;
    Serial.println("[Display] Display initialized successfully");
    
    // Show comprehensive test screen
    Serial.println("[Display] Drawing test screen...");
    clear(COLOR_BLACK);
    
    // Title
    fillRect(0, 0, DISPLAY_WIDTH, 30, COLOR_BLUE);
    setTextColor(COLOR_WHITE, COLOR_BLUE);
    setTextSize(TEXT_MEDIUM);
    setCursor(10, 8);
    println("CYD Display Test");
    
    // Display info
    setTextColor(COLOR_GREEN, COLOR_BLACK);
    setTextSize(TEXT_SMALL);
    setCursor(10, 40);
    printf("Resolution: %dx%d", DISPLAY_WIDTH, DISPLAY_HEIGHT);
    
    setCursor(10, 55);
    println("Driver: ILI9341");
    
    setCursor(10, 70);
    println("Touch: XPT2046");
    
    // Draw test graphics
    setTextColor(COLOR_YELLOW, COLOR_BLACK);
    setCursor(10, 90);
    println("Graphics Test:");
    
    // Color bars
    fillRect(10, 105, 30, 20, COLOR_RED);
    fillRect(45, 105, 30, 20, COLOR_GREEN);
    fillRect(80, 105, 30, 20, COLOR_BLUE);
    fillRect(115, 105, 30, 20, COLOR_YELLOW);
    fillRect(150, 105, 30, 20, COLOR_CYAN);
    fillRect(185, 105, 30, 20, COLOR_MAGENTA);
    
    // Shapes
    drawCircle(30, 150, 15, COLOR_WHITE);
    fillCircle(70, 150, 15, COLOR_ORANGE);
    drawRect(100, 135, 30, 30, COLOR_PURPLE);
    fillRect(145, 135, 30, 30, COLOR_CYAN);
    drawTriangle(190, 135, 175, 165, 205, 165, COLOR_GREEN);
    
    // Status
    setTextColor(COLOR_CYAN, COLOR_BLACK);
    setCursor(10, 180);
    println("Status: READY");
    
    setCursor(10, 200);
    setTextColor(COLOR_WHITE, COLOR_BLACK);
    println("Touch screen to test...");
    
    Serial.println("[Display] Test screen drawn");
    
    delay(3000);
    
    Serial.println("[Display] ===== DISPLAY INIT COMPLETE =====");
    
#ifndef DISPLAY_NO_LVGL
    // Initialize LVGL
    Serial.println("[Display] Initializing LVGL...");
    if (!initLVGL()) {
        Serial.println("[Display] ERROR: LVGL initialization failed");
        return false;
    }
    Serial.println("[Display] LVGL initialized successfully");
#endif
    
    return true;
}

#ifndef DISPLAY_NO_LVGL
bool DisplayService::initLVGL() {
    // Initialize LVGL
    lv_init();
    
    // Allocate display buffers (1/10 of screen size each)
    const size_t bufSize = (DISPLAY_WIDTH * DISPLAY_HEIGHT) / 10;
    lvglBuf1 = (lv_color_t*)heap_caps_malloc(bufSize * sizeof(lv_color_t), MALLOC_CAP_DMA);
    lvglBuf2 = (lv_color_t*)heap_caps_malloc(bufSize * sizeof(lv_color_t), MALLOC_CAP_DMA);
    
    if (!lvglBuf1 || !lvglBuf2) {
        SERIAL_PRINTLN("[Display] ERROR: Failed to allocate LVGL buffers");
        if (lvglBuf1) free(lvglBuf1);
        if (lvglBuf2) free(lvglBuf2);
        return false;
    }

    SERIAL_PRINTF("[Display] LVGL buffers allocated: %d bytes each\n", bufSize * sizeof(lv_color_t));
    
    // Initialize display buffer
    lv_disp_draw_buf_init(&lvglDrawBuf, lvglBuf1, lvglBuf2, bufSize);
    
    // Initialize display driver
    static lv_disp_drv_t disp_drv;
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = DISPLAY_WIDTH;
    disp_drv.ver_res = DISPLAY_HEIGHT;
    disp_drv.flush_cb = lvglFlushCallback;
    disp_drv.draw_buf = &lvglDrawBuf;
    disp_drv.user_data = this;
    
    lvglDisplay = lv_disp_drv_register(&disp_drv);
    if (!lvglDisplay) {
        SERIAL_PRINTLN("[Display] ERROR: Failed to register LVGL display driver");
        return false;
    }
    
    // Initialize touch input device
    static lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = lvglTouchCallback;
    indev_drv.user_data = this;
    
    lvglTouchDev = lv_indev_drv_register(&indev_drv);
    if (!lvglTouchDev) {
        SERIAL_PRINTLN("[Display] ERROR: Failed to register LVGL touch device");
        return false;
    }

    SERIAL_PRINTLN("[Display] LVGL display and touch drivers registered");
    return true;
}
#endif // DISPLAY_NO_LVGL

#ifndef DISPLAY_NO_LVGL
void DisplayService::lvglFlushCallback(lv_disp_drv_t* disp, const lv_area_t* area, lv_color_t* color_p) {
    DisplayService* service = (DisplayService*)disp->user_data;
    
    uint32_t w = (area->x2 - area->x1 + 1);
    uint32_t h = (area->y2 - area->y1 + 1);
    
    service->tft.startWrite();
    service->tft.setAddrWindow(area->x1, area->y1, w, h);
    service->tft.pushColors((uint16_t*)&color_p->full, w * h, true);
    service->tft.endWrite();
    
    lv_disp_flush_ready(disp);
}

void DisplayService::lvglTouchCallback(lv_indev_drv_t* indev, lv_indev_data_t* data) {
    DisplayService* service = (DisplayService*)indev->user_data;
    
    bool touched = false;
    uint16_t touchX = 0, touchY = 0;
    
#ifdef TOUCH_GT911
    if (service->touchType == TOUCH_CAPACITIVE && service->touchLib) {
        // GT911 capacitive touch via TouchLib
        if (service->touchLib->read()) {
            TP_Point t = service->touchLib->getPoint(0);
            touched = true;
            touchX = t.x;
            touchY = t.y;
        }
    }
    else
#endif
    if (service->touchType == TOUCH_RESISTIVE) {
        // XPT2046 resistive touch via TFT_eSPI
#ifdef TOUCH_CS
        touched = service->tft.getTouch(&touchX, &touchY);
#endif
    }
    
    if (touched) {
        data->state = LV_INDEV_STATE_PR;
        data->point.x = touchX;
        data->point.y = touchY;
    } else {
        data->state = LV_INDEV_STATE_REL;
    }
}

void DisplayService::update() {
    if (!initialized) return;
    lv_timer_handler();
}

void DisplayService::initTouch() {
#ifdef TOUCH_CS
    // XPT2046 resistive touch via TFT_eSPI (CYD)
    SERIAL_PRINTLN("[Display] Initializing XPT2046 resistive touch...");
    
    // Default calibration for CYD
    touchCalibration[0] = 300;
    touchCalibration[1] = 3600;
    touchCalibration[2] = 300;
    touchCalibration[3] = 3600;
    touchCalibration[4] = 1;
    
    tft.setTouch(touchCalibration);
    touchType = TOUCH_RESISTIVE;
    touchCalibrated = true;
    SERIAL_PRINTLN("[Display] XPT2046 resistive touch initialized");
#else
    SERIAL_PRINTLN("[Display] No touch controller configured (TOUCH_CS not defined)");
    touchType = TOUCH_NONE;
    touchCalibrated = false;
#endif
}

void DisplayService::end() {
    if (!initialized) return;
    
#ifndef DISPLAY_NO_LVGL
    // Clean up LVGL
    if (lvglBuf1) {
        free(lvglBuf1);
        lvglBuf1 = nullptr;
    }
    if (lvglBuf2) {
        free(lvglBuf2);
        lvglBuf2 = nullptr;
    }
#endif
    
    clear();
    initialized = false;
    SERIAL_PRINTLN("[Display] Display deinitialized");
}

void DisplayService::clear(uint16_t color) {
    if (!initialized) return;
    tft.fillScreen(color);
}

void DisplayService::setBrightness(uint8_t brightness) {
    currentBrightness = brightness;
    // Note: CYD backlight control via GPIO if available
    // For now, this is a placeholder
}

void DisplayService::sleep() {
    if (!initialized) return;
    tft.writecommand(0x10); // Sleep in
}

void DisplayService::wake() {
    if (!initialized) return;
    tft.writecommand(0x11); // Sleep out
    delay(120);
}

void DisplayService::setTextColor(uint16_t color, uint16_t bgColor) {
    if (!initialized) return;
    tft.setTextColor(color, bgColor);
}

void DisplayService::setTextSize(TextSize size) {
    if (!initialized) return;
    tft.setTextSize(size);
}

void DisplayService::setCursor(int16_t x, int16_t y) {
    if (!initialized) return;
    tft.setCursor(x, y);
}

void DisplayService::print(const char* text) {
    if (!initialized) return;
    tft.print(text);
}

void DisplayService::print(const String& text) {
    if (!initialized) return;
    tft.print(text);
}

void DisplayService::println(const char* text) {
    if (!initialized) return;
    tft.println(text);
}

void DisplayService::println(const String& text) {
    if (!initialized) return;
    tft.println(text);
}

void DisplayService::printf(const char* format, ...) {
    if (!initialized) return;
    
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    
    tft.print(buffer);
}

void DisplayService::drawPixel(int16_t x, int16_t y, uint16_t color) {
    if (!initialized) return;
    tft.drawPixel(x, y, color);
}

void DisplayService::drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    if (!initialized) return;
    tft.drawLine(x0, y0, x1, y1, color);
}

void DisplayService::drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (!initialized) return;
    tft.drawRect(x, y, w, h, color);
}

void DisplayService::fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (!initialized) return;
    tft.fillRect(x, y, w, h, color);
}

void DisplayService::drawCircle(int16_t x, int16_t y, int16_t r, uint16_t color) {
    if (!initialized) return;
    tft.drawCircle(x, y, r, color);
}

void DisplayService::fillCircle(int16_t x, int16_t y, int16_t r, uint16_t color) {
    if (!initialized) return;
    tft.fillCircle(x, y, r, color);
}

void DisplayService::drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
    if (!initialized) return;
    tft.drawTriangle(x0, y0, x1, y1, x2, y2, color);
}

void DisplayService::fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
    if (!initialized) return;
    tft.fillTriangle(x0, y0, x1, y1, x2, y2, color);
}

void DisplayService::drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    if (!initialized) return;
    tft.drawRoundRect(x, y, w, h, r, color);
}

void DisplayService::fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    if (!initialized) return;
    tft.fillRoundRect(x, y, w, h, r, color);
}

void DisplayService::drawBitmap(int16_t x, int16_t y, const uint8_t* bitmap, int16_t w, int16_t h, uint16_t color) {
    if (!initialized) return;
    tft.drawBitmap(x, y, bitmap, w, h, color);
}

void DisplayService::drawRGBBitmap(int16_t x, int16_t y, const uint16_t* bitmap, int16_t w, int16_t h) {
    if (!initialized) return;
    tft.pushImage(x, y, w, h, bitmap);
}

bool DisplayService::touchAvailable() {
    if (!initialized || !touchCalibrated) return false;
    
#ifdef TOUCH_CS
    if (touchType == TOUCH_RESISTIVE) {
        uint16_t x, y;
        return tft.getTouch(&x, &y);
    }
#endif
    
    return false;
}

TouchPoint DisplayService::getTouch() {
    TouchPoint point = {0, 0, false};
    
    if (!initialized || !touchCalibrated) return point;
    
#ifdef TOUCH_CS
    if (touchType == TOUCH_RESISTIVE) {
        uint16_t x, y;
        point.pressed = tft.getTouch(&x, &y);
        if (point.pressed) {
            point.x = x;
            point.y = y;
        }
    }
#endif
    
    return point;
}

void DisplayService::calibrateTouch() {
    if (!initialized) return;
    
#ifdef TOUCH_CS
    if (touchType == TOUCH_RESISTIVE) {
        SERIAL_PRINTLN("[Display] Starting resistive touch calibration...");
        tft.fillScreen(COLOR_BLACK);
        tft.setCursor(20, 0);
        tft.setTextFont(2);
        tft.setTextSize(1);
        tft.setTextColor(COLOR_WHITE, COLOR_BLACK);
        
        tft.println("Touch corners as indicated");
        
        tft.calibrateTouch(touchCalibration, COLOR_RED, COLOR_BLACK, 15);
        
        Serial.println("[Display] Touch calibration complete");
        touchCalibrated = true;
    }
    else
#endif
    {
        Serial.println("[Display] No touch controller available for calibration");
    }
}
#endif // DISPLAY_NO_LVGL

uint16_t DisplayService::color565(uint8_t r, uint8_t g, uint8_t b) {
    return tft.color565(r, g, b);
}

void DisplayService::showStatus(const char* title, const char* message, uint16_t color) {
    if (!initialized) return;
    
    clear(COLOR_BLACK);
    
    // Draw title bar
    fillRect(0, 0, DISPLAY_WIDTH, 30, COLOR_BLUE);
    setTextColor(COLOR_WHITE, COLOR_BLUE);
    setTextSize(TEXT_MEDIUM);
    setCursor(10, 8);
    print(title);
    
    // Draw message
    setTextColor(color, COLOR_BLACK);
    setTextSize(TEXT_MEDIUM);
    setCursor(10, 50);
    print(message);
}

void DisplayService::showError(const char* message) {
    showStatus("ERROR", message, COLOR_RED);
}

void DisplayService::showSuccess(const char* message) {
    showStatus("SUCCESS", message, COLOR_GREEN);
}

void DisplayService::showInfo(const char* message) {
    showStatus("INFO", message, COLOR_CYAN);
}

#endif // ENABLE_DISPLAY

// Made with Bob