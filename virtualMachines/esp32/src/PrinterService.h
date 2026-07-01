#ifndef PRINTER_SERVICE_H
#define PRINTER_SERVICE_H

#include <Arduino.h>
#include <WiFi.h>
#include <vector>
#include <map>
#include <ArduinoJson.h>
#include "upnp_discovery.h"

/**
 * Printer/Scanner Device Information
 */
struct PrinterDevice {
    String id;              // Unique identifier
    String name;            // Friendly name
    String ipAddress;       // IP address
    int port;               // Port (typically 9100)
    String type;            // "printer" or "scanner"
    String model;           // Device model
    bool online;            // Connection status
    unsigned long lastSeen; // Last successful communication
    String status;          // Current status (idle, printing, error, etc.)
    
    PrinterDevice() : port(9100), online(false), lastSeen(0), status("unknown") {}
};

/**
 * Print Job Information
 */
struct PrintJob {
    String jobId;
    String deviceId;
    String documentName;
    int pages;
    String status;
    unsigned long startTime;
    unsigned long endTime;
    
    PrintJob() : pages(0), startTime(0), endTime(0) {}
};

/**
 * PrinterService Class
 * 
 * Manages network printers and scanners that use port 9100 (raw TCP/IP printing).
 * Provides discovery, status monitoring, and control capabilities.
 * Integrates with Alexa for voice control.
 */
class PrinterService {
public:
    PrinterService();
    ~PrinterService();
    
    // Initialization
    bool begin();
    void loop();
    
    // Device Management
    bool addDevice(const String& id, const String& name, const String& ipAddress, 
                   int port = 9100, const String& type = "printer");
    bool removeDevice(const String& id);
    PrinterDevice* getDevice(const String& id);
    std::vector<PrinterDevice> getAllDevices();
    int getDeviceCount() const { return devices.size(); }
    
    // Discovery
    bool discoverDevices(const String& networkPrefix = "192.168.1");
    bool scanNetwork(const String& startIP, const String& endIP);
    bool discoverUPnPDevices();
    std::vector<UPnPDevice> getUPnPDevices() const;
    
    // Device Operations
    bool sendRawData(const String& deviceId, const uint8_t* data, size_t length);
    bool sendTextDocument(const String& deviceId, const String& text);
    bool sendPCLCommand(const String& deviceId, const String& pclCommand);
    bool cancelJob(const String& deviceId);
    bool getStatus(const String& deviceId, String& status);
    bool startScan(const String& deviceId, const JsonDocument& scanParams);
    
    // Status Monitoring
    bool checkDeviceOnline(const String& deviceId);
    void updateAllDeviceStatus();
    String getDeviceStatus(const String& deviceId);
    
    // Alexa Integration
    bool handleAlexaPrintCommand(const String& deviceId, const String& command,
                                  const JsonDocument& params);
    bool handleAlexaScanCommand(const String& deviceId, const String& command,
                                 const JsonDocument& params);
    JsonDocument getAlexaDeviceState(const String& deviceId);
    
    // Configuration
    bool loadConfig(const char* configPath);
    bool saveConfig(const char* configPath);
    String toJson();
    
    
    // Alexa Discovery
    JsonDocument getAlexaDiscoveryResponse();
    JsonDocument getDeviceAlexaCapabilities(const String& deviceId);
    // Callbacks
    typedef void (*DeviceStatusCallback)(const String& deviceId, const String& status);
    void setStatusCallback(DeviceStatusCallback callback) { statusCallback = callback; }
    
    // UPnP callback
    void onUPnPDeviceDiscovered(const UPnPDevice& upnpDevice);
    
private:
    std::map<String, PrinterDevice> devices;
    std::vector<PrintJob> activeJobs;
    std::vector<UPnPDevice> upnpDevices;
    UPnPDiscovery upnpDiscovery;
    DeviceStatusCallback statusCallback;
    unsigned long lastDiscovery;
    unsigned long lastStatusCheck;
    
    // Helper methods
    bool connectToDevice(const String& ipAddress, int port, WiFiClient& client);
    bool sendCommand(WiFiClient& client, const uint8_t* data, size_t length);
    bool readResponse(WiFiClient& client, String& response, int timeout = 5000);
    bool probePort(const String& ipAddress, int port);
    String generateDeviceId(const String& ipAddress, const String& type);
    void notifyStatusChange(const String& deviceId, const String& status);
    
    // PCL/ESC/P Commands
    String getPCLReset();
    String getPCLStatus();
    String getESCPReset();
};

// Global instance
extern PrinterService* globalPrinterService;

// Initialization helper
void initializePrinterService();

#endif // PRINTER_SERVICE_H

// Made with Bob