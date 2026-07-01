#ifdef ENABLE_PRINTER_SCANNER

#include "upnp_discovery.h"
#include <WiFi.h>
#include <HTTPClient.h>

// SSDP Multicast address
const char* UPnPDiscovery::SSDP_MULTICAST_ADDR = "239.255.255.250";

UPnPDiscovery::UPnPDiscovery() 
    : deviceDiscoveredCallback(nullptr), lastDiscovery(0) {
}

UPnPDiscovery::~UPnPDiscovery() {
    end();
}

bool UPnPDiscovery::begin() {
    Serial.println("UPnPDiscovery: Initializing...");
    
    if (!udp.begin(SSDP_PORT)) {
        Serial.println("UPnPDiscovery: Failed to start UDP");
        return false;
    }
    
    Serial.println("UPnPDiscovery: Initialized successfully");
    return true;
}

void UPnPDiscovery::end() {
    udp.stop();
    devices.clear();
}

// ============================================================================
// Discovery Methods
// ============================================================================

bool UPnPDiscovery::startDiscovery(const char* searchTarget) {
    Serial.printf("UPnPDiscovery: Starting discovery for %s\n", searchTarget);
    
    sendMSearch(searchTarget);
    lastDiscovery = millis();
    
    return true;
}

bool UPnPDiscovery::discoverPrinters() {
    Serial.println("UPnPDiscovery: Discovering printers...");
    
    // Search for printer devices
    sendMSearch(UPNP_PRINTER_BASIC);
    delay(100);
    sendMSearch(UPNP_PRINTER_ENHANCED);
    delay(100);
    sendMSearch(UPNP_MULTIFUNCTION);
    
    return true;
}

bool UPnPDiscovery::discoverScanners() {
    Serial.println("UPnPDiscovery: Discovering scanners...");
    
    // Search for scanner devices
    sendMSearch(UPNP_SCANNER_BASIC);
    delay(100);
    sendMSearch(UPNP_SCANNER_ENHANCED);
    delay(100);
    sendMSearch(UPNP_MULTIFUNCTION);
    
    return true;
}

void UPnPDiscovery::processResponses(unsigned long timeout) {
    unsigned long start = millis();
    int responseCount = 0;
    
    while (millis() - start < timeout) {
        int packetSize = udp.parsePacket();
        
        if (packetSize > 0) {
            char buffer[1024];
            int len = udp.read(buffer, sizeof(buffer) - 1);
            buffer[len] = '\0';
            
            String response = String(buffer);
            UPnPDevice device;
            
            if (parseResponse(response, device)) {
                // Check if device already exists
                auto it = devices.find(device.usn);
                if (it == devices.end()) {
                    // New device discovered
                    device.lastSeen = millis();
                    devices[device.usn] = device;
                    
                    Serial.printf("UPnPDiscovery: New device found - %s\n", device.usn.c_str());
                    
                    // Fetch detailed device description
                    if (fetchDeviceDescription(devices[device.usn])) {
                        Serial.printf("UPnPDiscovery: Device details: %s (%s)\n", 
                                      devices[device.usn].friendlyName.c_str(),
                                      devices[device.usn].modelName.c_str());
                    }
                    
                    notifyDeviceDiscovered(devices[device.usn]);
                    responseCount++;
                } else {
                    // Update last seen time
                    it->second.lastSeen = millis();
                }
            }
        }
        
        yield();
    }
    
    Serial.printf("UPnPDiscovery: Processed %d responses\n", responseCount);
}

// ============================================================================
// Device Access
// ============================================================================

std::vector<UPnPDevice> UPnPDiscovery::getDevices() const {
    std::vector<UPnPDevice> result;
    for (const auto& pair : devices) {
        result.push_back(pair.second);
    }
    return result;
}

std::vector<UPnPDevice> UPnPDiscovery::getPrinters() const {
    std::vector<UPnPDevice> result;
    for (const auto& pair : devices) {
        if (pair.second.isPrinter) {
            result.push_back(pair.second);
        }
    }
    return result;
}

std::vector<UPnPDevice> UPnPDiscovery::getScanners() const {
    std::vector<UPnPDevice> result;
    for (const auto& pair : devices) {
        if (pair.second.isScanner) {
            result.push_back(pair.second);
        }
    }
    return result;
}

UPnPDevice* UPnPDiscovery::getDevice(const String& usn) {
    auto it = devices.find(usn);
    if (it != devices.end()) {
        return &(it->second);
    }
    return nullptr;
}

// ============================================================================
// Device Description Fetching
// ============================================================================

bool UPnPDiscovery::fetchDeviceDescription(UPnPDevice& device) {
    if (device.location.isEmpty()) {
        return false;
    }
    
    Serial.printf("UPnPDiscovery: Fetching description from %s\n", device.location.c_str());
    
    String xml = httpGet(device.location);
    if (xml.isEmpty()) {
        Serial.println("UPnPDiscovery: Failed to fetch device description");
        return false;
    }
    
    return parseDeviceDescription(xml, device);
}

// ============================================================================
// Helper Methods
// ============================================================================

void UPnPDiscovery::sendMSearch(const char* searchTarget) {
    String message = "M-SEARCH * HTTP/1.1\r\n";
    message += "HOST: 239.255.255.250:1900\r\n";
    message += "MAN: \"ssdp:discover\"\r\n";
    message += "MX: 3\r\n";
    message += "ST: ";
    message += searchTarget;
    message += "\r\n\r\n";
    
    IPAddress multicast;
    multicast.fromString(SSDP_MULTICAST_ADDR);
    
    udp.beginPacket(multicast, SSDP_PORT);
    udp.write((const uint8_t*)message.c_str(), message.length());
    udp.endPacket();
}

bool UPnPDiscovery::parseResponse(const String& response, UPnPDevice& device) {
    // Parse SSDP response headers
    int locationIdx = response.indexOf("LOCATION:");
    if (locationIdx == -1) {
        locationIdx = response.indexOf("Location:");
    }
    if (locationIdx != -1) {
        int endIdx = response.indexOf("\r\n", locationIdx);
        device.location = response.substring(locationIdx + 9, endIdx);
        device.location.trim();
        
        // Extract IP and port from location
        extractIPAndPort(device.location, device.ipAddress, device.port);
    }
    
    int usnIdx = response.indexOf("USN:");
    if (usnIdx == -1) {
        usnIdx = response.indexOf("usn:");
    }
    if (usnIdx != -1) {
        int endIdx = response.indexOf("\r\n", usnIdx);
        device.usn = response.substring(usnIdx + 4, endIdx);
        device.usn.trim();
    }
    
    int serverIdx = response.indexOf("SERVER:");
    if (serverIdx == -1) {
        serverIdx = response.indexOf("Server:");
    }
    if (serverIdx != -1) {
        int endIdx = response.indexOf("\r\n", serverIdx);
        device.server = response.substring(serverIdx + 7, endIdx);
        device.server.trim();
    }
    
    int stIdx = response.indexOf("ST:");
    if (stIdx == -1) {
        stIdx = response.indexOf("st:");
    }
    if (stIdx != -1) {
        int endIdx = response.indexOf("\r\n", stIdx);
        device.deviceType = response.substring(stIdx + 3, endIdx);
        device.deviceType.trim();
        
        // Determine if printer or scanner
        device.isPrinter = isDeviceType(device.deviceType, "Printer") || 
                          isDeviceType(device.deviceType, "MultiFunction");
        device.isScanner = isDeviceType(device.deviceType, "Scanner") || 
                          isDeviceType(device.deviceType, "MultiFunction");
    }
    
    return !device.usn.isEmpty() && !device.location.isEmpty();
}

bool UPnPDiscovery::parseDeviceDescription(const String& xml, UPnPDevice& device) {
    // Simple XML parsing for device description
    // Extract friendlyName
    int nameStart = xml.indexOf("<friendlyName>");
    if (nameStart != -1) {
        nameStart += 14;
        int nameEnd = xml.indexOf("</friendlyName>", nameStart);
        device.friendlyName = xml.substring(nameStart, nameEnd);
    }
    
    // Extract manufacturer
    int mfgStart = xml.indexOf("<manufacturer>");
    if (mfgStart != -1) {
        mfgStart += 14;
        int mfgEnd = xml.indexOf("</manufacturer>", mfgStart);
        device.manufacturer = xml.substring(mfgStart, mfgEnd);
    }
    
    // Extract modelName
    int modelStart = xml.indexOf("<modelName>");
    if (modelStart != -1) {
        modelStart += 11;
        int modelEnd = xml.indexOf("</modelName>", modelStart);
        device.modelName = xml.substring(modelStart, modelEnd);
    }
    
    // Extract modelNumber
    int numStart = xml.indexOf("<modelNumber>");
    if (numStart != -1) {
        numStart += 13;
        int numEnd = xml.indexOf("</modelNumber>", numStart);
        device.modelNumber = xml.substring(numStart, numEnd);
    }
    
    // Extract serialNumber
    int serialStart = xml.indexOf("<serialNumber>");
    if (serialStart != -1) {
        serialStart += 14;
        int serialEnd = xml.indexOf("</serialNumber>", serialStart);
        device.serialNumber = xml.substring(serialStart, serialEnd);
    }
    
    // Extract deviceType if not already set
    if (device.deviceType.isEmpty()) {
        int typeStart = xml.indexOf("<deviceType>");
        if (typeStart != -1) {
            typeStart += 12;
            int typeEnd = xml.indexOf("</deviceType>", typeStart);
            device.deviceType = xml.substring(typeStart, typeEnd);
            
            device.isPrinter = isDeviceType(device.deviceType, "Printer") || 
                              isDeviceType(device.deviceType, "MultiFunction");
            device.isScanner = isDeviceType(device.deviceType, "Scanner") || 
                              isDeviceType(device.deviceType, "MultiFunction");
        }
    }
    
    return !device.friendlyName.isEmpty();
}

String UPnPDiscovery::httpGet(const String& url) {
    HTTPClient http;
    http.begin(url);
    http.setTimeout(5000);
    
    int httpCode = http.GET();
    String payload = "";
    
    if (httpCode == HTTP_CODE_OK) {
        payload = http.getString();
    } else {
        Serial.printf("UPnPDiscovery: HTTP GET failed, code: %d\n", httpCode);
    }
    
    http.end();
    return payload;
}

void UPnPDiscovery::extractIPAndPort(const String& location, String& ip, int& port) {
    // Extract IP and port from URL like http://192.168.1.100:8080/description.xml
    int protocolEnd = location.indexOf("://");
    if (protocolEnd == -1) return;
    
    int hostStart = protocolEnd + 3;
    int portStart = location.indexOf(":", hostStart);
    int pathStart = location.indexOf("/", hostStart);
    
    if (portStart != -1 && portStart < pathStart) {
        ip = location.substring(hostStart, portStart);
        String portStr = location.substring(portStart + 1, pathStart);
        port = portStr.toInt();
    } else {
        if (pathStart != -1) {
            ip = location.substring(hostStart, pathStart);
        } else {
            ip = location.substring(hostStart);
        }
        port = 80; // Default HTTP port
    }
}

bool UPnPDiscovery::isDeviceType(const String& deviceType, const char* type) {
    return deviceType.indexOf(type) != -1;
}

void UPnPDiscovery::notifyDeviceDiscovered(const UPnPDevice& device) {
    if (deviceDiscoveredCallback) {
        deviceDiscoveredCallback(device);
    }
}

#endif // ENABLE_PRINTER_SCANNER

// Made with Bob