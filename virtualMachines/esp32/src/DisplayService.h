#ifndef DISPLAY_SERVICE_H
#define DISPLAY_SERVICE_H

#ifdef ENABLE_DISPLAY

#include <Arduino.h>
#include <TFT_eSPI.h>

#ifndef DISPLAY_NO_LVGL
#include <lvgl.h>
#endif

// Display configuration
// Supports multiple boards:
// - CYD (Cheap Yellow Display) ESP32-2432S028R: ILI9341 320x240 with XPT2046 resistive touch
// - GUITON JC4827E543: ST7262 480x272 with GT911 capacitive touch

// Display dimensions
#define DISPLAY_WIDTH  320
#define DISPLAY_HEIGHT 240

// Colors (RGB565)
#define COLOR_BLACK   0x0000
#define COLOR_WHITE   0xFFFF
#define COLOR_RED     0xF800
#define COLOR_GREEN   0x07E0
#define COLOR_BLUE    0x001F
#define COLOR_YELLOW  0xFFE0
#define COLOR_CYAN    0x07FF
#define COLOR_MAGENTA 0xF81F
#define COLOR_GRAY    0x8410
#define COLOR_ORANGE  0xFD20
#define COLOR_PURPLE  0x8010

// Text sizes
enum TextSize {
    TEXT_SMALL = 1,
    TEXT_MEDIUM = 2,
    TEXT_LARGE = 3,
    TEXT_XLARGE = 4
};

// Touch point structure
struct TouchPoint {
    int16_t x;
    int16_t y;
    bool pressed;
};

class DisplayService {
public:
    DisplayService();
    ~DisplayService();

    // Initialization
    bool begin();
    void end();
    bool isInitialized() const { return initialized; }

    // Display control
    void clear(uint16_t color = COLOR_BLACK);
    void setBrightness(uint8_t brightness); // 0-255
    void sleep();
    void wake();

    // Text operations
    void setTextColor(uint16_t color, uint16_t bgColor = COLOR_BLACK);
    void setTextSize(TextSize size);
    void setCursor(int16_t x, int16_t y);
    void print(const char* text);
    void print(const String& text);
    void println(const char* text);
    void println(const String& text);
    void printf(const char* format, ...);

    // Graphics operations
    void drawPixel(int16_t x, int16_t y, uint16_t color);
    void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
    void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void drawCircle(int16_t x, int16_t y, int16_t r, uint16_t color);
    void fillCircle(int16_t x, int16_t y, int16_t r, uint16_t color);
    void drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);
    void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);
    void drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color);
    void fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color);

    // Image operations
    void drawBitmap(int16_t x, int16_t y, const uint8_t* bitmap, int16_t w, int16_t h, uint16_t color);
    void drawRGBBitmap(int16_t x, int16_t y, const uint16_t* bitmap, int16_t w, int16_t h);
    bool showJpeg(const uint8_t* data, size_t length, int16_t x = 0, int16_t y = 0);

#ifndef DISPLAY_NO_LVGL
    // Touch operations (only with LVGL)
    bool touchAvailable();
    TouchPoint getTouch();
    void calibrateTouch();
#endif

    // Utility functions
    uint16_t color565(uint8_t r, uint8_t g, uint8_t b);
    int16_t width() const { return DISPLAY_WIDTH; }
    int16_t height() const { return DISPLAY_HEIGHT; }

    // Status display helpers
    void showStatus(const char* title, const char* message, uint16_t color = COLOR_WHITE);
    void showError(const char* message);
    void showSuccess(const char* message);
    void showInfo(const char* message);

    // Get TFT instance for advanced operations
    TFT_eSPI* getTFT() { return &tft; }
    
#ifndef DISPLAY_NO_LVGL
    // Get LVGL display for DDLRenderer
    lv_disp_t* getLVGLDisplay() { return lvglDisplay; }
    
    // LVGL update (call in loop)
    void update();
#endif

private:
    bool initialized;
    TFT_eSPI tft;
    uint8_t currentBrightness;
    
#ifndef DISPLAY_NO_LVGL
    // Touch calibration data (for resistive touch)
    uint16_t touchCalibration[5];
    bool touchCalibrated;
    
    // Touch type detection
    enum TouchType {
        TOUCH_NONE,
        TOUCH_RESISTIVE,  // XPT2046 via TFT_eSPI
        TOUCH_CAPACITIVE  // GT911 via TouchLib
    };
    TouchType touchType;
    
    // LVGL objects
    lv_disp_t* lvglDisplay;
    lv_disp_draw_buf_t lvglDrawBuf;
    lv_color_t* lvglBuf1;
    lv_color_t* lvglBuf2;
    lv_indev_t* lvglTouchDev;
    
    void initTouch();
    TouchPoint readRawTouch();
    bool initLVGL();
    
    // LVGL callbacks
    static void lvglFlushCallback(lv_disp_drv_t* disp, const lv_area_t* area, lv_color_t* color_p);
    static void lvglTouchCallback(lv_indev_drv_t* indev, lv_indev_data_t* data);
#endif
};

// Global display service instance
extern DisplayService displayService;

#endif // ENABLE_DISPLAY
#endif // DISPLAY_SERVICE_H

// Made with Bob