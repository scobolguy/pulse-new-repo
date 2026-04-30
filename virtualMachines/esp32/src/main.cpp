#include <Arduino.h>
#include <FS.h>
#include "main_globals.h"
#include <LittleFS.h>

#include <ArduinoJson.h>
#include "ConfigSchema.h"
#include "ClusterConfig.h"
#include "provision_routes.h"
#include "cluster_routes.h"

#ifdef ENABLE_PMACHINE
#include "pmachine.h"
#include "pmachine_routes.h"
#endif

#if defined(ENABLE_PMACHINE)
static pmachine::PMachine pm;
#endif
#include "ffs/FederatedFileSystem.h"
#include "ffs/FederatedFileSystemRoutes.h"
#if defined(ESP32)
#include <SD.h>
#endif


const FieldDescriptor ClusterConfig::schema[2] = {
    FIELD_DESC(ClusterConfig, clusterId, FieldType::StringType),
    FIELD_DESC(ClusterConfig, isGateway, FieldType::BoolType)
};
const FieldDescriptor WifiConfig::schema[2] = {
    FIELD_DESC(WifiConfig, ssid, FieldType::StringType),
    FIELD_DESC(WifiConfig, password, FieldType::StringType)
};

#if defined(ESP32)
#include <WiFi.h>
#include <WiFiUdp.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#endif
//bool ffsUp = false;

#include <ESPAsyncWebServer.h>
#include "NodeDiscovery.h"

bool ffsUp = false;
// Global config, PMachine, and FederatedFileSystem instances
ClusterConfig clusterConfig;
WifiConfig wifiConfig;
// EnumManager and PMachine
#ifdef ENABLE_PMACHINE
static EnumManager enumManager;
#endif
std::vector<uint8_t> pcode;
FederatedFileSystem federatedFS;
#include "NodeDiscovery.h"

AsyncWebServer server(80);
String nodeName = "esp32vm";



void notFound(AsyncWebServerRequest *request) {
    request->send(404, "text/plain", "Not found");
}

// ...existing code...

void setupWebServer() {
    #ifdef ENABLE_PMACHINE
    // Register example enum type for testing
    enumManager.registerEnum("Color", {"RED", "GREEN", "BLUE"});
    pm.setEnumManager(&enumManager);
    // Register all PMachine endpoints in one call
    registerPMachineRoutes(server, pm);
    #endif
    // Register all FFS endpoints in one call
    registerFFSRoutes(server, federatedFS);     
    // Register all Cluster endpoints in one call
    cluster::registerClusterRoutes(server);

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        File file = LittleFS.open("/web/index.html", "r");
        if (!file) {
            request->send(500, "text/plain", "Web page not found");
            return;
        }
        String html = file.readString();
        html.replace("{{NODE_NAME}}", nodeName);
        request->send(200, "text/html", html);
        file.close();
    });

    // Register all Provision endpoints in one call
    provision::registerProvisionRoutes(server);
    // Status endpoint: returns JSON with node info, services, discovered nodes
    server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "{";
        #if defined(ESP32)
        json += "\"hardware\":\"ESP32\",";
        #elif defined(ESP8266)
        json += "\"hardware\":\"ESP8266\",";
        #endif
        json += "\"nodeName\":\"" + nodeName + "\",";
        json += "\"services\":[";
        bool firstService = true;
        if (ffsUp) {
            json += "\"FFS\"";
            firstService = false;
        }
        #ifdef ENABLE_PMACHINE
        if (!firstService) json += ",";
        json += "\"pmachine\"";
        #endif
        json += "]";
        json += ",\"discoveredNodes\":[";
        bool first = true;
        for (const auto& pair : discoveredNodeTable) {
            if (!first) json += ",";
            json += "{\"mac\":\"" + pair.second.mac + "\",\"ip\":\"" + pair.second.ip + "\"}";
            first = false;
        }
        json += "]}";
        request->send(200, "application/json", json);
    });
    server.onNotFound(notFound);
    server.begin();
}


#define ANNOUNCE_PORT 4210
#define ANNOUNCE_INTERVAL 10000 // ms

WiFiUDP udp;
unsigned long lastAnnounce = 0;

// Helper to process incoming UDP packets (non-blocking)
void processIncomingUDP() {
    int packetSize = udp.parsePacket();
    if (packetSize > 0) {
        char incoming[256];
        int len = udp.read(incoming, sizeof(incoming) - 1);
        if (len > 0) {
            incoming[len] = '\0';
            Serial.print("Received UDP announcement: ");
            Serial.println(incoming);
            // Parse message: expected format "ESP32-VM online: <MAC> IP: <IP>"
            String msg = String(incoming);
            int macStart = msg.indexOf(": ");
            int ipStart = msg.indexOf("IP: ");
            if (macStart != -1 && ipStart != -1) {
                String mac = msg.substring(macStart + 2, ipStart - 1);
                String ip = msg.substring(ipStart + 4);
                mac.trim();
                ip.trim();
                String myMac = WiFi.macAddress();
                myMac.trim();
                Serial.print("Parsed MAC: "); Serial.println(mac);
                Serial.print("My MAC:    "); Serial.println(myMac);
                if (!mac.equalsIgnoreCase(myMac)) {
                    DiscoveredNode node;
                    node.mac = mac;
                    node.ip = ip;
                    node.lastSeen = millis();
                    discoveredNodeTable[mac] = node;
                    Serial.println("Node added to discoveredNodeTable.");
                } else {
                    Serial.println("Announcement from self, not adding.");
                }
            } else {
                Serial.println("Failed to parse MAC/IP from announcement.");
            }
        }
    }
}

#if 0 // UDP announcement and discovery disabled
#define ANNOUNCE_PORT 4210
#define ANNOUNCE_INTERVAL 10000 // ms
WiFiUDP udp;
unsigned long lastAnnounce = 0;
void processIncomingUDP() {
    int packetSize = udp.parsePacket();
    if (packetSize) {
        char incoming[128];
        int len = udp.read(incoming, sizeof(incoming) - 1);
        if (len > 0) {
            incoming[len] = 0;
            Serial.print("Received UDP announcement: ");
            Serial.println(incoming);
            // ...existing code for processing announcement...
        }
    }
}
void announcePresence() {
    String msg = nodeName + "," + WiFi.macAddress() + "," + WiFi.localIP().toString();
    udp.beginPacket("255.255.255.255", ANNOUNCE_PORT);
    udp.write((const uint8_t*)msg.c_str(), msg.length());
    udp.endPacket();
}
#endif

void announcePresence() {
    String msg = String("ESP32-VM online: ") + WiFi.macAddress() + " IP: " + WiFi.localIP().toString();
    udp.beginPacket("255.255.255.255", ANNOUNCE_PORT);
    udp.write((const uint8_t*)msg.c_str(), msg.length());
    udp.endPacket();
}

void setup() {
        /* TODO: If you want to load config at startup, use:
        loadConfigFromFile(clusterConfig, ClusterConfig::schema, 2, CONFIG_PATH);
        */
    Serial.begin(9600);
    delay(1000);

#if defined(ESP32)
    bool sdAvailable = false;
    if (SD.begin()) {
        Serial.println("SD card detected and mounted");
        sdAvailable = true;
    } else {
        Serial.println("No SD card detected, falling back to LittleFS");
    }
    if (!sdAvailable) {
        if (!LittleFS.begin()) {
            Serial.println("LittleFS mount failed");
            while (1) delay(1000);
        }
    }
#else
    if (!LittleFS.begin()) {
        Serial.println("LittleFS mount failed");
        while (1) delay(1000);
    }
#endif
    // Load node name if exists
    File f = LittleFS.open(NODE_NAME_PATH, "r");
    if (f) {
        nodeName = f.readString();
        f.close();
    }
    // Append last 4 hex digits of MAC for uniqueness
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char macSuffix[5];
    sprintf(macSuffix, "%02X%02X", mac[4], mac[5]);
    nodeName += "-";
    nodeName += macSuffix;
    WiFi.setHostname(nodeName.c_str());

    // Load WiFi credentials from LittleFS
    /* TODO: If you want to load WiFi config at startup, use:
    loadConfigFromFile(wifiConfig, WifiConfig::schema, 2, WIFI_CONFIG_PATH);
    */
    WiFi.mode(WIFI_STA);
    const char* ssid = wifiConfig.ssid.length() ? wifiConfig.ssid.c_str() : "Home";
    const char* password = wifiConfig.password.length() ? wifiConfig.password.c_str() : "Brady123";
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 30) {
        delay(500);
        Serial.print(".");
        retries++;
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("WiFi connected: " + WiFi.localIP().toString());
    } else {
        Serial.println("WiFi connection failed");
    }
    udp.begin(ANNOUNCE_PORT);
    announcePresence();
        /* UDP announcement disabled */
        // udp.begin(ANNOUNCE_PORT);
        // announcePresence();


    // Initialize FederatedFileSystem with SD if available, else LittleFS
#if defined(ESP32)
    if (sdAvailable) {
        ffsUp = federatedFS.begin(FFSBackend::SD, SD);
        if (ffsUp) {
            Serial.println("FederatedFileSystem is UP (SD backend)");
        } else {
            Serial.println("FederatedFileSystem failed to initialize SD");
        }
    } else {
        ffsUp = federatedFS.begin(FFSBackend::LittleFS, LittleFS);
        if (ffsUp) {
            Serial.println("FederatedFileSystem is UP (LittleFS backend)");
        } else {
            Serial.println("FederatedFileSystem failed to initialize LittleFS");
        }
    }
#else
    ffsUp = federatedFS.begin(FFSBackend::LittleFS, LittleFS);
    if (ffsUp) {
        Serial.println("FederatedFileSystem is UP (LittleFS backend)");
    } else {
        Serial.println("FederatedFileSystem failed to initialize LittleFS");
    }
#endif

#ifdef ENABLE_PMACHINE
    pm.setFFS(&federatedFS);
#endif

    // Web server for node name config (Async)
    setupWebServer();
}

void loop() {
    // Non-blocking UDP receive for node discovery
    processIncomingUDP();
        /* UDP announcement disabled */
        // processIncomingUDP();

    // Remove nodes not seen in last 10 minutes (600000 ms)
    unsigned long now = millis();
    for (auto it = discoveredNodeTable.begin(); it != discoveredNodeTable.end(); ) {
        if (now - it->second.lastSeen > 600000) {
            Serial.print("Node expired: ");
            Serial.println(it->second.mac);
            it = discoveredNodeTable.erase(it);
        } else {
            ++it;
        }
    }

    if (millis() - lastAnnounce > ANNOUNCE_INTERVAL) {
        announcePresence();
        lastAnnounce = millis();
        /* UDP announcement disabled */
        // if (millis() - lastAnnounce > ANNOUNCE_INTERVAL) {
        //     announcePresence();
        //     lastAnnounce = millis();
        // }
    }
    // No need for server.handleClient() with AsyncWebServer
    // Add VM logic here
}

