#ifndef BLUETOOTH_SERVICE_H
#define BLUETOOTH_SERVICE_H

#ifdef ENABLE_BLUETOOTH_DEVICES

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <vector>
#include <map>
#include <ArduinoJson.h>

/**
 * Bluetooth Device Type
 */
enum class BLEDeviceType : uint8_t {
    UNKNOWN = 0,
    LIGHTBULB = 1,
    OUTLET = 2,
    WATER_CONTROLLER = 3,
    WATCH = 4,
    SENSOR = 5,
    SPEAKER = 6,
    OTHER = 7
};

/**
 * Bluetooth Device Information
 */
struct BluetoothDevice {
    String address;              // MAC address (unique identifier)
    String name;                 // Device name
    BLEDeviceType type;          // Device type
    String manufacturer;         // Manufacturer name
    int rssi;                    // Signal strength (dBm)
    float distanceFeet;          // Estimated distance in feet
    float distanceMeters;        // Estimated distance in meters
    bool controllable;           // Can be controlled (false for watches)
    bool connected;              // Connection status
    unsigned long lastSeen;      // Last discovery time
    unsigned long firstSeen;     // First discovery time
    
    // BLE specific
    std::vector<String> serviceUUIDs;  // Advertised service UUIDs
    String manufacturerData;     // Manufacturer specific data
    
    // Control state
    bool powerState;             // On/off state
    int brightness;              // Brightness level (0-100)
    String color;                // Color (hex format)
    
    BluetoothDevice()
        : address(""), name(""), type(BLEDeviceType::UNKNOWN),
          manufacturer(""), rssi(0), distanceFeet(0.0f), distanceMeters(0.0f),
          controllable(true), connected(false), lastSeen(0), firstSeen(0),
          powerState(false), brightness(100), color("#FFFFFF") {}
};

/**
 * BLE Scan Callback
 */
class BLEScanCallback : public NimBLEAdvertisedDeviceCallbacks {
public:
    void onResult(NimBLEAdvertisedDevice* advertisedDevice) override;
    void setService(class BluetoothService* service) { bleService = service; }
    
private:
    class BluetoothService* bleService;
};

/**
 * BluetoothService Class
 * 
 * Manages Bluetooth Low Energy (BLE) device discovery and control.
 * Discovers smart home devices like lightbulbs, outlets, and water controllers.
 * Filters out watches from control but displays them for information.
 */
class BluetoothService {
public:
    BluetoothService();
    ~BluetoothService();
    
    // Initialization
    bool begin();
    void loop();
    void end();
    
    // Device Management
    bool addDevice(const BluetoothDevice& device);
    bool removeDevice(const String& address);
    BluetoothDevice* getDevice(const String& address);
    std::vector<BluetoothDevice> getAllDevices();
    std::vector<BluetoothDevice> getControllableDevices();
    std::vector<BluetoothDevice> getDevicesByType(BLEDeviceType type);
    int getDeviceCount() const { return devices.size(); }
    
    // Discovery
    bool startScan(int duration = 10);
    void stopScan();
    bool isScanning() const { return scanning; }
    void processDiscoveredDevice(BLEAdvertisedDevice* device);
    
    // Device Control
    bool connectDevice(const String& address);
    bool disconnectDevice(const String& address);
    bool controlDevice(const String& address, const String& action, const JsonDocument& params);
    bool setPowerState(const String& address, bool on);
    bool setBrightness(const String& address, int brightness);
    bool setColor(const String& address, const String& color);
    
    // Device Type Detection
    BLEDeviceType detectDeviceType(NimBLEAdvertisedDevice* device);
    bool isWatchDevice(NimBLEAdvertisedDevice* device);
    bool isLightbulb(NimBLEAdvertisedDevice* device);
    bool isOutlet(NimBLEAdvertisedDevice* device);
    bool isWaterController(NimBLEAdvertisedDevice* device);
    
    // Status
    String getDeviceStatus(const String& address);
    void updateAllDeviceStatus();
    
    // Configuration getters/setters
    int getScanInterval() const { return scanInterval; }
    void setScanInterval(int interval) { scanInterval = interval; }
    int getScanDuration() const { return scanDuration; }
    void setScanDuration(int duration) { scanDuration = duration; }
    int getStatusCheckInterval() const { return statusCheckInterval; }
    void setStatusCheckInterval(int interval) { statusCheckInterval = interval; }
    bool isAutoDiscoveryEnabled() const { return autoDiscovery; }
    void setAutoDiscovery(bool enabled) { autoDiscovery = enabled; }
    
    // Configuration
    bool loadConfig(const char* configPath);
    bool saveConfig(const char* configPath);
    String toJson();
    
    // Alexa Integration
    #ifndef DISABLE_ALEXA_INTERFACE
    bool handleAlexaCommand(const String& address, const String& command,
                           const JsonDocument& params);
    JsonDocument getAlexaDiscoveryResponse();
    JsonDocument getDeviceAlexaCapabilities(const String& address);
    #endif
    
    // Callbacks
    typedef void (*DeviceDiscoveredCallback)(const BluetoothDevice& device);
    typedef void (*DeviceStatusCallback)(const String& address, const String& status);
    void setDeviceDiscoveredCallback(DeviceDiscoveredCallback callback) {
        deviceDiscoveredCallback = callback;
    }
    void setStatusCallback(DeviceStatusCallback callback) {
        statusCallback = callback;
    }
    
    // Service registration and advertisement
    String getServiceManifest() const;
    String getServiceCapabilities() const;
    void registerService();
    
private:
    std::map<String, BluetoothDevice> devices;
    NimBLEScan* pBLEScan;
    BLEScanCallback* scanCallback;
    bool scanning;
    unsigned long lastScan;
    unsigned long lastStatusCheck;
    DeviceDiscoveredCallback deviceDiscoveredCallback;
    DeviceStatusCallback statusCallback;
    
    // Configuration
    int scanInterval;           // Auto-scan interval (ms)
    int scanDuration;           // Scan duration (seconds)
    int statusCheckInterval;    // Status check interval (ms)
    bool autoDiscovery;         // Enable auto-discovery
    bool excludeWatches;        // Exclude watches from control
    
    // Helper methods
    String extractManufacturer(NimBLEAdvertisedDevice* device);
    bool hasService(NimBLEAdvertisedDevice* device, const char* serviceUUID);
    void notifyDeviceDiscovered(const BluetoothDevice& device);
    void notifyStatusChange(const String& address, const String& status);
    String deviceTypeToString(BLEDeviceType type);
    BLEDeviceType stringToDeviceType(const String& typeStr);
    float calculateDistance(int rssi, int txPower = -59);
    void cleanupStaleDevices();
    
    // BLE Service UUIDs for device type detection
    static const char* UUID_HEART_RATE;
    static const char* UUID_FITNESS;
    static const char* UUID_BATTERY;
    static const char* UUID_DEVICE_INFO;
    static const char* UUID_LIGHTING;
    static const char* UUID_AUTOMATION;
};

// Global instance
extern BluetoothService* globalBluetoothService;

// Initialization helper
void initializeBluetoothService();

#endif // ENABLE_BLUETOOTH_DEVICES

#endif // BLUETOOTH_SERVICE_H

// Made with Bob