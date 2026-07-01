#ifdef ENABLE_PRINTER_SCANNER

#include "PrinterService.h"
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// External references
extern PrinterService* globalPrinterService;

/**
 * Register Printer/Scanner HTTP Routes
 * 
 * Provides REST API endpoints for:
 * - Device discovery and management
 * - Print operations
 * - Scan operations
 * - Status monitoring
 */

void registerPrinterRoutes(AsyncWebServer& server) {
    if (!globalPrinterService) {
        Serial.println("PrinterService not initialized - skipping route registration");
        return;
    }
    
    Serial.println("Registering Printer/Scanner routes...");
    
    // ========================================================================
    // GET /api/printers - List all printers and scanners
    // ========================================================================
    server.on("/api/printers", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!globalPrinterService) {
            request->send(503, "application/json", "{\"error\":\"Service not available\"}");
            return;
        }
        
        String json = globalPrinterService->toJson();
        request->send(200, "application/json", json);
    });
    
    // ========================================================================
    // GET /api/printers/:id - Get specific device info
    // ========================================================================
    server.on("^\\/api\\/printers\\/([a-zA-Z0-9\\-]+)$", HTTP_GET, 
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            PrinterDevice* device = globalPrinterService->getDevice(deviceId);
            
            if (!device) {
                request->send(404, "application/json", "{\"error\":\"Device not found\"}");
                return;
            }
            
            JsonDocument doc;
            doc["id"] = device->id;
            doc["name"] = device->name;
            doc["ipAddress"] = device->ipAddress;
            doc["port"] = device->port;
            doc["type"] = device->type;
            doc["online"] = device->online;
            doc["status"] = device->status;
            doc["lastSeen"] = device->lastSeen;
            
            String json;
            serializeJson(doc, json);
            request->send(200, "application/json", json);
        }
    );
    
    // ========================================================================
    // POST /api/printers - Add a new device
    // ========================================================================
    server.on("/api/printers", HTTP_POST, 
        [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);
            
            if (error) {
                request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
                return;
            }
            
            String id = doc["id"] | "";
            String name = doc["name"] | "";
            String ipAddress = doc["ipAddress"] | "";
            int port = doc["port"] | 9100;
            String type = doc["type"] | "printer";
            
            if (id.isEmpty() || name.isEmpty() || ipAddress.isEmpty()) {
                request->send(400, "application/json", 
                    "{\"error\":\"Missing required fields: id, name, ipAddress\"}");
                return;
            }
            
            bool success = globalPrinterService->addDevice(id, name, ipAddress, port, type);
            
            if (success) {
                request->send(201, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", "{\"error\":\"Failed to add device\"}");
            }
        }
    );
    
    // ========================================================================
    // DELETE /api/printers/:id - Remove a device
    // ========================================================================
    server.on("^\\/api\\/printers\\/([a-zA-Z0-9\\-]+)$", HTTP_DELETE,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            bool success = globalPrinterService->removeDevice(deviceId);
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(404, "application/json", "{\"error\":\"Device not found\"}");
            }
        }
    );
    
    // ========================================================================
    // POST /api/printers/discover - Discover devices on network
    // ========================================================================
    server.on("/api/printers/discover", HTTP_POST,
        [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);
            
            String networkPrefix = "192.168.1";
            if (!error && doc.containsKey("networkPrefix")) {
                networkPrefix = doc["networkPrefix"].as<String>();
            }
            
            // Start discovery in background (this can take time)
            bool started = globalPrinterService->discoverDevices(networkPrefix);
            
            if (started) {
                request->send(202, "application/json", 
                    "{\"success\":true,\"message\":\"Discovery started\"}");
            } else {
                request->send(500, "application/json", 
                    "{\"error\":\"Failed to start discovery\"}");
            }
        }
    );
    
    // ========================================================================
    // POST /api/printers/discover/upnp - Discover UPnP devices
    // ========================================================================
    server.on("/api/printers/discover/upnp", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            // Start UPnP discovery
            bool started = globalPrinterService->discoverUPnPDevices();
            
            if (started) {
                // Get discovered UPnP devices
                std::vector<UPnPDevice> upnpDevices = globalPrinterService->getUPnPDevices();
                
                JsonDocument doc;
                doc["success"] = true;
                doc["message"] = "UPnP discovery completed";
                doc["devicesFound"] = upnpDevices.size();
                
                JsonArray devicesArray = doc["devices"].to<JsonArray>();
                for (const auto& upnpDev : upnpDevices) {
                    JsonObject devObj = devicesArray.add<JsonObject>();
                    devObj["usn"] = upnpDev.usn;
                    devObj["friendlyName"] = upnpDev.friendlyName;
                    devObj["manufacturer"] = upnpDev.manufacturer;
                    devObj["modelName"] = upnpDev.modelName;
                    devObj["ipAddress"] = upnpDev.ipAddress;
                    devObj["port"] = upnpDev.port;
                    devObj["isPrinter"] = upnpDev.isPrinter;
                    devObj["isScanner"] = upnpDev.isScanner;
                }
                
                String json;
                serializeJson(doc, json);
                request->send(200, "application/json", json);
            } else {
                request->send(500, "application/json",
                    "{\"error\":\"Failed to start UPnP discovery\"}");
            }
        }
    );
    
    // ========================================================================
    // GET /api/printers/upnp - List UPnP devices
    // ========================================================================
    server.on("/api/printers/upnp", HTTP_GET,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            std::vector<UPnPDevice> upnpDevices = globalPrinterService->getUPnPDevices();
            
            JsonDocument doc;
            JsonArray devicesArray = doc["devices"].to<JsonArray>();
            
            for (const auto& upnpDev : upnpDevices) {
                JsonObject devObj = devicesArray.add<JsonObject>();
                devObj["usn"] = upnpDev.usn;
                devObj["friendlyName"] = upnpDev.friendlyName;
                devObj["manufacturer"] = upnpDev.manufacturer;
                devObj["modelName"] = upnpDev.modelName;
                devObj["modelNumber"] = upnpDev.modelNumber;
                devObj["serialNumber"] = upnpDev.serialNumber;
                devObj["ipAddress"] = upnpDev.ipAddress;
                devObj["port"] = upnpDev.port;
                devObj["deviceType"] = upnpDev.deviceType;
                devObj["isPrinter"] = upnpDev.isPrinter;
                devObj["isScanner"] = upnpDev.isScanner;
                devObj["lastSeen"] = upnpDev.lastSeen;
            }
            
            String json;
            serializeJson(doc, json);
            request->send(200, "application/json", json);
        }
    );
    
    // ========================================================================
    // POST /api/printers/:id/print - Send print job
    // ========================================================================
    server.on("^\\/api\\/printers\\/([a-zA-Z0-9\\-]+)\\/print$", HTTP_POST,
        [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);
            
            if (error) {
                request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
                return;
            }
            
            String content = doc["content"] | "";
            String type = doc["type"] | "text";
            
            if (content.isEmpty()) {
                request->send(400, "application/json", 
                    "{\"error\":\"Missing content field\"}");
                return;
            }
            
            bool success = false;
            
            if (type == "text") {
                success = globalPrinterService->sendTextDocument(deviceId, content);
            } else if (type == "pcl") {
                success = globalPrinterService->sendPCLCommand(deviceId, content);
            } else if (type == "raw") {
                success = globalPrinterService->sendRawData(
                    deviceId, (const uint8_t*)content.c_str(), content.length()
                );
            }
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", 
                    "{\"error\":\"Failed to send print job\"}");
            }
        }
    );
    
    // ========================================================================
    // POST /api/printers/:id/test - Print test page
    // ========================================================================
    server.on("^\\/api\\/printers\\/([a-zA-Z0-9\\-]+)\\/test$", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            JsonDocument params;
            
            bool success = globalPrinterService->handleAlexaPrintCommand(
                deviceId, "PrintTestPage", params
            );
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", 
                    "{\"error\":\"Failed to print test page\"}");
            }
        }
    );
    
    // ========================================================================
    // POST /api/printers/:id/cancel - Cancel current job
    // ========================================================================
    server.on("^\\/api\\/printers\\/([a-zA-Z0-9\\-]+)\\/cancel$", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            bool success = globalPrinterService->cancelJob(deviceId);
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", "{\"error\":\"Failed to cancel job\"}");
            }
        }
    );
    
    // ========================================================================
    // GET /api/printers/alexa/discovery - Get Alexa Discovery Response
    // ========================================================================
    server.on("/api/printers/alexa/discovery", HTTP_GET,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            JsonDocument discoveryDoc = globalPrinterService->getAlexaDiscoveryResponse();
            
            String json;
            serializeJson(discoveryDoc, json);
            request->send(200, "application/json", json);
        }
    );
    
    // ========================================================================
    // GET /api/printers/alexa/capabilities/:id - Get Device Alexa Capabilities
    // ========================================================================
    server.on("^\\/api\\/printers\\/alexa\\/capabilities\\/([a-zA-Z0-9\\-]+)$", HTTP_GET,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            JsonDocument capabilitiesDoc = globalPrinterService->getDeviceAlexaCapabilities(deviceId);
            
            if (capabilitiesDoc.containsKey("error")) {
                request->send(404, "application/json", "{\"error\":\"Device not found\"}");
                return;
            }
            
            String json;
            serializeJson(capabilitiesDoc, json);
            request->send(200, "application/json", json);
        }
    );
    
    // ========================================================================
    // POST /api/scanners/:id/scan - Start scan
    // ========================================================================
    server.on("^\\/api\\/scanners\\/([a-zA-Z0-9\\-]+)\\/scan$", HTTP_POST,
        [](AsyncWebServerRequest* request) {},
        nullptr,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);
            
            JsonDocument scanParams;
            if (!error) {
                scanParams["resolution"] = doc["resolution"] | 300;
                scanParams["format"] = doc["format"] | "PDF";
                scanParams["color"] = doc["color"] | "COLOR";
            }
            
            bool success = globalPrinterService->startScan(deviceId, scanParams);
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", 
                    "{\"error\":\"Failed to start scan\"}");
            }
        }
    );
    
    // ========================================================================
    // GET /api/printers/:id/status - Get device status
    // ========================================================================
    server.on("^\\/api\\/printers\\/([a-zA-Z0-9\\-]+)\\/status$", HTTP_GET,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            String deviceId = request->pathArg(0);
            String status = globalPrinterService->getDeviceStatus(deviceId);
            
            JsonDocument doc;
            doc["deviceId"] = deviceId;
            doc["status"] = status;
            doc["timestamp"] = millis();
            
            String json;
            serializeJson(doc, json);
            request->send(200, "application/json", json);
        }
    );
    
    // ========================================================================
    // POST /api/printers/config/save - Save configuration
    // ========================================================================
    server.on("/api/printers/config/save", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            bool success = globalPrinterService->saveConfig("/config/printers.json");
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", 
                    "{\"error\":\"Failed to save configuration\"}");
            }
        }
    );
    
    // ========================================================================
    // POST /api/printers/config/load - Load configuration
    // ========================================================================
    server.on("/api/printers/config/load", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            if (!globalPrinterService) {
                request->send(503, "application/json", "{\"error\":\"Service not available\"}");
                return;
            }
            
            bool success = globalPrinterService->loadConfig("/config/printers.json");
            
            if (success) {
                request->send(200, "application/json", "{\"success\":true}");
            } else {
                request->send(500, "application/json", 
                    "{\"error\":\"Failed to load configuration\"}");
            }
        }
    );
    
    Serial.println("Printer/Scanner routes registered successfully");
}

#endif // ENABLE_PRINTER_SCANNER

// Made with Bob