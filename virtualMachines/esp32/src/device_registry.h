#ifndef DEVICE_REGISTRY_H
#define DEVICE_REGISTRY_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include <map>
#include <string>

// Forward declarations
struct DeviceInfo;
struct SensorConfig;
struct ActuatorConfig;
struct NetworkConfig;
struct BrokerConfig;
struct StorageConfig;
struct SchedulerConfig;
struct LibraryConfig;
struct LoggingConfig;

/**
 * Device Information
 */
struct DeviceInfo {
    std::string id;
    std::string name;
    std::string role;
    std::string version;
    
    DeviceInfo() : id(""), name(""), role(""), version("") {}
};

/**
 * Sensor Configuration
 */
struct SensorConfig {
    std::string id;
    std::string type;
    int pin;
    bool enabled;
    int sampleRate;
    float calibrationOffset;
    float calibrationScale;
    
    SensorConfig() : id(""), type(""), pin(-1), enabled(true), 
                     sampleRate(1000), calibrationOffset(0.0f), 
                     calibrationScale(1.0f) {}
};

/**
 * Actuator Configuration
 */
struct ActuatorConfig {
    std::string id;
    std::string type;
    int pin;
    bool enabled;
    int defaultValue;
    int minValue;
    int maxValue;
    
    ActuatorConfig() : id(""), type(""), pin(-1), enabled(true),
                       defaultValue(0), minValue(0), maxValue(255) {}
};

/**
 * WiFi Configuration
 */
struct WiFiConfig {
    std::string ssid;
    std::string password;
    bool enabled;
    int reconnectInterval;
    
    WiFiConfig() : ssid(""), password(""), enabled(true), 
                   reconnectInterval(5000) {}
};

/**
 * MQTT Configuration
 */
struct MQTTConfig {
    std::string broker;
    int port;
    std::string username;
    std::string password;
    bool enabled;
    
    MQTTConfig() : broker(""), port(1883), username(""), 
                   password(""), enabled(false) {}
};

/**
 * HTTP Configuration
 */
struct HTTPConfig {
    int port;
    bool enabled;
    
    HTTPConfig() : port(80), enabled(true) {}
};

/**
 * Network Configuration
 */
struct NetworkConfig {
    WiFiConfig wifi;
    MQTTConfig mqtt;
    HTTPConfig http;
    
    NetworkConfig() {}
};

/**
 * Queue Configuration
 */
struct QueueConfig {
    std::string name;
    int maxSize;
    bool persistent;
    
    QueueConfig() : name(""), maxSize(100), persistent(false) {}
};

/**
 * Broker Configuration
 */
struct BrokerConfig {
    std::string url;
    int port;
    bool discoveryEnabled;
    int discoveryInterval;
    std::vector<QueueConfig> queues;
    
    BrokerConfig() : url(""), port(5000), discoveryEnabled(true),
                     discoveryInterval(30000) {}
};

/**
 * SD Card Configuration
 */
struct SDCardConfig {
    int csPin;
    int chunkSize;
    bool wearLevelingEnabled;
    
    SDCardConfig() : csPin(5), chunkSize(512), wearLevelingEnabled(true) {}
};

/**
 * SPIFFS Configuration
 */
struct DeviceSPIFFSConfig {
    bool enabled;
    int maxFiles;
    
    DeviceSPIFFSConfig() : enabled(true), maxFiles(10) {}
};

/**
 * Storage Configuration
 */
struct StorageConfig {
    SDCardConfig sdCard;
    DeviceSPIFFSConfig spiffs;
    
    StorageConfig() {}
};

/**
 * Scheduler Configuration
 */
struct SchedulerConfig {
    int quantum;
    int maxContexts;
    int priorityLevels;
    
    SchedulerConfig() : quantum(10), maxContexts(8), priorityLevels(4) {}
};

/**
 * Library Configuration
 */
struct LibraryConfig {
    std::string name;
    std::string path;
    bool autoLoad;
    
    LibraryConfig() : name(""), path(""), autoLoad(false) {}
};

/**
 * Logging Configuration
 */
struct LoggingConfig {
    std::string level;
    bool serialEnabled;
    bool fileEnabled;
    std::string filePath;
    
    LoggingConfig() : level("INFO"), serialEnabled(true), 
                      fileEnabled(false), filePath("/logs/system.log") {}
};

/**
 * Device Registry
 * 
 * Manages device configuration loaded from JSON schema-compliant files.
 * Provides type-safe access to all configuration sections.
 */
class DeviceRegistry {
public:
    DeviceRegistry();
    ~DeviceRegistry();
    
    // Configuration loading
    bool loadConfig(const char* configPath);
    bool loadConfigFromString(const char* jsonString);
    bool validateConfig();
    
    // Device information
    DeviceInfo getDeviceInfo() const;
    
    // Hardware configuration
    std::vector<SensorConfig> getSensors() const;
    std::vector<ActuatorConfig> getActuators() const;
    SensorConfig getSensor(const char* id) const;
    ActuatorConfig getActuator(const char* id) const;
    
    // Network configuration
    NetworkConfig getNetworkConfig() const;
    WiFiConfig getWiFiConfig() const;
    MQTTConfig getMQTTConfig() const;
    HTTPConfig getHTTPConfig() const;
    
    // Broker configuration
    BrokerConfig getBrokerConfig() const;
    std::vector<QueueConfig> getQueues() const;
    
    // Storage configuration
    StorageConfig getStorageConfig() const;
    SDCardConfig getSDCardConfig() const;
    DeviceSPIFFSConfig getSPIFFSConfig() const;
    
    // Scheduler configuration
    SchedulerConfig getSchedulerConfig() const;
    
    // Library configuration
    std::vector<LibraryConfig> getLibraries() const;
    
    // Logging configuration
    LoggingConfig getLoggingConfig() const;
    
    // Dynamic updates
    bool updateSensor(const char* id, const SensorConfig& config);
    bool updateActuator(const char* id, const ActuatorConfig& config);
    
    // Status
    bool isLoaded() const { return loaded; }
    bool isValidated() const { return validated; }
    const char* getLastError() const { return lastError.c_str(); }
    
    // Serialization
    std::string toJson() const;
    bool saveConfig(const char* configPath);
    
private:
    JsonDocument configDoc;
    bool loaded;
    bool validated;
    std::string lastError;
    
    // Helper methods
    bool parseDeviceInfo();
    bool parseHardware();
    bool parseNetwork();
    bool parseBroker();
    bool parseStorage();
    bool parseScheduler();
    bool parseLibraries();
    bool parseLogging();
    
    void setError(const char* error);
    void clearError();
};

// Global registry instance
extern DeviceRegistry* globalDeviceRegistry;

// Initialization helper
void initializeDeviceRegistry();

#endif // DEVICE_REGISTRY_H

// Made with Bob
