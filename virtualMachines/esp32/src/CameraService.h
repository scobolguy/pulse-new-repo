#ifndef CAMERA_SERVICE_H
#define CAMERA_SERVICE_H

#ifdef ENABLE_CAMERA

#include <Arduino.h>
#include "esp_camera.h"
#include "ffs/FederatedFileSystem.h"

// Camera configuration for Freenove ESP32-WROVER CAM Board
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     21
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       19
#define Y4_GPIO_NUM       18
#define Y3_GPIO_NUM        5
#define Y2_GPIO_NUM        4
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Motion detection settings
#define MOTION_BLOCK_SIZE 16
#define MOTION_THRESHOLD 20
#define MOTION_MIN_BLOCKS 10

enum CameraResolution {
    RES_QQVGA = 0,  // 160x120
    RES_QVGA,       // 320x240
    RES_VGA,        // 640x480
    RES_SVGA,       // 800x600
    RES_XGA,        // 1024x768
    RES_SXGA,       // 1280x1024
    RES_UXGA        // 1600x1200
};

enum CameraQuality {
    QUALITY_HIGH = 10,
    QUALITY_MEDIUM = 20,
    QUALITY_LOW = 30
};

struct CameraConfig {
    CameraResolution resolution;
    CameraQuality quality;
    bool verticalFlip;
    bool horizontalMirror;
    int brightness;      // -2 to 2
    int contrast;        // -2 to 2
    int saturation;      // -2 to 2
};

struct MotionDetectionConfig {
    bool enabled;
    int threshold;
    int minBlocks;
    int blockSize;
    unsigned long cooldownMs;
};

struct MotionEvent {
    unsigned long timestamp;
    int changedBlocks;
    float changePercentage;
    String snapshotPath;
};

class CameraService {
public:
    CameraService();
    ~CameraService();

    // Initialization
    bool begin(const CameraConfig& config = getDefaultConfig());
    void end();
    bool isInitialized() const { return initialized; }

    // Configuration
    static CameraConfig getDefaultConfig();
    bool updateConfig(const CameraConfig& config);
    CameraConfig getConfig() const { return currentConfig; }

    // Capture operations
    bool captureSnapshot(String& outPath, const char* filename = nullptr);
    bool captureToBuffer(uint8_t** buffer, size_t* length);
    bool captureToStream(Stream& stream);

    // Motion detection
    bool enableMotionDetection(const MotionDetectionConfig& config);
    void disableMotionDetection();
    bool isMotionDetectionEnabled() const { return motionConfig.enabled; }
    bool checkMotion(MotionEvent& event);
    void setMotionCallback(void (*callback)(const MotionEvent&));

    // Advanced features
    bool captureTimelapse(int intervalMs, int count, const char* prefix = "timelapse");
    bool startVideoStream(int frameDelayMs = 100);
    void stopVideoStream();
    bool isStreaming() const { return streaming; }

    // Image processing
    bool adjustBrightness(int level);  // -2 to 2
    bool adjustContrast(int level);    // -2 to 2
    bool adjustSaturation(int level);  // -2 to 2
    bool setFlip(bool vertical, bool horizontal);

    // Status and diagnostics
    String getStatus() const;
    size_t getLastFrameSize() const { return lastFrameSize; }
    unsigned long getLastCaptureTime() const { return lastCaptureTime; }
    int getFrameCount() const { return frameCount; }

    // FFS integration
    void setFFS(FederatedFileSystem* ffs) { this->ffs = ffs; }

private:
    bool initialized;
    bool streaming;
    CameraConfig currentConfig;
    MotionDetectionConfig motionConfig;
    FederatedFileSystem* ffs;
    
    // Motion detection state
    uint8_t* previousFrame;
    size_t previousFrameSize;
    unsigned long lastMotionTime;
    void (*motionCallback)(const MotionEvent&);
    
    // Statistics
    size_t lastFrameSize;
    unsigned long lastCaptureTime;
    int frameCount;
    
    // Helper methods
    bool initCamera();
    framesize_t resolutionToFramesize(CameraResolution res);
    bool compareFrames(camera_fb_t* current, MotionEvent& event);
    String generateFilename(const char* prefix = "snapshot");
    bool saveFrameToFFS(camera_fb_t* fb, const String& path);
};

// Global camera service instance
extern CameraService cameraService;

#endif // ENABLE_CAMERA
#endif // CAMERA_SERVICE_H

// Made with Bob
