#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>

#include <ArduinoJson.h>
#include "ConfigSchema.h"
#ifdef ENABLE_PMACHINE
#include "pmachine.h"
#endif
#include "ffs/FederatedFileSystem.h"
#if defined(ESP32)
#include <SD.h>
#endif

#define CONFIG_PATH "/config.json"


struct ClusterConfig {
    String clusterId = "default";
    bool isGateway = false;
    static const FieldDescriptor schema[2];
    static constexpr size_t schemaSize = 2;
};

struct WifiConfig {
    String ssid = "";
    String password = "";
    static const FieldDescriptor schema[2];
    static constexpr size_t schemaSize = 2;
};

const FieldDescriptor ClusterConfig::schema[2] = {
    FIELD_DESC(ClusterConfig, clusterId, FieldType::StringType),
    FIELD_DESC(ClusterConfig, isGateway, FieldType::BoolType)
};
const FieldDescriptor WifiConfig::schema[2] = {
    FIELD_DESC(WifiConfig, ssid, FieldType::StringType),
    FIELD_DESC(WifiConfig, password, FieldType::StringType)
};

#define CONFIG_PATH "/config.json"
#define WIFI_CONFIG_PATH "/wifi.json"
#define NODE_NAME_PATH "/node_name.txt"

#if defined(ESP32)
#include <WiFi.h>
#include <WiFiUdp.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#endif
#include <ESPAsyncWebServer.h>

// Global config, PMachine, and FederatedFileSystem instances
ClusterConfig clusterConfig;
WifiConfig wifiConfig;
#ifdef ENABLE_PMACHINE
pmachine::PMachine pm;
#endif
FederatedFileSystem federatedFS;
bool ffsUp = false;


#include <map>
struct DiscoveredNode {
    String mac;
    String ip;
    unsigned long lastSeen;
};
std::map<String, DiscoveredNode> discoveredNodeTable;

AsyncWebServer server(80);
String nodeName = "esp32vm";



void notFound(AsyncWebServerRequest *request) {
    request->send(404, "text/plain", "Not found");
}

// ...existing code...

void setupWebServer() {
            // FFS: List files endpoint
            server.on("/ffs/list", HTTP_GET, [](AsyncWebServerRequest *request){
                std::vector<String> files;
                if (federatedFS.listFiles(files) != FFSStatus::OK) {
                    request->send(500, "application/json", "[]");
                    return;
                }
                String json = "[";
                for (size_t i = 0; i < files.size(); ++i) {
                    if (i > 0) json += ",";
                    json += "\"" + files[i] + "\"";
                }
                json += "]";
                request->send(200, "application/json", json);
            });

            // FFS: List discovered nodes endpoint
            server.on("/ffs/nodes", HTTP_GET, [](AsyncWebServerRequest *request){
                String json = "[";
                bool first = true;
                for (const auto& pair : discoveredNodeTable) {
                    if (!first) json += ",";
                    json += "{\"mac\":\"" + pair.second.mac + "\",\"ip\":\"" + pair.second.ip + "\"}";
                    first = false;
                }
                json += "]";
                request->send(200, "application/json", json);
            });
        // Federated file chunk endpoint: /ffs/chunk?file=...&chunk=...&size=...
        server.on("/ffs/chunk", HTTP_GET, [](AsyncWebServerRequest *request){
            if (!request->hasParam("file") || !request->hasParam("chunk")) {
                request->send(400, "text/plain", "Missing file or chunk param");
                return;
            }
            String file = request->getParam("file")->value();
            size_t chunkIdx = request->getParam("chunk")->value().toInt();
            size_t chunkSize = 512;
            if (request->hasParam("size")) chunkSize = request->getParam("size")->value().toInt();
            std::vector<uint8_t> data;
            if (federatedFS.read(file, data) != FFSStatus::OK) {
                request->send(404, "text/plain", "File not found");
                return;
            }
            size_t offset = chunkIdx * chunkSize;
            if (offset >= data.size()) {
                request->send(416, "text/plain", "Chunk out of range");
                return;
            }
            size_t actualSize = std::min(chunkSize, data.size() - offset);
            // Compute CRC32
            uint32_t crc = 0xFFFFFFFF;
            for (size_t i = 0; i < actualSize; ++i) {
                uint8_t b = data[offset + i];
                crc ^= b;
                for (int k = 0; k < 8; ++k)
                    crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
            }
            crc ^= 0xFFFFFFFF;
            // Prepare response
            AsyncWebServerResponse *response = request->beginResponse_P(200, "application/octet-stream", &data[offset], actualSize);
            response->addHeader("X-Chunk-CRC32", String(crc, HEX));
            response->addHeader("X-Chunk-Offset", String(offset));
            response->addHeader("X-Chunk-Size", String(actualSize));
            response->addHeader("X-File-Size", String(data.size()));
            request->send(response);
        });
    // Serve cluster config UI
    server.on("/web/cluster.html", HTTP_GET, [](AsyncWebServerRequest *request){
        File file = LittleFS.open("/web/cluster.html", "r");
        if (!file) {
            request->send(500, "text/plain", "Config page not found");
            return;
        }
        String html = file.readString();
        request->send(200, "text/html", html);
        file.close();
    });
    // Cluster config endpoints
    server.on("/config/get", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        serializeWithSchema(clusterConfig, ClusterConfig::schema, 2, doc);
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });
    server.on("/config/set", HTTP_POST, [](AsyncWebServerRequest *request){
        if (request->hasParam("clusterId", true))
            clusterConfig.clusterId = request->getParam("clusterId", true)->value();
        if (request->hasParam("isGateway", true))
            clusterConfig.isGateway = request->getParam("isGateway", true)->value() == "true";
        saveConfigToFile(clusterConfig, ClusterConfig::schema, 2, CONFIG_PATH);
        saveConfigToFile(clusterConfig, ClusterConfig::schema, 2, CONFIG_PATH, LittleFS);
        request->send(200, "text/plain", "Config updated");
    });

#ifdef ENABLE_PMACHINE
    // PMachine status endpoint
    server.on("/pmachine/status", HTTP_GET, [](AsyncWebServerRequest *request){
        auto s = pm.getStatus();
        String json = "{";
        json += "\"numPages\":" + String(s.numPages) + ",";
        json += "\"backingFile\":\"" + String(s.backingFile.c_str()) + "\",";
        json += "\"maxSpace\":" + String((unsigned long)s.maxSpace) + ",";
        json += "\"dynamicLibs\":[";
        for (size_t i = 0; i < s.dynamicLibs.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + String(s.dynamicLibs[i].c_str()) + "\"";
        }
        json += "],";
        json += "\"running\":" + String(s.running ? "true" : "false") + ",";
        json += "\"pc\":" + String(s.pc) + ",";
        json += "\"breakpoints\":[";
        for (size_t i = 0; i < s.breakpoints.size(); ++i) {
            if (i > 0) json += ",";
            json += String(s.breakpoints[i]);
        }
        json += "]}";
        request->send(200, "application/json", json);
    });

    // PMachine program load (POST, expects raw binary in body, plus ?file= and ?max=)
    server.on("/pmachine/load", HTTP_POST, [](AsyncWebServerRequest *request){
        if (!request->hasParam("file") || !request->hasParam("max")) {
            request->send(400, "text/plain", "Missing file or max param");
            return;
        }
        String file = request->getParam("file")->value();
        size_t max = request->getParam("max")->value().toInt();
        // Read binary from body
        std::vector<uint8_t> pcode;
        if (request->hasParam("pcode", true)) {
            String bin = request->getParam("pcode", true)->value();
            pcode.assign(bin.begin(), bin.end());
        }
        bool ok = pm.loadProgram(pcode, file.c_str(), max);
        request->send(ok ? 200 : 500, "text/plain", ok ? "Loaded" : "Load failed");
    });

    // PMachine run
    server.on("/pmachine/run", HTTP_POST, [](AsyncWebServerRequest *request){
        pm.run();
        request->send(200, "text/plain", "Run complete");
    });

    // PMachine single step
    server.on("/pmachine/step", HTTP_POST, [](AsyncWebServerRequest *request){
        pm.singleStep();
        request->send(200, "text/plain", "Step complete");
    });

    // PMachine breakpoints
    server.on("/pmachine/break/set", HTTP_POST, [](AsyncWebServerRequest *request){
        if (!request->hasParam("pc")) {
            request->send(400, "text/plain", "Missing pc param");
            return;
        }
        uint16_t pc = request->getParam("pc")->value().toInt();
        pm.setBreakpoint(pc);
        request->send(200, "text/plain", "Breakpoint set");
    });
    server.on("/pmachine/break/clear", HTTP_POST, [](AsyncWebServerRequest *request){
        if (!request->hasParam("pc")) {
            request->send(400, "text/plain", "Missing pc param");
            return;
        }
        uint16_t pc = request->getParam("pc")->value().toInt();
        pm.clearBreakpoint(pc);
        request->send(200, "text/plain", "Breakpoint cleared");
    });
    server.on("/pmachine/break/clearall", HTTP_POST, [](AsyncWebServerRequest *request){
        pm.clearAllBreakpoints();
        request->send(200, "text/plain", "All breakpoints cleared");
    });

    // PMachine service endpoints
    server.on("/pmachine/pcode", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "{";
        bool first = true;
        for (const auto& pair : pm.getPCodeMap()) {
            if (!first) json += ",";
            json += "\"" + String(pair.first) + "\":\"0x" + String(pair.second, HEX) + "\"";
            first = false;
        }
        json += "}";
        request->send(200, "application/json", json);
    });
    server.on("/pmachine/memory", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "{";
        bool first = true;
        for (const auto& pair : pm.getMemoryMap()) {
            if (!first) json += ",";
            json += "\"" + String(pair.first) + "\":\"0x" + String(pair.second, HEX) + "\"";
            first = false;
        }
        json += "}";
        request->send(200, "application/json", json);
    });
    server.on("/pmachine/strings", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "[";
        auto pool = pm.getStringPool();
        for (size_t i = 0; i < pool.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + String(pool[i].c_str()) + "\"";
        }
        json += "]";
        request->send(200, "application/json", json);
    });
    server.on("/pmachine/enums", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "{";
        bool first = true;
        for (const auto& pair : pm.getEnumTypes()) {
            if (!first) json += ",";
            json += "\"" + String(pair.first.c_str()) + ":" + String(pair.second);
            first = false;
        }
        json += "}";
        request->send(200, "application/json", json);
    });
#endif
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

    // Provision endpoint: expects ssid, password, nodeName
    server.on("/provision", HTTP_POST, [](AsyncWebServerRequest *request){
        String ssid, password, newName;
        if (request->hasParam("ssid", true)) ssid = request->getParam("ssid", true)->value();
        if (request->hasParam("password", true)) password = request->getParam("password", true)->value();
        if (request->hasParam("nodeName", true)) newName = request->getParam("nodeName", true)->value();
        // Force SSID and password for logbin
        if (newName == "logbin") {
            ssid = "Home";
            password = "Brady123";
        }
        if (ssid.length() && password.length() && newName.length()) {
            nodeName = newName;
            File f = LittleFS.open(NODE_NAME_PATH, "w");
            if (f) {
                f.print(nodeName);
                f.close();
            }
            #if defined(ESP32)
            WiFi.setHostname(nodeName.c_str());
            #elif defined(ESP8266)
            WiFi.hostname(nodeName.c_str());
            #endif
            // Save WiFi credentials to LittleFS
            wifiConfig.ssid = ssid;
            wifiConfig.password = password;
            saveConfigToFile(wifiConfig, WifiConfig::schema, 2, WIFI_CONFIG_PATH);
            saveConfigToFile(wifiConfig, WifiConfig::schema, 2, WIFI_CONFIG_PATH, LittleFS);
            request->send(200, "text/plain", "Provisioned. Rebooting...");
            delay(1000);
            ESP.restart();
        } else {
            request->send(400, "text/plain", "Missing parameters");
        }
    });
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

    // Web server for node name config (Async)
    setupWebServer();
}

void loop() {
    // Non-blocking UDP receive for node discovery
    processIncomingUDP();

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
    }
    // No need for server.handleClient() with AsyncWebServer
    // Add VM logic here
}

