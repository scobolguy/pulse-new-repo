# ESP32-CAM Camera Service API Documentation

## Overview

The Camera Service provides comprehensive camera functionality for ESP32-CAM devices, including:
- Snapshot capture with FFS integration
- Motion detection with configurable sensitivity
- MJPEG video streaming
- Timelapse photography
- Real-time image adjustments (brightness, contrast, saturation)
- Configurable resolution and quality settings

## Conditional Compilation

The camera module is conditionally compiled using the `ENABLE_CAMERA` flag. This ensures it only builds for ESP32-CAM devices.

```cpp
#ifdef ENABLE_CAMERA
// Camera code here
#endif
```

## Configuration

### Camera Resolutions

| Resolution | Dimensions | Use Case |
|------------|------------|----------|
| RES_QQVGA  | 160x120    | Ultra-low bandwidth, motion detection |
| RES_QVGA   | 320x240    | Low bandwidth streaming |
| RES_VGA    | 640x480    | Standard quality |
| RES_SVGA   | 800x600    | Good balance (default) |
| RES_XGA    | 1024x768   | High quality |
| RES_SXGA   | 1280x1024  | Very high quality |
| RES_UXGA   | 1600x1200  | Maximum quality |

### Quality Settings

| Quality | JPEG Quality | Use Case |
|---------|--------------|----------|
| QUALITY_HIGH   | 10 | Best image quality, larger files |
| QUALITY_MEDIUM | 20 | Balanced (default) |
| QUALITY_LOW    | 30 | Smaller files, faster capture |

## HTTP API Endpoints

### 1. Get Camera Status

**Endpoint:** `GET /api/camera/status`

**Response:**
```json
{
  "initialized": true,
  "streaming": false,
  "motionDetection": false,
  "frameCount": 42,
  "lastFrameSize": 15234,
  "lastCaptureTime": 1234567890,
  "config": {
    "resolution": 3,
    "quality": 20,
    "verticalFlip": false,
    "horizontalMirror": false,
    "brightness": 0,
    "contrast": 0,
    "saturation": 0
  }
}
```

### 2. Capture Snapshot

**Endpoint:** `POST /api/camera/snapshot`

**Parameters:**
- `filename` (optional): Custom filename for the snapshot

**Request:**
```bash
curl -X POST http://esp32cam.local/api/camera/snapshot \
  -d "filename=my_photo.jpg"
```

**Response:**
```json
{
  "success": true,
  "path": "/snapshots/my_photo.jpg",
  "size": 15234,
  "timestamp": 1234567890
}
```

### 3. MJPEG Video Stream

**Endpoint:** `GET /api/camera/stream`

**Usage:**
```html
<img src="http://esp32cam.local/api/camera/stream" />
```

This endpoint provides a continuous MJPEG stream suitable for real-time video display in web browsers.

### 4. Start Video Streaming

**Endpoint:** `POST /api/camera/stream/start`

**Parameters:**
- `delay` (optional): Frame delay in milliseconds (default: 100ms)

**Request:**
```bash
curl -X POST http://esp32cam.local/api/camera/stream/start \
  -d "delay=50"
```

**Response:**
```json
{
  "success": true,
  "streaming": true
}
```

### 5. Stop Video Streaming

**Endpoint:** `POST /api/camera/stream/stop`

**Response:**
```json
{
  "success": true,
  "streaming": false
}
```

### 6. Update Camera Configuration

**Endpoint:** `POST /api/camera/config`

**Request Body:**
```json
{
  "resolution": 3,
  "quality": 20,
  "verticalFlip": false,
  "horizontalMirror": true,
  "brightness": 1,
  "contrast": 0,
  "saturation": -1
}
```

**Response:**
```json
{
  "success": true
}
```

### 7. Enable Motion Detection

**Endpoint:** `POST /api/camera/motion/enable`

**Request Body:**
```json
{
  "threshold": 20,
  "minBlocks": 10,
  "blockSize": 16,
  "cooldownMs": 1000
}
```

**Parameters:**
- `threshold`: Sensitivity threshold (0-255, lower = more sensitive)
- `minBlocks`: Minimum number of changed blocks to trigger motion
- `blockSize`: Size of comparison blocks in pixels
- `cooldownMs`: Minimum time between motion events

**Response:**
```json
{
  "success": true,
  "enabled": true
}
```

### 8. Disable Motion Detection

**Endpoint:** `POST /api/camera/motion/disable`

**Response:**
```json
{
  "success": true,
  "enabled": false
}
```

### 9. Check for Motion

**Endpoint:** `GET /api/camera/motion/check`

**Response (motion detected):**
```json
{
  "motionDetected": true,
  "timestamp": 1234567890,
  "changedBlocks": 25,
  "changePercentage": 12.5,
  "snapshotPath": "/motion/motion_1234567890.jpg"
}
```

**Response (no motion):**
```json
{
  "motionDetected": false
}
```

### 10. Capture Timelapse

**Endpoint:** `POST /api/camera/timelapse`

**Request Body:**
```json
{
  "intervalMs": 5000,
  "count": 20,
  "prefix": "sunset"
}
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "intervalMs": 5000
}
```

This will capture 20 images at 5-second intervals, saved as:
- `/timelapse/sunset_0.jpg`
- `/timelapse/sunset_1.jpg`
- ... etc.

### 11. Adjust Brightness

**Endpoint:** `POST /api/camera/adjust/brightness`

**Parameters:**
- `level`: Brightness level (-2 to 2)

**Request:**
```bash
curl -X POST http://esp32cam.local/api/camera/adjust/brightness \
  -d "level=1"
```

**Response:**
```json
{
  "success": true,
  "brightness": 1
}
```

### 12. Adjust Contrast

**Endpoint:** `POST /api/camera/adjust/contrast`

**Parameters:**
- `level`: Contrast level (-2 to 2)

**Response:**
```json
{
  "success": true,
  "contrast": 1
}
```

### 13. Adjust Saturation

**Endpoint:** `POST /api/camera/adjust/saturation`

**Parameters:**
- `level`: Saturation level (-2 to 2)

**Response:**
```json
{
  "success": true,
  "saturation": -1
}
```

## C++ API Usage

### Basic Initialization

```cpp
#ifdef ENABLE_CAMERA
#include "CameraService.h"
#include "camera_routes.h"

void setup() {
    // Initialize camera with default config
    CameraConfig config = CameraService::getDefaultConfig();
    config.resolution = RES_SVGA;
    config.quality = QUALITY_MEDIUM;
    
    if (cameraService.begin(config)) {
        Serial.println("Camera initialized");
        
        // Set FFS for snapshot storage
        cameraService.setFFS(&federatedFileSystem);
        
        // Setup HTTP routes
        setupCameraRoutes(server);
    }
}
#endif
```

### Capture Snapshot

```cpp
String snapshotPath;
if (cameraService.captureSnapshot(snapshotPath)) {
    Serial.printf("Snapshot saved: %s\n", snapshotPath.c_str());
}
```

### Motion Detection with Callback

```cpp
void onMotionDetected(const MotionEvent& event) {
    Serial.printf("Motion detected! Changed blocks: %d (%.1f%%)\n",
                  event.changedBlocks, event.changePercentage);
    Serial.printf("Snapshot saved: %s\n", event.snapshotPath.c_str());
}

void setup() {
    // Enable motion detection
    MotionDetectionConfig motionConfig;
    motionConfig.enabled = true;
    motionConfig.threshold = 20;
    motionConfig.minBlocks = 10;
    motionConfig.cooldownMs = 2000;
    
    cameraService.enableMotionDetection(motionConfig);
    cameraService.setMotionCallback(onMotionDetected);
}

void loop() {
    // Check for motion
    MotionEvent event;
    if (cameraService.checkMotion(event)) {
        // Motion detected, callback will be triggered
    }
    delay(100);
}
```

### Timelapse Photography

```cpp
// Capture 100 frames at 10-second intervals
cameraService.captureTimelapse(10000, 100, "sunrise");
```

### Video Streaming

```cpp
// Start streaming
cameraService.startVideoStream(100); // 100ms between frames

// ... stream is active ...

// Stop streaming
cameraService.stopVideoStream();
```

## Integration with Main Application

Add to `main.cpp`:

```cpp
#ifdef ENABLE_CAMERA
#include "CameraService.h"
#include "camera_routes.h"
#endif

void setup() {
    // ... other initialization ...
    
    #ifdef ENABLE_CAMERA
    // Initialize camera
    CameraConfig cameraConfig = CameraService::getDefaultConfig();
    cameraConfig.resolution = RES_SVGA;
    cameraConfig.quality = QUALITY_MEDIUM;
    
    if (cameraService.begin(cameraConfig)) {
        Serial.println("[Main] Camera initialized");
        cameraService.setFFS(&federatedFileSystem);
        setupCameraRoutes(server);
        
        // Optional: Enable motion detection
        MotionDetectionConfig motionConfig;
        motionConfig.enabled = true;
        motionConfig.threshold = 20;
        motionConfig.minBlocks = 10;
        motionConfig.cooldownMs = 2000;
        cameraService.enableMotionDetection(motionConfig);
    } else {
        Serial.println("[Main] Camera initialization failed");
    }
    #endif
}

void loop() {
    // ... other loop code ...
    
    #ifdef ENABLE_CAMERA
    // Check for motion periodically
    static unsigned long lastMotionCheck = 0;
    if (millis() - lastMotionCheck > 500) {
        MotionEvent event;
        cameraService.checkMotion(event);
        lastMotionCheck = millis();
    }
    #endif
}
```

## Use Cases

### 1. Security Camera with Motion Detection

```cpp
void onMotionDetected(const MotionEvent& event) {
    // Send alert to backend
    String alertJson = "{\"type\":\"motion\",\"timestamp\":" + 
                       String(event.timestamp) + 
                       ",\"snapshot\":\"" + event.snapshotPath + "\"}";
    brokerClient.sendMessage("security/alerts", alertJson.c_str());
}

cameraService.setMotionCallback(onMotionDetected);
```

### 2. Time-Lapse Construction Monitoring

```cpp
// Capture one frame every 5 minutes for 8 hours
void startConstructionMonitoring() {
    int framesPerDay = (8 * 60) / 5; // 96 frames
    cameraService.captureTimelapse(5 * 60 * 1000, framesPerDay, "construction");
}
```

### 3. Live Streaming Dashboard

```html
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Live View</title>
</head>
<body>
    <h1>Live Camera Feed</h1>
    <img src="http://esp32cam.local/api/camera/stream" 
         style="width: 100%; max-width: 800px;" />
    
    <div>
        <button onclick="captureSnapshot()">Take Snapshot</button>
        <button onclick="toggleMotionDetection()">Toggle Motion Detection</button>
    </div>
    
    <script>
        async function captureSnapshot() {
            const response = await fetch('/api/camera/snapshot', {
                method: 'POST'
            });
            const data = await response.json();
            alert('Snapshot saved: ' + data.path);
        }
        
        async function toggleMotionDetection() {
            const status = await fetch('/api/camera/status').then(r => r.json());
            const endpoint = status.motionDetection ? 
                '/api/camera/motion/disable' : 
                '/api/camera/motion/enable';
            await fetch(endpoint, { method: 'POST' });
        }
    </script>
</body>
</html>
```

## Performance Considerations

1. **Memory Usage**: Higher resolutions require more RAM. SVGA (800x600) is recommended for ESP32-CAM.

2. **Frame Rate**: Typical frame rates:
   - QQVGA: 25-30 FPS
   - QVGA: 20-25 FPS
   - VGA: 15-20 FPS
   - SVGA: 10-15 FPS
   - XGA+: 5-10 FPS

3. **Motion Detection**: Uses block-based comparison. Adjust `blockSize` for performance:
   - Smaller blocks (8-12): More accurate, slower
   - Larger blocks (16-32): Faster, less accurate

4. **Storage**: JPEG compression ratios:
   - QUALITY_HIGH: ~1:10 compression
   - QUALITY_MEDIUM: ~1:15 compression
   - QUALITY_LOW: ~1:20 compression

## Troubleshooting

### Camera Fails to Initialize

```cpp
if (!cameraService.begin()) {
    Serial.println("Camera init failed");
    // Check:
    // 1. Correct GPIO pins for your board
    // 2. Camera module properly connected
    // 3. Sufficient power supply (5V 2A recommended)
}
```

### Poor Image Quality

```cpp
// Adjust settings
cameraService.adjustBrightness(1);
cameraService.adjustContrast(1);
cameraService.setFlip(false, true); // Mirror horizontally
```

### Motion Detection Too Sensitive

```cpp
MotionDetectionConfig config;
config.threshold = 30;      // Increase threshold
config.minBlocks = 20;      // Require more changed blocks
config.cooldownMs = 5000;   // Longer cooldown
cameraService.enableMotionDetection(config);
```

## Future Enhancements

Potential additions:
- Face detection
- QR code scanning
- Image filters (grayscale, edge detection)
- Multi-camera support
- Cloud storage integration
- AI-powered object detection
- Scheduled captures
- Circular buffer for pre-motion recording

## License

Part of the ESP32 Virtual Machine project.