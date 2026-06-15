#ifdef ENABLE_CAMERA

#include "camera_routes.h"
#include "CameraService.h"
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

void setupCameraRoutes(AsyncWebServer& server) {
    // GET /camera - Serve camera viewer HTML page
    server.on("/camera", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (LittleFS.exists("/camera-viewer.html")) {
            request->send(LittleFS, "/camera-viewer.html", "text/html");
        } else {
            request->send(404, "text/plain", "Camera viewer page not found. Upload camera-viewer.html to LittleFS.");
        }
    });

    // GET /api/camera/capture - Get single JPEG image
    server.on("/api/camera/capture", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "text/plain", "Camera not initialized");
            return;
        }

        uint8_t* buffer = nullptr;
        size_t length = 0;

        if (!cameraService.captureToBuffer(&buffer, &length)) {
            request->send(500, "text/plain", "Failed to capture image");
            return;
        }

        AsyncWebServerResponse* response = request->beginResponse_P(
            200, "image/jpeg", buffer, length
        );
        response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        response->addHeader("Pragma", "no-cache");
        response->addHeader("Expires", "0");
        request->send(response);
        
        free(buffer);
    });

    // GET /api/camera/status - Get camera status
    server.on("/api/camera/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
            return;
        }

        JsonDocument doc;
        doc["initialized"] = cameraService.isInitialized();
        doc["streaming"] = cameraService.isStreaming();
        doc["motionDetection"] = cameraService.isMotionDetectionEnabled();
        doc["frameCount"] = cameraService.getFrameCount();
        doc["lastFrameSize"] = cameraService.getLastFrameSize();
        doc["lastCaptureTime"] = cameraService.getLastCaptureTime();

        CameraConfig config = cameraService.getConfig();
        JsonObject configObj = doc["config"].to<JsonObject>();
        configObj["resolution"] = config.resolution;
        configObj["quality"] = config.quality;
        configObj["verticalFlip"] = config.verticalFlip;
        configObj["horizontalMirror"] = config.horizontalMirror;
        configObj["brightness"] = config.brightness;
        configObj["contrast"] = config.contrast;
        configObj["saturation"] = config.saturation;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // POST /api/camera/snapshot - Capture a snapshot
    server.on("/api/camera/snapshot", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
            return;
        }

        String filename = "";
        if (request->hasParam("filename", true)) {
            filename = request->getParam("filename", true)->value();
        }

        String outPath;
        bool success = cameraService.captureSnapshot(outPath, filename.length() > 0 ? filename.c_str() : nullptr);

        JsonDocument doc;
        doc["success"] = success;
        if (success) {
            doc["path"] = outPath;
            doc["size"] = cameraService.getLastFrameSize();
            doc["timestamp"] = cameraService.getLastCaptureTime();
        } else {
            doc["error"] = "Failed to capture snapshot";
        }

        String response;
        serializeJson(doc, response);
        request->send(success ? 200 : 500, "application/json", response);
    });

    // GET /api/camera/stream - MJPEG video stream (simplified)
    server.on("/api/camera/stream", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "text/plain", "Camera not initialized");
            return;
        }

        // Send a simple message for now - streaming via chunked response is complex
        // Use /api/camera/capture with JavaScript refresh instead
        request->send(200, "text/html",
            "<html><body style='margin:0;background:#000;text-align:center;'>"
            "<h2 style='color:#fff;padding:20px;'>Use /api/camera/capture for images</h2>"
            "<img id='cam' style='max-width:100%;' src='/api/camera/capture'>"
            "<script>setInterval(()=>document.getElementById('cam').src='/api/camera/capture?t='+Date.now(),1000);</script>"
            "</body></html>"
        );
    });

    // POST /api/camera/stream/start - Start video streaming
    server.on("/api/camera/stream/start", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
            return;
        }

        int frameDelay = 100;
        if (request->hasParam("delay", true)) {
            frameDelay = request->getParam("delay", true)->value().toInt();
        }

        bool success = cameraService.startVideoStream(frameDelay);
        
        JsonDocument doc;
        doc["success"] = success;
        doc["streaming"] = cameraService.isStreaming();

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // POST /api/camera/stream/stop - Stop video streaming
    server.on("/api/camera/stream/stop", HTTP_POST, [](AsyncWebServerRequest* request) {
        cameraService.stopVideoStream();
        
        JsonDocument doc;
        doc["success"] = true;
        doc["streaming"] = cameraService.isStreaming();

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // POST /api/camera/config - Update camera configuration
    server.on("/api/camera/config", HTTP_POST, [](AsyncWebServerRequest* request) {}, 
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!cameraService.isInitialized()) {
                request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
                return;
            }

            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);
            
            if (error) {
                request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
                return;
            }

            CameraConfig config = cameraService.getConfig();
            
            if (doc["resolution"].is<int>()) {
                config.resolution = (CameraResolution)doc["resolution"].as<int>();
            }
            if (doc["quality"].is<int>()) {
                config.quality = (CameraQuality)doc["quality"].as<int>();
            }
            if (doc["verticalFlip"].is<bool>()) {
                config.verticalFlip = doc["verticalFlip"];
            }
            if (doc["horizontalMirror"].is<bool>()) {
                config.horizontalMirror = doc["horizontalMirror"];
            }
            if (doc["brightness"].is<int>()) {
                config.brightness = doc["brightness"];
            }
            if (doc["contrast"].is<int>()) {
                config.contrast = doc["contrast"];
            }
            if (doc["saturation"].is<int>()) {
                config.saturation = doc["saturation"];
            }

            bool success = cameraService.updateConfig(config);

            JsonDocument responseDoc;
            responseDoc["success"] = success;
            if (!success) {
                responseDoc["error"] = "Failed to update configuration";
            }

            String response;
            serializeJson(responseDoc, response);
            request->send(success ? 200 : 500, "application/json", response);
        }
    );

    // POST /api/camera/motion/enable - Enable motion detection
    server.on("/api/camera/motion/enable", HTTP_POST, [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!cameraService.isInitialized()) {
                request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
                return;
            }

            MotionDetectionConfig config;
            config.enabled = true;
            config.threshold = MOTION_THRESHOLD;
            config.minBlocks = MOTION_MIN_BLOCKS;
            config.blockSize = MOTION_BLOCK_SIZE;
            config.cooldownMs = 1000;

            if (len > 0) {
                JsonDocument doc;
                DeserializationError error = deserializeJson(doc, data, len);
                
                if (!error) {
                    if (doc["threshold"].is<int>()) {
                        config.threshold = doc["threshold"];
                    }
                    if (doc["minBlocks"].is<int>()) {
                        config.minBlocks = doc["minBlocks"];
                    }
                    if (doc["blockSize"].is<int>()) {
                        config.blockSize = doc["blockSize"];
                    }
                    if (doc["cooldownMs"].is<unsigned long>()) {
                        config.cooldownMs = doc["cooldownMs"];
                    }
                }
            }

            bool success = cameraService.enableMotionDetection(config);

            JsonDocument responseDoc;
            responseDoc["success"] = success;
            responseDoc["enabled"] = cameraService.isMotionDetectionEnabled();

            String response;
            serializeJson(responseDoc, response);
            request->send(success ? 200 : 500, "application/json", response);
        }
    );

    // POST /api/camera/motion/disable - Disable motion detection
    server.on("/api/camera/motion/disable", HTTP_POST, [](AsyncWebServerRequest* request) {
        cameraService.disableMotionDetection();
        
        JsonDocument doc;
        doc["success"] = true;
        doc["enabled"] = cameraService.isMotionDetectionEnabled();

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // GET /api/camera/motion/check - Check for motion
    server.on("/api/camera/motion/check", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized() || !cameraService.isMotionDetectionEnabled()) {
            request->send(503, "application/json", "{\"error\":\"Motion detection not enabled\"}");
            return;
        }

        MotionEvent event;
        bool motionDetected = cameraService.checkMotion(event);

        JsonDocument doc;
        doc["motionDetected"] = motionDetected;
        if (motionDetected) {
            doc["timestamp"] = event.timestamp;
            doc["changedBlocks"] = event.changedBlocks;
            doc["changePercentage"] = event.changePercentage;
            doc["snapshotPath"] = event.snapshotPath;
        }

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // POST /api/camera/timelapse - Capture timelapse
    server.on("/api/camera/timelapse", HTTP_POST, [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!cameraService.isInitialized()) {
                request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
                return;
            }

            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);
            
            if (error) {
                request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
                return;
            }

            int intervalMs = doc["intervalMs"] | 1000;
            int count = doc["count"] | 10;
            String prefix = doc["prefix"] | "timelapse";

            bool success = cameraService.captureTimelapse(intervalMs, count, prefix.c_str());

            JsonDocument responseDoc;
            responseDoc["success"] = success;
            responseDoc["count"] = count;
            responseDoc["intervalMs"] = intervalMs;

            String response;
            serializeJson(responseDoc, response);
            request->send(success ? 200 : 500, "application/json", response);
        }
    );

    // POST /api/camera/adjust/brightness - Adjust brightness
    server.on("/api/camera/adjust/brightness", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
            return;
        }

        if (!request->hasParam("level", true)) {
            request->send(400, "application/json", "{\"error\":\"Missing level parameter\"}");
            return;
        }

        int level = request->getParam("level", true)->value().toInt();
        bool success = cameraService.adjustBrightness(level);

        JsonDocument doc;
        doc["success"] = success;
        doc["brightness"] = level;

        String response;
        serializeJson(doc, response);
        request->send(success ? 200 : 500, "application/json", response);
    });

    // POST /api/camera/adjust/contrast - Adjust contrast
    server.on("/api/camera/adjust/contrast", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
            return;
        }

        if (!request->hasParam("level", true)) {
            request->send(400, "application/json", "{\"error\":\"Missing level parameter\"}");
            return;
        }

        int level = request->getParam("level", true)->value().toInt();
        bool success = cameraService.adjustContrast(level);

        JsonDocument doc;
        doc["success"] = success;
        doc["contrast"] = level;

        String response;
        serializeJson(doc, response);
        request->send(success ? 200 : 500, "application/json", response);
    });

    // POST /api/camera/adjust/saturation - Adjust saturation
    server.on("/api/camera/adjust/saturation", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!cameraService.isInitialized()) {
            request->send(503, "application/json", "{\"error\":\"Camera not initialized\"}");
            return;
        }

        if (!request->hasParam("level", true)) {
            request->send(400, "application/json", "{\"error\":\"Missing level parameter\"}");
            return;
        }

        int level = request->getParam("level", true)->value().toInt();
        bool success = cameraService.adjustSaturation(level);

        JsonDocument doc;
        doc["success"] = success;
        doc["saturation"] = level;

        String response;
        serializeJson(doc, response);
        request->send(success ? 200 : 500, "application/json", response);
    });

    Serial.println("[Camera Routes] Registered all camera API endpoints");
}

#endif // ENABLE_CAMERA

// Made with Bob
