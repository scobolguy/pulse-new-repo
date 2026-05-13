#include "SensorService.h"
#include "DevicePin.h"
#include <map>
std::map<int, DevicePin*> devicePins;
DeviceConfiguration deviceConfig;
#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>

#include <ArduinoJson.h>
#include "ConfigSchema.h"
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


#include "config_types.h"

std::map<String, bool> serviceBusyMap;

// FieldDescriptor arrays (definitions)
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

#include "NodeConfig.h"

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
            // Service broker endpoint: aggregator can notify this node when a service is assigned or released
            server.on("/service-broker/announce", HTTP_POST, [](AsyncWebServerRequest *request){
                if (!request->hasParam("service", true) || !request->hasParam("busy", true)) {
                    request->send(400, "text/plain", "Missing service or busy param");
                    return;
                }
                String service = request->getParam("service", true)->value();
                bool busy = request->getParam("busy", true)->value() == "true";
                serviceBusyMap[service] = busy;
                request->send(200, "text/plain", String(service) + " set to " + (busy ? "busy" : "free"));
            });
    // Self-describing services endpoint
    server.on("/services/describe", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        #if defined(ESP32)
        doc["hardware"] = "ESP32";
        #elif defined(ESP8266)
        doc["hardware"] = "ESP8266";
        #else
        doc["hardware"] = "Unknown";
        #endif
        doc["nodeName"] = nodeName;
        auto services = doc["services"].to<JsonArray>();

        // Devices section: enumerate devices and their documentation/visibility
        JsonArray devices = doc["devices"].to<JsonArray>();
        if (LittleFS.exists("/devices")) {
            File dir = LittleFS.open("/devices");
            File entry = dir.openNextFile();
            while (entry) {
                String devName = String(entry.name());
                if (devName.startsWith("/devices/")) devName = devName.substring(9);
                if (devName.endsWith(".json")) devName = devName.substring(0, devName.length() - 5);
                // Read device JSON
                String devJsonStr = entry.readString();
                entry.close();
                JsonDocument devDoc;
                DeserializationError err = deserializeJson(devDoc, devJsonStr);
                JsonObject devObj = devices.add<JsonObject>();
                devObj["name"] = devName;
                // Visibility: default private, can be set to public in device JSON
                String visibility = "private";
                if (!err && devDoc["visibility"].is<const char*>()) {
                    visibility = devDoc["visibility"].as<String>();
                }
                devObj["visibility"] = visibility;
                // Load documentation from FFS if available
                String docText;
                String docPath = String("/devices/docs/") + devName + ".txt";
                File docFile = LittleFS.open(docPath, "r");
                if (docFile) {
                    docText = docFile.readString();
                    docFile.close();
                } else {
                    docText = String("Device: ") + devName;
                }
                devObj["description"] = docText;
                // Optionally, add device actions/commands if present in JSON
                if (!err && devDoc["actions"].is<JsonArray>()) {
                    JsonArray actions = devObj["actions"].to<JsonArray>();
                    for (JsonVariant v : devDoc["actions"].as<JsonArray>()) {
                        String actionName = v.as<String>();
                        String actionDocPath = String("/devices/docs/") + devName + "_" + actionName + ".txt";
                        String actionDoc;
                        File actionDocFile = LittleFS.open(actionDocPath, "r");
                        if (actionDocFile) { actionDoc = actionDocFile.readString(); actionDocFile.close(); }
                        else { actionDoc = String("Action: ") + actionName; }
                        JsonObject act = actions.add<JsonObject>();
                        act["name"] = actionName;
                        act["description"] = actionDoc;
                    }
                }
                entry = dir.openNextFile();
            }
        }

        // FFS Service
        auto ffs = services.add<JsonObject>();
        ffs["name"] = "FFS";
        {
            String docText;
            File docFile = LittleFS.open("/services/docs/ffs.txt", "r");
            if (docFile) {
                docText = docFile.readString();
                docFile.close();
            } else {
                docText = "Federated File System: provides distributed file storage and access.";
            }
            ffs["description"] = docText;
        }
        // Check if broker has marked this service busy
        extern std::map<String, bool> serviceBusyMap;
        String ffsStatus = ffsUp ? "up" : "down";
        if (serviceBusyMap.count("FFS") && serviceBusyMap["FFS"]) ffsStatus = "busy";
        ffs["status"] = ffsStatus;
        auto ffsCmds = ffs["commands"].to<JsonArray>();
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "listFiles";
            String docText;
            File docFile = LittleFS.open("/services/docs/ffs_listFiles.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "List all files in the file system."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "write";
            String docText;
            File docFile = LittleFS.open("/services/docs/ffs_write.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Write data to a file."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "read";
            String docText;
            File docFile = LittleFS.open("/services/docs/ffs_read.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Read data from a file."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "remove";
            String docText;
            File docFile = LittleFS.open("/services/docs/ffs_remove.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Remove a file from the file system."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "sync";
            String docText;
            File docFile = LittleFS.open("/services/docs/ffs_sync.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Synchronize file system to storage."; }
            cmd["description"] = docText;
        }

        // PMachine Service
        #ifdef ENABLE_PMACHINE
        extern pmachine::PMachine pm;
        auto pmObj = services.add<JsonObject>();
        pmObj["name"] = "pmachine";
        {
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine.txt", "r");
            if (docFile) {
                docText = docFile.readString();
                docFile.close();
            } else {
                docText = "PL/0-style virtual machine for executing pcode programs.";
            }
            pmObj["description"] = docText;
        }
        auto s = pm.getStatus();
        String pmStatus = s.running ? "running" : "stopped";
        if (serviceBusyMap.count("pmachine") && serviceBusyMap["pmachine"]) pmStatus = "busy";
        pmObj["status"] = pmStatus;
        auto pmCmds = pmObj["commands"].to<JsonArray>();
        {
            JsonObject cmd = pmCmds.add<JsonObject>();
            cmd["name"] = "loadProgram";
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine_loadProgram.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Load a pcode program into the VM."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = pmCmds.add<JsonObject>();
            cmd["name"] = "run";
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine_run.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Run the loaded program."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = pmCmds.add<JsonObject>();
            cmd["name"] = "singleStep";
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine_singleStep.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Execute a single instruction."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = pmCmds.add<JsonObject>();
            cmd["name"] = "setBreakpoint";
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine_setBreakpoint.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Set a breakpoint at a given address."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = pmCmds.add<JsonObject>();
            cmd["name"] = "clearBreakpoint";
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine_clearBreakpoint.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Clear a breakpoint at a given address."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = pmCmds.add<JsonObject>();
            cmd["name"] = "getStatus";
            String docText;
            File docFile = LittleFS.open("/services/docs/pmachine_getStatus.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Get the current status of the VM."; }
            cmd["description"] = docText;
        }

        auto routerObj = services.add<JsonObject>();
        routerObj["name"] = "GenericRouterService";
        routerObj["description"] = "Aggregator-compatible generic router: FFS-distributed rules and mapping execution.";
        String routerStatus = "ready";
        if (serviceBusyMap.count("GenericRouterService") && serviceBusyMap["GenericRouterService"]) routerStatus = "busy";
        routerObj["status"] = routerStatus;
        auto routerCmds = routerObj["commands"].to<JsonArray>();
        {
            JsonObject cmd = routerCmds.add<JsonObject>();
            cmd["name"] = "run";
            cmd["description"] = "Run routing rules for an input queue and payload.";
        }
        {
            JsonObject cmd = routerCmds.add<JsonObject>();
            cmd["name"] = "runWithMappings";
            cmd["description"] = "Run routing including MAP(...) transforms using distributed mapping files.";
        }
        #endif

        // Sensor Service (example, static)
        auto sensor = services.add<JsonObject>();
        sensor["name"] = "SensorService";
        {
            String docText;
            File docFile = LittleFS.open("/services/docs/sensor.txt", "r");
            if (docFile) {
                docText = docFile.readString();
                docFile.close();
            } else {
                docText = "Provides access to connected sensors (e.g., DHT22, BME280).";
            }
            sensor["description"] = docText;
        }
        String sensorStatus = "ready";
        if (serviceBusyMap.count("SensorService") && serviceBusyMap["SensorService"]) sensorStatus = "busy";
        sensor["status"] = sensorStatus;
        auto sensorCmds = sensor["commands"].to<JsonArray>();
        {
            JsonObject cmd = sensorCmds.add<JsonObject>();
            cmd["name"] = "readSensor";
            String docText;
            File docFile = LittleFS.open("/services/docs/sensor_readSensor.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Read values from a sensor."; }
            cmd["description"] = docText;
        }
        {
            JsonObject cmd = sensorCmds.add<JsonObject>();
            cmd["name"] = "resultToJson";
            String docText;
            File docFile = LittleFS.open("/services/docs/sensor_resultToJson.txt", "r");
            if (docFile) { docText = docFile.readString(); docFile.close(); }
            else { docText = "Convert sensor result to JSON."; }
            cmd["description"] = docText;
        }

        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    // GET /sensor/read?pin=4&type=DHT22&unit=C
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
        json += ",\"GenericRouterService\"";
        firstService = false;
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
    registerFFSRoutes(server, federatedFS);
#ifdef ENABLE_PMACHINE
    registerPMachineRoutes(server, pm, &federatedFS);
#endif
    server.onNotFound(notFound);
    server.begin();
}


#define ANNOUNCE_PORT 4210
#define ANNOUNCE_INTERVAL 10000 // ms
#define WIFI_RECONNECT_INTERVAL 5000 // ms

WiFiUDP udp;
unsigned long lastAnnounce = 0;
unsigned long lastWifiReconnectAttempt = 0;
bool udpReady = false;
String wifiSsid;
String wifiPassword;

bool ensureUdpReady() {
    if (udpReady) return true;
    udpReady = udp.begin(ANNOUNCE_PORT);
    if (udpReady) {
        Serial.print("[UDP] Listening on port ");
        Serial.println(ANNOUNCE_PORT);
    } else {
        Serial.println("[UDP] Failed to bind announce port");
    }
    return udpReady;
}

void maintainConnectivity() {
    const wl_status_t status = WiFi.status();
    if (status == WL_CONNECTED) {
        if (!udpReady) {
            Serial.println("[WIFI] Connected, restoring UDP listener");
            ensureUdpReady();
        }
        return;
    }

    // Force UDP rebind after WiFi returns.
    udpReady = false;

    const unsigned long now = millis();
    if (now - lastWifiReconnectAttempt < WIFI_RECONNECT_INTERVAL) {
        return;
    }

    lastWifiReconnectAttempt = now;
    Serial.print("[WIFI] Disconnected (status=");
    Serial.print((int)status);
    Serial.println(") attempting reconnect...");
    WiFi.disconnect();
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
}

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
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[ANNOUNCE] Skipped: WiFi not connected");
        return;
    }

    if (!ensureUdpReady()) {
        Serial.println("[ANNOUNCE] Skipped: UDP not ready");
        return;
    }

    String msg = String("ESP32-VM online: ") + WiFi.macAddress() + " IP: " + WiFi.localIP().toString();
    int beginOk = udp.beginPacket("255.255.255.255", ANNOUNCE_PORT);
    size_t written = udp.write((const uint8_t*)msg.c_str(), msg.length());
    int endOk = udp.endPacket();

    Serial.print("[ANNOUNCE] begin=");
    Serial.print(beginOk);
    Serial.print(" write=");
    Serial.print((unsigned int)written);
    Serial.print(" end=");
    Serial.print(endOk);
    Serial.print(" ip=");
    Serial.println(WiFi.localIP());
}

void setup() {

    Serial.begin(9600);     
    delay(100);
    Serial.println("[BOOT] setup() starting...");

    // 1. Mount filesystem (SD or LittleFS)
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

    // 2. WiFi connection logic
    Serial.println("[BOOT] Connecting to WiFi...");
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    wifiSsid = wifiConfig.ssid.length() ? wifiConfig.ssid : "Home";
    wifiPassword = wifiConfig.password.length() ? wifiConfig.password : "Brady123";
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 30) {
        delay(500);
        Serial.print(".");
        retries++;
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("[BOOT] WiFi connected: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("[BOOT] WiFi connection failed");
    }

    // 3. Ensure /devices and /services directories exist at root at boot
    File root = LittleFS.open("/");
    bool foundDevices = false, foundServices = false;
    Serial.println("Looking for services and devices");
    if (root && root.isDirectory()) {
        File entry = root.openNextFile();
        while (entry) {
            String name = String(entry.name());
            if (entry.isDirectory()) {
                if (name == "/devices") foundDevices = true;
                if (name == "/services") foundServices = true;
            }
            entry = root.openNextFile();
        }
        root.close();
    }
    Serial.println("Making sure we have devices and services");
    if (!foundDevices) LittleFS.mkdir("/devices");
    if (!foundServices) LittleFS.mkdir("/services");

    // 4. LEDPIN device creation after WiFi connection and directory creation
    Serial.println("[DEBUG] Checking WiFi status for LEDPIN device creation...");
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[LEDPIN] Creating /devices/LEDPIN.json after WiFi connection...");
        if (LittleFS.exists("/devices")) {
            File f = LittleFS.open("/devices/LEDPIN.json", "w");
            if (f) {
                JsonDocument doc;
                doc["type"] = "device";
                doc["name"] = "LEDPIN";
                doc["pin"] = 2;
                auto arr = doc["actions"].to<JsonArray>();
                arr.add("set_output");
                arr.add("raise");
                arr.add("lower");
                String json;
                serializeJson(doc, json);
                f.print(json);
                f.close();
                Serial.println("[LEDPIN] /devices/LEDPIN.json created.");
            } else {
                Serial.println("[LEDPIN] Failed to create /devices/LEDPIN.json!");
            }
            pinMode(2, OUTPUT);
            digitalWrite(2, LOW);
            Serial.println("[LEDPIN] Pin 2 set as OUTPUT and LOW (LED off)");
        } else {
            Serial.println("[LEDPIN] /devices directory does NOT exist!");
        }
    } else {
        Serial.println("[LEDPIN] WiFi not connected, skipping LEDPIN device creation!");
    }

    // 5. Load node config from /ffs/.NodeConfig.json if present
    NodeConfig nodeConfig;
    if (loadNodeConfig(nodeConfig) && nodeConfig.nodeName.length()) {
        nodeName = nodeConfig.nodeName;
    } else {
        // Fallback: Load node name if exists
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
    }

    // 6. Set hostname, start UDP, and announce presence (must be after WiFi is up and nodeName is set)
    WiFi.setHostname(nodeName.c_str());
    ensureUdpReady();
    announcePresence();

    // 7. Initialize FederatedFileSystem with SD if available, else LittleFS
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

    String advertisedServices = "[BOOT] Advertised services: ";
    bool firstAdvertised = true;
    if (ffsUp) {
        advertisedServices += "FFS";
        firstAdvertised = false;
    }
#ifdef ENABLE_PMACHINE
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "pmachine";
    advertisedServices += ", GenericRouterService";
    firstAdvertised = false;
#endif
    if (firstAdvertised) advertisedServices += "none";
    Serial.println(advertisedServices);

    // 8. Web server for node name config (Async)
    setupWebServer();
}

void loop() {
    maintainConnectivity();

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

