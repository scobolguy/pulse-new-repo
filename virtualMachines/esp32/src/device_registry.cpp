#include "device_registry.h"
#include <FS.h>
#include <LittleFS.h>

// Global registry instance
DeviceRegistry* globalDeviceRegistry = nullptr;

void initializeDeviceRegistry() {
    if (globalDeviceRegistry == nullptr) {
        globalDeviceRegistry = new DeviceRegistry();
    }
}

DeviceRegistry::DeviceRegistry() : loaded(false), validated(false) {
    clearError();
}

DeviceRegistry::~DeviceRegistry() {
    // Cleanup if needed
}

bool DeviceRegistry::loadConfig(const char* configPath) {
    clearError();
    
    // Try to open file from LittleFS
    if (!LittleFS.begin()) {
        setError("Failed to mount LittleFS");
        return false;
    }
    
    File file = LittleFS.open(configPath, "r");
    if (!file) {
        setError("Failed to open config file");
        return false;
    }
    
    // Read file content
    String content = file.readString();
    file.close();
    
    return loadConfigFromString(content.c_str());
}

bool DeviceRegistry::loadConfigFromString(const char* jsonString) {
    clearError();
    
    // Parse JSON
    DeserializationError error = deserializeJson(configDoc, jsonString);
    if (error) {
        setError("JSON parse error");
        return false;
    }
    
    loaded = true;
    
    // Validate configuration
    return validateConfig();
}

bool DeviceRegistry::validateConfig() {
    clearError();
    
    // Check required fields
    if (!configDoc.containsKey("device")) {
        setError("Missing 'device' section");
        return false;
    }
    
    JsonObject device = configDoc["device"];
    if (!device.containsKey("id") || !device.containsKey("role")) {
        setError("Missing required device fields");
        return false;
    }
    
    // Validate hardware section if present
    if (configDoc.containsKey("hardware")) {
        JsonObject hardware = configDoc["hardware"];
        
        // Validate sensors
        if (hardware.containsKey("sensors")) {
            JsonArray sensors = hardware["sensors"];
            for (JsonObject sensor : sensors) {
                if (!sensor.containsKey("id") || !sensor.containsKey("type") || 
                    !sensor.containsKey("pin")) {
                    setError("Invalid sensor configuration");
                    return false;
                }
            }
        }
        
        // Validate actuators
        if (hardware.containsKey("actuators")) {
            JsonArray actuators = hardware["actuators"];
            for (JsonObject actuator : actuators) {
                if (!actuator.containsKey("id") || !actuator.containsKey("type") || 
                    !actuator.containsKey("pin")) {
                    setError("Invalid actuator configuration");
                    return false;
                }
            }
        }
    }
    
    validated = true;
    return true;
}

DeviceInfo DeviceRegistry::getDeviceInfo() const {
    DeviceInfo info;
    
    if (!loaded) return info;
    
    JsonObjectConst device = configDoc["device"];
    info.id = device["id"].as<std::string>();
    info.name = device["name"].as<std::string>();
    info.role = device["role"].as<std::string>();
    info.version = device["version"].as<std::string>();
    
    return info;
}

std::vector<SensorConfig> DeviceRegistry::getSensors() const {
    std::vector<SensorConfig> sensors;
    
    if (!loaded || !configDoc["hardware"].is<JsonObject>()) return sensors;
    
    JsonObjectConst hardware = configDoc["hardware"];
    if (!hardware["sensors"].is<JsonArray>()) return sensors;
    
    JsonArrayConst sensorArray = hardware["sensors"];
    for (JsonObjectConst sensorObj : sensorArray) {
        SensorConfig sensor;
        sensor.id = sensorObj["id"].as<std::string>();
        sensor.type = sensorObj["type"].as<std::string>();
        sensor.pin = sensorObj["pin"];
        sensor.enabled = sensorObj["enabled"] | true;
        sensor.sampleRate = sensorObj["sampleRate"] | 1000;
        
        if (sensorObj["calibration"].is<JsonObject>()) {
            JsonObjectConst cal = sensorObj["calibration"];
            sensor.calibrationOffset = cal["offset"] | 0.0f;
            sensor.calibrationScale = cal["scale"] | 1.0f;
        }
        
        sensors.push_back(sensor);
    }
    
    return sensors;
}

std::vector<ActuatorConfig> DeviceRegistry::getActuators() const {
    std::vector<ActuatorConfig> actuators;
    
    if (!loaded || !configDoc["hardware"].is<JsonObject>()) return actuators;
    
    JsonObjectConst hardware = configDoc["hardware"];
    if (!hardware["actuators"].is<JsonArray>()) return actuators;
    
    JsonArrayConst actuatorArray = hardware["actuators"];
    for (JsonObjectConst actuatorObj : actuatorArray) {
        ActuatorConfig actuator;
        actuator.id = actuatorObj["id"].as<std::string>();
        actuator.type = actuatorObj["type"].as<std::string>();
        actuator.pin = actuatorObj["pin"];
        actuator.enabled = actuatorObj["enabled"] | true;
        actuator.defaultValue = actuatorObj["defaultValue"] | 0;
        actuator.minValue = actuatorObj["minValue"] | 0;
        actuator.maxValue = actuatorObj["maxValue"] | 255;
        
        actuators.push_back(actuator);
    }
    
    return actuators;
}

SensorConfig DeviceRegistry::getSensor(const char* id) const {
    std::vector<SensorConfig> sensors = getSensors();
    for (const auto& sensor : sensors) {
        if (sensor.id == id) {
            return sensor;
        }
    }
    return SensorConfig();
}

ActuatorConfig DeviceRegistry::getActuator(const char* id) const {
    std::vector<ActuatorConfig> actuators = getActuators();
    for (const auto& actuator : actuators) {
        if (actuator.id == id) {
            return actuator;
        }
    }
    return ActuatorConfig();
}

NetworkConfig DeviceRegistry::getNetworkConfig() const {
    NetworkConfig config;
    
    if (!loaded || !configDoc["network"].is<JsonObject>()) return config;
    
    JsonObjectConst network = configDoc["network"];
    
    // WiFi
    if (network["wifi"].is<JsonObject>()) {
        JsonObjectConst wifi = network["wifi"];
        config.wifi.ssid = wifi["ssid"].as<std::string>();
        config.wifi.password = wifi["password"].as<std::string>();
        config.wifi.enabled = wifi["enabled"] | true;
        config.wifi.reconnectInterval = wifi["reconnectInterval"] | 5000;
    }
    
    // MQTT
    if (network["mqtt"].is<JsonObject>()) {
        JsonObjectConst mqtt = network["mqtt"];
        config.mqtt.broker = mqtt["broker"].as<std::string>();
        config.mqtt.port = mqtt["port"] | 1883;
        config.mqtt.username = mqtt["username"].as<std::string>();
        config.mqtt.password = mqtt["password"].as<std::string>();
        config.mqtt.enabled = mqtt["enabled"] | false;
    }
    
    // HTTP
    if (network["http"].is<JsonObject>()) {
        JsonObjectConst http = network["http"];
        config.http.port = http["port"] | 80;
        config.http.enabled = http["enabled"] | true;
    }
    
    return config;
}

WiFiConfig DeviceRegistry::getWiFiConfig() const {
    return getNetworkConfig().wifi;
}

MQTTConfig DeviceRegistry::getMQTTConfig() const {
    return getNetworkConfig().mqtt;
}

HTTPConfig DeviceRegistry::getHTTPConfig() const {
    return getNetworkConfig().http;
}

BrokerConfig DeviceRegistry::getBrokerConfig() const {
    BrokerConfig config;
    
    if (!loaded || !configDoc["broker"].is<JsonObject>()) return config;
    
    JsonObjectConst broker = configDoc["broker"];
    config.url = broker["url"].as<std::string>();
    config.port = broker["port"] | 5000;
    config.discoveryEnabled = broker["discoveryEnabled"] | true;
    config.discoveryInterval = broker["discoveryInterval"] | 30000;
    
    // Queues
    if (broker["queues"].is<JsonArray>()) {
        JsonArrayConst queues = broker["queues"];
        for (JsonObjectConst queueObj : queues) {
            QueueConfig queue;
            queue.name = queueObj["name"].as<std::string>();
            queue.maxSize = queueObj["maxSize"] | 100;
            queue.persistent = queueObj["persistent"] | false;
            config.queues.push_back(queue);
        }
    }
    
    return config;
}

std::vector<QueueConfig> DeviceRegistry::getQueues() const {
    return getBrokerConfig().queues;
}

StorageConfig DeviceRegistry::getStorageConfig() const {
    StorageConfig config;
    
    if (!loaded || !configDoc["storage"].is<JsonObject>()) return config;
    
    JsonObjectConst storage = configDoc["storage"];
    
    // SD Card
    if (storage["sdCard"].is<JsonObject>()) {
        JsonObjectConst sdCard = storage["sdCard"];
        config.sdCard.csPin = sdCard["csPin"] | 5;
        config.sdCard.chunkSize = sdCard["chunkSize"] | 512;
        config.sdCard.wearLevelingEnabled = sdCard["wearLevelingEnabled"] | true;
    }
    
    // SPIFFS
    if (storage["spiffs"].is<JsonObject>()) {
        JsonObjectConst spiffs = storage["spiffs"];
        config.spiffs.enabled = spiffs["enabled"] | true;
        config.spiffs.maxFiles = spiffs["maxFiles"] | 10;
    }
    
    return config;
}

SDCardConfig DeviceRegistry::getSDCardConfig() const {
    return getStorageConfig().sdCard;
}

DeviceSPIFFSConfig DeviceRegistry::getSPIFFSConfig() const {
    return getStorageConfig().spiffs;
}

SchedulerConfig DeviceRegistry::getSchedulerConfig() const {
    SchedulerConfig config;
    
    if (!loaded || !configDoc["scheduler"].is<JsonObject>()) return config;
    
    JsonObjectConst scheduler = configDoc["scheduler"];
    config.quantum = scheduler["quantum"] | 10;
    config.maxContexts = scheduler["maxContexts"] | 8;
    config.priorityLevels = scheduler["priorityLevels"] | 4;
    
    return config;
}

std::vector<LibraryConfig> DeviceRegistry::getLibraries() const {
    std::vector<LibraryConfig> libraries;
    
    if (!loaded || !configDoc["libraries"].is<JsonArray>()) return libraries;
    
    JsonArrayConst libraryArray = configDoc["libraries"];
    for (JsonObjectConst libObj : libraryArray) {
        LibraryConfig lib;
        lib.name = libObj["name"].as<std::string>();
        lib.path = libObj["path"].as<std::string>();
        lib.autoLoad = libObj["autoLoad"] | false;
        libraries.push_back(lib);
    }
    
    return libraries;
}

LoggingConfig DeviceRegistry::getLoggingConfig() const {
    LoggingConfig config;
    
    if (!loaded || !configDoc["logging"].is<JsonObject>()) return config;
    
    JsonObjectConst logging = configDoc["logging"];
    config.level = logging["level"].as<std::string>();
    config.serialEnabled = logging["serialEnabled"] | true;
    config.fileEnabled = logging["fileEnabled"] | false;
    config.filePath = logging["filePath"].as<std::string>();
    
    return config;
}

bool DeviceRegistry::updateSensor(const char* id, const SensorConfig& config) {
    if (!loaded || !configDoc.containsKey("hardware")) return false;
    
    JsonObject hardware = configDoc["hardware"];
    if (!hardware.containsKey("sensors")) return false;
    
    JsonArray sensors = hardware["sensors"];
    for (JsonObject sensor : sensors) {
        if (sensor["id"].as<std::string>() == id) {
            sensor["enabled"] = config.enabled;
            sensor["sampleRate"] = config.sampleRate;
            
            if (!sensor.containsKey("calibration")) {
                sensor.createNestedObject("calibration");
            }
            JsonObject cal = sensor["calibration"];
            cal["offset"] = config.calibrationOffset;
            cal["scale"] = config.calibrationScale;
            
            return true;
        }
    }
    
    return false;
}

bool DeviceRegistry::updateActuator(const char* id, const ActuatorConfig& config) {
    if (!loaded || !configDoc.containsKey("hardware")) return false;
    
    JsonObject hardware = configDoc["hardware"];
    if (!hardware.containsKey("actuators")) return false;
    
    JsonArray actuators = hardware["actuators"];
    for (JsonObject actuator : actuators) {
        if (actuator["id"].as<std::string>() == id) {
            actuator["enabled"] = config.enabled;
            actuator["defaultValue"] = config.defaultValue;
            actuator["minValue"] = config.minValue;
            actuator["maxValue"] = config.maxValue;
            
            return true;
        }
    }
    
    return false;
}

std::string DeviceRegistry::toJson() const {
    if (!loaded) return "{}";
    
    String output;
    serializeJsonPretty(configDoc, output);
    return output.c_str();
}

bool DeviceRegistry::saveConfig(const char* configPath) {
    if (!loaded) {
        setError("No configuration loaded");
        return false;
    }
    
    if (!LittleFS.begin()) {
        setError("Failed to mount LittleFS");
        return false;
    }
    
    File file = LittleFS.open(configPath, "w");
    if (!file) {
        setError("Failed to open file for writing");
        return false;
    }
    
    serializeJsonPretty(configDoc, file);
    file.close();
    
    return true;
}

void DeviceRegistry::setError(const char* error) {
    lastError = error;
}

void DeviceRegistry::clearError() {
    lastError = "";
}

// Made with Bob
