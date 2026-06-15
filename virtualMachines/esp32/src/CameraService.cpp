#ifdef ENABLE_CAMERA

#include "CameraService.h"
#include <Arduino.h>

// Global instance
CameraService cameraService;

CameraService::CameraService() 
    : initialized(false), streaming(false), ffs(nullptr),
      previousFrame(nullptr), previousFrameSize(0), lastMotionTime(0),
      motionCallback(nullptr), lastFrameSize(0), lastCaptureTime(0), frameCount(0) {
    currentConfig = getDefaultConfig();
    motionConfig.enabled = false;
    motionConfig.threshold = MOTION_THRESHOLD;
    motionConfig.minBlocks = MOTION_MIN_BLOCKS;
    motionConfig.blockSize = MOTION_BLOCK_SIZE;
    motionConfig.cooldownMs = 1000;
}

CameraService::~CameraService() {
    end();
}

CameraConfig CameraService::getDefaultConfig() {
    CameraConfig config;
    config.resolution = RES_SVGA;
    config.quality = QUALITY_MEDIUM;
    config.verticalFlip = false;
    config.horizontalMirror = false;
    config.brightness = 0;
    config.contrast = 0;
    config.saturation = 0;
    return config;
}

bool CameraService::begin(const CameraConfig& config) {
    if (initialized) {
        Serial.println("[Camera] Already initialized");
        return true;
    }

    currentConfig = config;
    
    if (!initCamera()) {
        Serial.println("[Camera] Failed to initialize");
        return false;
    }

    initialized = true;
    Serial.println("[Camera] Initialized successfully");
    return true;
}

void CameraService::end() {
    if (!initialized) return;

    stopVideoStream();
    disableMotionDetection();
    
    if (previousFrame) {
        free(previousFrame);
        previousFrame = nullptr;
    }

    esp_camera_deinit();
    initialized = false;
    Serial.println("[Camera] Deinitialized");
}

bool CameraService::initCamera() {
    Serial.println("[Camera] ===== CAMERA INIT START =====");
    
    #ifdef BOARD_HAS_PSRAM
    Serial.println("[Camera] BOARD_HAS_PSRAM is DEFINED");
    Serial.printf("[Camera] PSRAM size: %d bytes\n", ESP.getPsramSize());
    Serial.printf("[Camera] Free PSRAM: %d bytes\n", ESP.getFreePsram());
    #else
    Serial.println("[Camera] BOARD_HAS_PSRAM is NOT DEFINED");
    #endif
    
    // Power cycle the camera module
    if (PWDN_GPIO_NUM != -1) {
        Serial.println("[Camera] Power cycling camera module...");
        pinMode(PWDN_GPIO_NUM, OUTPUT);
        digitalWrite(PWDN_GPIO_NUM, HIGH);  // Power down
        delay(100);
        digitalWrite(PWDN_GPIO_NUM, LOW);   // Power up
        delay(100);
        Serial.println("[Camera] Camera powered up");
    }
    
    // Initialize I2C pins explicitly before camera init
    Serial.println("[Camera] Initializing I2C pins...");
    pinMode(SIOD_GPIO_NUM, INPUT_PULLUP);
    pinMode(SIOC_GPIO_NUM, INPUT_PULLUP);
    delay(10);
    
    camera_config_t camera_config;
    camera_config.ledc_channel = LEDC_CHANNEL_0;
    camera_config.ledc_timer = LEDC_TIMER_0;
    camera_config.pin_d0 = Y2_GPIO_NUM;
    camera_config.pin_d1 = Y3_GPIO_NUM;
    camera_config.pin_d2 = Y4_GPIO_NUM;
    camera_config.pin_d3 = Y5_GPIO_NUM;
    camera_config.pin_d4 = Y6_GPIO_NUM;
    camera_config.pin_d5 = Y7_GPIO_NUM;
    camera_config.pin_d6 = Y8_GPIO_NUM;
    camera_config.pin_d7 = Y9_GPIO_NUM;
    camera_config.pin_xclk = XCLK_GPIO_NUM;
    camera_config.pin_pclk = PCLK_GPIO_NUM;
    camera_config.pin_vsync = VSYNC_GPIO_NUM;
    camera_config.pin_href = HREF_GPIO_NUM;
    camera_config.pin_sccb_sda = SIOD_GPIO_NUM;
    camera_config.pin_sccb_scl = SIOC_GPIO_NUM;
    camera_config.pin_pwdn = PWDN_GPIO_NUM;
    camera_config.pin_reset = RESET_GPIO_NUM;
    camera_config.xclk_freq_hz = 20000000;
    camera_config.sccb_i2c_port = 0;
    
    // Try lower XCLK frequency for better compatibility
    // Some camera modules need 10MHz instead of 20MHz
    Serial.println("[Camera] Using 10MHz XCLK for better compatibility");
    camera_config.xclk_freq_hz = 10000000;
    camera_config.pixel_format = PIXFORMAT_JPEG;
    
    // Try to initialize with different frame sizes for better compatibility
    Serial.printf("[Camera] Attempting init with resolution: %d, quality: %d\n",
                  currentConfig.resolution, currentConfig.quality);
    camera_config.frame_size = resolutionToFramesize(currentConfig.resolution);
    camera_config.jpeg_quality = currentConfig.quality;
    
    Serial.printf("[Camera] Pin config: SIOD=%d, SIOC=%d, PWDN=%d, RESET=%d\n",
                  SIOD_GPIO_NUM, SIOC_GPIO_NUM, PWDN_GPIO_NUM, RESET_GPIO_NUM);
    
    // PSRAM configuration for ESP32-CAM
    #ifdef BOARD_HAS_PSRAM
    camera_config.fb_location = CAMERA_FB_IN_PSRAM;
    camera_config.fb_count = 2;
    Serial.println("[Camera] Using PSRAM for frame buffers (fb_count=2)");
    #else
    camera_config.fb_location = CAMERA_FB_IN_DRAM;
    camera_config.fb_count = 1;
    Serial.println("[Camera] Using DRAM for frame buffers (fb_count=1)");
    #endif
    
    camera_config.grab_mode = CAMERA_GRAB_LATEST;

    Serial.println("[Camera] Calling esp_camera_init()...");
    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) {
        Serial.printf("[Camera] Init failed with error 0x%x\n", err);
        
        // Try with lower resolution as fallback
        if (camera_config.frame_size > FRAMESIZE_VGA) {
            Serial.println("[Camera] Retrying with VGA resolution...");
            camera_config.frame_size = FRAMESIZE_VGA;
            camera_config.jpeg_quality = 12;
            camera_config.fb_count = 1;
            
            err = esp_camera_init(&camera_config);
            if (err != ESP_OK) {
                Serial.printf("[Camera] Retry failed with error 0x%x\n", err);
                return false;
            }
            Serial.println("[Camera] Initialized with VGA fallback");
        } else {
            return false;
        }
    }

    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        Serial.printf("[Camera] Sensor detected: PID=0x%02x\n", s->id.PID);
        s->set_vflip(s, currentConfig.verticalFlip ? 1 : 0);
        s->set_hmirror(s, currentConfig.horizontalMirror ? 1 : 0);
        s->set_brightness(s, currentConfig.brightness);
        s->set_contrast(s, currentConfig.contrast);
        s->set_saturation(s, currentConfig.saturation);
    } else {
        Serial.println("[Camera] WARNING: Could not get sensor handle");
    }

    return true;
}

framesize_t CameraService::resolutionToFramesize(CameraResolution res) {
    switch (res) {
        case RES_QQVGA: return FRAMESIZE_QQVGA;
        case RES_QVGA:  return FRAMESIZE_QVGA;
        case RES_VGA:   return FRAMESIZE_VGA;
        case RES_SVGA:  return FRAMESIZE_SVGA;
        case RES_XGA:   return FRAMESIZE_XGA;
        case RES_SXGA:  return FRAMESIZE_SXGA;
        case RES_UXGA:  return FRAMESIZE_UXGA;
        default:        return FRAMESIZE_SVGA;
    }
}

bool CameraService::updateConfig(const CameraConfig& config) {
    if (!initialized) return false;

    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;

    s->set_framesize(s, resolutionToFramesize(config.resolution));
    s->set_quality(s, config.quality);
    s->set_vflip(s, config.verticalFlip ? 1 : 0);
    s->set_hmirror(s, config.horizontalMirror ? 1 : 0);
    s->set_brightness(s, config.brightness);
    s->set_contrast(s, config.contrast);
    s->set_saturation(s, config.saturation);

    currentConfig = config;
    return true;
}

bool CameraService::captureSnapshot(String& outPath, const char* filename) {
    if (!initialized) {
        Serial.println("[Camera] Not initialized");
        return false;
    }

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[Camera] Failed to capture frame");
        return false;
    }

    lastFrameSize = fb->len;
    lastCaptureTime = millis();
    frameCount++;

    String path = filename ? String(filename) : generateFilename("snapshot");
    if (!path.endsWith(".jpg")) {
        path += ".jpg";
    }

    bool success = saveFrameToFFS(fb, path);
    if (success) {
        outPath = path;
        Serial.printf("[Camera] Snapshot saved: %s (%d bytes)\n", path.c_str(), fb->len);
    }

    esp_camera_fb_return(fb);
    return success;
}

bool CameraService::captureToBuffer(uint8_t** buffer, size_t* length) {
    if (!initialized) return false;

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return false;

    *buffer = (uint8_t*)malloc(fb->len);
    if (!*buffer) {
        esp_camera_fb_return(fb);
        return false;
    }

    memcpy(*buffer, fb->buf, fb->len);
    *length = fb->len;

    lastFrameSize = fb->len;
    lastCaptureTime = millis();
    frameCount++;

    esp_camera_fb_return(fb);
    return true;
}

bool CameraService::captureToStream(Stream& stream) {
    if (!initialized) return false;

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return false;

    size_t written = stream.write(fb->buf, fb->len);
    
    lastFrameSize = fb->len;
    lastCaptureTime = millis();
    frameCount++;

    esp_camera_fb_return(fb);
    return written == fb->len;
}

bool CameraService::enableMotionDetection(const MotionDetectionConfig& config) {
    if (!initialized) return false;

    motionConfig = config;
    motionConfig.enabled = true;

    // Capture initial reference frame
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return false;

    if (previousFrame) {
        free(previousFrame);
    }

    previousFrameSize = fb->len;
    previousFrame = (uint8_t*)malloc(previousFrameSize);
    if (!previousFrame) {
        esp_camera_fb_return(fb);
        return false;
    }

    memcpy(previousFrame, fb->buf, previousFrameSize);
    esp_camera_fb_return(fb);

    Serial.println("[Camera] Motion detection enabled");
    return true;
}

void CameraService::disableMotionDetection() {
    motionConfig.enabled = false;
    if (previousFrame) {
        free(previousFrame);
        previousFrame = nullptr;
    }
    Serial.println("[Camera] Motion detection disabled");
}

bool CameraService::checkMotion(MotionEvent& event) {
    if (!initialized || !motionConfig.enabled) return false;

    unsigned long now = millis();
    if (now - lastMotionTime < motionConfig.cooldownMs) {
        return false;
    }

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return false;

    bool motionDetected = compareFrames(fb, event);

    if (motionDetected) {
        lastMotionTime = now;
        event.timestamp = now;

        // Save snapshot if motion detected
        String snapshotPath;
        if (captureSnapshot(snapshotPath, "motion")) {
            event.snapshotPath = snapshotPath;
        }

        // Update reference frame
        if (previousFrame && previousFrameSize == fb->len) {
            memcpy(previousFrame, fb->buf, fb->len);
        }

        // Trigger callback if set
        if (motionCallback) {
            motionCallback(event);
        }
    }

    esp_camera_fb_return(fb);
    return motionDetected;
}

bool CameraService::compareFrames(camera_fb_t* current, MotionEvent& event) {
    if (!previousFrame || previousFrameSize != current->len) {
        return false;
    }

    int changedBlocks = 0;
    int totalBlocks = 0;
    int blockSize = motionConfig.blockSize;

    // Simple block-based motion detection
    for (size_t i = 0; i < current->len; i += blockSize) {
        int diff = 0;
        for (int j = 0; j < blockSize && (i + j) < current->len; j++) {
            diff += abs((int)current->buf[i + j] - (int)previousFrame[i + j]);
        }
        
        totalBlocks++;
        if (diff / blockSize > motionConfig.threshold) {
            changedBlocks++;
        }
    }

    event.changedBlocks = changedBlocks;
    event.changePercentage = (float)changedBlocks / totalBlocks * 100.0f;

    return changedBlocks >= motionConfig.minBlocks;
}

void CameraService::setMotionCallback(void (*callback)(const MotionEvent&)) {
    motionCallback = callback;
}

bool CameraService::captureTimelapse(int intervalMs, int count, const char* prefix) {
    if (!initialized) return false;

    Serial.printf("[Camera] Starting timelapse: %d frames, %dms interval\n", count, intervalMs);

    for (int i = 0; i < count; i++) {
        String filename = String(prefix) + "_" + String(i) + ".jpg";
        String outPath;
        
        if (!captureSnapshot(outPath, filename.c_str())) {
            Serial.printf("[Camera] Timelapse failed at frame %d\n", i);
            return false;
        }

        if (i < count - 1) {
            delay(intervalMs);
        }
    }

    Serial.println("[Camera] Timelapse complete");
    return true;
}

bool CameraService::startVideoStream(int frameDelayMs) {
    if (!initialized || streaming) return false;
    streaming = true;
    Serial.printf("[Camera] Video streaming started (%dms delay)\n", frameDelayMs);
    return true;
}

void CameraService::stopVideoStream() {
    streaming = false;
    Serial.println("[Camera] Video streaming stopped");
}

bool CameraService::adjustBrightness(int level) {
    if (!initialized) return false;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_brightness(s, level);
    currentConfig.brightness = level;
    return true;
}

bool CameraService::adjustContrast(int level) {
    if (!initialized) return false;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_contrast(s, level);
    currentConfig.contrast = level;
    return true;
}

bool CameraService::adjustSaturation(int level) {
    if (!initialized) return false;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_saturation(s, level);
    currentConfig.saturation = level;
    return true;
}

bool CameraService::setFlip(bool vertical, bool horizontal) {
    if (!initialized) return false;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_vflip(s, vertical ? 1 : 0);
    s->set_hmirror(s, horizontal ? 1 : 0);
    currentConfig.verticalFlip = vertical;
    currentConfig.horizontalMirror = horizontal;
    return true;
}

String CameraService::getStatus() const {
    String status = "Camera Status:\n";
    status += "  Initialized: " + String(initialized ? "Yes" : "No") + "\n";
    status += "  Streaming: " + String(streaming ? "Yes" : "No") + "\n";
    status += "  Motion Detection: " + String(motionConfig.enabled ? "Enabled" : "Disabled") + "\n";
    status += "  Frame Count: " + String(frameCount) + "\n";
    status += "  Last Frame Size: " + String(lastFrameSize) + " bytes\n";
    status += "  Resolution: " + String(currentConfig.resolution) + "\n";
    status += "  Quality: " + String(currentConfig.quality) + "\n";
    return status;
}

String CameraService::generateFilename(const char* prefix) {
    char filename[64];
    snprintf(filename, sizeof(filename), "%s_%lu.jpg", prefix, millis());
    return String(filename);
}

bool CameraService::saveFrameToFFS(camera_fb_t* fb, const String& path) {
    if (!ffs) {
        Serial.println("[Camera] FFS not configured");
        return false;
    }

    // Use FFS write method instead of writeFile
    FFSStatus status = ffs->write(path, fb->buf, fb->len);
    return status == FFSStatus::OK;
}

#endif // ENABLE_CAMERA

// Made with Bob
