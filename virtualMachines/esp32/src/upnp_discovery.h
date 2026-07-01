#ifndef UPNP_DISCOVERY_H
#define UPNP_DISCOVERY_H

#ifdef ENABLE_PRINTER_SCANNER

#include <Arduino.h>
#include <WiFiUdp.h>
#include <vector>
#include <map>

/**
 * UPnP Device Information
 */
struct UPnPDevice {
    String usn;              // Unique Service Name
    String location;         // Device description URL
    String server;           // Server information
    String deviceType;       // UPnP device type
    String friendlyName;     // Human-readable name
    String manufacturer;     // Manufacturer name
    String modelName;        // Model name
    String modelNumber;      // Model number
    String serialNumber;     // Serial number
    String ipAddress;        // Extracted IP address
    int port;                // Extracted port
    unsigned long lastSeen;  // Last discovery time
    bool isPrinter;          // Is this a printer device
    bool isScanner;          // Is this a scanner device
    
    UPnPDevice() : port(0), lastSeen(0), isPrinter(false), isScanner(false) {}
};

/**
 * UPnP Discovery Service
 * 
 * Implements SSDP (Simple Service Discovery Protocol) for discovering
 * UPnP devices on the network, including printers and scanners.
 */
class UPnPDiscovery {
public:
    UPnPDiscovery();
    ~UPnPDiscovery();
    
    // Initialization
    bool begin();
    void end();
    
    // Discovery
    bool startDiscovery(const char* searchTarget = "ssdp:all");
    bool discoverPrinters();
    bool discoverScanners();
    void processResponses(unsigned long timeout = 3000);
    
    // Device access
    std::vector<UPnPDevice> getDevices() const;
    std::vector<UPnPDevice> getPrinters() const;
    std::vector<UPnPDevice> getScanners() const;
    UPnPDevice* getDevice(const String& usn);
    
    // Device details
    bool fetchDeviceDescription(UPnPDevice& device);
    
    // Callbacks
    typedef void (*DeviceDiscoveredCallback)(const UPnPDevice& device);
    void setDeviceDiscoveredCallback(DeviceDiscoveredCallback callback) {
        deviceDiscoveredCallback = callback;
    }
    
private:
    WiFiUDP udp;
    std::map<String, UPnPDevice> devices;
    DeviceDiscoveredCallback deviceDiscoveredCallback;
    unsigned long lastDiscovery;
    
    // SSDP constants
    static const char* SSDP_MULTICAST_ADDR;
    static const int SSDP_PORT = 1900;
    
    // Helper methods
    void sendMSearch(const char* searchTarget);
    bool parseResponse(const String& response, UPnPDevice& device);
    bool parseDeviceDescription(const String& xml, UPnPDevice& device);
    String httpGet(const String& url);
    void extractIPAndPort(const String& location, String& ip, int& port);
    bool isDeviceType(const String& deviceType, const char* type);
    void notifyDeviceDiscovered(const UPnPDevice& device);
};

// UPnP device type constants
#define UPNP_PRINTER_BASIC "urn:schemas-upnp-org:device:Printer:1"
#define UPNP_PRINTER_ENHANCED "urn:schemas-upnp-org:device:Printer:2"
#define UPNP_SCANNER_BASIC "urn:schemas-upnp-org:device:Scanner:1"
#define UPNP_SCANNER_ENHANCED "urn:schemas-upnp-org:device:Scanner:2"
#define UPNP_MULTIFUNCTION "urn:schemas-upnp-org:device:MultiFunction:1"

#endif // ENABLE_PRINTER_SCANNER

#endif // UPNP_DISCOVERY_H

// Made with Bob