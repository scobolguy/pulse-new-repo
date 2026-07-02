#ifndef WIFI_PROVISIONING_H
#define WIFI_PROVISIONING_H

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>

/**
 * WiFi Provisioning System
 * 
 * Provides multiple methods to provision WiFi credentials without hardcoding:
 * 1. Captive Portal - AP mode with web interface
 * 2. BLE Provisioning - Bluetooth Low Energy setup
 * 3. WPS - Push-button WiFi Protected Setup
 * 4. Persistent Storage - Save/load credentials from LittleFS
 */

enum ProvisioningMethod {
    PROV_NONE,
    PROV_CAPTIVE_PORTAL,
    PROV_WIFI_SCANNER,
    PROV_BLE,
    PROV_WPS,
    PROV_STORED
};

struct WiFiCredentials {
    String ssid;
    String password;
    String hostname;
    bool dhcp;
    String staticIP;
    String gateway;
    String subnet;
    String dns1;
    String dns2;
    
    WiFiCredentials() : dhcp(true) {}
};

class WiFiProvisioning {
public:
    WiFiProvisioning();
    ~WiFiProvisioning();
    
    /**
     * Initialize provisioning system
     * @param deviceName Device name for AP and BLE
     * @return true if initialization successful
     */
    bool begin(const char* deviceName = "ESP32-Device");
    
    /**
     * Check if WiFi credentials are stored
     * @return true if credentials exist
     */
    bool hasStoredCredentials();
    
    /**
     * Load stored WiFi credentials
     * @param creds Output credentials
     * @return true if loaded successfully
     */
    bool loadCredentials(WiFiCredentials& creds);
    
    /**
     * Save WiFi credentials to persistent storage
     * @param creds Credentials to save
     * @return true if saved successfully
     */
    bool saveCredentials(const WiFiCredentials& creds);
    
    /**
     * Clear stored credentials
     * @return true if cleared successfully
     */
    bool clearCredentials();
    
    /**
     * Start captive portal for WiFi setup
     * @param timeout Timeout in seconds (0 = no timeout)
     * @return true if credentials received
     */
    bool startCaptivePortal(uint32_t timeout = 300);
    
    /**
     * Start BLE provisioning
     * @param timeout Timeout in seconds (0 = no timeout)
     * @return true if credentials received
     */
    bool startBLEProvisioning(uint32_t timeout = 300);

    /**
     * Start WiFi scanner mode
     * Performs a WiFi network scan and keeps results available via portal scan route
     * @param timeout Timeout in seconds (reserved for future use)
     * @return true if scan completed
     */
    bool startWiFiScanner(uint32_t timeout = 30);
    
    /**
     * Start WPS provisioning
     * @param timeout Timeout in seconds (default 120)
     * @return true if credentials received
     */
    bool startWPSProvisioning(uint32_t timeout = 120);
    
    /**
     * Connect to WiFi using stored or provided credentials
     * @param creds Credentials (optional, uses stored if null)
     * @param timeout Connection timeout in seconds
     * @return true if connected
     */
    bool connectWiFi(const WiFiCredentials* creds = nullptr, uint32_t timeout = 30);
    
    /**
     * Auto-provision WiFi
     * Tries stored credentials, then falls back to captive portal
     * @return true if connected
     */
    bool autoProvision();
    
    /**
     * Check if WiFi is connected
     * @return true if connected
     */
    bool isConnected();
    
    /**
     * Get current WiFi status
     * @return WiFi status string
     */
    String getStatus();
    
    /**
     * Get provisioning method used
     * @return Provisioning method
     */
    ProvisioningMethod getProvisioningMethod() const { return provMethod; }
    
    /**
     * Set provision button GPIO
     * Hold button on boot to enter provisioning mode
     * @param pin GPIO pin number
     * @param activeLevel Active level (LOW or HIGH)
     */
    void setProvisionButton(int pin, int activeLevel = LOW);
    
    /**
     * Check if provision button is pressed
     * @return true if button pressed
     */
    bool isProvisionButtonPressed();
    
    /**
     * Update loop - call periodically
     */
    void update();
    
private:
    String deviceName;
    WiFiCredentials currentCreds;
    ProvisioningMethod provMethod;
    
    // Captive portal
    DNSServer* dnsServer;
    AsyncWebServer* portalServer;
    bool portalActive;
    bool credsReceived;
    unsigned long portalStartTime;
    uint32_t portalTimeout;
    
    // Provision button
    int provButtonPin;
    int provButtonActiveLevel;
    bool provButtonEnabled;
    
    // Helper methods
    void setupCaptivePortal();
    void stopCaptivePortal();
    String generatePortalHTML();
    void handlePortalRoot(AsyncWebServerRequest* request);
    void handlePortalSave(AsyncWebServerRequest* request);
    void handlePortalScan(AsyncWebServerRequest* request);
    bool configureStaticIP(const WiFiCredentials& creds);
};

// Global instance
extern WiFiProvisioning* globalWiFiProvisioning;

// Register WiFi provisioning API routes on an existing server
void registerWiFiProvisioningRoutes(AsyncWebServer& server);

// Initialization helper
void initializeWiFiProvisioning(const char* deviceName = "ESP32-Device");

#endif // WIFI_PROVISIONING_H

// Made with Bob