#ifdef ENABLE_BLUETOOTH_DEVICES

#include "BluetoothService.h"
#include <LittleFS.h>

// Global instance
BluetoothService* globalBluetoothService = nullptr;

// BLE Service UUIDs
const char* BluetoothService::UUID_HEART_RATE = "0000180d-0000-1000-8000-00805f9b34fb";
const char* BluetoothService::UUID_FITNESS = "00001826-0000-1000-8000-00805f9b34fb";
const char* BluetoothService::UUID_BATTERY = "0000180f-0000-1000-8000-00805f9b34fb";
const char* BluetoothService::UUID_DEVICE_INFO = "0000180a-0000-1000-8000-00805f9b34fb";
const char* BluetoothService::UUID_LIGHTING = "00001800-0000-1000-8000-00805f9b34fb";
const char* BluetoothService::UUID_AUTOMATION = "00001801-0000-1000-8000-00805f9b34fb";

// ============================================================================
// BLE Scan Callback Implementation
// ============================================================================

void BLEScanCallback::onResult(NimBLEAdvertisedDevice* advertisedDevice) {
    if (bleService) {
        bleService->processDiscoveredDevice(advertisedDevice);
    }
}

// ============================================================================
// BluetoothService Implementation
// ============================================================================

BluetoothService::BluetoothService()
    : pBLEScan(nullptr), scanCallback(nullptr), scanning(false),
      lastScan(0), lastStatusCheck(0),
      deviceDiscoveredCallback(nullptr), statusCallback(nullptr),
      scanInterval(60000), scanDuration(10), statusCheckInterval(30000),
      autoDiscovery(true), excludeWatches(true) {
}

BluetoothService::~BluetoothService() {
    end();
}

bool BluetoothService::begin() {
    Serial.println("========================================");
    Serial.println("🔧 BLUETOOTH SERVICE INITIALIZING");
    Serial.println("========================================");
    
    // Initialize NimBLE
    Serial.println("   Step 1: Initializing NimBLE...");
    NimBLEDevice::init("ESP32-BLE-Scanner");
    Serial.println("   ✓ NimBLE initialized");
    
    // Create BLE scan object
    Serial.println("   Step 2: Creating BLE scan object...");
    pBLEScan = NimBLEDevice::getScan();
    if (!pBLEScan) {
        Serial.println("   ✗ FAILED to create BLE scan object!");
        return false;
    }
    Serial.println("   ✓ BLE scan object created");
    
    // Create and set callback
    Serial.println("   Step 3: Setting up scan callback...");
    scanCallback = new BLEScanCallback();
    if (!scanCallback) {
        Serial.println("   ✗ FAILED to create scan callback!");
        return false;
    }
    scanCallback->setService(this);
    pBLEScan->setAdvertisedDeviceCallbacks(scanCallback);
    Serial.println("   ✓ Scan callback configured");
    
    // Configure scan parameters
    Serial.println("   Step 4: Configuring scan parameters...");
    pBLEScan->setActiveScan(true);  // Active scan uses more power but gets more info
    pBLEScan->setInterval(100);
    pBLEScan->setWindow(99);
    Serial.println("   ✓ Scan parameters set (active scan, interval=100, window=99)");
    
    // Load configuration if available
    if (LittleFS.exists("/config/bluetooth.json")) {
        Serial.println("   Step 5: Loading configuration...");
        loadConfig("/config/bluetooth.json");
        Serial.println("   ✓ Configuration loaded");
    } else {
        Serial.println("   Step 5: No config file, using defaults");
    }
    
    // Start initial scan after 5 seconds
    lastScan = millis() - (scanInterval - 5000);
    lastStatusCheck = millis();
    
    Serial.println("========================================");
    Serial.println("✅ BLUETOOTH SERVICE INITIALIZED");
    Serial.printf("   Scan interval: %d ms (%d seconds)\n", scanInterval, scanInterval/1000);
    Serial.printf("   Scan duration: %d seconds\n", scanDuration);
    Serial.printf("   Auto-discovery: %s\n", autoDiscovery ? "ENABLED" : "DISABLED");
    Serial.println("   First scan will start in ~5 seconds...");
    Serial.println("========================================");
    
    // Register service for advertisement
    registerService();
    
    return true;
}

void BluetoothService::loop() {
    unsigned long now = millis();
    
    // Debug: Print loop status every 30 seconds
    static unsigned long lastDebug = 0;
    if (now - lastDebug > 30000) {
        Serial.printf("[BT-DEBUG] loop() running - scanning:%s, devices:%d, lastScan:%lu ms ago\n",
                      scanning ? "YES" : "NO", devices.size(), now - lastScan);
        lastDebug = now;
    }
    
    // Auto-discovery scan
    if (autoDiscovery && !scanning && (now - lastScan > scanInterval)) {
        Serial.printf("[BT-DEBUG] Triggering auto-scan (interval elapsed: %lu ms)\n", now - lastScan);
        startScan(scanDuration);
        lastScan = now;
    }
    
    // Periodic status check and cleanup
    if (now - lastStatusCheck > statusCheckInterval) {
        updateAllDeviceStatus();
        cleanupStaleDevices();
        lastStatusCheck = now;
    }
}

void BluetoothService::end() {
    if (pBLEScan) {
        stopScan();
        pBLEScan = nullptr;
    }
    
    if (scanCallback) {
        delete scanCallback;
        scanCallback = nullptr;
    }
    
    devices.clear();
    NimBLEDevice::deinit(false);
}

// ============================================================================
// Device Management
// ============================================================================

bool BluetoothService::addDevice(const BluetoothDevice& device) {
    devices[device.address] = device;
    Serial.printf("BluetoothService: Added device %s (%s)\n", 
                  device.name.c_str(), device.address.c_str());
    return true;
}

bool BluetoothService::removeDevice(const String& address) {
    auto it = devices.find(address);
    if (it == devices.end()) {
        return false;
    }
    
    devices.erase(it);
    Serial.printf("BluetoothService: Removed device %s\n", address.c_str());
    return true;
}

BluetoothDevice* BluetoothService::getDevice(const String& address) {
    auto it = devices.find(address);
    if (it == devices.end()) {
        return nullptr;
    }
    return &(it->second);
}

std::vector<BluetoothDevice> BluetoothService::getAllDevices() {
    std::vector<BluetoothDevice> result;
    for (const auto& pair : devices) {
        result.push_back(pair.second);
    }
    return result;
}

std::vector<BluetoothDevice> BluetoothService::getControllableDevices() {
    std::vector<BluetoothDevice> result;
    for (const auto& pair : devices) {
        if (pair.second.controllable) {
            result.push_back(pair.second);
        }
    }
    return result;
}

std::vector<BluetoothDevice> BluetoothService::getDevicesByType(BLEDeviceType type) {
    std::vector<BluetoothDevice> result;
    for (const auto& pair : devices) {
        if (pair.second.type == type) {
            result.push_back(pair.second);
        }
    }
    return result;
}

// ============================================================================
// Discovery
// ============================================================================

bool BluetoothService::startScan(int duration) {
    if (scanning) {
        Serial.println("BluetoothService: Scan already in progress");
        return false;
    }
    
    Serial.println("========================================");
    Serial.printf("🔍 BLUETOOTH SCAN STARTING\n");
    Serial.printf("   Duration: %d seconds\n", duration);
    Serial.printf("   Current devices: %d\n", devices.size());
    Serial.printf("   Auto-discovery: %s\n", autoDiscovery ? "enabled" : "disabled");
    Serial.printf("   Exclude watches: %s\n", excludeWatches ? "yes" : "no");
    Serial.printf("   Scan callback: %s\n", scanCallback ? "set" : "NULL");
    Serial.printf("   BLE scan object: %s\n", pBLEScan ? "initialized" : "NULL");
    Serial.println("========================================");
    
    scanning = true;
    
    // Start scan (non-blocking)
    pBLEScan->start(duration, false);
    
    return true;
}

void BluetoothService::stopScan() {
    if (scanning) {
        pBLEScan->stop();
        scanning = false;
        Serial.println("========================================");
        Serial.println("🛑 BLUETOOTH SCAN STOPPED");
        Serial.printf("   Total devices discovered: %d\n", getDeviceCount());
        Serial.println("========================================");
    }
}

void BluetoothService::processDiscoveredDevice(NimBLEAdvertisedDevice* advertisedDevice) {
    Serial.println("🔔 processDiscoveredDevice() called!");
    
    String address = advertisedDevice->getAddress().toString().c_str();
    int rssi = advertisedDevice->getRSSI();
    
    Serial.printf("   Raw device: %s, RSSI: %d\n", address.c_str(), rssi);
    
    // Check if device already exists
    auto it = devices.find(address);
    if (it != devices.end()) {
        // Update last seen, RSSI, and distance
        it->second.lastSeen = millis();
        it->second.rssi = rssi;
        it->second.distanceMeters = calculateDistance(rssi);
        it->second.distanceFeet = it->second.distanceMeters * 3.28084f;
        return;
    }
    
    // New device discovered
    BluetoothDevice device;
    device.address = address;
    device.name = advertisedDevice->haveName() ?
                  advertisedDevice->getName().c_str() : "Unknown";
    device.rssi = rssi;
    device.distanceMeters = calculateDistance(rssi);
    device.distanceFeet = device.distanceMeters * 3.28084f;
    device.lastSeen = millis();
    device.firstSeen = millis();
    
    // Extract manufacturer data
    if (advertisedDevice->haveManufacturerData()) {
        std::string mfgData = advertisedDevice->getManufacturerData();
        device.manufacturerData = "";
        for (int i = 0; i < mfgData.length(); i++) {
            char hex[3];
            sprintf(hex, "%02X", (uint8_t)mfgData[i]);
            device.manufacturerData += hex;
        }
    }
    
    // Extract service UUIDs
    if (advertisedDevice->haveServiceUUID()) {
        NimBLEUUID serviceUUID = advertisedDevice->getServiceUUID();
        device.serviceUUIDs.push_back(serviceUUID.toString().c_str());
    }
    
    // Detect device type
    device.type = detectDeviceType(advertisedDevice);
    device.manufacturer = extractManufacturer(advertisedDevice);
    
    // Determine if controllable (exclude watches)
    device.controllable = !isWatchDevice(advertisedDevice);
    
    // Add device
    addDevice(device);
    
    // Notify callback
    notifyDeviceDiscovered(device);
    
    // Print detailed discovery message
    Serial.println("========================================");
    Serial.printf("🔵 NEW BLUETOOTH DEVICE DISCOVERED\n");
    Serial.printf("   Type: %s\n", deviceTypeToString(device.type).c_str());
    Serial.printf("   Name: %s\n", device.name.c_str());
    Serial.printf("   Address: %s\n", device.address.c_str());
    Serial.printf("   RSSI: %d dBm\n", device.rssi);
    Serial.printf("   Distance: %.1f feet (%.1f meters)\n", device.distanceFeet, device.distanceMeters);
    Serial.printf("   Controllable: %s\n", device.controllable ? "YES" : "NO (Watch/Display Only)");
    if (!device.manufacturer.isEmpty()) {
        Serial.printf("   Manufacturer: %s\n", device.manufacturer.c_str());
    }
    Serial.println("========================================");
}

// ============================================================================
// Device Type Detection
// ============================================================================

BLEDeviceType BluetoothService::detectDeviceType(NimBLEAdvertisedDevice* device) {
    // Check for watch/fitness devices first
    if (isWatchDevice(device)) {
        return BLEDeviceType::WATCH;
    }

    if (device->haveManufacturerData()) {
        std::string mfgData = device->getManufacturerData();
        if (mfgData.length() >= 2 && (uint8_t)mfgData[0] == 0x4C && (uint8_t)mfgData[1] == 0x00) {
            return BLEDeviceType::WATCH;
        }
    }

    if (hasService(device, "0000180f-0000-1000-8000-00805f9b34fb")) {
        return BLEDeviceType::WATCH;
    }
    
    // Check for specific device types
    if (isLightbulb(device)) {
        return BLEDeviceType::LIGHTBULB;
    }
    
    if (isOutlet(device)) {
        return BLEDeviceType::OUTLET;
    }
    
    if (isWaterController(device)) {
        return BLEDeviceType::WATER_CONTROLLER;
    }
    
    // Check name for hints
    String name = device->haveName() ? device->getName().c_str() : "";
    name.toLowerCase();
    
    if (name.indexOf("light") >= 0 || name.indexOf("bulb") >= 0 || 
        name.indexOf("lamp") >= 0) {
        return BLEDeviceType::LIGHTBULB;
    }
    
    if (name.indexOf("plug") >= 0 || name.indexOf("outlet") >= 0 || 
        name.indexOf("switch") >= 0) {
        return BLEDeviceType::OUTLET;
    }
    
    if (name.indexOf("water") >= 0 || name.indexOf("valve") >= 0 || 
        name.indexOf("sprinkler") >= 0 || name.indexOf("melnow") >= 0) {
        return BLEDeviceType::WATER_CONTROLLER;
    }
    
    if (name.indexOf("speaker") >= 0 || name.indexOf("audio") >= 0) {
        return BLEDeviceType::SPEAKER;
    }
    
    if (name.indexOf("sensor") >= 0 || name.indexOf("temp") >= 0 || 
        name.indexOf("humidity") >= 0) {
        return BLEDeviceType::SENSOR;
    }
    
    return BLEDeviceType::UNKNOWN;
}

bool BluetoothService::isWatchDevice(NimBLEAdvertisedDevice* device) {
    // Check for heart rate or fitness services
    if (hasService(device, UUID_HEART_RATE) || hasService(device, UUID_FITNESS)) {
        return true;
    }
    
    // Check name for watch indicators
    if (device->haveName()) {
        String name = device->getName().c_str();
        name.toLowerCase();
        if (name.indexOf("watch") >= 0 || name.indexOf("band") >= 0 || 
            name.indexOf("fit") >= 0 || name.indexOf("tracker") >= 0) {
            return true;
        }
    }
    
    return false;
}

bool BluetoothService::isLightbulb(NimBLEAdvertisedDevice* device) {
    // Check for lighting service UUID
    if (hasService(device, UUID_LIGHTING)) {
        return true;
    }
    
    // Check manufacturer data for known lightbulb manufacturers
    // This would need to be expanded based on actual devices
    return false;
}

bool BluetoothService::isOutlet(NimBLEAdvertisedDevice* device) {
    // Check for automation service UUID
    if (hasService(device, UUID_AUTOMATION)) {
        return true;
    }
    
    return false;
}

bool BluetoothService::isWaterController(NimBLEAdvertisedDevice* device) {
    // Check name for water controller indicators
    if (device->haveName()) {
        String name = device->getName().c_str();
        name.toLowerCase();
        if (name.indexOf("melnow") >= 0 || name.indexOf("water") >= 0) {
            return true;
        }
    }
    
    return false;
}

// ============================================================================
// Device Control
// ============================================================================

bool BluetoothService::connectDevice(const String& address) {
    BluetoothDevice* device = getDevice(address);
    if (!device) {
        Serial.printf("BluetoothService: Device %s not found\n", address.c_str());
        return false;
    }
    
    if (!device->controllable) {
        Serial.printf("BluetoothService: Device %s is not controllable\n", address.c_str());
        return false;
    }
    
    Serial.printf("BluetoothService: Connecting to %s...\n", address.c_str());
    
    // TODO: Implement actual BLE connection
    // This would involve creating a BLEClient and connecting to the device
    
    device->connected = true;
    notifyStatusChange(address, "connected");
    
    return true;
}

bool BluetoothService::disconnectDevice(const String& address) {
    BluetoothDevice* device = getDevice(address);
    if (!device) {
        return false;
    }
    
    Serial.printf("BluetoothService: Disconnecting from %s...\n", address.c_str());
    
    // TODO: Implement actual BLE disconnection
    
    device->connected = false;
    notifyStatusChange(address, "disconnected");
    
    return true;
}

bool BluetoothService::controlDevice(const String& address, const String& action, 
                                     const JsonDocument& params) {
    BluetoothDevice* device = getDevice(address);
    if (!device || !device->controllable) {
        return false;
    }
    
    Serial.printf("BluetoothService: Controlling %s - action: %s\n", 
                  address.c_str(), action.c_str());
    
    if (action == "on" || action == "turnOn") {
        return setPowerState(address, true);
    } else if (action == "off" || action == "turnOff") {
        return setPowerState(address, false);
    } else if (action == "setBrightness") {
        int brightness = params["brightness"] | 100;
        return setBrightness(address, brightness);
    } else if (action == "setColor") {
        String color = params["color"] | "#FFFFFF";
        return setColor(address, color);
    }
    
    return false;
}

bool BluetoothService::setPowerState(const String& address, bool on) {
    BluetoothDevice* device = getDevice(address);
    if (!device || !device->controllable) {
        return false;
    }
    
    Serial.printf("BluetoothService: Setting %s power state to %s\n", 
                  address.c_str(), on ? "ON" : "OFF");
    
    // TODO: Implement actual BLE control commands
    // This would involve writing to specific characteristics
    
    device->powerState = on;
    notifyStatusChange(address, on ? "on" : "off");
    
    return true;
}

bool BluetoothService::setBrightness(const String& address, int brightness) {
    BluetoothDevice* device = getDevice(address);
    if (!device || !device->controllable) {
        return false;
    }
    
    if (device->type != BLEDeviceType::LIGHTBULB) {
        Serial.println("BluetoothService: Device does not support brightness control");
        return false;
    }
    
    brightness = constrain(brightness, 0, 100);
    Serial.printf("BluetoothService: Setting %s brightness to %d%%\n", 
                  address.c_str(), brightness);
    
    // TODO: Implement actual BLE brightness control
    
    device->brightness = brightness;
    notifyStatusChange(address, "brightness:" + String(brightness));
    
    return true;
}

bool BluetoothService::setColor(const String& address, const String& color) {
    BluetoothDevice* device = getDevice(address);
    if (!device || !device->controllable) {
        return false;
    }
    
    if (device->type != BLEDeviceType::LIGHTBULB) {
        Serial.println("BluetoothService: Device does not support color control");
        return false;
    }
    
    Serial.printf("BluetoothService: Setting %s color to %s\n", 
                  address.c_str(), color.c_str());
    
    // TODO: Implement actual BLE color control
    
    device->color = color;
    notifyStatusChange(address, "color:" + color);
    
    return true;
}

// ============================================================================
// Status
// ============================================================================

String BluetoothService::getDeviceStatus(const String& address) {
    BluetoothDevice* device = getDevice(address);
    if (!device) {
        return "unknown";
    }
    
    if (device->connected) {
        return device->powerState ? "on" : "off";
    }
    
    return "disconnected";
}

void BluetoothService::updateAllDeviceStatus() {
    // Check for stale devices (not seen in 5 minutes)
    unsigned long now = millis();
    unsigned long staleThreshold = 300000; // 5 minutes
    
    for (auto& pair : devices) {
        if (now - pair.second.lastSeen > staleThreshold) {
            if (pair.second.connected) {
                pair.second.connected = false;
                notifyStatusChange(pair.first, "stale");
            }
        }
    }
}

// ============================================================================
// Configuration
// ============================================================================

bool BluetoothService::loadConfig(const char* configPath) {
    Serial.printf("BluetoothService: Loading configuration from %s\n", configPath);
    
    File file = LittleFS.open(configPath, "r");
    if (!file) {
        Serial.println("BluetoothService: Failed to open config file");
        return false;
    }
    
    StaticJsonDocument<4096> doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        Serial.printf("BluetoothService: Failed to parse config: %s\n", error.c_str());
        return false;
    }
    
    // Load settings
    if (doc.containsKey("settings")) {
        JsonObject settings = doc["settings"];
        autoDiscovery = settings["autoDiscovery"] | true;
        scanInterval = settings["scanInterval"] | 60000;
        scanDuration = settings["scanDuration"] | 10;
        statusCheckInterval = settings["statusCheckInterval"] | 30000;
        excludeWatches = settings["excludeWatches"] | true;
    }
    
    // Load known devices
    if (doc.containsKey("devices")) {
        JsonArray devicesArray = doc["devices"];
        for (JsonObject deviceObj : devicesArray) {
            BluetoothDevice device;
            device.address = deviceObj["address"] | "";
            device.name = deviceObj["name"] | "";
            device.type = stringToDeviceType(deviceObj["type"] | "unknown");
            device.manufacturer = deviceObj["manufacturer"] | "";
            device.controllable = deviceObj["controllable"] | true;
            
            if (!device.address.isEmpty()) {
                addDevice(device);
            }
        }
    }
    
    Serial.printf("BluetoothService: Loaded %d devices from config\n", devices.size());
    return true;
}

bool BluetoothService::saveConfig(const char* configPath) {
    Serial.printf("BluetoothService: Saving configuration to %s\n", configPath);
    
    StaticJsonDocument<4096> doc;
    
    // Save settings
    JsonObject settings = doc.createNestedObject("settings");
    settings["autoDiscovery"] = autoDiscovery;
    settings["scanInterval"] = scanInterval;
    settings["scanDuration"] = scanDuration;
    settings["statusCheckInterval"] = statusCheckInterval;
    settings["excludeWatches"] = excludeWatches;
    
    // Save devices
    JsonArray devicesArray = doc.createNestedArray("devices");
    for (const auto& pair : devices) {
        JsonObject deviceObj = devicesArray.createNestedObject();
        deviceObj["address"] = pair.second.address;
        deviceObj["name"] = pair.second.name;
        deviceObj["type"] = deviceTypeToString(pair.second.type);
        deviceObj["manufacturer"] = pair.second.manufacturer;
        deviceObj["controllable"] = pair.second.controllable;
    }
    
    File file = LittleFS.open(configPath, "w");
    if (!file) {
        Serial.println("BluetoothService: Failed to open config file for writing");
        return false;
    }
    
    serializeJson(doc, file);
    file.close();
    
    Serial.println("BluetoothService: Configuration saved successfully");
    return true;
}

String BluetoothService::toJson() {
    StaticJsonDocument<4096> doc;
    
    JsonArray devicesArray = doc.createNestedArray("devices");
    for (const auto& pair : devices) {
        JsonObject deviceObj = devicesArray.createNestedObject();
        deviceObj["address"] = pair.second.address;
        deviceObj["name"] = pair.second.name;
        deviceObj["type"] = deviceTypeToString(pair.second.type);
        deviceObj["manufacturer"] = pair.second.manufacturer;
        deviceObj["manufacturerData"] = pair.second.manufacturerData;
        deviceObj["rssi"] = pair.second.rssi;
        deviceObj["controllable"] = pair.second.controllable;
        deviceObj["connected"] = pair.second.connected;
        deviceObj["powerState"] = pair.second.powerState;
        deviceObj["brightness"] = pair.second.brightness;
        JsonArray services = deviceObj["serviceUUIDs"].to<JsonArray>();
        for (const auto& serviceUUID : pair.second.serviceUUIDs) {
            services.add(serviceUUID);
        }
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}

// ============================================================================
// Alexa Integration
// ============================================================================

bool BluetoothService::handleAlexaCommand(const String& address, const String& command,
                                          const JsonDocument& params) {
    return controlDevice(address, command, params);
}

JsonDocument BluetoothService::getAlexaDiscoveryResponse() {
    StaticJsonDocument<4096> doc;
    JsonArray endpoints = doc.createNestedArray("endpoints");
    
    for (const auto& pair : devices) {
        if (!pair.second.controllable) continue;
        
        JsonObject endpoint = endpoints.createNestedObject();
        endpoint["endpointId"] = pair.second.address;
        endpoint["friendlyName"] = pair.second.name;
        endpoint["manufacturerName"] = pair.second.manufacturer;
        
        // Add capabilities based on device type
        JsonArray capabilities = endpoint.createNestedArray("capabilities");
        
        // Power control
        JsonObject powerCap = capabilities.createNestedObject();
        powerCap["type"] = "AlexaInterface";
        powerCap["interface"] = "Alexa.PowerController";
        powerCap["version"] = "3";
        
        // Brightness control for lightbulbs
        if (pair.second.type == BLEDeviceType::LIGHTBULB) {
            JsonObject brightnessCap = capabilities.createNestedObject();
            brightnessCap["type"] = "AlexaInterface";
            brightnessCap["interface"] = "Alexa.BrightnessController";
            brightnessCap["version"] = "3";
        }
    }
    
    return doc;
}

JsonDocument BluetoothService::getDeviceAlexaCapabilities(const String& address) {
    StaticJsonDocument<1024> doc;
    BluetoothDevice* device = getDevice(address);
    
    if (device && device->controllable) {
        JsonArray capabilities = doc.createNestedArray("capabilities");
        
        JsonObject powerCap = capabilities.createNestedObject();
        powerCap["type"] = "AlexaInterface";
        powerCap["interface"] = "Alexa.PowerController";
        
        if (device->type == BLEDeviceType::LIGHTBULB) {
            JsonObject brightnessCap = capabilities.createNestedObject();
            brightnessCap["type"] = "AlexaInterface";
            brightnessCap["interface"] = "Alexa.BrightnessController";
        }
    }
    
    return doc;
}

// ============================================================================
// Helper Methods
// ============================================================================

String BluetoothService::extractManufacturer(NimBLEAdvertisedDevice* device) {
    // Extract manufacturer from manufacturer data or name
    if (device->haveName()) {
        String name = device->getName().c_str();
        // Common manufacturer prefixes
        if (name.startsWith("Philips")) return "Philips";
        if (name.startsWith("LIFX")) return "LIFX";
        if (name.startsWith("TP-Link")) return "TP-Link";
        if (name.startsWith("Melnow")) return "Melnow";
    }
    
    return "Unknown";
}

bool BluetoothService::hasService(NimBLEAdvertisedDevice* device, const char* serviceUUID) {
    if (!device->haveServiceUUID()) {
        return false;
    }
    
    NimBLEUUID uuid = device->getServiceUUID();
    return uuid.equals(NimBLEUUID(serviceUUID));
}

void BluetoothService::notifyDeviceDiscovered(const BluetoothDevice& device) {
    if (deviceDiscoveredCallback) {
        deviceDiscoveredCallback(device);
    }
}

void BluetoothService::notifyStatusChange(const String& address, const String& status) {
    if (statusCallback) {
        statusCallback(address, status);
    }
}

String BluetoothService::deviceTypeToString(BLEDeviceType type) {
    switch (type) {
        case BLEDeviceType::LIGHTBULB: return "lightbulb";
        case BLEDeviceType::OUTLET: return "outlet";
        case BLEDeviceType::WATER_CONTROLLER: return "water_controller";
        case BLEDeviceType::WATCH: return "watch";
        case BLEDeviceType::SENSOR: return "sensor";
        case BLEDeviceType::SPEAKER: return "speaker";
        case BLEDeviceType::OTHER: return "other";
        default: return "unknown";
    }
}

BLEDeviceType BluetoothService::stringToDeviceType(const String& typeStr) {
    if (typeStr == "lightbulb") return BLEDeviceType::LIGHTBULB;
    if (typeStr == "outlet") return BLEDeviceType::OUTLET;
    if (typeStr == "water_controller") return BLEDeviceType::WATER_CONTROLLER;
    if (typeStr == "watch") return BLEDeviceType::WATCH;
    if (typeStr == "sensor") return BLEDeviceType::SENSOR;
    if (typeStr == "speaker") return BLEDeviceType::SPEAKER;
    if (typeStr == "other") return BLEDeviceType::OTHER;
    return BLEDeviceType::UNKNOWN;
}

float BluetoothService::calculateDistance(int rssi, int txPower) {
    /*
     * Calculate distance using RSSI (Received Signal Strength Indicator)
     * Formula: distance = 10 ^ ((txPower - rssi) / (10 * n))
     * where:
     *   txPower = transmitted power at 1 meter (typically -59 dBm for BLE)
     *   rssi = received signal strength
     *   n = path loss exponent (2.0 for free space, 2-4 for indoor)
     */
    
    if (rssi == 0) {
        return -1.0f; // Unknown distance
    }
    
    // Use path loss exponent of 2.5 for typical indoor environment
    float ratio = (float)(txPower - rssi) / (10.0f * 2.5f);
    float distanceMeters = pow(10.0f, ratio);
    
    return distanceMeters;
}

void BluetoothService::cleanupStaleDevices() {
    unsigned long now = millis();
    unsigned long staleThreshold = 300000; // 5 minutes in milliseconds
    
    std::vector<String> toRemove;
    
    // Find stale devices
    for (const auto& pair : devices) {
        if (now - pair.second.lastSeen > staleThreshold) {
            toRemove.push_back(pair.first);
        }
    }
    
    // Remove stale devices
    for (const String& address : toRemove) {
        auto it = devices.find(address);
        if (it != devices.end()) {
            Serial.println("========================================");
            Serial.printf("🔴 BLUETOOTH DEVICE REMOVED (STALE)\n");
            Serial.printf("   Name: %s\n", it->second.name.c_str());
            Serial.printf("   Address: %s\n", address.c_str());
            Serial.printf("   Type: %s\n", deviceTypeToString(it->second.type).c_str());
            Serial.printf("   Last Seen: %lu ms ago\n", now - it->second.lastSeen);
            Serial.println("========================================");
            
            devices.erase(it);
            notifyStatusChange(address, "removed");
        }
    }
    
    if (toRemove.size() > 0) {
        Serial.printf("BluetoothService: Cleaned up %d stale device(s)\n", toRemove.size());
    }
}

// ============================================================================
// Initialization Helper
// ============================================================================

void initializeBluetoothService() {
    if (!globalBluetoothService) {
        globalBluetoothService = new BluetoothService();
        globalBluetoothService->begin();
    }
}

// ============================================================================
// Service Registration and Advertisement
// ============================================================================

String BluetoothService::getServiceManifest() const {
    StaticJsonDocument<2048> doc;
    
    doc["type"] = "service";
    doc["name"] = "BluetoothService";
    doc["description"] = "Discovers and manages Bluetooth Low Energy (BLE) smart home devices";
    doc["version"] = "1.0.0";
    doc["enabled"] = true;
    
    JsonArray endpoints = doc.createNestedArray("endpoints");
    endpoints.add("/bluetooth/scan");
    endpoints.add("/bluetooth/devices");
    endpoints.add("/bluetooth/device/:address");
    endpoints.add("/bluetooth/control");
    endpoints.add("/bluetooth/config");
    endpoints.add("/bluetooth/status");
    
    JsonArray features = doc.createNestedArray("features");
    features.add("BLE device discovery");
    features.add("Device type detection");
    features.add("Watch filtering");
    features.add("RSSI distance calculation");
    features.add("Device control");
    
    JsonObject stats = doc.createNestedObject("statistics");
    stats["totalDevices"] = devices.size();
    stats["controllableDevices"] = 0;
    stats["scanning"] = scanning;
    stats["scanInterval"] = scanInterval;
    
    // Count controllable devices
    for (const auto& pair : devices) {
        if (pair.second.controllable) {
            stats["controllableDevices"] = stats["controllableDevices"].as<int>() + 1;
        }
    }
    
    String manifest;
    serializeJson(doc, manifest);
    return manifest;
}

String BluetoothService::getServiceCapabilities() const {
    StaticJsonDocument<512> doc;
    
    doc["service"] = "BluetoothService";
    doc["protocol"] = "BLE";
    doc["deviceTypes"] = "lightbulb,outlet,water_controller";
    doc["features"] = "discovery,control,distance";
    doc["deviceCount"] = devices.size();
    doc["status"] = scanning ? "scanning" : "idle";
    
    String capabilities;
    serializeJson(doc, capabilities);
    return capabilities;
}

void BluetoothService::registerService() {
    Serial.println("========================================");
    Serial.println("📡 BLUETOOTH SERVICE REGISTERED");
    Serial.println("   Service: BluetoothService");
    Serial.println("   Protocol: BLE (NimBLE)");
    Serial.println("   Capabilities: Device discovery, control, distance calculation");
    Serial.println("   Endpoints: /bluetooth/*");
    Serial.printf("   Status: %s\n", scanning ? "Scanning" : "Idle");
    Serial.printf("   Devices: %d discovered\n", devices.size());
    Serial.println("========================================");
}

#endif // ENABLE_BLUETOOTH_DEVICES

// Made with Bob