# Camera Service Integration Guide

## Problem
After building for ESP32-CAM, the camera API returns "Not Found" because the camera service isn't initialized in `main.cpp`.

## Solution
Add camera initialization code to `main.cpp` in three places.

---

## Step 1: Add Includes (Top of main.cpp)

Find the section with other includes (around line 30-36) and add:

```cpp
#ifdef ENABLE_PMACHINE
#include "pmachine.h"
#include "pmachine_routes.h"
#endif

// ADD THESE LINES:
#ifdef ENABLE_CAMERA
#include "CameraService.h"
#include "camera_routes.h"
#endif
```

---

## Step 2: Initialize Camera in setup()

Find the `setup()` function (around line 1765) and add camera initialization **AFTER** the FederatedFileSystem is initialized (around line 1993).

Look for this section:
```cpp
#ifdef ENABLE_PMACHINE
    pm.setFFS(&federatedFS);
#endif
```

Add the camera initialization right after:

```cpp
#ifdef ENABLE_PMACHINE
    pm.setFFS(&federatedFS);
#endif

// ADD THESE LINES:
#ifdef ENABLE_CAMERA
    Serial.println("[BOOT] Initializing camera service...");
    CameraConfig cameraConfig = CameraService::getDefaultConfig();
    cameraConfig.resolution = RES_SVGA;  // 800x600
    cameraConfig.quality = QUALITY_MEDIUM;
    
    if (cameraService.begin(cameraConfig)) {
        Serial.println("[CAMERA] Camera initialized successfully");
        cameraService.setFFS(&federatedFS);
        
        // Optional: Enable motion detection
        // MotionDetectionConfig motionConfig;
        // motionConfig.enabled = true;
        // motionConfig.threshold = 20;
        // motionConfig.minBlocks = 10;
        // motionConfig.cooldownMs = 2000;
        // cameraService.enableMotionDetection(motionConfig);
    } else {
        Serial.println("[CAMERA] Camera initialization failed");
    }
#endif
```

---

## Step 3: Register Camera Routes in setupWebServer()

Find the `setupWebServer()` function (around line 871).

At the END of this function (before the closing brace), add:

```cpp
    // ... existing routes ...
    
    // ADD THESE LINES AT THE END:
    #ifdef ENABLE_CAMERA
    setupCameraRoutes(server);
    Serial.println("[CAMERA] Camera routes registered");
    #endif
    
    server.begin();
    Serial.println("HTTP server started");
}
```

---

## Step 4: Update Advertised Services (Optional)

Find the section that builds the "Advertised services" string (around line 1995-2008).

Update it to include camera:

```cpp
String advertisedServices = "[BOOT] Advertised services: ";
bool firstAdvertised = true;
if (ffsUp) {
    advertisedServices += "FFS";
    firstAdvertised = false;
}
#ifdef ENABLE_PMACHINE
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "pmachine";
    advertisedServices += ", GenericRouterService";
    firstAdvertised = false;
#endif
// ADD THESE LINES:
#ifdef ENABLE_CAMERA
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "camera";
    firstAdvertised = false;
#endif
if (firstAdvertised) advertisedServices += "none";
Serial.println(advertisedServices);
```

---

## Complete Integration Example

Here's what the key sections should look like after integration:

### Includes Section:
```cpp
#include "ffs/FederatedFileSystem.h"
#include "ffs/FederatedFileSystemRoutes.h"
#include "profile_config.h"
#include "provision_routes.h"
#include "cluster_routes.h"
#include "udp_announcement.h"
#include "udp_runtime.h"
#include "main_globals.h"

#ifdef ENABLE_PMACHINE
#include "pmachine.h"
#include "pmachine_routes.h"
#endif

#ifdef ENABLE_CAMERA
#include "CameraService.h"
#include "camera_routes.h"
#endif
```

### setup() Function (after FFS initialization):
```cpp
#ifdef ENABLE_PMACHINE
    pm.setFFS(&federatedFS);
#endif

#ifdef ENABLE_CAMERA
    Serial.println("[BOOT] Initializing camera service...");
    CameraConfig cameraConfig = CameraService::getDefaultConfig();
    cameraConfig.resolution = RES_SVGA;
    cameraConfig.quality = QUALITY_MEDIUM;
    
    if (cameraService.begin(cameraConfig)) {
        Serial.println("[CAMERA] Camera initialized successfully");
        cameraService.setFFS(&federatedFS);
    } else {
        Serial.println("[CAMERA] Camera initialization failed");
    }
#endif

String advertisedServices = "[BOOT] Advertised services: ";
// ... rest of the code
```

### setupWebServer() Function (at the end):
```cpp
void setupWebServer() {
    // ... all existing routes ...
    
    #ifdef ENABLE_CAMERA
    setupCameraRoutes(server);
    Serial.println("[CAMERA] Camera routes registered");
    #endif
    
    server.begin();
    Serial.println("HTTP server started");
}
```

---

## Rebuild and Test

After making these changes:

1. **Rebuild:**
   ```bash
   platformio run -e esp32cam
   ```

2. **Upload:**
   ```bash
   platformio run -e esp32cam --target upload
   ```

3. **Monitor:**
   ```bash
   platformio device monitor -e esp32cam
   ```

4. **Check Serial Output:**
   You should see:
   ```
   [BOOT] Initializing camera service...
   [CAMERA] Camera initialized successfully
   [CAMERA] Camera routes registered
   [BOOT] Advertised services: FFS, pmachine, GenericRouterService, camera
   ```

5. **Test API:**
   ```bash
   curl http://192.168.1.100/api/camera/status
   ```

---

## Troubleshooting

### "Not Found" Error
- Camera routes not registered → Check `setupWebServer()` has camera routes
- Camera not initialized → Check serial output for initialization messages

### Camera Initialization Failed
- Check camera module is properly connected
- Verify power supply is adequate (5V 2A minimum)
- Check GPIO pins match your board (AI-Thinker by default)

### Compilation Errors
- Missing includes → Add camera headers at top of main.cpp
- Undefined references → Ensure `ENABLE_CAMERA` flag is set in platformio.ini

---

## Quick Copy-Paste Sections

### Section 1 (After line 36):
```cpp
#ifdef ENABLE_CAMERA
#include "CameraService.h"
#include "camera_routes.h"
#endif
```

### Section 2 (After line 1993):
```cpp
#ifdef ENABLE_CAMERA
    Serial.println("[BOOT] Initializing camera service...");
    CameraConfig cameraConfig = CameraService::getDefaultConfig();
    cameraConfig.resolution = RES_SVGA;
    cameraConfig.quality = QUALITY_MEDIUM;
    if (cameraService.begin(cameraConfig)) {
        Serial.println("[CAMERA] Camera initialized successfully");
        cameraService.setFFS(&federatedFS);
    } else {
        Serial.println("[CAMERA] Camera initialization failed");
    }
#endif
```

### Section 3 (End of setupWebServer()):
```cpp
#ifdef ENABLE_CAMERA
    setupCameraRoutes(server);
    Serial.println("[CAMERA] Camera routes registered");
#endif
```

That's it! After adding these three sections, rebuild and upload, and your camera API will work.