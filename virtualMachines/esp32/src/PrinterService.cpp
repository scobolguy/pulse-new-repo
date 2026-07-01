#ifdef ENABLE_PRINTER_SCANNER

#include "PrinterService.h"
#include <LittleFS.h>

// Global instance
PrinterService* globalPrinterService = nullptr;

// PCL Commands
#define PCL_RESET "\x1B" "E"
#define PCL_STATUS "\x1B" "*s1M"
#define ESCP_RESET "\x1B" "@"

// Scanner Commands (TWAIN/SANE over network)
#define SCANNER_STATUS_CMD "STATUS\r\n"
#define SCANNER_SCAN_CMD "SCAN\r\n"
#define SCANNER_CANCEL_CMD "CANCEL\r\n"

PrinterService::PrinterService() 
    : statusCallback(nullptr), lastDiscovery(0), lastStatusCheck(0) {
}

PrinterService::~PrinterService() {
    devices.clear();
    activeJobs.clear();
}

bool PrinterService::begin() {
    Serial.println("PrinterService: Initializing...");
    
    // Initialize UPnP discovery
    if (!upnpDiscovery.begin()) {
        Serial.println("PrinterService: Warning - UPnP discovery failed to initialize");
    }
    
    // Set up UPnP device discovered callback
    upnpDiscovery.setDeviceDiscoveredCallback([](const UPnPDevice& upnpDevice) {
        if (globalPrinterService) {
            globalPrinterService->onUPnPDeviceDiscovered(upnpDevice);
        }
    });
    
    // Load configuration if available
    if (LittleFS.exists("/config/printers.json")) {
        loadConfig("/config/printers.json");
    }
    
    // Start initial discovery after 5 seconds (give WiFi time to stabilize)
    lastDiscovery = millis() - 295000; // Will trigger in 5 seconds
    lastStatusCheck = millis();
    
    Serial.println("PrinterService: Initialized successfully");
    Serial.println("PrinterService: Auto-discovery will start in 5 seconds...");
    return true;
}

void PrinterService::loop() {
    unsigned long now = millis();
    
    // Auto-discovery every 5 minutes (300000 ms)
    if (now - lastDiscovery > 300000) {
        Serial.println("PrinterService: Starting automatic device discovery...");
        
        // Discover UPnP devices (TVs, printers, etc.)
        discoverUPnPDevices();
        
        // Also scan local network for printers on port 9100
        // Get network prefix from WiFi
        IPAddress ip = WiFi.localIP();
        String networkPrefix = String(ip[0]) + "." + String(ip[1]) + "." + String(ip[2]);
        discoverDevices(networkPrefix);
        
        lastDiscovery = now;
        Serial.printf("PrinterService: Discovery complete. Total devices: %d\n", getDeviceCount());
    }
    
    // Periodic status check every 30 seconds
    if (now - lastStatusCheck > 30000) {
        updateAllDeviceStatus();
        lastStatusCheck = now;
    }
}

// ============================================================================
// Device Management
// ============================================================================

bool PrinterService::addDevice(const String& id, const String& name, 
                                const String& ipAddress, int port, const String& type) {
    PrinterDevice device;
    device.id = id;
    device.name = name;
    device.ipAddress = ipAddress;
    device.port = port;
    device.type = type;
    device.online = false;
    device.lastSeen = 0;
    device.status = "unknown";
    
    devices[id] = device;
    
    Serial.printf("PrinterService: Added %s device %s (%s) at %s:%d\n", 
                  type.c_str(), id.c_str(), name.c_str(), ipAddress.c_str(), port);
    
    // Check if device is online
    checkDeviceOnline(id);
    
    return true;
}

bool PrinterService::removeDevice(const String& id) {
    auto it = devices.find(id);
    if (it != devices.end()) {
        Serial.printf("PrinterService: Removed device %s\n", id.c_str());
        devices.erase(it);
        return true;
    }
    return false;
}

PrinterDevice* PrinterService::getDevice(const String& id) {
    auto it = devices.find(id);
    if (it != devices.end()) {
        return &(it->second);
    }
    return nullptr;
}

std::vector<PrinterDevice> PrinterService::getAllDevices() {
    std::vector<PrinterDevice> result;
    for (auto& pair : devices) {
        result.push_back(pair.second);
    }
    return result;
}

// ============================================================================
// Discovery
// ============================================================================

bool PrinterService::discoverDevices(const String& networkPrefix) {
    Serial.printf("PrinterService: Starting discovery on %s.x\n", networkPrefix.c_str());
    
    int discovered = 0;
    
    // Scan common printer/scanner IP range (1-254)
    for (int i = 1; i <= 254; i++) {
        String ip = networkPrefix + "." + String(i);
        
        // Check for printer on port 9100
        if (probePort(ip, 9100)) {
            String deviceId = generateDeviceId(ip, "printer");
            
            // Check if device already exists
            if (devices.find(deviceId) == devices.end()) {
                addDevice(deviceId, "Printer-" + String(i), ip, 9100, "printer");
                discovered++;
            }
        }
        
        // Check for scanner on port 9100 (some scanners use same port)
        // or port 8610 (SANE network scanning)
        if (probePort(ip, 8610)) {
            String deviceId = generateDeviceId(ip, "scanner");
            
            if (devices.find(deviceId) == devices.end()) {
                addDevice(deviceId, "Scanner-" + String(i), ip, 8610, "scanner");
                discovered++;
            }
        }
        
        // Yield to prevent watchdog timeout
        if (i % 10 == 0) {
            yield();
        }
    }
    
    Serial.printf("PrinterService: Discovery complete. Found %d devices\n", discovered);
    return discovered > 0;
}

bool PrinterService::discoverUPnPDevices() {
    Serial.println("PrinterService: Starting UPnP discovery...");
    
    // Discover printers and scanners via UPnP
    upnpDiscovery.discoverPrinters();
    upnpDiscovery.discoverScanners();
    
    // Also do a general discovery for all UPnP devices
    upnpDiscovery.startDiscovery("ssdp:all");
    
    // Process responses for 5 seconds
    upnpDiscovery.processResponses(5000);
    
    // Get discovered devices
    upnpDevices = upnpDiscovery.getDevices();
    
    Serial.printf("PrinterService: UPnP discovery complete. Found %d devices\n", upnpDevices.size());
    
    return upnpDevices.size() > 0;
}

std::vector<UPnPDevice> PrinterService::getUPnPDevices() const {
    return upnpDevices;
}

void PrinterService::onUPnPDeviceDiscovered(const UPnPDevice& upnpDevice) {
    Serial.printf("PrinterService: UPnP device discovered - %s\n", upnpDevice.friendlyName.c_str());
    
    // Automatically add printer/scanner devices
    if (upnpDevice.isPrinter || upnpDevice.isScanner) {
        String deviceId = "upnp-" + upnpDevice.usn;
        deviceId.replace(":", "-");
        deviceId.replace(" ", "-");
        
        // Check if already exists
        if (devices.find(deviceId) == devices.end()) {
            String type = upnpDevice.isPrinter ? "printer" : "scanner";
            if (upnpDevice.isPrinter && upnpDevice.isScanner) {
                type = "multifunction";
            }
            
            // Determine port (default to 9100 for printers, 8610 for scanners)
            int port = upnpDevice.port;
            if (port == 0 || port == 80) {
                port = upnpDevice.isPrinter ? 9100 : 8610;
            }
            
            String name = upnpDevice.friendlyName;
            if (name.isEmpty()) {
                name = upnpDevice.modelName;
            }
            if (name.isEmpty()) {
                name = type + "-" + upnpDevice.ipAddress;
            }
            
            addDevice(deviceId, name, upnpDevice.ipAddress, port, type);
            
            // Store model information
            PrinterDevice* device = getDevice(deviceId);
            if (device) {
                device->model = upnpDevice.manufacturer + " " + upnpDevice.modelName;
            }
        }
    }
}

bool PrinterService::scanNetwork(const String& startIP, const String& endIP) {
    // Parse IP addresses and scan range
    // Simplified implementation - scan specific range
    Serial.printf("PrinterService: Scanning from %s to %s\n", startIP.c_str(), endIP.c_str());
    
    // Extract network prefix from startIP
    int lastDot = startIP.lastIndexOf('.');
    String networkPrefix = startIP.substring(0, lastDot);
    
    return discoverDevices(networkPrefix);
}

bool PrinterService::probePort(const String& ipAddress, int port) {
    WiFiClient client;
    
    // Try to connect with short timeout
    client.setTimeout(1000);
    
    if (client.connect(ipAddress.c_str(), port)) {
        client.stop();
        return true;
    }
    
    return false;
}

String PrinterService::generateDeviceId(const String& ipAddress, const String& type) {
    // Generate ID from IP address and type
    String id = type + "-";
    id += ipAddress;
    id.replace(".", "-");
    return id;
}

// ============================================================================
// Device Operations
// ============================================================================

bool PrinterService::sendRawData(const String& deviceId, const uint8_t* data, size_t length) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device) {
        Serial.printf("PrinterService: Device %s not found\n", deviceId.c_str());
        return false;
    }
    
    WiFiClient client;
    if (!connectToDevice(device->ipAddress, device->port, client)) {
        device->online = false;
        device->status = "offline";
        notifyStatusChange(deviceId, "offline");
        return false;
    }
    
    bool success = sendCommand(client, data, length);
    
    client.stop();
    
    if (success) {
        device->online = true;
        device->lastSeen = millis();
        
        if (device->type == "printer") {
            device->status = "printing";
        } else if (device->type == "scanner") {
            device->status = "scanning";
        }
        
        notifyStatusChange(deviceId, device->status);
    }
    
    return success;
}

bool PrinterService::sendTextDocument(const String& deviceId, const String& text) {
    // Convert text to raw bytes and send
    return sendRawData(deviceId, (const uint8_t*)text.c_str(), text.length());
}

bool PrinterService::sendPCLCommand(const String& deviceId, const String& pclCommand) {
    return sendRawData(deviceId, (const uint8_t*)pclCommand.c_str(), pclCommand.length());
}

bool PrinterService::cancelJob(const String& deviceId) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device) return false;
    
    bool success = false;
    
    if (device->type == "printer") {
        // Send PCL reset command to cancel current job
        String resetCmd = getPCLReset();
        success = sendPCLCommand(deviceId, resetCmd);
    } else if (device->type == "scanner") {
        // Send scanner cancel command
        success = sendRawData(deviceId, (const uint8_t*)SCANNER_CANCEL_CMD, strlen(SCANNER_CANCEL_CMD));
    }
    
    if (success) {
        device->status = "idle";
        notifyStatusChange(deviceId, "idle");
    }
    
    return success;
}

bool PrinterService::getStatus(const String& deviceId, String& status) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device) return false;
    
    status = device->status;
    return true;
}

bool PrinterService::startScan(const String& deviceId, const JsonDocument& scanParams) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device || device->type != "scanner") {
        Serial.println("PrinterService: Device is not a scanner");
        return false;
    }
    
    // Build scan command with parameters
    String scanCmd = "SCAN";
    
    if (scanParams.containsKey("resolution")) {
        scanCmd += " RESOLUTION=" + String(scanParams["resolution"].as<int>());
    }
    
    if (scanParams.containsKey("format")) {
        scanCmd += " FORMAT=" + scanParams["format"].as<String>();
    }
    
    if (scanParams.containsKey("color")) {
        scanCmd += " COLOR=" + scanParams["color"].as<String>();
    }
    
    scanCmd += "\r\n";
    
    bool success = sendRawData(deviceId, (const uint8_t*)scanCmd.c_str(), scanCmd.length());
    
    if (success) {
        device->status = "scanning";
        notifyStatusChange(deviceId, "scanning");
    }
    
    return success;
}

// ============================================================================
// Status Monitoring
// ============================================================================

bool PrinterService::checkDeviceOnline(const String& deviceId) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device) return false;
    
    bool online = probePort(device->ipAddress, device->port);
    
    if (online != device->online) {
        device->online = online;
        device->status = online ? "idle" : "offline";
        notifyStatusChange(deviceId, device->status);
    }
    
    if (online) {
        device->lastSeen = millis();
    }
    
    return online;
}

void PrinterService::updateAllDeviceStatus() {
    for (auto& pair : devices) {
        checkDeviceOnline(pair.first);
    }
}

String PrinterService::getDeviceStatus(const String& deviceId) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device) return "unknown";
    return device->status;
}

// ============================================================================
// Alexa Integration
// ============================================================================

bool PrinterService::handleAlexaPrintCommand(const String& deviceId, 
                                              const String& command, 
                                              const JsonDocument& params) {
    Serial.printf("PrinterService: Alexa command '%s' for device %s\n", 
                  command.c_str(), deviceId.c_str());
    
    PrinterDevice* device = getDevice(deviceId);
    if (!device) {
        Serial.println("PrinterService: Device not found");
        return false;
    }
    
    // Handle printer commands
    if (device->type == "printer") {
        if (command == "PrintTestPage") {
            // Send a test page
            String testPage = "\x1B" "E";  // PCL Reset
            testPage += "Test Page\n";
            testPage += "Device: " + device->name + "\n";
            testPage += "IP: " + device->ipAddress + "\n";
            testPage += "Time: " + String(millis()) + "\n";
            testPage += "\x0C";  // Form feed
            
            return sendTextDocument(deviceId, testPage);
        }
        else if (command == "CancelPrint") {
            return cancelJob(deviceId);
        }
        else if (command == "TurnOn") {
            // Most printers don't support power on via network
            // Just check if online
            return checkDeviceOnline(deviceId);
        }
    }
    // Handle scanner commands
    else if (device->type == "scanner") {
        if (command == "StartScan") {
            return startScan(deviceId, params);
        }
        else if (command == "TurnOn") {
            return checkDeviceOnline(deviceId);
        }
    }
    
    return false;
}

// ============================================================================
// Alexa Discovery
// ============================================================================

JsonDocument PrinterService::getAlexaDiscoveryResponse() {
    JsonDocument doc;
    
    JsonObject event = doc["event"].to<JsonObject>();
    JsonObject header = event["header"].to<JsonObject>();
    header["namespace"] = "Alexa.Discovery";
    header["name"] = "Discover.Response";
    header["payloadVersion"] = "3";
    header["messageId"] = String(millis());
    
    JsonObject payload = event["payload"].to<JsonObject>();
    JsonArray endpoints = payload["endpoints"].to<JsonArray>();
    
    // Add each managed device as an Alexa endpoint
    for (auto& pair : devices) {
        PrinterDevice& device = pair.second;
        
        JsonObject endpoint = endpoints.add<JsonObject>();
        endpoint["endpointId"] = device.id;
        endpoint["manufacturerName"] = device.model.isEmpty() ? "Network Device" : device.model;
        endpoint["friendlyName"] = device.name;
        endpoint["description"] = device.type + " at " + device.ipAddress;
        
        JsonArray displayCategories = endpoint["displayCategories"].to<JsonArray>();
        if (device.type == "printer") {
            displayCategories.add("PRINTER");
        } else if (device.type == "scanner") {
            displayCategories.add("SCANNER");
        } else {
            displayCategories.add("OTHER");
        }
        
        // Add capabilities
        JsonArray capabilities = endpoint["capabilities"].to<JsonArray>();
        
        // Alexa interface (required)
        JsonObject alexaCap = capabilities.add<JsonObject>();
        alexaCap["type"] = "AlexaInterface";
        alexaCap["interface"] = "Alexa";
        alexaCap["version"] = "3";
        
        // EndpointHealth
        JsonObject healthCap = capabilities.add<JsonObject>();
        healthCap["type"] = "AlexaInterface";
        healthCap["interface"] = "Alexa.EndpointHealth";
        healthCap["version"] = "3";
        JsonObject healthProps = healthCap["properties"].to<JsonObject>();
        healthProps["supported"].to<JsonArray>().add(JsonObject());
        healthProps["supported"][0]["name"] = "connectivity";
        healthProps["proactivelyReported"] = true;
        healthProps["retrievable"] = true;
        
        // PowerController
        JsonObject powerCap = capabilities.add<JsonObject>();
        powerCap["type"] = "AlexaInterface";
        powerCap["interface"] = "Alexa.PowerController";
        powerCap["version"] = "3";
        JsonObject powerProps = powerCap["properties"].to<JsonObject>();
        powerProps["supported"].to<JsonArray>().add(JsonObject());
        powerProps["supported"][0]["name"] = "powerState";
        powerProps["proactivelyReported"] = true;
        powerProps["retrievable"] = true;
        
        // Device-specific capabilities
        if (device.type == "printer") {
            JsonObject printerCap = capabilities.add<JsonObject>();
            printerCap["type"] = "AlexaInterface";
            printerCap["interface"] = "Alexa.PrinterController";
            printerCap["version"] = "1";
            
            JsonObject printerConfig = printerCap["configuration"].to<JsonObject>();
            JsonArray supportedOps = printerConfig["supportedOperations"].to<JsonArray>();
            supportedOps.add("PrintTestPage");
            supportedOps.add("CancelPrint");
            supportedOps.add("GetPrinterStatus");
        }
        else if (device.type == "scanner") {
            JsonObject scannerCap = capabilities.add<JsonObject>();
            scannerCap["type"] = "AlexaInterface";
            scannerCap["interface"] = "Alexa.ScannerController";
            scannerCap["version"] = "1";
            
            JsonObject scannerConfig = scannerCap["configuration"].to<JsonObject>();
            JsonArray supportedOps = scannerConfig["supportedOperations"].to<JsonArray>();
            supportedOps.add("StartScan");
            supportedOps.add("CancelScan");
            supportedOps.add("GetScannerStatus");
            
            JsonArray scanFormats = scannerConfig["supportedFormats"].to<JsonArray>();
            scanFormats.add("PDF");
            scanFormats.add("JPEG");
            scanFormats.add("PNG");
        }
    }
    
    // Add ALL UPnP devices as Alexa endpoints
    for (const auto& upnpDev : upnpDevices) {
        JsonObject endpoint = endpoints.add<JsonObject>();
        
        String endpointId = "upnp-" + upnpDev.usn;
        endpointId.replace(":", "-");
        endpointId.replace(" ", "-");
        
        endpoint["endpointId"] = endpointId;
        endpoint["manufacturerName"] = upnpDev.manufacturer.isEmpty() ? "UPnP Device" : upnpDev.manufacturer;
        endpoint["friendlyName"] = upnpDev.friendlyName.isEmpty() ? upnpDev.modelName : upnpDev.friendlyName;
        endpoint["description"] = upnpDev.deviceType + " at " + upnpDev.ipAddress;
        
        JsonArray displayCategories = endpoint["displayCategories"].to<JsonArray>();
        if (upnpDev.isPrinter) {
            displayCategories.add("PRINTER");
        } else if (upnpDev.isScanner) {
            displayCategories.add("SCANNER");
        } else if (upnpDev.deviceType.indexOf("MediaServer") != -1) {
            displayCategories.add("TV");
        } else if (upnpDev.deviceType.indexOf("MediaRenderer") != -1) {
            displayCategories.add("SPEAKER");
        } else {
            displayCategories.add("OTHER");
        }
        
        // Add capabilities
        JsonArray capabilities = endpoint["capabilities"].to<JsonArray>();
        
        // Alexa interface (required)
        JsonObject alexaCap = capabilities.add<JsonObject>();
        alexaCap["type"] = "AlexaInterface";
        alexaCap["interface"] = "Alexa";
        alexaCap["version"] = "3";
        
        // EndpointHealth
        JsonObject healthCap = capabilities.add<JsonObject>();
        healthCap["type"] = "AlexaInterface";
        healthCap["interface"] = "Alexa.EndpointHealth";
        healthCap["version"] = "3";
        JsonObject healthProps = healthCap["properties"].to<JsonObject>();
        healthProps["supported"].to<JsonArray>().add(JsonObject());
        healthProps["supported"][0]["name"] = "connectivity";
        healthProps["proactivelyReported"] = true;
        healthProps["retrievable"] = true;
        
        // PowerController (basic on/off for all devices)
        JsonObject powerCap = capabilities.add<JsonObject>();
        powerCap["type"] = "AlexaInterface";
        powerCap["interface"] = "Alexa.PowerController";
        powerCap["version"] = "3";
        JsonObject powerProps = powerCap["properties"].to<JsonObject>();
        powerProps["supported"].to<JsonArray>().add(JsonObject());
        powerProps["supported"][0]["name"] = "powerState";
        powerProps["proactivelyReported"] = true;
        powerProps["retrievable"] = true;
        
        // Add device-specific capabilities based on UPnP device type
        if (upnpDev.isPrinter) {
            JsonObject printerCap = capabilities.add<JsonObject>();
            printerCap["type"] = "AlexaInterface";
            printerCap["interface"] = "Alexa.PrinterController";
            printerCap["version"] = "1";
        }
        if (upnpDev.isScanner) {
            JsonObject scannerCap = capabilities.add<JsonObject>();
            scannerCap["type"] = "AlexaInterface";
            scannerCap["interface"] = "Alexa.ScannerController";
            scannerCap["version"] = "1";
        }
    }
    
    return doc;
}

JsonDocument PrinterService::getDeviceAlexaCapabilities(const String& deviceId) {
    JsonDocument doc;
    
    // Check managed devices first
    PrinterDevice* device = getDevice(deviceId);
    if (device) {
        doc["endpointId"] = device->id;
        doc["friendlyName"] = device->name;
        doc["type"] = device->type;
        doc["manufacturer"] = device->model;
        
        JsonArray capabilities = doc["capabilities"].to<JsonArray>();
        capabilities.add("Alexa");
        capabilities.add("Alexa.EndpointHealth");
        capabilities.add("Alexa.PowerController");
        
        if (device->type == "printer") {
            capabilities.add("Alexa.PrinterController");
            JsonArray actions = doc["supportedActions"].to<JsonArray>();
            actions.add("PrintTestPage");
            actions.add("CancelPrint");
            actions.add("GetPrinterStatus");
        }
        else if (device->type == "scanner") {
            capabilities.add("Alexa.ScannerController");
            JsonArray actions = doc["supportedActions"].to<JsonArray>();
            actions.add("StartScan");
            actions.add("CancelScan");
            actions.add("GetScannerStatus");
        }
        
        return doc;
    }
    
    // Check UPnP devices
    for (const auto& upnpDev : upnpDevices) {
        String upnpId = "upnp-" + upnpDev.usn;
        upnpId.replace(":", "-");
        upnpId.replace(" ", "-");
        
        if (upnpId == deviceId) {
            doc["endpointId"] = upnpId;
            doc["friendlyName"] = upnpDev.friendlyName;
            doc["type"] = upnpDev.deviceType;
            doc["manufacturer"] = upnpDev.manufacturer;
            doc["model"] = upnpDev.modelName;
            doc["serialNumber"] = upnpDev.serialNumber;
            
            JsonArray capabilities = doc["capabilities"].to<JsonArray>();
            capabilities.add("Alexa");
            capabilities.add("Alexa.EndpointHealth");
            capabilities.add("Alexa.PowerController");
            
            if (upnpDev.isPrinter) {
                capabilities.add("Alexa.PrinterController");
            }
            if (upnpDev.isScanner) {
                capabilities.add("Alexa.ScannerController");
            }
            
            return doc;
        }
    }
    
    doc["error"] = "Device not found";
    return doc;
}

// Common commands for handleAlexaScanCommand would go here if needed

bool PrinterService::handleAlexaScanCommand(const String& deviceId, const String& command, const JsonDocument& params) {
    PrinterDevice* device = getDevice(deviceId);
    if (!device || device->type != "scanner") {
        return false;
    }
    
    // Handle scanner commands
    if (command == "GetStatus") {
        // Status is already tracked
        return true;
    }
    else if (command == "TurnOff") {
        // Most devices don't support power off via network
        Serial.println("PrinterService: Power off not supported");
        return false;
    }
    
    Serial.printf("PrinterService: Unknown command '%s'\n", command.c_str());
    return false;
}

JsonDocument PrinterService::getAlexaDeviceState(const String& deviceId) {
    JsonDocument state;
    
    PrinterDevice* device = getDevice(deviceId);
    if (!device) {
        state["error"] = "Device not found";
        return state;
    }
    
    state["endpointId"] = deviceId;
    state["online"] = device->online;
    state["status"] = device->status;
    state["name"] = device->name;
    state["type"] = device->type;
    state["ipAddress"] = device->ipAddress;
    state["port"] = device->port;
    state["lastSeen"] = device->lastSeen;
    
    return state;
}

// ============================================================================
// Configuration
// ============================================================================

bool PrinterService::loadConfig(const char* configPath) {
    File file = LittleFS.open(configPath, "r");
    if (!file) {
        Serial.printf("PrinterService: Failed to open config file %s\n", configPath);
        return false;
    }
    
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        Serial.printf("PrinterService: Failed to parse config: %s\n", error.c_str());
        return false;
    }
    
    // Load devices from config
    JsonArray devicesArray = doc["devices"].as<JsonArray>();
    for (JsonObject deviceObj : devicesArray) {
        String id = deviceObj["id"].as<String>();
        String name = deviceObj["name"].as<String>();
        String ip = deviceObj["ipAddress"].as<String>();
        int port = deviceObj["port"] | 9100;
        String type = deviceObj["type"] | "printer";
        
        addDevice(id, name, ip, port, type);
    }
    
    Serial.printf("PrinterService: Loaded %d devices from config\n", devices.size());
    return true;
}

bool PrinterService::saveConfig(const char* configPath) {
    JsonDocument doc;
    JsonArray devicesArray = doc["devices"].to<JsonArray>();
    
    for (auto& pair : devices) {
        JsonObject deviceObj = devicesArray.add<JsonObject>();
        deviceObj["id"] = pair.second.id;
        deviceObj["name"] = pair.second.name;
        deviceObj["ipAddress"] = pair.second.ipAddress;
        deviceObj["port"] = pair.second.port;
        deviceObj["type"] = pair.second.type;
    }
    
    File file = LittleFS.open(configPath, "w");
    if (!file) {
        Serial.printf("PrinterService: Failed to open config file for writing\n");
        return false;
    }
    
    serializeJson(doc, file);
    file.close();
    
    Serial.printf("PrinterService: Saved %d devices to config\n", devices.size());
    return true;
}

String PrinterService::toJson() {
    JsonDocument doc;
    JsonArray devicesArray = doc["devices"].to<JsonArray>();
    
    for (auto& pair : devices) {
        JsonObject deviceObj = devicesArray.add<JsonObject>();
        deviceObj["id"] = pair.second.id;
        deviceObj["name"] = pair.second.name;
        deviceObj["ipAddress"] = pair.second.ipAddress;
        deviceObj["port"] = pair.second.port;
        deviceObj["type"] = pair.second.type;
        deviceObj["online"] = pair.second.online;
        deviceObj["status"] = pair.second.status;
        deviceObj["lastSeen"] = pair.second.lastSeen;
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}

// ============================================================================
// Helper Methods
// ============================================================================

bool PrinterService::connectToDevice(const String& ipAddress, int port, WiFiClient& client) {
    client.setTimeout(5000);
    
    if (!client.connect(ipAddress.c_str(), port)) {
        Serial.printf("PrinterService: Failed to connect to %s:%d\n", ipAddress.c_str(), port);
        return false;
    }
    
    return true;
}

bool PrinterService::sendCommand(WiFiClient& client, const uint8_t* data, size_t length) {
    size_t written = client.write(data, length);
    
    if (written != length) {
        Serial.printf("PrinterService: Failed to send complete data (%d/%d bytes)\n", 
                      written, length);
        return false;
    }
    
    client.flush();
    return true;
}

bool PrinterService::readResponse(WiFiClient& client, String& response, int timeout) {
    unsigned long start = millis();
    response = "";
    
    while (millis() - start < timeout) {
        if (client.available()) {
            char c = client.read();
            response += c;
        }
        yield();
    }
    
    return response.length() > 0;
}

void PrinterService::notifyStatusChange(const String& deviceId, const String& status) {
    if (statusCallback) {
        statusCallback(deviceId, status);
    }
}

String PrinterService::getPCLReset() {
    return String(PCL_RESET);
}

String PrinterService::getPCLStatus() {
    return String(PCL_STATUS);
}

String PrinterService::getESCPReset() {
    return String(ESCP_RESET);
}

// ============================================================================
// Initialization
// ============================================================================

void initializePrinterService() {
    if (!globalPrinterService) {
        globalPrinterService = new PrinterService();
        globalPrinterService->begin();
    }
}

#endif // ENABLE_PRINTER_SCANNER

// Made with Bob