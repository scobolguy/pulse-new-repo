#include <Arduino.h>
#include <ctype.h>
#include "SensorService.h"
#include "DevicePin.h"
#include <map>
#include <vector>
std::map<int, DevicePin*> devicePins;
DeviceConfiguration deviceConfig;
#include <FS.h>
#include <LittleFS.h>
#include <SD.h>
#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#else
#include <HTTPClient.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#endif
#include <ESPAsyncWebServer.h>
#include "https_service.h"

#include <ArduinoJson.h>
#include "ConfigSchema.h"
#include "NodeConfig.h"
#include "NodeDiscovery.h"
#include "ffs/FederatedFileSystem.h"
#include "ffs/FederatedFileSystemRoutes.h"
#include "profile_config.h"
#include "broker_client.h"
#include "provision_routes.h"
#include "wifi_provisioning.h"
#include "serial_provisioning.h"
#include "cluster_routes.h"
#include "udp_announcement.h"
#include "udp_runtime.h"
#include "main_globals.h"
#include "time_authority.h"
#include "unique_id_service.h"

#ifdef ENABLE_PMACHINE
#include "pmachine.h"
#include "pmachine_routes.h"
#endif

#ifdef ENABLE_CAMERA
#include "CameraService.h"
#include "camera_routes.h"
#endif

#ifdef ENABLE_DISPLAY
#include "DisplayService.h"
#ifndef DISPLAY_NO_LVGL
#include "DDLRenderer.h"
#endif
#endif

#ifdef ENABLE_AWS_IOT
#include "aws_iot_routes.h"
#endif

#ifdef ENABLE_PRINTER_SCANNER
#include "PrinterService.h"
#include "printer_routes.h"
#endif

#ifdef ENABLE_BLUETOOTH_DEVICES
#include "BluetoothService.h"
#include "bluetooth_routes.h"
#endif

#if defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)
#include "BluetoothAudioTtsService.h"
#endif

#ifdef ENABLE_EVENT_SCHEDULER
#include "EventScheduler.h"
#endif

String nodeName = "ESP32-VM";
NodeConfig nodeConfig;
WifiConfig wifiConfig;
ClusterConfig clusterConfig;
FederatedFileSystem federatedFS;
bool ffsUp = false;
AsyncWebServer server(80);
DevicePin* devicePin = nullptr;
int devicePinNumber = 2;
#ifdef ENABLE_CAMERA
// GPIO 5 is used by camera (Y2 data line), move relay to GPIO 12
int relayPinNumber = 12;
#else
int relayPinNumber = 5;
#endif
bool relayStateOn = false;
std::map<String, bool> serviceBusyMap;

namespace {
bool gLittleFsInitialized = false;
bool gMdnsInitialized = false;
String gMdnsHost;

bool ensureLittleFsInitialized() {
    if (gLittleFsInitialized) return true;

#if defined(ARDUINO_ARCH_ESP8266)
    if (LittleFS.begin()) {
        gLittleFsInitialized = true;
        return true;
    }
#else
    if (LittleFS.begin()) {
        gLittleFsInitialized = true;
        return true;
    }
    // Retry with format to recover uninitialized/corrupt local FS on ESP32.
    if (LittleFS.begin(true)) {
        gLittleFsInitialized = true;
        return true;
    }
#endif

    return false;
}

String toMdnsHostLabel(const String& raw) {
    String host = raw;
    host.trim();
    host.toLowerCase();
    String out;
    out.reserve(host.length());
    for (size_t i = 0; i < host.length(); ++i) {
        const char c = host[i];
        if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-') {
            out += c;
        } else if (c == ' ' || c == '_' || c == '.') {
            out += '-';
        }
    }
    while (out.startsWith("-")) out.remove(0, 1);
    while (out.endsWith("-")) out.remove(out.length() - 1);
    if (out.length() == 0) out = "pulse-node";
    if (out.length() > 63) out = out.substring(0, 63);
    return out;
}

void startOrRefreshMdns(const String& preferredNodeName) {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    const String host = toMdnsHostLabel(preferredNodeName);
    const bool hostChanged = gMdnsHost.length() && gMdnsHost != host;

    if (gMdnsInitialized && hostChanged) {
        MDNS.end();
        gMdnsInitialized = false;
    }

    if (!gMdnsInitialized) {
        if (!MDNS.begin(host.c_str())) {
            Serial.printf("[mDNS] Failed to start for host %s.local\n", host.c_str());
            return;
        }
        MDNS.addService("http", "tcp", 80);
        MDNS.addService("https", "tcp", 443);
        gMdnsInitialized = true;
        gMdnsHost = host;
        Serial.printf("[mDNS] Advertising as %s.local\n", gMdnsHost.c_str());
        return;
    }

#if defined(ARDUINO_ARCH_ESP8266)
    MDNS.update();
#endif
}
}

#ifndef DOORBELL_BUTTON_PIN
#define DOORBELL_BUTTON_PIN 13
#endif

#ifndef DOORBELL_BUTTON_ACTIVE_LEVEL
#define DOORBELL_BUTTON_ACTIVE_LEVEL LOW
#endif

#ifndef DOORBELL_BUTTON_DEBOUNCE_MS
#define DOORBELL_BUTTON_DEBOUNCE_MS 250
#endif

#if defined(ENABLE_DOORBELL_CAMERA)
bool doorbellButtonLastReading = false;
bool doorbellButtonStablePressed = false;
unsigned long doorbellButtonLastChangeMs = 0;
unsigned long doorbellLastMotionCheckMs = 0;
#endif

#if defined(ENABLE_DOORBELL_DISPLAY)
String doorbellLastAlertType;
String doorbellLastSnapshotUrl;
unsigned long doorbellLastAlertMs = 0;
#endif

#ifdef ENABLE_PMACHINE
pmachine::PMachine pm;
#endif

const char* firmwareVersion = "2026.06.06";
const char* firmwareBuildStamp = __DATE__ " " __TIME__;
const char* deviceRole = DEVICE_ROLE;

constexpr unsigned long NODE_BEACON_ACKED_INTERVAL_MS = 60000;
constexpr unsigned long NODE_BEACON_UNACKED_INTERVAL_MS = 10000;

const char* preferredTaskType = PROFILE_PREFERRED_TASK_TYPE;
const char* firmwareTrack = FIRMWARE_TRACK;
const size_t maxMessageBytes = PROFILE_MAX_MESSAGE_BYTES;
const size_t maxConcurrentTasks = PROFILE_MAX_CONCURRENT_TASKS;

struct SupervisorProbeState {
    String name;
    String url;
    bool healthy = false;
    int lastStatusCode = -1;
    unsigned long lastCheckMs = 0;
    unsigned long okCount = 0;
    unsigned long failCount = 0;
    String lastError;
};

bool supervisorEnabled = SUPERVISOR_DEFAULT_ENABLED != 0;
bool supervisorRequireFrontend = SUPERVISOR_REQUIRE_FRONTEND != 0;
unsigned long supervisorCheckIntervalMs = SUPERVISOR_CHECK_INTERVAL_MS;
unsigned long supervisorLastRunMs = 0;
SupervisorProbeState supervisorBackendProbe;
SupervisorProbeState supervisorFrontendProbe;
String supervisorHeartbeatUrl = SUPERVISOR_HEARTBEAT_URL;
int supervisorLastHeartbeatStatusCode = -1;
unsigned long supervisorLastHeartbeatPostMs = 0;
unsigned long supervisorHeartbeatOkCount = 0;
unsigned long supervisorHeartbeatFailCount = 0;
String supervisorLastHeartbeatError;
const char* supervisorConfigPath = "/supervisor-config.json";

bool supervisorOverallHealthy();
void appendSupervisorStatus(JsonObject obj);
void announcePresence();

// Declared later in this translation unit; forward declare for early route lambdas.
extern uint16_t runtimeUdpParentPort;
extern uint16_t runtimeUdpSiblingPort;

bool parseBoolValue(const String& value) {
    return value == "1" || value.equalsIgnoreCase("true") || value.equalsIgnoreCase("yes") || value.equalsIgnoreCase("on");
}

void saveSupervisorConfig() {
    JsonDocument doc;
    doc["enabled"] = supervisorEnabled;
    doc["requireFrontend"] = supervisorRequireFrontend;
    doc["intervalMs"] = static_cast<uint32_t>(supervisorCheckIntervalMs);
    doc["backendUrl"] = supervisorBackendProbe.url;
    doc["frontendUrl"] = supervisorFrontendProbe.url;
    doc["heartbeatUrl"] = supervisorHeartbeatUrl;

    File f = LittleFS.open(supervisorConfigPath, "w");
    if (!f) {
        Serial.println("[SUPERVISOR] Failed to open config file for write");
        return;
    }

    serializeJson(doc, f);
    f.close();
}

void loadSupervisorConfig() {
    // Open in append+read mode so first boot creates the file silently
    // instead of emitting a VFS missing-file error.
    File f = LittleFS.open(supervisorConfigPath, "a+");
    if (!f) {
        Serial.println("[SUPERVISOR] Failed to open config file for read");
        return;
    }

    if (f.size() == 0) {
        f.close();
        return;
    }

    f.seek(0, SeekSet);

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        Serial.println("[SUPERVISOR] Failed to parse config file; using defaults");
        return;
    }

    if (doc["enabled"].is<bool>()) {
        supervisorEnabled = doc["enabled"].as<bool>();
    }
    if (doc["requireFrontend"].is<bool>()) {
        supervisorRequireFrontend = doc["requireFrontend"].as<bool>();
    }
    if (doc["intervalMs"].is<unsigned long>()) {
        const unsigned long requested = doc["intervalMs"].as<unsigned long>();
        if (requested >= 1000 && requested <= 120000) {
            supervisorCheckIntervalMs = requested;
        }
    }
    if (doc["backendUrl"].is<const char*>()) {
        supervisorBackendProbe.url = doc["backendUrl"].as<const char*>();
    }
    if (doc["frontendUrl"].is<const char*>()) {
        supervisorFrontendProbe.url = doc["frontendUrl"].as<const char*>();
    }
    if (doc["heartbeatUrl"].is<const char*>()) {
        supervisorHeartbeatUrl = doc["heartbeatUrl"].as<const char*>();
    }
}

bool isSupervisorRole() {
    return String(deviceRole).equalsIgnoreCase("sentinel") || String(deviceRole).equalsIgnoreCase("supervisor");
}

void configureSupervisorTargets() {
    supervisorBackendProbe.name = "backend";
    supervisorBackendProbe.url = SUPERVISOR_BACKEND_URL;
    supervisorFrontendProbe.name = "frontend";
    supervisorFrontendProbe.url = SUPERVISOR_FRONTEND_URL;
}

String computeNodeCapabilityHash() {
    String hash;
    hash.reserve(160);
    hash += firmwareVersion;
    hash += '|';
    hash += firmwareBuildStamp;
    hash += '|';
    hash += deviceRole;
    hash += '|';
    hash += preferredTaskType;
    hash += '|';
    hash += firmwareTrack;
    hash += '|';
    hash += '0';
    hash += '|';
    hash += isSupervisorRole() ? '1' : '0';
    hash += '|';
    hash += ffsUp ? '1' : '0';
#ifdef ENABLE_PMACHINE
    hash += "|pmachine:1";
#else
    hash += "|pmachine:0";
#endif
#ifdef ENABLE_TIME_AUTHORITY
    hash += "|timeAuthority:1";
    #if TIME_AUTHORITY_COOP_ENABLED
    hash += "|timeAuthorityCoop:1";
    #else
    hash += "|timeAuthorityCoop:0";
    #endif
#else
    hash += "|timeAuthority:0";
#endif
#ifndef DISABLE_UNIQUE_ID_SERVICE
    hash += "|uniqueId:1";
#else
    hash += "|uniqueId:0";
#endif
    hash += '|';
    hash += nodeName;
    return hash;
}

#if defined(ENABLE_DOORBELL_CAMERA)
void emitDoorbellAlert(const char* eventType, const MotionEvent* motionEvent = nullptr) {
    JsonDocument doc;
    doc["kind"] = "doorbellAlert";
    doc["eventType"] = eventType;
    doc["nodeName"] = nodeName;
    doc["deviceRole"] = deviceRole;
    doc["cameraIp"] = WiFi.localIP().toString();
    doc["snapshotUrl"] = String("http://") + WiFi.localIP().toString() + "/api/camera/capture";
    doc["timestamp"] = millis();
    if (motionEvent) {
        doc["changedBlocks"] = motionEvent->changedBlocks;
        doc["changePercentage"] = motionEvent->changePercentage;
        if (motionEvent->snapshotPath.length() > 0) {
            doc["snapshotPath"] = motionEvent->snapshotPath;
        }
    }

    String payload;
    serializeJson(doc, payload);

    if (globalBrokerClient) {
        globalBrokerClient->broadcastMessage("alerts", payload.c_str());
    }

    const uint16_t alertPort = udpRuntimeGetBoundParentPort();
    if (alertPort > 0) {
        WiFiUDP& udp = udpRuntimeSocket();
        udp.beginPacket(IPAddress(255, 255, 255, 255), alertPort);
        udp.write((const uint8_t*)payload.c_str(), payload.length());
        udp.endPacket();
    }

    Serial.printf("[DOORBELL] Alert emitted: %s\n", eventType);
}

void onDoorbellMotionDetected(const MotionEvent& event) {
    emitDoorbellAlert("person", &event);
}

void pollDoorbellButton() {
    const bool readingPressed = digitalRead(DOORBELL_BUTTON_PIN) == DOORBELL_BUTTON_ACTIVE_LEVEL;
    const unsigned long now = millis();

    if (readingPressed != doorbellButtonLastReading) {
        doorbellButtonLastReading = readingPressed;
        doorbellButtonLastChangeMs = now;
    }

    if ((now - doorbellButtonLastChangeMs) < DOORBELL_BUTTON_DEBOUNCE_MS) {
        return;
    }

    if (readingPressed != doorbellButtonStablePressed) {
        doorbellButtonStablePressed = readingPressed;
        if (doorbellButtonStablePressed) {
            emitDoorbellAlert("doorbell");
        }
    }
}
#endif

#if defined(ENABLE_DOORBELL_DISPLAY)
bool fetchUrlToBuffer(const String& url, uint8_t** buffer, size_t* length) {
    if (!buffer || !length) {
        return false;
    }

    *buffer = nullptr;
    *length = 0;

    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient client;
    if (!http.begin(client, url)) {
#else
    if (!http.begin(url)) {
#endif
        return false;
    }

    http.setTimeout(5000);
    const int code = http.GET();
    if (code != HTTP_CODE_OK) {
        http.end();
        return false;
    }

    const int totalLength = http.getSize();
    if (totalLength <= 0) {
        http.end();
        return false;
    }

    uint8_t* data = static_cast<uint8_t*>(malloc(static_cast<size_t>(totalLength)));
    if (!data) {
        http.end();
        return false;
    }

    WiFiClient* stream = http.getStreamPtr();
    size_t offset = 0;
    while (http.connected() && offset < static_cast<size_t>(totalLength)) {
        const size_t available = stream->available();
        if (available == 0) {
            delay(1);
            continue;
        }

        const size_t toRead = min(available, static_cast<size_t>(totalLength) - offset);
        const size_t readCount = stream->readBytes(reinterpret_cast<char*>(data + offset), toRead);
        offset += readCount;
    }

    http.end();

    if (offset != static_cast<size_t>(totalLength)) {
        free(data);
        return false;
    }

    *buffer = data;
    *length = offset;
    return true;
}

void handleDoorbellAlertPacket(const String& payload, IPAddress sourceIp, uint16_t sourcePort) {
    JsonDocument doc;
    if (deserializeJson(doc, payload)) {
        Serial.println("[DOORBELL] Ignoring malformed alert payload");
        return;
    }

    const String eventType = String(doc["eventType"] | doc["kind"] | "person");
    const String snapshotUrl = String(doc["snapshotUrl"] | "");

    doorbellLastAlertType = eventType;
    doorbellLastSnapshotUrl = snapshotUrl;
    doorbellLastAlertMs = millis();

    Serial.printf("[DOORBELL] Alert received from %s:%u type=%s\n", sourceIp.toString().c_str(), sourcePort, eventType.c_str());

    if (!displayService.isInitialized()) {
        return;
    }

    if (snapshotUrl.length() == 0) {
        displayService.showInfo("Doorbell alert received");
        return;
    }

    uint8_t* jpegBuffer = nullptr;
    size_t jpegLength = 0;
    if (!fetchUrlToBuffer(snapshotUrl, &jpegBuffer, &jpegLength)) {
        displayService.showError("Failed to fetch camera JPEG");
        return;
    }

    const bool shown = displayService.showJpeg(jpegBuffer, jpegLength, 0, 0);
    free(jpegBuffer);

    if (!shown) {
        displayService.showError("Failed to render camera JPEG");
    }
}
#endif

void updateProbeResult(SupervisorProbeState& probe, bool healthy, int statusCode, const String& errorText) {
    probe.healthy = healthy;
    probe.lastStatusCode = statusCode;
    probe.lastCheckMs = millis();
    probe.lastError = errorText;
    if (healthy) probe.okCount++;
    else probe.failCount++;
}

void probeHttpTarget(SupervisorProbeState& probe) {
    if (probe.url.length() == 0) {
        updateProbeResult(probe, false, -1, "probe url not configured");
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        updateProbeResult(probe, false, -1, "wifi disconnected");
        return;
    }

    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient probeClient;
    if (!http.begin(probeClient, probe.url)) {
#else
    if (!http.begin(probe.url)) {
#endif
        updateProbeResult(probe, false, -1, "http begin failed");
        return;
    }

    http.setTimeout(2500);
    const int code = http.GET();
    const bool ok = code >= 200 && code < 500;
    String err;
    if (!ok) {
        err = String("http code ") + String(code);
    }
    updateProbeResult(probe, ok, code, err);
    http.end();
}

bool parseUrlHostPort(const String& url, String& hostOut, uint16_t& portOut) {
    const int schemeSep = url.indexOf("://");
    const int hostStart = schemeSep >= 0 ? schemeSep + 3 : 0;
    const int pathStart = url.indexOf('/', hostStart);
    const String hostPort = pathStart >= 0 ? url.substring(hostStart, pathStart) : url.substring(hostStart);
    if (hostPort.length() == 0) {
        return false;
    }

    const int colon = hostPort.lastIndexOf(':');
    if (colon > 0) {
        hostOut = hostPort.substring(0, colon);
        const int parsedPort = hostPort.substring(colon + 1).toInt();
        if (parsedPort <= 0 || parsedPort > 65535) {
            return false;
        }
        portOut = static_cast<uint16_t>(parsedPort);
        return true;
    }

    hostOut = hostPort;
    if (schemeSep >= 0 && url.substring(0, schemeSep).equalsIgnoreCase("https")) {
        portOut = 443;
    } else {
        portOut = 80;
    }
    return true;
}

void probeTcpTarget(SupervisorProbeState& probe) {
    if (probe.url.length() == 0) {
        updateProbeResult(probe, false, -1, "probe url not configured");
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        updateProbeResult(probe, false, -1, "wifi disconnected");
        return;
    }

    String host;
    uint16_t port = 0;
    if (!parseUrlHostPort(probe.url, host, port)) {
        updateProbeResult(probe, false, -1, "invalid probe url");
        return;
    }

    WiFiClient client;
    client.setTimeout(2500);
    const bool ok = client.connect(host.c_str(), port);
    if (ok) {
        updateProbeResult(probe, true, 200, "");
        client.stop();
        return;
    }

    updateProbeResult(probe, false, -11, "tcp connect failed");
}

void postSupervisorHeartbeat() {
    if (!isSupervisorRole() || !supervisorEnabled) {
        return;
    }

    if (supervisorHeartbeatUrl.length() == 0) {
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        supervisorLastHeartbeatStatusCode = -1;
        supervisorHeartbeatFailCount++;
        supervisorLastHeartbeatError = "wifi disconnected";
        return;
    }

    JsonDocument doc;
    doc["nodeId"] = nodeName;
    doc["nodeName"] = nodeName;
    doc["ip"] = WiFi.localIP().toString();
    doc["deviceRole"] = deviceRole;
    doc["overallHealthy"] = supervisorOverallHealthy();

    auto supervisor = doc["supervisor"].to<JsonObject>();
    appendSupervisorStatus(supervisor);

    String body;
    serializeJson(doc, body);

    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient supervisorClient;
    if (!http.begin(supervisorClient, supervisorHeartbeatUrl)) {
#else
    if (!http.begin(supervisorHeartbeatUrl)) {
#endif
        supervisorLastHeartbeatStatusCode = -1;
        supervisorHeartbeatFailCount++;
        supervisorLastHeartbeatError = "heartbeat begin failed";
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.setTimeout(2500);
    const int code = http.POST((uint8_t*)body.c_str(), body.length());
    supervisorLastHeartbeatPostMs = millis();
    supervisorLastHeartbeatStatusCode = code;

    if (code >= 200 && code < 300) {
        supervisorHeartbeatOkCount++;
        supervisorLastHeartbeatError = "";
    } else {
        supervisorHeartbeatFailCount++;
        supervisorLastHeartbeatError = String("http code ") + String(code);
    }

    http.end();
}

void runSupervisorHealthChecks() {
    if (!isSupervisorRole() || !supervisorEnabled) {
        return;
    }

    const unsigned long now = millis();
    if (now - supervisorLastRunMs < supervisorCheckIntervalMs) {
        return;
    }
    supervisorLastRunMs = now;

    probeHttpTarget(supervisorBackendProbe);
    probeTcpTarget(supervisorFrontendProbe);
    postSupervisorHeartbeat();
}

bool supervisorOverallHealthy() {
    if (!isSupervisorRole() || !supervisorEnabled) {
        return true;
    }
    if (!supervisorBackendProbe.healthy) {
        return false;
    }
    if (!supervisorRequireFrontend) {
        return true;
    }
    return supervisorFrontendProbe.healthy;
}

void appendSupervisorStatus(JsonObject obj) {
    obj["enabled"] = supervisorEnabled;
    obj["checkIntervalMs"] = static_cast<uint32_t>(supervisorCheckIntervalMs);
    obj["lastRunMs"] = static_cast<uint32_t>(supervisorLastRunMs);
    obj["overallHealthy"] = supervisorOverallHealthy();
    obj["requireFrontend"] = supervisorRequireFrontend;
    obj["heartbeatUrl"] = supervisorHeartbeatUrl;
    obj["lastHeartbeatStatusCode"] = supervisorLastHeartbeatStatusCode;
    obj["lastHeartbeatPostMs"] = static_cast<uint32_t>(supervisorLastHeartbeatPostMs);
    obj["heartbeatOkCount"] = static_cast<uint32_t>(supervisorHeartbeatOkCount);
    obj["heartbeatFailCount"] = static_cast<uint32_t>(supervisorHeartbeatFailCount);
    obj["lastHeartbeatError"] = supervisorLastHeartbeatError;

    auto targets = obj["targets"].to<JsonArray>();

    auto b = targets.add<JsonObject>();
    b["name"] = supervisorBackendProbe.name;
    b["url"] = supervisorBackendProbe.url;
    b["healthy"] = supervisorBackendProbe.healthy;
    b["lastStatusCode"] = supervisorBackendProbe.lastStatusCode;
    b["lastCheckMs"] = static_cast<uint32_t>(supervisorBackendProbe.lastCheckMs);
    b["okCount"] = static_cast<uint32_t>(supervisorBackendProbe.okCount);
    b["failCount"] = static_cast<uint32_t>(supervisorBackendProbe.failCount);
    b["lastError"] = supervisorBackendProbe.lastError;

    auto f = targets.add<JsonObject>();
    f["name"] = supervisorFrontendProbe.name;
    f["url"] = supervisorFrontendProbe.url;
    f["healthy"] = supervisorFrontendProbe.healthy;
    f["lastStatusCode"] = supervisorFrontendProbe.lastStatusCode;
    f["lastCheckMs"] = static_cast<uint32_t>(supervisorFrontendProbe.lastCheckMs);
    f["okCount"] = static_cast<uint32_t>(supervisorFrontendProbe.okCount);
    f["failCount"] = static_cast<uint32_t>(supervisorFrontendProbe.failCount);
    f["lastError"] = supervisorFrontendProbe.lastError;
}

struct BonecrusherWorkerConfig {
    bool enabled = false;
    String queueManagerUrl = "http://192.168.2.11:4100";
    String queueName = "swift.mt103.inbound";
    String workerId = "";
    uint32_t leaseMs = 30000;
    uint32_t pollIntervalMs = 250;
    uint32_t heartbeatMs = 4000;
    uint32_t processTimeoutMs = 60000;
    uint32_t retryDelayMs = 1000;
    uint32_t maxAttempts = 5;
};

struct BonecrusherWorkerStats {
    uint32_t claimAttempts = 0;
    uint32_t claimed = 0;
    uint32_t completed = 0;
    uint32_t failed = 0;
    uint32_t requeued = 0;
    uint32_t deadLettered = 0;
    uint32_t heartbeatsSent = 0;
    int lastQueueHttpCode = 0;
    int lastEdgeHttpCode = 0;
    unsigned long lastRunMs = 0;
    String lastError;
};

BonecrusherWorkerConfig bonecrusherConfig;
BonecrusherWorkerStats bonecrusherStats;
const char* bonecrusherConfigPath = "/bonecrusher-worker-config.json";
const char* esp32GatewayConfigPath = "/esp32-gateway-workers.json";

struct Esp32GatewayWorkerEntry {
    String gatewayId;
    BonecrusherWorkerConfig worker;
    BonecrusherWorkerStats stats;
};

std::vector<Esp32GatewayWorkerEntry> esp32GatewayWorkers;
bool esp32GatewayWorkersEnabled = false;
uint32_t esp32GatewayIdleDelayMs = 250;
#if defined(ESP32)
TaskHandle_t esp32GatewayWorkerTaskHandle = nullptr;
#endif

constexpr size_t ESP32_GATEWAY_WORKER_MAX = 8;
#if defined(ESP32)
TaskHandle_t bonecrusherWorkerTaskHandle = nullptr;
#endif

bool isBonecrusherRole() {
    const String role = String(deviceRole);
    return role.equalsIgnoreCase("bonecrusher") || role.equalsIgnoreCase("generalist");
}

String percentEncode(const String& in) {
    String out;
    out.reserve(in.length() * 3);
    for (size_t i = 0; i < in.length(); ++i) {
        const uint8_t c = static_cast<uint8_t>(in[i]);
        const bool unreserved =
            (c >= 'A' && c <= 'Z') ||
            (c >= 'a' && c <= 'z') ||
            (c >= '0' && c <= '9') ||
            c == '-' || c == '_' || c == '.' || c == '~';
        if (unreserved) {
            out += static_cast<char>(c);
            continue;
        }
        char buf[4];
        snprintf(buf, sizeof(buf), "%%%02X", c);
        out += buf;
    }
    return out;
}

String trimTrailingSlash(const String& value) {
    String out = value;
    while (out.endsWith("/")) {
        out.remove(out.length() - 1);
    }
    return out;
}

void initializeBonecrusherWorkerDefaults() {
    bonecrusherConfig.enabled = isBonecrusherRole();
    bonecrusherConfig.workerId = nodeName.length() > 0 ? nodeName : "bonecrusher-worker";
}

BonecrusherWorkerConfig makeDefaultGatewayWorkerConfig(size_t index) {
    BonecrusherWorkerConfig cfg;
    cfg.enabled = true;
    cfg.queueManagerUrl = bonecrusherConfig.queueManagerUrl;
    cfg.queueName = String("gateway.in.") + String(static_cast<unsigned long>(index + 1));
    cfg.workerId = String("esp32-gateway-") + String(static_cast<unsigned long>(index + 1));
    cfg.leaseMs = bonecrusherConfig.leaseMs;
    cfg.pollIntervalMs = bonecrusherConfig.pollIntervalMs;
    cfg.heartbeatMs = bonecrusherConfig.heartbeatMs;
    cfg.processTimeoutMs = bonecrusherConfig.processTimeoutMs;
    cfg.retryDelayMs = bonecrusherConfig.retryDelayMs;
    cfg.maxAttempts = bonecrusherConfig.maxAttempts;
    return cfg;
}

void saveEsp32GatewayWorkersConfig() {
    JsonDocument doc;
    doc["enabled"] = esp32GatewayWorkersEnabled;
    doc["idleDelayMs"] = esp32GatewayIdleDelayMs;
    JsonArray gateways = doc["gateways"].to<JsonArray>();
    for (size_t i = 0; i < esp32GatewayWorkers.size(); ++i) {
        const auto& gw = esp32GatewayWorkers[i];
        JsonObject g = gateways.add<JsonObject>();
        g["gatewayId"] = gw.gatewayId;
        g["enabled"] = gw.worker.enabled;
        g["queueManagerUrl"] = gw.worker.queueManagerUrl;
        g["queueName"] = gw.worker.queueName;
        g["workerId"] = gw.worker.workerId;
        g["leaseMs"] = gw.worker.leaseMs;
        g["pollIntervalMs"] = gw.worker.pollIntervalMs;
        g["heartbeatMs"] = gw.worker.heartbeatMs;
        g["processTimeoutMs"] = gw.worker.processTimeoutMs;
        g["retryDelayMs"] = gw.worker.retryDelayMs;
        g["maxAttempts"] = gw.worker.maxAttempts;
    }

    File f = LittleFS.open(esp32GatewayConfigPath, "w");
    if (!f) {
        Serial.println("[ESP32-GATEWAY] Failed to save config");
        return;
    }
    serializeJson(doc, f);
    f.close();
}

void loadEsp32GatewayWorkersConfig() {
    esp32GatewayWorkers.clear();
    // Open in append+read mode so first boot creates the file silently
    // instead of emitting a VFS missing-file error.
    File f = LittleFS.open(esp32GatewayConfigPath, "a+");
    if (!f) return;

    if (f.size() == 0) {
        f.close();
        return;
    }

    f.seek(0, SeekSet);

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        Serial.println("[ESP32-GATEWAY] Failed to parse gateway config, ignoring");
        return;
    }

    if (doc["enabled"].is<bool>()) {
        esp32GatewayWorkersEnabled = doc["enabled"].as<bool>();
    }
    if (doc["idleDelayMs"].is<uint32_t>()) {
        esp32GatewayIdleDelayMs = doc["idleDelayMs"].as<uint32_t>();
    }

    JsonArray gateways = doc["gateways"].as<JsonArray>();
    if (gateways.isNull()) return;

    for (JsonObject g : gateways) {
        if (esp32GatewayWorkers.size() >= ESP32_GATEWAY_WORKER_MAX) break;
        Esp32GatewayWorkerEntry entry;
        entry.gatewayId = String(g["gatewayId"] | "");
        entry.worker = makeDefaultGatewayWorkerConfig(esp32GatewayWorkers.size());
        if (g["enabled"].is<bool>()) entry.worker.enabled = g["enabled"].as<bool>();
        if (g["queueManagerUrl"].is<const char*>()) entry.worker.queueManagerUrl = g["queueManagerUrl"].as<const char*>();
        if (g["queueName"].is<const char*>()) entry.worker.queueName = g["queueName"].as<const char*>();
        if (g["workerId"].is<const char*>()) entry.worker.workerId = g["workerId"].as<const char*>();
        if (g["leaseMs"].is<uint32_t>()) entry.worker.leaseMs = g["leaseMs"].as<uint32_t>();
        if (g["pollIntervalMs"].is<uint32_t>()) entry.worker.pollIntervalMs = g["pollIntervalMs"].as<uint32_t>();
        if (g["heartbeatMs"].is<uint32_t>()) entry.worker.heartbeatMs = g["heartbeatMs"].as<uint32_t>();
        if (g["processTimeoutMs"].is<uint32_t>()) entry.worker.processTimeoutMs = g["processTimeoutMs"].as<uint32_t>();
        if (g["retryDelayMs"].is<uint32_t>()) entry.worker.retryDelayMs = g["retryDelayMs"].as<uint32_t>();
        if (g["maxAttempts"].is<uint32_t>()) entry.worker.maxAttempts = g["maxAttempts"].as<uint32_t>();

        if (entry.gatewayId.length() == 0) {
            entry.gatewayId = entry.worker.workerId.length() ? entry.worker.workerId : String("gateway-") + String(static_cast<unsigned long>(esp32GatewayWorkers.size() + 1));
        }
        if (entry.worker.workerId.length() == 0) {
            entry.worker.workerId = entry.gatewayId;
        }
        esp32GatewayWorkers.push_back(entry);
    }
}

void appendGatewayWorkerJson(JsonObject obj, const Esp32GatewayWorkerEntry& gw) {
    obj["gatewayId"] = gw.gatewayId;
    obj["enabled"] = gw.worker.enabled;
    obj["queueManagerUrl"] = gw.worker.queueManagerUrl;
    obj["queueName"] = gw.worker.queueName;
    obj["workerId"] = gw.worker.workerId;
    obj["leaseMs"] = gw.worker.leaseMs;
    obj["pollIntervalMs"] = gw.worker.pollIntervalMs;
    obj["heartbeatMs"] = gw.worker.heartbeatMs;
    obj["processTimeoutMs"] = gw.worker.processTimeoutMs;
    obj["retryDelayMs"] = gw.worker.retryDelayMs;
    obj["maxAttempts"] = gw.worker.maxAttempts;
    JsonObject stats = obj["stats"].to<JsonObject>();
    stats["claimAttempts"] = gw.stats.claimAttempts;
    stats["claimed"] = gw.stats.claimed;
    stats["completed"] = gw.stats.completed;
    stats["failed"] = gw.stats.failed;
    stats["requeued"] = gw.stats.requeued;
    stats["deadLettered"] = gw.stats.deadLettered;
    stats["heartbeatsSent"] = gw.stats.heartbeatsSent;
    stats["lastQueueHttpCode"] = gw.stats.lastQueueHttpCode;
    stats["lastEdgeHttpCode"] = gw.stats.lastEdgeHttpCode;
    stats["lastRunMs"] = static_cast<uint32_t>(gw.stats.lastRunMs);
    stats["lastError"] = gw.stats.lastError;
}

void saveBonecrusherWorkerConfig() {
    JsonDocument doc;
    doc["enabled"] = bonecrusherConfig.enabled;
    doc["queueManagerUrl"] = bonecrusherConfig.queueManagerUrl;
    doc["queueName"] = bonecrusherConfig.queueName;
    doc["workerId"] = bonecrusherConfig.workerId;
    doc["leaseMs"] = bonecrusherConfig.leaseMs;
    doc["pollIntervalMs"] = bonecrusherConfig.pollIntervalMs;
    doc["heartbeatMs"] = bonecrusherConfig.heartbeatMs;
    doc["processTimeoutMs"] = bonecrusherConfig.processTimeoutMs;
    doc["retryDelayMs"] = bonecrusherConfig.retryDelayMs;
    doc["maxAttempts"] = bonecrusherConfig.maxAttempts;

    File f = LittleFS.open(bonecrusherConfigPath, "w");
    if (!f) {
        Serial.println("[BONECRUSHER] Failed to save worker config");
        return;
    }
    serializeJson(doc, f);
    f.close();
}

void loadBonecrusherWorkerConfig() {
    if (!LittleFS.exists(bonecrusherConfigPath)) return;

    File f = LittleFS.open(bonecrusherConfigPath, "r");
    if (!f) return;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        Serial.println("[BONECRUSHER] Failed to parse worker config, using defaults");
        return;
    }

    if (doc["enabled"].is<bool>()) bonecrusherConfig.enabled = doc["enabled"].as<bool>();
    if (doc["queueManagerUrl"].is<const char*>()) bonecrusherConfig.queueManagerUrl = doc["queueManagerUrl"].as<const char*>();
    if (doc["queueName"].is<const char*>()) bonecrusherConfig.queueName = doc["queueName"].as<const char*>();
    if (doc["workerId"].is<const char*>()) bonecrusherConfig.workerId = doc["workerId"].as<const char*>();
    if (doc["leaseMs"].is<uint32_t>()) bonecrusherConfig.leaseMs = doc["leaseMs"].as<uint32_t>();
    if (doc["pollIntervalMs"].is<uint32_t>()) bonecrusherConfig.pollIntervalMs = doc["pollIntervalMs"].as<uint32_t>();
    if (doc["heartbeatMs"].is<uint32_t>()) bonecrusherConfig.heartbeatMs = doc["heartbeatMs"].as<uint32_t>();
    if (doc["processTimeoutMs"].is<uint32_t>()) bonecrusherConfig.processTimeoutMs = doc["processTimeoutMs"].as<uint32_t>();
    if (doc["retryDelayMs"].is<uint32_t>()) bonecrusherConfig.retryDelayMs = doc["retryDelayMs"].as<uint32_t>();
    if (doc["maxAttempts"].is<uint32_t>()) bonecrusherConfig.maxAttempts = doc["maxAttempts"].as<uint32_t>();
}

int httpPostJson(const String& url, const String& body, String& responseBody, uint16_t timeoutMs = 4000) {
    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient postJsonClient;
    if (!http.begin(postJsonClient, url)) return -1;
#else
    if (!http.begin(url)) return -1;
#endif
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(timeoutMs);
    const int code = http.POST(body);
    responseBody = (code > 0) ? http.getString() : "";
    http.end();
    return code;
}

int httpPostForm(const String& url, const String& body, String& responseBody, uint16_t timeoutMs = 6000) {
    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient postFormClient;
    if (!http.begin(postFormClient, url)) return -1;
#else
    if (!http.begin(url)) return -1;
#endif
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    http.setTimeout(timeoutMs);
    const int code = http.POST(body);
    responseBody = (code > 0) ? http.getString() : "";
    http.end();
    return code;
}

int httpGet(const String& url, String& responseBody, uint16_t timeoutMs = 4000) {
    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient getClient;
    if (!http.begin(getClient, url)) return -1;
#else
    if (!http.begin(url)) return -1;
#endif
    http.setTimeout(timeoutMs);
    const int code = http.GET();
    responseBody = (code > 0) ? http.getString() : "";
    http.end();
    return code;
}

bool processClaimWithLocalIngress(
    const String& claimToken,
    const String& queuePayload,
    const String& inputQueue,
    String& processError,
    int& lastEdgeCode
) {
    const String stageUrl = "http://127.0.0.1/pmachine/edge_ingress_stage";
    String form = "inputQueue=" + percentEncode(inputQueue);
    form += "&message=" + percentEncode(queuePayload);
    form += "&runRouter=1&async=1&convertMtToXml=0";

    String stageResponse;
    const int stageCode = httpPostForm(stageUrl, form, stageResponse, 6000);
    lastEdgeCode = stageCode;
    if (stageCode < 200 || stageCode >= 300) {
        processError = String("edge stage submit failed: ") + String(stageCode) + " " + stageResponse;
        return false;
    }

    JsonDocument stageDoc;
    if (deserializeJson(stageDoc, stageResponse)) {
        processError = "edge stage submit parse failed";
        return false;
    }

    String jobId = stageDoc["jobId"] | "";
    if (jobId.length() == 0) {
        processError = "edge stage missing jobId";
        return false;
    }

    const unsigned long started = millis();
    unsigned long lastHeartbeat = 0;
    const String qmBase = trimTrailingSlash(bonecrusherConfig.queueManagerUrl);

    while (millis() - started < bonecrusherConfig.processTimeoutMs) {
        if (millis() - lastHeartbeat >= bonecrusherConfig.heartbeatMs) {
            JsonDocument hbDoc;
            hbDoc["queueName"] = bonecrusherConfig.queueName;
            hbDoc["workerId"] = bonecrusherConfig.workerId;
            hbDoc["claimToken"] = claimToken;
            hbDoc["extendMs"] = bonecrusherConfig.leaseMs;
            String hbBody;
            serializeJson(hbDoc, hbBody);
            String hbResp;
            int hbCode = httpPostJson(qmBase + "/claim/heartbeat", hbBody, hbResp, 3000);
            if (hbCode > 0) {
                bonecrusherStats.heartbeatsSent += 1;
                bonecrusherStats.lastQueueHttpCode = hbCode;
            }
            lastHeartbeat = millis();
        }

        String statusResponse;
        const int statusCode = httpGet("http://127.0.0.1/pmachine/edge_ingress_status?jobId=" + percentEncode(jobId), statusResponse, 4000);
        lastEdgeCode = statusCode;
        if (statusCode <= 0) {
            delay(150);
            continue;
        }

        JsonDocument statusDoc;
        if (deserializeJson(statusDoc, statusResponse)) {
            delay(150);
            continue;
        }

        String state = statusDoc["state"] | "";
        int innerStatus = statusDoc["statusCode"] | statusCode;
        if (state == "completed") {
            if (innerStatus >= 200 && innerStatus < 300) {
                return true;
            }
            String body = statusDoc["body"] | "";
            processError = String("edge stage failed: ") + String(innerStatus) + " " + body;
            return false;
        }

        delay(120);
    }

    processError = "edge stage timed out";
    return false;
}

void runBonecrusherWorkerIteration() {
    if (!isBonecrusherRole() || !bonecrusherConfig.enabled) return;
    if (WiFi.status() != WL_CONNECTED) return;

    const String qmBase = trimTrailingSlash(bonecrusherConfig.queueManagerUrl);

    JsonDocument claimDoc;
    claimDoc["queueName"] = bonecrusherConfig.queueName;
    claimDoc["workerId"] = bonecrusherConfig.workerId;
    claimDoc["leaseMs"] = bonecrusherConfig.leaseMs;
    String claimBody;
    serializeJson(claimDoc, claimBody);

    String claimResponse;
    bonecrusherStats.claimAttempts += 1;
    const int claimCode = httpPostJson(qmBase + "/claim", claimBody, claimResponse, 4000);
    bonecrusherStats.lastQueueHttpCode = claimCode;

    if (claimCode == 404) return; // no work
    if (claimCode < 200 || claimCode >= 300) {
        bonecrusherStats.lastError = String("claim failed ") + String(claimCode) + " " + claimResponse;
        return;
    }

    JsonDocument claimRespDoc;
    if (deserializeJson(claimRespDoc, claimResponse)) {
        bonecrusherStats.lastError = "claim response parse failed";
        return;
    }

    String claimToken = claimRespDoc["claim"]["claimToken"] | "";
    String inputQueue = claimRespDoc["claim"]["message"]["messageEnvelope"]["inputQueue"] | "";
    JsonVariant msgVariant = claimRespDoc["claim"]["message"]["message"];
    String queuePayload;
    if (msgVariant.is<const char*>()) {
        queuePayload = msgVariant.as<const char*>();
    } else {
        serializeJson(msgVariant, queuePayload);
        if (inputQueue.length() == 0) {
            inputQueue = claimRespDoc["claim"]["message"]["message"]["inputQueue"] | "";
        }
        if (queuePayload.length() == 0) {
            queuePayload = claimRespDoc["claim"]["message"]["message"].as<String>();
        }
    }

    if (inputQueue.length() == 0) {
        inputQueue = bonecrusherConfig.queueName;
    }

    if (claimToken.length() == 0 || queuePayload.length() == 0) {
        bonecrusherStats.lastError = "claim payload missing token or message";
        return;
    }

    bonecrusherStats.claimed += 1;
    bonecrusherStats.lastRunMs = millis();

    String processError;
    int edgeCode = 0;
    bool ok = processClaimWithLocalIngress(claimToken, queuePayload, inputQueue, processError, edgeCode);
    bonecrusherStats.lastEdgeHttpCode = edgeCode;

    JsonDocument finishDoc;
    finishDoc["queueName"] = bonecrusherConfig.queueName;
    finishDoc["workerId"] = bonecrusherConfig.workerId;
    finishDoc["claimToken"] = claimToken;

    if (ok) {
        JsonObject completionMeta = finishDoc["completionMeta"].to<JsonObject>();
        completionMeta["edgeHttpCode"] = edgeCode;
        completionMeta["nodeName"] = nodeName;
        String finishBody;
        serializeJson(finishDoc, finishBody);
        String finishResp;
        int finishCode = httpPostJson(qmBase + "/claim/complete", finishBody, finishResp, 4000);
        bonecrusherStats.lastQueueHttpCode = finishCode;
        if (finishCode >= 200 && finishCode < 300) {
            bonecrusherStats.completed += 1;
            bonecrusherStats.lastError = "";
        } else {
            bonecrusherStats.lastError = String("complete failed ") + String(finishCode) + " " + finishResp;
        }
        return;
    }

    finishDoc["reason"] = processError;
    finishDoc["delayMs"] = bonecrusherConfig.retryDelayMs;
    finishDoc["maxAttempts"] = bonecrusherConfig.maxAttempts;
    String failBody;
    serializeJson(finishDoc, failBody);
    String failResp;
    int failCode = httpPostJson(qmBase + "/claim/fail", failBody, failResp, 4000);
    bonecrusherStats.lastQueueHttpCode = failCode;
    bonecrusherStats.failed += 1;

    if (failCode >= 200 && failCode < 300) {
        JsonDocument failDoc;
        if (!deserializeJson(failDoc, failResp)) {
            String status = failDoc["status"] | "";
            if (status == "requeued") bonecrusherStats.requeued += 1;
            if (status == "dead-letter") bonecrusherStats.deadLettered += 1;
        }
    }
    bonecrusherStats.lastError = processError;
}

void runEsp32GatewayWorkersIteration() {
    if (!isBonecrusherRole() || !esp32GatewayWorkersEnabled) return;
    if (WiFi.status() != WL_CONNECTED) return;
    if (esp32GatewayWorkers.empty()) return;

    for (size_t i = 0; i < esp32GatewayWorkers.size(); ++i) {
        auto& gw = esp32GatewayWorkers[i];
        if (!gw.worker.enabled) continue;

        BonecrusherWorkerConfig prevConfig = bonecrusherConfig;
        BonecrusherWorkerStats prevStats = bonecrusherStats;

        bonecrusherConfig = gw.worker;
        bonecrusherStats = gw.stats;
        runBonecrusherWorkerIteration();
        gw.worker = bonecrusherConfig;
        gw.stats = bonecrusherStats;

        bonecrusherConfig = prevConfig;
        bonecrusherStats = prevStats;
    }
}

#if defined(ESP32)
void bonecrusherWorkerTask(void* param) {
    (void)param;
    for (;;) {
        if (esp32GatewayWorkersEnabled && !esp32GatewayWorkers.empty()) {
            runEsp32GatewayWorkersIteration();
        } else {
            runBonecrusherWorkerIteration();
        }
        const uint32_t delayMs = esp32GatewayWorkersEnabled
          ? (esp32GatewayIdleDelayMs > 20 ? esp32GatewayIdleDelayMs : 20)
          : (bonecrusherConfig.enabled ? (bonecrusherConfig.pollIntervalMs > 20 ? bonecrusherConfig.pollIntervalMs : 20) : 1000);
        vTaskDelay(pdMS_TO_TICKS(delayMs));
    }
}

void startBonecrusherWorkerTaskIfNeeded() {
    if (!isBonecrusherRole()) return;
    if (bonecrusherWorkerTaskHandle != nullptr) return;
    constexpr uint32_t bonecrusherWorkerStackBytes = 12288;
    BaseType_t ok = xTaskCreatePinnedToCore(
        bonecrusherWorkerTask,
        "bonecrusherWorker",
        bonecrusherWorkerStackBytes,
        nullptr,
        1,
        &bonecrusherWorkerTaskHandle,
        1
    );
    if (ok != pdPASS) {
        ok = xTaskCreate(
            bonecrusherWorkerTask,
            "bonecrusherWorker",
            bonecrusherWorkerStackBytes,
            nullptr,
            1,
            &bonecrusherWorkerTaskHandle
        );
    }
    if (ok == pdPASS) {
        Serial.println("[BONECRUSHER] Worker task started");
    } else {
        Serial.println("[BONECRUSHER] Worker task failed to start");
    }
}

void startEsp32GatewayWorkerTaskIfNeeded() {
    if (!isBonecrusherRole()) return;
    if (esp32GatewayWorkerTaskHandle != nullptr) return;
    constexpr uint32_t gatewayWorkerStackBytes = 12288;
    BaseType_t ok = xTaskCreatePinnedToCore(
        bonecrusherWorkerTask,
        "esp32GatewayWorker",
        gatewayWorkerStackBytes,
        nullptr,
        1,
        &esp32GatewayWorkerTaskHandle,
        1
    );
    if (ok != pdPASS) {
        ok = xTaskCreate(
            bonecrusherWorkerTask,
            "esp32GatewayWorker",
            gatewayWorkerStackBytes,
            nullptr,
            1,
            &esp32GatewayWorkerTaskHandle
        );
    }
    if (ok == pdPASS) {
        Serial.println("[ESP32-GATEWAY] Worker task started");
    } else {
        Serial.println("[ESP32-GATEWAY] Worker task failed to start");
    }
}
#endif



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

    // Board source-of-truth node naming endpoint.
    server.on("/node/name", HTTP_POST, [](AsyncWebServerRequest *request){
        String nextName;
        if (request->hasParam("nodeName", true)) {
            nextName = request->getParam("nodeName", true)->value();
        } else if (request->hasParam("nodeName")) {
            nextName = request->getParam("nodeName")->value();
        }

        nextName.trim();
        if (nextName.length() == 0) {
            request->send(400, "application/json", "{\"error\":\"nodeName is required\"}");
            return;
        }

        nodeName = nextName;
        File f = LittleFS.open(NODE_NAME_PATH, "w");
        if (!f) {
            request->send(500, "application/json", "{\"error\":\"failed to persist nodeName file\"}");
            return;
        }
        f.print(nodeName);
        f.close();

        if (!loadNodeConfig(nodeConfig)) {
            nodeConfig = NodeConfig();
        }
        nodeConfig.nodeName = nodeName;
        saveNodeConfig(nodeConfig);

#if defined(ESP32)
        WiFi.setHostname(nodeName.c_str());
#elif defined(ESP8266)
        WiFi.hostname(nodeName.c_str());
#endif

        bonecrusherConfig.workerId = nodeName;
        udpRuntimeResetBeaconState();
        announcePresence();

        JsonDocument doc;
        doc["status"] = "ok";
        doc["nodeName"] = nodeName;
        doc["persisted"] = true;
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    // Board source-of-truth topology endpoint.
    server.on("/node/topology", HTTP_POST, [](AsyncWebServerRequest *request){
        if (!loadNodeConfig(nodeConfig)) {
            nodeConfig = NodeConfig();
        }

        if (request->hasParam("activeClusterId", true)) {
            nodeConfig.activeClusterId = request->getParam("activeClusterId", true)->value();
        }
        if (request->hasParam("parentHost", true)) {
            nodeConfig.parentHost = request->getParam("parentHost", true)->value();
        }
        if (request->hasParam("parentNodeId", true)) {
            nodeConfig.parentNodeId = request->getParam("parentNodeId", true)->value();
        }
        if (request->hasParam("isClusterGateway", true)) {
            nodeConfig.isClusterGateway = parseBoolValue(request->getParam("isClusterGateway", true)->value());
        }
        if (request->hasParam("parentPort", true)) {
            const int v = request->getParam("parentPort", true)->value().toInt();
            if (v >= 1024 && v <= 65535) nodeConfig.parentPort = static_cast<uint16_t>(v);
        }
        if (request->hasParam("siblingPort", true)) {
            const int v = request->getParam("siblingPort", true)->value().toInt();
            if (v >= 1024 && v <= 65535) nodeConfig.siblingPort = static_cast<uint16_t>(v);
        }

        saveNodeConfig(nodeConfig);

        runtimeUdpParentPort = nodeConfig.parentPort;
        runtimeUdpSiblingPort = nodeConfig.siblingPort;
        udpRuntimeEnsureReady(runtimeUdpParentPort, runtimeUdpSiblingPort);
        udpRuntimeResetBeaconState();
        announcePresence();

        JsonDocument doc;
        doc["status"] = "ok";
        auto cluster = doc["cluster"].to<JsonObject>();
        cluster["activeClusterId"] = nodeConfig.activeClusterId;
        cluster["parentHost"] = nodeConfig.parentHost;
        cluster["parentNodeId"] = nodeConfig.parentNodeId;
        cluster["isClusterGateway"] = nodeConfig.isClusterGateway;
        cluster["parentPort"] = nodeConfig.parentPort;
        cluster["siblingPort"] = nodeConfig.siblingPort;
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    server.on("/node/restart", HTTP_POST, [](AsyncWebServerRequest *request){
        String reason = "api-request";
        if (request->hasParam("reason", true)) {
            reason = request->getParam("reason", true)->value();
        } else if (request->hasParam("reason")) {
            reason = request->getParam("reason")->value();
        }

        int delayMs = 150;
        if (request->hasParam("delayMs", true)) {
            delayMs = request->getParam("delayMs", true)->value().toInt();
        } else if (request->hasParam("delayMs")) {
            delayMs = request->getParam("delayMs")->value().toInt();
        }
        if (delayMs < 0) delayMs = 0;
        if (delayMs > 2000) delayMs = 2000;

        JsonDocument doc;
        doc["status"] = "ok";
        doc["restartRequested"] = true;
        doc["reason"] = reason;
        doc["delayMs"] = delayMs;
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);

        delay(delayMs);
        ESP.restart();
    });

    // Relay device actions: toggle, turnOn, turnOff.
    server.on("/devices/relay/action", HTTP_POST, [](AsyncWebServerRequest *request){
        String action;
        if (request->hasParam("action", true)) {
            action = request->getParam("action", true)->value();
        } else if (request->hasParam("action")) {
            action = request->getParam("action")->value();
        }
        action.trim();
        if (action.length() == 0) {
            request->send(400, "application/json", "{\"error\":\"action is required\"}");
            return;
        }

        pinMode(relayPinNumber, OUTPUT);
        if (action.equalsIgnoreCase("toggle")) {
            relayStateOn = !relayStateOn;
        } else if (action.equalsIgnoreCase("turnOn")) {
            relayStateOn = true;
        } else if (action.equalsIgnoreCase("turnOff")) {
            relayStateOn = false;
        } else {
            request->send(400, "application/json", "{\"error\":\"unsupported relay action\"}");
            return;
        }

        digitalWrite(relayPinNumber, relayStateOn ? HIGH : LOW);

        JsonDocument doc;
        doc["status"] = "ok";
        doc["device"] = "RELAY";
        doc["action"] = action;
        doc["pin"] = relayPinNumber;
        doc["state"] = relayStateOn ? "on" : "off";
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    auto handleLedAction = [](AsyncWebServerRequest *request){
        String action;
        if (request->hasParam("action", true)) {
            action = request->getParam("action", true)->value();
        } else if (request->hasParam("action")) {
            action = request->getParam("action")->value();
        }
        action.trim();
        if (action.length() == 0) {
            request->send(400, "application/json", "{\"error\":\"action is required\"}");
            return;
        }

        const int ledPinNumber = 2;
        String valueParam;
        if (request->hasParam("value", true)) {
            valueParam = request->getParam("value", true)->value();
        } else if (request->hasParam("value")) {
            valueParam = request->getParam("value")->value();
        }
        valueParam.trim();

        Serial.printf("[LEDPIN] Received action=%s value=%s\n", action.c_str(), valueParam.c_str());

        // Always configure the LED pin as output before any state change.
        pinMode(ledPinNumber, OUTPUT);

        bool nextOn = false;
        if (action.equalsIgnoreCase("raise") || action.equalsIgnoreCase("turnOn") || action.equalsIgnoreCase("on")) {
            nextOn = true;
        } else if (action.equalsIgnoreCase("lower") || action.equalsIgnoreCase("turnOff") || action.equalsIgnoreCase("off")) {
            nextOn = false;
        } else if (action.equalsIgnoreCase("set_output")) {
            const String lowered = valueParam;
            if (lowered.equalsIgnoreCase("1") || lowered.equalsIgnoreCase("high") || lowered.equalsIgnoreCase("on") || lowered.equalsIgnoreCase("true")) {
                nextOn = true;
            } else if (lowered.equalsIgnoreCase("0") || lowered.equalsIgnoreCase("low") || lowered.equalsIgnoreCase("off") || lowered.equalsIgnoreCase("false")) {
                nextOn = false;
            } else {
                request->send(400, "application/json", "{\"error\":\"set_output requires value=0|1|low|high|off|on|false|true\"}");
                return;
            }
        } else {
            request->send(400, "application/json", "{\"error\":\"unsupported LED action\"}");
            return;
        }

        digitalWrite(ledPinNumber, nextOn ? HIGH : LOW);
        Serial.printf("[LEDPIN] Pin %d set to %s\n", ledPinNumber, nextOn ? "HIGH" : "LOW");

        JsonDocument doc;
        doc["status"] = "ok";
        doc["device"] = "LEDPIN";
        doc["action"] = action;
        doc["pin"] = ledPinNumber;
        doc["state"] = nextOn ? "on" : "off";
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    };

    server.on("/devices/ledpin/action", HTTP_POST, handleLedAction);
    server.on("/devices/LEDPIN/action", HTTP_POST, handleLedAction);

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
        doc["firmwareVersion"] = firmwareVersion;
        doc["firmwareBuildStamp"] = firmwareBuildStamp;
        doc["deviceRole"] = deviceRole;
        doc["preferredTaskType"] = preferredTaskType;
        doc["firmwareTrack"] = firmwareTrack;
        doc["maxMessageBytes"] = static_cast<uint32_t>(maxMessageBytes);
        doc["maxConcurrentTasks"] = static_cast<uint32_t>(maxConcurrentTasks);
        auto cluster = doc["cluster"].to<JsonObject>();
        cluster["activeClusterId"] = nodeConfig.activeClusterId;
        cluster["parentHost"] = nodeConfig.parentHost;
        cluster["parentNodeId"] = nodeConfig.parentNodeId;
        cluster["isClusterGateway"] = nodeConfig.isClusterGateway;
        cluster["parentPort"] = nodeConfig.parentPort;
        cluster["siblingPort"] = nodeConfig.siblingPort;
        auto services = doc["services"].to<JsonArray>();

        if (isSupervisorRole()) {
            auto supervisor = services.add<JsonObject>();
            supervisor["name"] = "StartupSupervisor";
            supervisor["description"] = "Monitors backend/frontend readiness and exposes stability telemetry.";
            supervisor["status"] = supervisorOverallHealthy() ? "healthy" : "degraded";
            auto supervisorCmds = supervisor["commands"].to<JsonArray>();
            JsonObject c1 = supervisorCmds.add<JsonObject>();
            c1["name"] = "status";
            c1["description"] = "GET /supervisor/status returns health telemetry.";
            JsonObject c2 = supervisorCmds.add<JsonObject>();
            c2["name"] = "configure";
            c2["description"] = "POST /supervisor/config to update enabled flag, interval, and probe URLs.";
        }

        // Devices section: enumerate devices and their documentation/visibility
        JsonArray devices = doc["devices"].to<JsonArray>();
        if (LittleFS.exists("/devices")) {
            File dir = LittleFS.open("/devices", "r");
            File entry = dir.openNextFile();
            while (entry) {
                if (entry.isDirectory()) {
                    entry = dir.openNextFile();
                    continue;
                }
                String devName = String(entry.name());
                if (devName.startsWith("/devices/")) devName = devName.substring(9);
                if (!devName.endsWith(".json")) {
                    entry.close();
                    entry = dir.openNextFile();
                    continue;
                }
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
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "mount";
            cmd["description"] = "Create a mount point that aliases a local path or points at a peer node.";
        }
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "unmount";
            cmd["description"] = "Remove a previously configured mount point.";
        }
        {
            JsonObject cmd = ffsCmds.add<JsonObject>();
            cmd["name"] = "mounts";
            cmd["description"] = "List configured mount points.";
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

        #ifdef ENABLE_BLUETOOTH_DEVICES
        auto btObj = services.add<JsonObject>();
        btObj["name"] = "BluetoothService";
        btObj["description"] = "Bluetooth LE discovery and generic device control service.";
        String btStatus = (globalBluetoothService != nullptr) ? "ready" : "down";
        if (serviceBusyMap.count("BluetoothService") && serviceBusyMap["BluetoothService"]) btStatus = "busy";
        btObj["status"] = btStatus;
        auto btCmds = btObj["commands"].to<JsonArray>();
        {
            JsonObject cmd = btCmds.add<JsonObject>();
            cmd["name"] = "discoverDevices";
            cmd["description"] = "POST /api/bluetooth/scan then GET /api/bluetooth/devices.";
        }
        {
            JsonObject cmd = btCmds.add<JsonObject>();
            cmd["name"] = "connectDevice";
            cmd["description"] = "POST /api/bluetooth/connect with target address.";
        }

        #if defined(ENABLE_BLUETOOTH_AUDIO_TTS)
        auto btAudioObj = services.add<JsonObject>();
        btAudioObj["name"] = "BluetoothAudioTtsService";
        btAudioObj["description"] = "Find speakers/headsets, connect target, queue MP3 playback, and invoke TTS.";
        String btAudioStatus = (globalBluetoothAudioTtsService != nullptr) ? "ready" : "down";
        if (serviceBusyMap.count("BluetoothAudioTtsService") && serviceBusyMap["BluetoothAudioTtsService"]) btAudioStatus = "busy";
        btAudioObj["status"] = btAudioStatus;
        auto btAudioCmds = btAudioObj["commands"].to<JsonArray>();
        {
            JsonObject cmd = btAudioCmds.add<JsonObject>();
            cmd["name"] = "discover";
            cmd["description"] = "POST /api/bluetooth-audio/discover";
        }
        {
            JsonObject cmd = btAudioCmds.add<JsonObject>();
            cmd["name"] = "listTargets";
            cmd["description"] = "GET /api/bluetooth-audio/targets";
        }
        {
            JsonObject cmd = btAudioCmds.add<JsonObject>();
            cmd["name"] = "connect";
            cmd["description"] = "POST /api/bluetooth-audio/connect";
        }
        {
            JsonObject cmd = btAudioCmds.add<JsonObject>();
            cmd["name"] = "playMp3";
            cmd["description"] = "POST /api/bluetooth-audio/play-mp3";
        }
        {
            JsonObject cmd = btAudioCmds.add<JsonObject>();
            cmd["name"] = "tts";
            cmd["description"] = "POST /api/bluetooth-audio/tts";
        }
        {
            JsonObject cmd = btAudioCmds.add<JsonObject>();
            cmd["name"] = "ui";
            cmd["description"] = "GET /BTConnect serves the bluetooth connect web UI.";
        }
        #endif
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

#ifdef ENABLE_TIME_AUTHORITY
        auto timeAuthority = services.add<JsonObject>();
        timeAuthority["name"] = "TimeAuthorityService";
        timeAuthority["description"] = "Authoritative time service with NTP sync and cooperative peer checks.";
        String timeAuthorityStatus = "ready";
        if (serviceBusyMap.count("TimeAuthorityService") && serviceBusyMap["TimeAuthorityService"]) timeAuthorityStatus = "busy";
        timeAuthority["status"] = timeAuthorityStatus;
        auto timeCmds = timeAuthority["commands"].to<JsonArray>();
        {
            JsonObject cmd = timeCmds.add<JsonObject>();
            cmd["name"] = "status";
            cmd["description"] = "GET /time/authority returns current authority time snapshot.";
        }
        {
            JsonObject cmd = timeCmds.add<JsonObject>();
            cmd["name"] = "resync";
            cmd["description"] = "POST /time/authority/sync forces immediate NTP resync.";
        }
#endif

#ifndef DISABLE_UNIQUE_ID_SERVICE
        auto uniqueId = services.add<JsonObject>();
        uniqueId["name"] = "UniqueIdService";
        uniqueId["description"] = "Hybrid unique ID service (hashed MAC + time + counter + random).";
        String uniqueIdStatus = "ready";
        if (serviceBusyMap.count("UniqueIdService") && serviceBusyMap["UniqueIdService"]) uniqueIdStatus = "busy";
        uniqueId["status"] = uniqueIdStatus;
        auto uniqueIdCmds = uniqueId["commands"].to<JsonArray>();
        {
            JsonObject cmd = uniqueIdCmds.add<JsonObject>();
            cmd["name"] = "device";
            cmd["description"] = "GET /id/device returns stable device identity metadata.";
        }
        {
            JsonObject cmd = uniqueIdCmds.add<JsonObject>();
            cmd["name"] = "next";
            cmd["description"] = "POST or GET /id/next returns a new globally unique event ID.";
        }
        {
            JsonObject cmd = uniqueIdCmds.add<JsonObject>();
            cmd["name"] = "status";
            cmd["description"] = "GET /id/status returns unique ID service health and counters.";
        }
#endif

        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    // GET /sensor/read?pin=4&type=DHT22&unit=C
    server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request){
        const uint32_t freeHeap = ESP.getFreeHeap();
        if (freeHeap < 70000) {
            char fallback[256];
            snprintf(
                fallback,
                sizeof(fallback),
                "{\"status\":\"degraded\",\"error\":\"low_heap\",\"freeHeap\":%lu,\"nodeName\":\"%s\",\"ip\":\"%s\"}",
                static_cast<unsigned long>(freeHeap),
                nodeName.c_str(),
                WiFi.localIP().toString().c_str());
            request->send(200, "application/json", fallback);
            return;
        }

        const size_t maxDiscoveredNodesInStatus = 64;
        const size_t estimatedNodeBytes = 80;
        String json;
        const size_t reserveBytes = 2200 + (std::min(discoveredNodeTable.size(), maxDiscoveredNodesInStatus) * estimatedNodeBytes);
        if (!json.reserve(reserveBytes)) {
            char fallback[256];
            snprintf(
                fallback,
                sizeof(fallback),
                "{\"status\":\"degraded\",\"error\":\"reserve_failed\",\"freeHeap\":%lu,\"nodeName\":\"%s\",\"ip\":\"%s\"}",
                static_cast<unsigned long>(ESP.getFreeHeap()),
                nodeName.c_str(),
                WiFi.localIP().toString().c_str());
            request->send(200, "application/json", fallback);
            return;
        }

        json = "{";
        #if defined(ESP32)
            File dir = LittleFS.open("/devices", "r");
        #elif defined(ESP8266)
        json += "\"hardware\":\"ESP8266\",";
        #endif
        json += "\"nodeName\":\"" + nodeName + "\",";
        json += "\"firmwareVersion\":\"" + String(firmwareVersion) + "\",";
        json += "\"firmwareBuildStamp\":\"" + String(firmwareBuildStamp) + "\",";
        json += "\"deviceRole\":\"" + String(deviceRole) + "\",";
        json += "\"preferredTaskType\":\"" + String(preferredTaskType) + "\",";
        json += "\"firmwareTrack\":\"" + String(firmwareTrack) + "\",";
        json += "\"maxMessageBytes\":" + String((unsigned long)maxMessageBytes) + ",";
        json += "\"maxConcurrentTasks\":" + String((unsigned long)maxConcurrentTasks) + ",";
        json += "\"cluster\":{";
        json += "\"activeClusterId\":\"" + String(nodeConfig.activeClusterId) + "\",";
        json += "\"parentHost\":\"" + String(nodeConfig.parentHost) + "\",";
        json += "\"parentNodeId\":\"" + String(nodeConfig.parentNodeId) + "\",";
        json += String("\"isClusterGateway\":") + (nodeConfig.isClusterGateway ? "true" : "false") + ",";
        json += "\"parentPort\":" + String((unsigned long)nodeConfig.parentPort) + ",";
        json += "\"siblingPort\":" + String((unsigned long)nodeConfig.siblingPort);
        json += "},";
        json += "\"beacon\":{";
        json += String("\"acknowledged\":") + (udpRuntimeIsBeaconAcknowledged() ? "true" : "false") + ",";
        json += "\"lastSentAt\":" + String((unsigned long)udpRuntimeGetBeaconLastSentAt()) + ",";
        json += "\"lastAckAt\":" + String((unsigned long)udpRuntimeGetBeaconLastAckAt()) + ",";
        json += "\"capabilityHash\":\"" + computeNodeCapabilityHash() + "\"}" + ",";
        if (isSupervisorRole()) {
            json += String("\"supervisorEnabled\":") + (supervisorEnabled ? "true" : "false") + ",";
            json += String("\"supervisorOverallHealthy\":") + (supervisorOverallHealthy() ? "true" : "false") + ",";
        }
        json += "\"services\":[";
        bool firstService = true;
        if (isSupervisorRole()) {
            json += "\"StartupSupervisor\"";
            firstService = false;
        }
        if (ffsUp) {
            if (!firstService) json += ",";
            json += "\"FFS\"";
            firstService = false;
        }
        #ifdef ENABLE_PMACHINE
        if (!firstService) json += ",";
        #ifndef DISABLE_PMACHINE_ROUTES
        json += "\"pmachine\"";
        json += ",\"GenericRouterService\"";
        firstService = false;
        #endif
        #endif
        #ifdef ENABLE_BLUETOOTH_DEVICES
        if (!firstService) json += ",";
        json += "\"BluetoothService\"";
        firstService = false;
        #if defined(ENABLE_BLUETOOTH_AUDIO_TTS)
            if (!firstService) json += ",";
            json += "\"BluetoothAudioTtsService\"";
            firstService = false;
        #endif
        #endif
        #ifdef ENABLE_EVENT_SCHEDULER
        if (!firstService) json += ",";
        json += "\"EventSchedulerService\"";
        firstService = false;
        #endif
        #ifdef ENABLE_TIME_AUTHORITY
        if (!firstService) json += ",";
        json += "\"TimeAuthorityService\"";
        firstService = false;
        #endif
    #ifndef DISABLE_UNIQUE_ID_SERVICE
        if (!firstService) json += ",";
        json += "\"UniqueIdService\"";
        firstService = false;
    #endif
        json += "]";
        json += ",\"discoveredNodes\":[";
        bool first = true;
        size_t emittedNodes = 0;
        for (const auto& pair : discoveredNodeTable) {
            if (emittedNodes >= maxDiscoveredNodesInStatus) {
                break;
            }
            if (!first) json += ",";
            json += "{\"mac\":\"" + pair.second.mac + "\",\"ip\":\"" + pair.second.ip + "\"}";
            first = false;
            emittedNodes++;
        }
        json += "]";
        json += ",\"discoveredNodeCount\":" + String((unsigned long)discoveredNodeTable.size());
        json += ",\"discoveredNodesTruncated\":";
        json += (discoveredNodeTable.size() > emittedNodes) ? "true" : "false";
#ifdef ENABLE_TIME_AUTHORITY
        json += ",\"timeAuthority\":";
        json += timeAuthorityBuildStatusJson();
#endif
#ifndef DISABLE_UNIQUE_ID_SERVICE
    json += ",\"uniqueId\":";
    json += uniqueIdBuildStatusJson();
#endif
        json += "}";
        request->send(200, "application/json", json);
    });

#ifdef ENABLE_TIME_AUTHORITY
    server.on("/time/authority", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(200, "application/json", timeAuthorityBuildStatusJson());
    });

    server.on("/time/authority/sync", HTTP_POST, [](AsyncWebServerRequest *request){
        const bool ok = timeAuthorityForceResync("api");
        const String body = String("{\"status\":\"") + (ok ? "ok" : "degraded") + "\",\"time\":" + timeAuthorityBuildStatusJson() + "}";
        request->send(ok ? 200 : 503, "application/json", body);
    });
#endif

#ifndef DISABLE_UNIQUE_ID_SERVICE
    auto handleUniqueIdNext = [](AsyncWebServerRequest *request) {
        String kind = "evt";
        if (request->hasParam("kind", true)) {
            kind = request->getParam("kind", true)->value();
        } else if (request->hasParam("kind")) {
            kind = request->getParam("kind")->value();
        }
        kind.trim();
        if (kind.length() == 0) {
            kind = "evt";
        }

        const String nextId = uniqueIdNext(kind);
        JsonDocument doc;
        doc["status"] = "ok";
        doc["kind"] = kind;
        doc["id"] = nextId;
        doc["deviceId"] = uniqueIdGetDeviceId();
        doc["counter"] = uniqueIdGetCounter();
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    };

    server.on("/id/status", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(200, "application/json", uniqueIdBuildStatusJson());
    });

    server.on("/id/device", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        doc["status"] = "ok";
        doc["deviceId"] = uniqueIdGetDeviceId();
        doc["counter"] = uniqueIdGetCounter();
        doc["nodeName"] = nodeName;
        doc["strategy"] = "hybrid-mac-hash-time-counter-random";
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    server.on("/id/next", HTTP_GET, handleUniqueIdNext);
    server.on("/id/next", HTTP_POST, handleUniqueIdNext);
#endif

    server.on("/supervisor/status", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        doc["deviceRole"] = deviceRole;
        auto supervisor = doc["supervisor"].to<JsonObject>();
        appendSupervisorStatus(supervisor);
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

        auto serveBtConnectPage = [](AsyncWebServerRequest *request) {
            #ifndef FORCE_INLINE_BTCONNECT
                if (LittleFS.exists("/web/BTConnect.html")) {
                        request->send(LittleFS, "/web/BTConnect.html", "text/html");
                        return;
                }
            #endif

                static const char* kInlineBtConnectPage = R"HTML(
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>BTConnect</title>
    <style>
        body { font-family: Segoe UI, Arial, sans-serif; margin: 16px; background: #0f172a; color: #e2e8f0; }
        h1 { margin: 0 0 12px 0; }
        .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        button { padding: 10px 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; cursor: pointer; }
        input, select { padding: 8px; border-radius: 6px; border: 1px solid #334155; background: #0b1220; color: #e2e8f0; }
        pre { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 12px; min-height: 240px; overflow: auto; }
        .hint { color: #93c5fd; margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>BTConnect</h1>
    <div class="hint">Fallback page served from firmware. For static file mode, upload LittleFS data to include /web/BTConnect.html.</div>

    <div class="row">
        <button id="discover">Discover (Audio)</button>
        <button id="targets">List Audio Targets</button>
        <button id="status">Audio Status</button>
    </div>

    <div class="row">
        <input id="address" placeholder="AA:BB:CC:DD:EE:FF" size="22" />
        <select id="transport">
            <option value="classic">classic</option>
            <option value="ble">ble</option>
        </select>
        <button id="connect">Connect</button>
        <button id="disconnect">Disconnect</button>
    </div>

    <pre id="out">Ready\n</pre>

    <script>
        const out = document.getElementById('out');
        function log(obj) {
            out.textContent = JSON.stringify(obj, null, 2) + "\n" + out.textContent;
        }
        async function post(path, body) {
            const data = new URLSearchParams(body || {});
            const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data });
            const text = await res.text();
            let parsed = text;
            try { parsed = JSON.parse(text); } catch {}
            return { ok: res.ok, status: res.status, body: parsed };
        }
        async function get(path) {
            const res = await fetch(path);
            const text = await res.text();
            let parsed = text;
            try { parsed = JSON.parse(text); } catch {}
            return { ok: res.ok, status: res.status, body: parsed };
        }

        document.getElementById('discover').onclick = async () => log(await post('/api/bluetooth-audio/discover', { duration: 10 }));
        document.getElementById('targets').onclick = async () => log(await get('/api/bluetooth-audio/targets'));
        document.getElementById('status').onclick = async () => log(await get('/api/bluetooth-audio/status'));
        document.getElementById('connect').onclick = async () => {
            const address = document.getElementById('address').value.trim();
            const transport = document.getElementById('transport').value;
            log(await post('/api/bluetooth-audio/connect', { address, transport }));
        };
        document.getElementById('disconnect').onclick = async () => log(await post('/api/bluetooth-audio/disconnect', {}));
    </script>
</body>
</html>
)HTML";

                request->send(200, "text/html", kInlineBtConnectPage);
        };

    server.on("/BTConnect", HTTP_GET, serveBtConnectPage);
    server.on("/BRConnect", HTTP_GET, serveBtConnectPage);

    server.on("/web/provisioning.html", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (LittleFS.exists("/web/provisioning.html")) {
            request->send(LittleFS, "/web/provisioning.html", "text/html");
            return;
        }
        request->send(404, "text/plain", "Missing /web/provisioning.html on LittleFS. Upload data/ first.");
    });
    server.on("/provisioning", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->redirect("/web/provisioning.html");
    });

    server.on("/supervisor/config", HTTP_POST, [](AsyncWebServerRequest *request){
        if (!isSupervisorRole()) {
            request->send(409, "application/json", "{\"error\":\"supervisor role required\"}");
            return;
        }

        if (request->hasParam("enabled", true)) {
            String enabled = request->getParam("enabled", true)->value();
            supervisorEnabled = parseBoolValue(enabled);
        }
        if (request->hasParam("requireFrontend", true)) {
            String requireFrontend = request->getParam("requireFrontend", true)->value();
            supervisorRequireFrontend = parseBoolValue(requireFrontend);
        }
        if (request->hasParam("intervalMs", true)) {
            const unsigned long requested = request->getParam("intervalMs", true)->value().toInt();
            if (requested >= 1000 && requested <= 120000) {
                supervisorCheckIntervalMs = requested;
            }
        }
        if (request->hasParam("backendUrl", true)) {
            supervisorBackendProbe.url = request->getParam("backendUrl", true)->value();
        }
        if (request->hasParam("frontendUrl", true)) {
            supervisorFrontendProbe.url = request->getParam("frontendUrl", true)->value();
        }
        if (request->hasParam("heartbeatUrl", true)) {
            supervisorHeartbeatUrl = request->getParam("heartbeatUrl", true)->value();
        }

        bool persist = true;
        if (request->hasParam("persist", true)) {
            persist = parseBoolValue(request->getParam("persist", true)->value());
        }
        if (persist) {
            saveSupervisorConfig();
        }

        JsonDocument doc;
        doc["updated"] = true;
        doc["persisted"] = persist;
        auto supervisor = doc["supervisor"].to<JsonObject>();
        appendSupervisorStatus(supervisor);
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    #ifndef DISABLE_BONECRUSHER
    server.on("/bonecrusher/worker/status", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        doc["role"] = deviceRole;
        doc["enabled"] = bonecrusherConfig.enabled;
        doc["queueManagerUrl"] = bonecrusherConfig.queueManagerUrl;
        doc["queueName"] = bonecrusherConfig.queueName;
        doc["workerId"] = bonecrusherConfig.workerId;
        doc["leaseMs"] = bonecrusherConfig.leaseMs;
        doc["pollIntervalMs"] = bonecrusherConfig.pollIntervalMs;
        doc["heartbeatMs"] = bonecrusherConfig.heartbeatMs;
        doc["processTimeoutMs"] = bonecrusherConfig.processTimeoutMs;
        doc["retryDelayMs"] = bonecrusherConfig.retryDelayMs;
        doc["maxAttempts"] = bonecrusherConfig.maxAttempts;

        auto stats = doc["stats"].to<JsonObject>();
        stats["claimAttempts"] = bonecrusherStats.claimAttempts;
        stats["claimed"] = bonecrusherStats.claimed;
        stats["completed"] = bonecrusherStats.completed;
        stats["failed"] = bonecrusherStats.failed;
        stats["requeued"] = bonecrusherStats.requeued;
        stats["deadLettered"] = bonecrusherStats.deadLettered;
        stats["heartbeatsSent"] = bonecrusherStats.heartbeatsSent;
        stats["lastQueueHttpCode"] = bonecrusherStats.lastQueueHttpCode;
        stats["lastEdgeHttpCode"] = bonecrusherStats.lastEdgeHttpCode;
        stats["lastRunMs"] = static_cast<uint32_t>(bonecrusherStats.lastRunMs);
        stats["lastError"] = bonecrusherStats.lastError;

        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    server.on("/bonecrusher/worker/config", HTTP_POST, [](AsyncWebServerRequest *request){
        if (request->hasParam("enabled", true)) {
            bonecrusherConfig.enabled = parseBoolValue(request->getParam("enabled", true)->value());
        }
        if (request->hasParam("queueManagerUrl", true)) {
            bonecrusherConfig.queueManagerUrl = request->getParam("queueManagerUrl", true)->value();
        }
        if (request->hasParam("queueName", true)) {
            bonecrusherConfig.queueName = request->getParam("queueName", true)->value();
        }
        if (request->hasParam("workerId", true)) {
            bonecrusherConfig.workerId = request->getParam("workerId", true)->value();
        }
        if (request->hasParam("leaseMs", true)) {
            bonecrusherConfig.leaseMs = static_cast<uint32_t>(request->getParam("leaseMs", true)->value().toInt());
        }
        if (request->hasParam("pollIntervalMs", true)) {
            bonecrusherConfig.pollIntervalMs = static_cast<uint32_t>(request->getParam("pollIntervalMs", true)->value().toInt());
        }
        if (request->hasParam("heartbeatMs", true)) {
            bonecrusherConfig.heartbeatMs = static_cast<uint32_t>(request->getParam("heartbeatMs", true)->value().toInt());
        }
        if (request->hasParam("processTimeoutMs", true)) {
            bonecrusherConfig.processTimeoutMs = static_cast<uint32_t>(request->getParam("processTimeoutMs", true)->value().toInt());
        }
        if (request->hasParam("retryDelayMs", true)) {
            bonecrusherConfig.retryDelayMs = static_cast<uint32_t>(request->getParam("retryDelayMs", true)->value().toInt());
        }
        if (request->hasParam("maxAttempts", true)) {
            bonecrusherConfig.maxAttempts = static_cast<uint32_t>(request->getParam("maxAttempts", true)->value().toInt());
        }

        if (bonecrusherConfig.workerId.length() == 0) {
            bonecrusherConfig.workerId = nodeName;
        }

        bool persist = true;
        if (request->hasParam("persist", true)) {
            persist = parseBoolValue(request->getParam("persist", true)->value());
        }
        if (persist) {
            saveBonecrusherWorkerConfig();
        }

        JsonDocument doc;
        doc["updated"] = true;
        doc["persisted"] = persist;
        doc["enabled"] = bonecrusherConfig.enabled;
        doc["queueManagerUrl"] = bonecrusherConfig.queueManagerUrl;
        doc["queueName"] = bonecrusherConfig.queueName;
        doc["workerId"] = bonecrusherConfig.workerId;
        doc["leaseMs"] = bonecrusherConfig.leaseMs;
        doc["pollIntervalMs"] = bonecrusherConfig.pollIntervalMs;
        doc["heartbeatMs"] = bonecrusherConfig.heartbeatMs;
        doc["processTimeoutMs"] = bonecrusherConfig.processTimeoutMs;
        doc["retryDelayMs"] = bonecrusherConfig.retryDelayMs;
        doc["maxAttempts"] = bonecrusherConfig.maxAttempts;

        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    server.on("/esp32/gateways/status", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        doc["role"] = deviceRole;
        doc["enabled"] = esp32GatewayWorkersEnabled;
        doc["idleDelayMs"] = esp32GatewayIdleDelayMs;
        doc["count"] = static_cast<unsigned long>(esp32GatewayWorkers.size());
        doc["max"] = static_cast<unsigned long>(ESP32_GATEWAY_WORKER_MAX);
        JsonArray gateways = doc["gateways"].to<JsonArray>();
        for (size_t i = 0; i < esp32GatewayWorkers.size(); ++i) {
            JsonObject g = gateways.add<JsonObject>();
            appendGatewayWorkerJson(g, esp32GatewayWorkers[i]);
        }
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    server.on("/esp32/gateways/config", HTTP_POST, [](AsyncWebServerRequest *request){
        if (request->hasParam("enabled", true)) {
            esp32GatewayWorkersEnabled = parseBoolValue(request->getParam("enabled", true)->value());
        }
        if (request->hasParam("idleDelayMs", true)) {
            const uint32_t parsed = static_cast<uint32_t>(request->getParam("idleDelayMs", true)->value().toInt());
            esp32GatewayIdleDelayMs = parsed > 20 ? parsed : 20;
        }

        if (request->hasParam("configJson", true)) {
            String configJson = request->getParam("configJson", true)->value();
            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, configJson);
            if (err) {
                request->send(400, "application/json", String("{\"error\":\"Invalid configJson: ") + err.c_str() + "\"}");
                return;
            }

            if (doc["enabled"].is<bool>()) {
                esp32GatewayWorkersEnabled = doc["enabled"].as<bool>();
            }
            if (doc["idleDelayMs"].is<uint32_t>()) {
                const uint32_t parsed = doc["idleDelayMs"].as<uint32_t>();
                esp32GatewayIdleDelayMs = parsed > 20 ? parsed : 20;
            }

            JsonArray arr = doc["gateways"].as<JsonArray>();
            if (!arr.isNull()) {
                esp32GatewayWorkers.clear();
                for (JsonObject g : arr) {
                    if (esp32GatewayWorkers.size() >= ESP32_GATEWAY_WORKER_MAX) break;
                    Esp32GatewayWorkerEntry entry;
                    entry.gatewayId = String(g["gatewayId"] | "");
                    entry.worker = makeDefaultGatewayWorkerConfig(esp32GatewayWorkers.size());
                    if (g["enabled"].is<bool>()) entry.worker.enabled = g["enabled"].as<bool>();
                    if (g["queueManagerUrl"].is<const char*>()) entry.worker.queueManagerUrl = g["queueManagerUrl"].as<const char*>();
                    if (g["queueName"].is<const char*>()) entry.worker.queueName = g["queueName"].as<const char*>();
                    if (g["workerId"].is<const char*>()) entry.worker.workerId = g["workerId"].as<const char*>();
                    if (g["leaseMs"].is<uint32_t>()) entry.worker.leaseMs = g["leaseMs"].as<uint32_t>();
                    if (g["pollIntervalMs"].is<uint32_t>()) entry.worker.pollIntervalMs = g["pollIntervalMs"].as<uint32_t>();
                    if (g["heartbeatMs"].is<uint32_t>()) entry.worker.heartbeatMs = g["heartbeatMs"].as<uint32_t>();
                    if (g["processTimeoutMs"].is<uint32_t>()) entry.worker.processTimeoutMs = g["processTimeoutMs"].as<uint32_t>();
                    if (g["retryDelayMs"].is<uint32_t>()) entry.worker.retryDelayMs = g["retryDelayMs"].as<uint32_t>();
                    if (g["maxAttempts"].is<uint32_t>()) entry.worker.maxAttempts = g["maxAttempts"].as<uint32_t>();

                    if (entry.gatewayId.length() == 0) {
                        entry.gatewayId = entry.worker.workerId.length() ? entry.worker.workerId : String("gateway-") + String(static_cast<unsigned long>(esp32GatewayWorkers.size() + 1));
                    }
                    if (entry.worker.workerId.length() == 0) {
                        entry.worker.workerId = entry.gatewayId;
                    }
                    esp32GatewayWorkers.push_back(entry);
                }
            }
        }

        bool persist = true;
        if (request->hasParam("persist", true)) {
            persist = parseBoolValue(request->getParam("persist", true)->value());
        }
        if (persist) {
            saveEsp32GatewayWorkersConfig();
        }

        JsonDocument out;
        out["updated"] = true;
        out["persisted"] = persist;
        out["enabled"] = esp32GatewayWorkersEnabled;
        out["idleDelayMs"] = esp32GatewayIdleDelayMs;
        out["count"] = static_cast<unsigned long>(esp32GatewayWorkers.size());
        JsonArray gateways = out["gateways"].to<JsonArray>();
        for (size_t i = 0; i < esp32GatewayWorkers.size(); ++i) {
            JsonObject g = gateways.add<JsonObject>();
            appendGatewayWorkerJson(g, esp32GatewayWorkers[i]);
        }
        String json;
        serializeJson(out, json);
        request->send(200, "application/json", json);
    });
    #endif

    #ifndef DISABLE_FFS_ROUTES
    registerFFSRoutes(server, federatedFS);
    #endif
#ifdef ENABLE_PMACHINE
#ifndef DISABLE_PMACHINE_ROUTES
    registerPMachineRoutes(server, pm, &federatedFS);
#endif
#endif
    server.onNotFound(notFound);
    
#ifdef ENABLE_CAMERA
    setupCameraRoutes(server);
    Serial.println("[CAMERA] Camera routes registered");
#endif

#ifdef ENABLE_AWS_IOT
    registerAwsIotRoutes(server);
    Serial.println("[AWS_IOT] AWS IoT routes registered");
#endif

#ifdef ENABLE_PRINTER_SCANNER
    registerPrinterRoutes(server);
    Serial.println("[PRINTER] Printer/Scanner routes registered");
#endif

#ifdef ENABLE_BLUETOOTH_DEVICES
#if !defined(DISABLE_BLE_AUDIO_TTS)
    registerBluetoothRoutes(server);
    Serial.println("[BLUETOOTH] Bluetooth routes registered");
#endif
#if defined(ENABLE_BLUETOOTH_AUDIO_TTS)
    if (globalBluetoothAudioTtsService) {
        registerBluetoothAudioTtsRoutes(server, *globalBluetoothAudioTtsService);
        Serial.println("[BLUETOOTH-AUDIO] Bluetooth Audio/TTS routes registered");
    }
#endif
#ifdef ENABLE_EVENT_SCHEDULER
    registerSchedulerRoutes(server);
    Serial.println("[SCHEDULER] Scheduler routes registered");
#endif
#endif

    #ifndef DISABLE_WIFI_PROVISIONING
    registerWiFiProvisioningRoutes(server);
    Serial.println("[WIFI-PROV] WiFi provisioning routes registered");
    #else
    Serial.println("[WIFI-PROV] Disabled by build flag");
    #endif

#if defined(ENABLE_HTTPS) && (defined(ESP32) || defined(ESP8266))
    registerHttpsTlsRoutes(server);
#endif

    server.begin();
}


#define ANNOUNCE_INTERVAL 10000 // ms
#define WIFI_RECONNECT_INTERVAL 5000 // ms
constexpr unsigned long WIFI_FAILOVER_INTERVAL_MS = 15000;

constexpr uint16_t DEFAULT_UDP_PARENT_PORT = 4210;
constexpr uint16_t DEFAULT_UDP_SIBLING_PORT = 4211;
constexpr unsigned long TOPOLOGY_SYNC_INTERVAL_MS = 60000;

uint16_t runtimeUdpParentPort = DEFAULT_UDP_PARENT_PORT;
uint16_t runtimeUdpSiblingPort = DEFAULT_UDP_SIBLING_PORT;
unsigned long lastTopologySyncMs = 0;

unsigned long lastAnnounce = 0;
unsigned long lastWifiFailoverAttemptMs = 0;

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
    if (!udpRuntimeEnsureReady(runtimeUdpParentPort, runtimeUdpSiblingPort)) {
        return;
    }

    const String capabilityHash = computeNodeCapabilityHash();
    UdpAnnouncementState state = udpRuntimeGetAnnouncementState();

    if (sendNodeBeaconAnnouncement(
        udpRuntimeSocket(),
        runtimeUdpParentPort,
        nodeName.c_str(),
        deviceRole,
        firmwareBuildStamp,
        capabilityHash,
        state,
        runtimeUdpParentPort,
        runtimeUdpSiblingPort)) {
        udpRuntimeApplyAnnouncementState(state);
    }
}

String getOriginFromUrl(const String& url) {
    const int scheme = url.indexOf("://");
    if (scheme < 0) return "";

    const int authorityStart = scheme + 3;
    if (authorityStart >= static_cast<int>(url.length())) return "";

    const int pathStart = url.indexOf('/', authorityStart);
    if (pathStart < 0) return url;
    return url.substring(0, pathStart);
}

bool isValidTopologyPortPair(uint16_t parentPort, uint16_t siblingPort) {
    if (parentPort < 4200) return false;
    if ((parentPort % 2) != 0) return false;
    if ((siblingPort % 2) != 1) return false;
    if (siblingPort != static_cast<uint16_t>(parentPort + 1)) return false;
    return true;
}

bool syncTopologyUdpPortsFromAggregator() {
    if (WiFi.status() != WL_CONNECTED) return false;

    const String backendOrigin = getOriginFromUrl(supervisorBackendProbe.url);
    if (backendOrigin.length() == 0) return false;

    const String localIp = WiFi.localIP().toString();
    const String topologyUrl = trimTrailingSlash(backendOrigin) + "/api/nodes";

    HTTPClient http;
#if defined(ARDUINO_ARCH_ESP8266)
    WiFiClient topologyClient;
    if (!http.begin(topologyClient, topologyUrl)) {
#else
    if (!http.begin(topologyUrl)) {
#endif
        return false;
    }

    http.setTimeout(3000);
    const int code = http.GET();
    if (code < 200 || code >= 300) {
        http.end();
        return false;
    }

    const String body = http.getString();
    http.end();

    JsonDocument doc;
    if (deserializeJson(doc, body)) {
        return false;
    }

    if (!doc.is<JsonArray>()) {
        return false;
    }

    for (JsonObject node : doc.as<JsonArray>()) {
        const String nodeId = String(node["nodeId"] | "");
        const String nodeDisplayName = String(node["nodeName"] | "");
        const JsonVariantConst details = node["details"];
        const String nodeDetailsName = details.is<JsonObjectConst>() ? String(details["nodeName"] | "") : String();
        const String nodeIp = String(node["ip"] | "");

        const bool isSelf =
            (nodeId.length() > 0 && nodeId.equalsIgnoreCase(nodeName)) ||
            (nodeDisplayName.length() > 0 && nodeDisplayName.equalsIgnoreCase(nodeName)) ||
            (nodeDetailsName.length() > 0 && nodeDetailsName.equalsIgnoreCase(nodeName)) ||
            (nodeIp.length() > 0 && nodeIp.equals(localIp));

        if (!isSelf) continue;

        const uint16_t parentPort = static_cast<uint16_t>(node["topology"]["udp"]["parentPort"] | 0);
        const uint16_t siblingPort = static_cast<uint16_t>(node["topology"]["udp"]["siblingPort"] | 0);
        if (!isValidTopologyPortPair(parentPort, siblingPort)) {
            return false;
        }

        if (runtimeUdpParentPort != parentPort || runtimeUdpSiblingPort != siblingPort) {
            runtimeUdpParentPort = parentPort;
            runtimeUdpSiblingPort = siblingPort;
            udpRuntimeEnsureReady(runtimeUdpParentPort, runtimeUdpSiblingPort);
        }
        return true;
    }

    return false;
}

void writeDefaultDocIfMissing(const char* path, const char* content) {
    if (LittleFS.exists(path)) {
        return;
    }
    File file = LittleFS.open(path, "w");
    if (!file) {
        Serial.print("[DOCS] Failed to create ");
        Serial.println(path);
        return;
    }
    file.print(content);
    file.close();
}

void ensureDocsTreeAndDefaults() {
    if (!LittleFS.exists("/services/docs")) {
        LittleFS.mkdir("/services/docs");
    }
    if (!LittleFS.exists("/devices/docs")) {
        LittleFS.mkdir("/devices/docs");
    }

    writeDefaultDocIfMissing("/devices/docs/LEDPIN.txt", "Device: LEDPIN");
    writeDefaultDocIfMissing("/devices/docs/LEDPIN_set_output.txt", "Action: set_output");
    writeDefaultDocIfMissing("/devices/docs/LEDPIN_raise.txt", "Action: raise");
    writeDefaultDocIfMissing("/devices/docs/LEDPIN_lower.txt", "Action: lower");
    writeDefaultDocIfMissing("/devices/docs/RELAY.txt", "Device: RELAY (pin-controlled relay)");
    writeDefaultDocIfMissing("/devices/docs/RELAY_toggle.txt", "Action: toggle");
    writeDefaultDocIfMissing("/devices/docs/RELAY_turnOn.txt", "Action: turnOn");
    writeDefaultDocIfMissing("/devices/docs/RELAY_turnOff.txt", "Action: turnOff");
    writeDefaultDocIfMissing("/devices/docs/RELAY_fsm.txt", "FSM: off --turnOn--> on, on --turnOff--> off, off|on --toggle--> toggled state");

    writeDefaultDocIfMissing("/services/docs/ffs.txt", "Federated File System: provides distributed file storage and access.");
    writeDefaultDocIfMissing("/services/docs/ffs_listFiles.txt", "List all files in the file system.");
    writeDefaultDocIfMissing("/services/docs/ffs_write.txt", "Write data to a file.");
    writeDefaultDocIfMissing("/services/docs/ffs_read.txt", "Read data from a file.");
    writeDefaultDocIfMissing("/services/docs/ffs_remove.txt", "Remove a file from the file system.");
    writeDefaultDocIfMissing("/services/docs/ffs_sync.txt", "Synchronize file system to storage.");

    writeDefaultDocIfMissing("/services/docs/pmachine.txt", "PL/0-style virtual machine for executing pcode programs.");
    writeDefaultDocIfMissing("/services/docs/pmachine_loadProgram.txt", "Load a pcode program into the VM.");
    writeDefaultDocIfMissing("/services/docs/pmachine_run.txt", "Run the loaded program.");
    writeDefaultDocIfMissing("/services/docs/pmachine_singleStep.txt", "Execute a single instruction.");
    writeDefaultDocIfMissing("/services/docs/pmachine_setBreakpoint.txt", "Set a breakpoint at a given address.");
    writeDefaultDocIfMissing("/services/docs/pmachine_clearBreakpoint.txt", "Clear a breakpoint at a given address.");
    writeDefaultDocIfMissing("/services/docs/pmachine_getStatus.txt", "Get the current status of the VM.");

    writeDefaultDocIfMissing("/services/docs/sensor.txt", "Provides access to connected sensors (e.g., DHT22, BME280).");
    writeDefaultDocIfMissing("/services/docs/sensor_readSensor.txt", "Read values from a sensor.");
    writeDefaultDocIfMissing("/services/docs/sensor_resultToJson.txt", "Convert sensor result to JSON.");
}

void setup() {

    Serial.begin(115200);
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
        if (!ensureLittleFsInitialized()) {
            Serial.println("LittleFS mount failed");
            while (1) delay(1000);
        }
    }
#else
    if (!ensureLittleFsInitialized()) {
        Serial.println("LittleFS mount failed");
        while (1) delay(1000);
    }
#endif

#if defined(ESP32)
    if (!ensureLittleFsInitialized()) {
        Serial.println("LittleFS unavailable");
        while (1) delay(1000);
    }
#endif

    // Load persisted node identity early so provisioning AP/hostname can use it.
    if (loadNodeConfig(nodeConfig) && nodeConfig.nodeName.length()) {
        nodeName = nodeConfig.nodeName;
    } else {
        File f = LittleFS.open(NODE_NAME_PATH, "r");
        if (f) {
            String savedName = f.readString();
            f.close();
            savedName.trim();
            if (savedName.length()) {
                nodeName = savedName;
            }
        }
    }

    // 2. WiFi connection logic
    Serial.println("[BOOT] Connecting to WiFi...");
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    WiFi.disconnect(true, true);
    delay(50);

    initializeWiFiProvisioning(nodeName.c_str());
    if (globalWiFiProvisioning) {
        globalWiFiProvisioning->eraseLegacyCredentialStores();
    }

    bool connected = false;
    if (globalWiFiProvisioning) {
        connected = globalWiFiProvisioning->connectWiFi(nullptr, 12);
        if (connected) {
            const WiFiCredentials& active = globalWiFiProvisioning->getCurrentCredentials();
            udpRuntimeConfigureWifiCredentials(active.ssid, active.password);
        }
    }

    if (!connected && wifiConfig.ssid.length() > 0) {
        Serial.println("[BOOT] Falling back to in-memory wifiConfig credentials");
        WiFi.begin(wifiConfig.ssid.c_str(), wifiConfig.password.c_str());
        udpRuntimeConfigureWifiCredentials(wifiConfig.ssid, wifiConfig.password);
        int retries = 0;
        while (WiFi.status() != WL_CONNECTED && retries < 20) {
            delay(500);
            Serial.print(".");
            retries++;
        }
    }

    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("[BOOT] WiFi connected: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("[BOOT] WiFi connection failed (no usable provisioned profile)");
        String ssidBase = nodeName.length() ? nodeName : String("ESP32");
        ssidBase.replace(" ", "-");
        String apName = String("Pulse-") + ssidBase + "-Provision";
        if (apName.length() > 31) {
            apName = apName.substring(0, 31);
        }
        WiFi.mode(WIFI_AP_STA);
        const bool apStarted = WiFi.softAP(apName.c_str());
        if (apStarted) {
            Serial.printf("[WIFI-PROV] Provisioning AP started: %s\n", apName.c_str());
            Serial.printf("[WIFI-PROV] AP IP: %s\n", WiFi.softAPIP().toString().c_str());
        } else {
            Serial.printf("[WIFI-PROV] Failed to start provisioning AP: %s\n", apName.c_str());
        }
    }

    // 3. Ensure /devices, /services, and /flows directories exist at root at boot
    File root = LittleFS.open("/", "r");
    bool foundDevices = false, foundServices = false, foundFlows = false;
    Serial.println("Looking for services and devices");
    if (root && root.isDirectory()) {
        File entry = root.openNextFile();
        while (entry) {
            String name = String(entry.name());
            if (entry.isDirectory()) {
                if (name == "/devices") foundDevices = true;
                if (name == "/services") foundServices = true;
                if (name == "/flows") foundFlows = true;
            }
            entry = root.openNextFile();
        }
        root.close();
    }
    Serial.println("Making sure we have devices and services");
    if (!foundDevices) LittleFS.mkdir("/devices");
    if (!foundServices) LittleFS.mkdir("/services");
    if (!foundFlows) LittleFS.mkdir("/flows");
    ensureDocsTreeAndDefaults();

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

            File relayFile = LittleFS.open("/devices/RELAY.json", "w");
            if (relayFile) {
                JsonDocument relayDoc;
                relayDoc["type"] = "device";
                relayDoc["name"] = "RELAY";
                relayDoc["pin"] = relayPinNumber;
                relayDoc["visibility"] = "private";
                auto relayActions = relayDoc["actions"].to<JsonArray>();
                relayActions.add("toggle");
                relayActions.add("turnOn");
                relayActions.add("turnOff");
                auto relayFsm = relayDoc["fsm"].to<JsonObject>();
                relayFsm["initialState"] = "off";
                auto relayStates = relayFsm["states"].to<JsonArray>();
                relayStates.add("off");
                relayStates.add("on");
                auto relayTransitions = relayFsm["transitions"].to<JsonArray>();
                JsonObject t1 = relayTransitions.add<JsonObject>();
                t1["from"] = "off";
                t1["action"] = "turnOn";
                t1["to"] = "on";
                JsonObject t2 = relayTransitions.add<JsonObject>();
                t2["from"] = "on";
                t2["action"] = "turnOff";
                t2["to"] = "off";
                JsonObject t3 = relayTransitions.add<JsonObject>();
                t3["from"] = "off";
                t3["action"] = "toggle";
                t3["to"] = "on";
                JsonObject t4 = relayTransitions.add<JsonObject>();
                t4["from"] = "on";
                t4["action"] = "toggle";
                t4["to"] = "off";
                String relayJson;
                serializeJson(relayDoc, relayJson);
                relayFile.print(relayJson);
                relayFile.close();
                Serial.println("[RELAY] /devices/RELAY.json created.");
            } else {
                Serial.println("[RELAY] Failed to create /devices/RELAY.json!");
            }

            pinMode(relayPinNumber, OUTPUT);
            relayStateOn = false;
            digitalWrite(relayPinNumber, LOW);
            Serial.printf("[RELAY] Pin %d set as OUTPUT and LOW (relay off)\n", relayPinNumber);
        } else {
            Serial.println("[LEDPIN] /devices directory does NOT exist!");
        }
    } else {
        Serial.println("[LEDPIN] WiFi not connected, skipping LEDPIN device creation!");
    }

    // 5. Load node config from /ffs/.NodeConfig.json if present
    if (loadNodeConfig(nodeConfig) && nodeConfig.nodeName.length()) {
        nodeName = nodeConfig.nodeName;
    } else {
        bool loadedStoredName = false;
        File f = LittleFS.open(NODE_NAME_PATH, "r");
        if (f) {
            String savedName = f.readString();
            f.close();
            savedName.trim();
            if (savedName.length()) {
                nodeName = savedName;
                loadedStoredName = true;
            }
        }

        // If no persisted name exists, append last 4 hex digits of MAC for uniqueness.
        if (!loadedStoredName) {
            uint8_t mac[6];
            WiFi.macAddress(mac);
            char macSuffix[5];
            sprintf(macSuffix, "%02X%02X", mac[4], mac[5]);
            nodeName += "-";
            nodeName += macSuffix;
        }
    }

    #ifndef DISABLE_BONECRUSHER
    initializeBonecrusherWorkerDefaults();
    loadBonecrusherWorkerConfig();
    if (bonecrusherConfig.workerId.length() == 0) {
        bonecrusherConfig.workerId = nodeName;
    }
    loadEsp32GatewayWorkersConfig();
    #endif

    // 6. Set hostname, start UDP, and announce presence (must be after WiFi is up and nodeName is set)
    WiFi.setHostname(nodeName.c_str());
    startOrRefreshMdns(nodeName);
    Serial.println("[OTA] Removed: use serial firmware upload + FFS file upload for delivery");
    configureSupervisorTargets();
    loadSupervisorConfig();
    if (isSupervisorRole()) {
        Serial.println("[SUPERVISOR] Sentinel role enabled");
        Serial.print("[SUPERVISOR] require frontend for green: ");
        Serial.println(supervisorRequireFrontend ? "true" : "false");
        Serial.print("[SUPERVISOR] backend target: ");
        Serial.println(supervisorBackendProbe.url);
        Serial.print("[SUPERVISOR] frontend target: ");
        Serial.println(supervisorFrontendProbe.url);
        Serial.print("[SUPERVISOR] heartbeat target: ");
        Serial.println(supervisorHeartbeatUrl);
    }
    udpRuntimeEnsureReady(runtimeUdpParentPort, runtimeUdpSiblingPort);
    udpRuntimeResetBeaconState();
    announcePresence();

#ifdef ENABLE_TIME_AUTHORITY
    timeAuthorityBegin(nodeName);
#endif

#ifndef DISABLE_UNIQUE_ID_SERVICE
    uniqueIdBegin(nodeName);
#endif

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

#ifdef ENABLE_CAMERA
    Serial.println("[BOOT] Initializing camera service...");
    CameraConfig cameraConfig = CameraService::getDefaultConfig();
#if defined(ENABLE_DOORBELL_CAMERA)
    cameraConfig.resolution = RES_QVGA;
    cameraConfig.quality = QUALITY_MEDIUM;
#else
    cameraConfig.resolution = RES_SVGA;
    cameraConfig.quality = QUALITY_MEDIUM;
#endif
    
    if (cameraService.begin(cameraConfig)) {
        Serial.println("[CAMERA] Camera initialized successfully");
        cameraService.setFFS(&federatedFS);
#if defined(ENABLE_DOORBELL_CAMERA)
        pinMode(DOORBELL_BUTTON_PIN, INPUT_PULLUP);
        doorbellButtonLastReading = digitalRead(DOORBELL_BUTTON_PIN) == DOORBELL_BUTTON_ACTIVE_LEVEL;
        doorbellButtonStablePressed = doorbellButtonLastReading;
        doorbellButtonLastChangeMs = millis();

        MotionDetectionConfig motionConfig;
        motionConfig.enabled = true;
        motionConfig.threshold = 20;
        motionConfig.minBlocks = 10;
        motionConfig.blockSize = 16;
        motionConfig.cooldownMs = 1500;
        if (cameraService.enableMotionDetection(motionConfig)) {
            cameraService.setMotionCallback(onDoorbellMotionDetected);
            Serial.println("[DOORBELL] Motion detection enabled");
        } else {
            Serial.println("[DOORBELL] Motion detection failed to start");
        }
#endif
    } else {
        Serial.println("[CAMERA] Camera initialization failed");
    }
#endif

#ifdef ENABLE_AWS_IOT
    Serial.println("[BOOT] Initializing AWS IoT Gateway...");
    if (initializeAwsIotGateway()) {
        Serial.println("[AWS_IOT] AWS IoT Gateway initialized successfully");
    } else {
        Serial.println("[AWS_IOT] AWS IoT Gateway initialization failed");
    }
#endif

#ifdef ENABLE_DISPLAY
    Serial.println("[BOOT] Initializing display service...");
    if (displayService.begin()) {
        Serial.println("[DISPLAY] Display initialized successfully");
        
#ifndef DISPLAY_NO_LVGL
        // Initialize DDL Renderer
        Serial.println("[BOOT] Initializing DDL renderer...");
        if (ddlRenderer.begin(displayService.getLVGLDisplay())) {
            Serial.println("[DDL] DDL renderer initialized successfully");
            
            // Set up action callback
            ddlRenderer.setActionCallback([&](const String& action) {
                Serial.printf("[DDL] Action triggered: %s\n", action.c_str());
                // TODO: Handle actions (e.g., device.relay.toggle, system.refresh)
            });
            
            // Set up registry callback
            ddlRenderer.setRegistryCallback([&](const String& key, JsonVariant value) {
                Serial.printf("[DDL] Registry update from UI: %s = %s\n", key.c_str(), value.as<String>().c_str());
                // TODO: Update registry/pmachine state
            });
            
            // Load and render DDL
            if (LittleFS.exists("/display/example.ddl.json")) {
                Serial.println("[DDL] Loading example DDL...");
                if (ddlRenderer.loadDDL("/display/example.ddl.json")) {
                    ddlRenderer.render();
                    Serial.println("[DDL] DDL rendered successfully");
                } else {
                    Serial.println("[DDL] Failed to load DDL file");
                }
            } else {
                Serial.println("[DDL] No DDL file found, using embedded touch test DDL");
                
                // Embedded touch test DDL - compact single card design
                String touchTestDDL = R"({
                    "display": "TouchTest",
                    "version": "1.0",
                    "layout": {
                        "type": "column",
                        "cards": [
                            {
                                "id": "touchCard",
                                "title": "Touch Test - IP: )" + WiFi.localIP().toString() + R"(",
                                "actions": [
                                    {
                                        "id": "btn1",
                                        "type": "button",
                                        "label": "Button 1",
                                        "action": "test.button1"
                                    },
                                    {
                                        "id": "btn2",
                                        "type": "button",
                                        "label": "Button 2",
                                        "action": "test.button2"
                                    },
                                    {
                                        "id": "btn3",
                                        "type": "button",
                                        "label": "Button 3",
                                        "action": "test.button3"
                                    }
                                ]
                            }
                        ]
                    }
                })";
                
                if (ddlRenderer.parseDDL(touchTestDDL)) {
                    ddlRenderer.render();
                    Serial.println("[DDL] Embedded touch test DDL rendered successfully");
                } else {
                    Serial.println("[DDL] Failed to parse embedded DDL");
                }
            }
        } else {
            Serial.println("[DDL] DDL renderer initialization failed");
        }
#endif // DISPLAY_NO_LVGL
    } else {
        Serial.println("[DISPLAY] Display initialization failed");
    }
#endif

#ifdef ENABLE_PRINTER_SCANNER
    Serial.println("[BOOT] Initializing Printer/Scanner service...");
    initializePrinterService();
    if (globalPrinterService) {
        Serial.println("[PRINTER] Printer/Scanner service initialized successfully");
        
        #ifdef ENABLE_AWS_IOT
        // Register Alexa handlers for printer/scanner control
        registerPrinterAlexaHandlers();
        #endif
    } else {
        Serial.println("[PRINTER] Printer/Scanner service initialization failed");
    }
#endif

#ifdef ENABLE_BLUETOOTH_DEVICES
#if !defined(DISABLE_BLE_AUDIO_TTS)
    Serial.println("[BOOT] Initializing Bluetooth service...");
    globalBluetoothService = new BluetoothService();
    if (globalBluetoothService && globalBluetoothService->begin()) {
        Serial.println("[BLUETOOTH] Bluetooth service initialized successfully");
    } else {
        Serial.println("[BLUETOOTH] Bluetooth service initialization failed");
        delete globalBluetoothService;
        globalBluetoothService = nullptr;
    }
#endif

#if defined(ENABLE_BLUETOOTH_AUDIO_TTS)
#if !defined(DISABLE_BLE_AUDIO_TTS)
    if (globalBluetoothService) {
        globalBluetoothService->setScanInterval(120000);
        globalBluetoothService->setScanDuration(5);
        globalBluetoothService->setAutoDiscovery(true);
        Serial.printf("[BLUETOOTH] Audio profile BLE scan config: auto=ON interval=%dms duration=%ds freeHeap=%lu\n",
                      globalBluetoothService->getScanInterval(),
                      globalBluetoothService->getScanDuration(),
                      static_cast<unsigned long>(ESP.getFreeHeap()));
    }
#else
    Serial.println("[BLUETOOTH] BLE device service disabled for classic-only audio profile");
#endif

    Serial.println("[BOOT] Initializing Bluetooth Audio/TTS service...");
    globalBluetoothAudioTtsService = new BluetoothAudioTtsService();
    if (globalBluetoothAudioTtsService && globalBluetoothAudioTtsService->begin()) {
        Serial.println("[BLUETOOTH-AUDIO] Bluetooth Audio/TTS service initialized successfully");
    } else {
        Serial.println("[BLUETOOTH-AUDIO] Bluetooth Audio/TTS service initialization failed");
        delete globalBluetoothAudioTtsService;
        globalBluetoothAudioTtsService = nullptr;
    }
#endif
#endif

#ifdef ENABLE_EVENT_SCHEDULER
    Serial.println("[BOOT] Initializing Event Scheduler service...");
    globalEventScheduler = new EventScheduler();
    if (globalEventScheduler && globalEventScheduler->begin()) {
        Serial.println("[SCHEDULER] Event Scheduler service initialized successfully");
#ifdef ENABLE_BLUETOOTH_DEVICES
        globalEventScheduler->setEventExecutor([](const ScheduledEvent& event) -> bool {
            if (!globalBluetoothService) {
                return false;
            }
            if (!event.deviceType.equalsIgnoreCase("bluetooth") && !event.deviceType.equalsIgnoreCase("ble")) {
                return false;
            }
            return globalBluetoothService->controlDevice(event.deviceId, event.action, event.params);
        });
        Serial.println("[SCHEDULER] Bluetooth executor bridge enabled");
#endif
    } else {
        Serial.println("[SCHEDULER] Event Scheduler service initialization failed");
        delete globalEventScheduler;
        globalEventScheduler = nullptr;
    }
#endif

    String advertisedServices = "[BOOT] Advertised services: ";
    bool firstAdvertised = true;
    if (ffsUp) {
        advertisedServices += "FFS";
        firstAdvertised = false;
    }
#ifdef ENABLE_PMACHINE
#ifndef DISABLE_PMACHINE_ROUTES
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "pmachine";
    advertisedServices += ", GenericRouterService";
    firstAdvertised = false;
#endif
#endif
#ifdef ENABLE_CAMERA
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "camera";
    firstAdvertised = false;
#endif
#ifdef ENABLE_PRINTER_SCANNER
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "printer-scanner";
    firstAdvertised = false;
#endif
#ifdef ENABLE_BLUETOOTH_DEVICES
#if !defined(DISABLE_BLE_AUDIO_TTS)
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "BluetoothService";
    firstAdvertised = false;
#endif
#if defined(ENABLE_BLUETOOTH_AUDIO_TTS)
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "BluetoothAudioTtsService";
    firstAdvertised = false;
#endif
#endif
#ifdef ENABLE_EVENT_SCHEDULER
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "EventScheduler";
    firstAdvertised = false;
#endif
#ifdef ENABLE_TIME_AUTHORITY
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "TimeAuthorityService";
    firstAdvertised = false;
#endif
#ifndef DISABLE_UNIQUE_ID_SERVICE
    if (!firstAdvertised) advertisedServices += ", ";
    advertisedServices += "UniqueIdService";
    firstAdvertised = false;
#endif
    if (firstAdvertised) advertisedServices += "none";
    Serial.println(advertisedServices);

    // 8. Web server for node name config (Async)
    setupWebServer();
#if defined(ENABLE_HTTPS) && (defined(ESP32) || defined(ESP8266))
    startHttpsService();
#endif
#if defined(ESP32) && !defined(DISABLE_BONECRUSHER)
    startEsp32GatewayWorkerTaskIfNeeded();
#endif
}

void loop() {
    serialProvisioningPoll();

    if (WiFi.status() != WL_CONNECTED && globalWiFiProvisioning) {
        const unsigned long now = millis();
        if (now - lastWifiFailoverAttemptMs >= WIFI_FAILOVER_INTERVAL_MS) {
            lastWifiFailoverAttemptMs = now;
            if (globalWiFiProvisioning->connectWiFi(nullptr, 10)) {
                const WiFiCredentials& active = globalWiFiProvisioning->getCurrentCredentials();
                udpRuntimeConfigureWifiCredentials(active.ssid, active.password);
                startOrRefreshMdns(nodeName);
            }
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        startOrRefreshMdns(nodeName);
    }

    udpRuntimeMaintainConnectivity(runtimeUdpParentPort, runtimeUdpSiblingPort, WIFI_RECONNECT_INTERVAL);

#ifdef ENABLE_TIME_AUTHORITY
    timeAuthorityLoop();
#endif

#ifdef ENABLE_AWS_IOT
    // Update AWS IoT Gateway (process MQTT messages)
    updateAwsIotGateway();
#endif

#ifdef ENABLE_BLUETOOTH_DEVICES
    // Update Bluetooth service (handle scanning and device discovery)
#if !defined(DISABLE_BLE_AUDIO_TTS)
    if (globalBluetoothService) {
        globalBluetoothService->loop();
    }
#endif
#if defined(ENABLE_BLUETOOTH_AUDIO_TTS)
    if (globalBluetoothAudioTtsService) {
        globalBluetoothAudioTtsService->loop();
    }
#endif
#endif

#ifdef ENABLE_EVENT_SCHEDULER
    // Update Event Scheduler (check and execute scheduled events)
    if (globalEventScheduler) {
        globalEventScheduler->loop();
    }
#endif

    // Non-blocking UDP receive for node discovery
    UdpRuntimeContext udpContext;
    udpContext.nodeName = nodeName.c_str();
    udpContext.deviceRole = deviceRole;
    udpContext.firmwareVersion = firmwareVersion;
    udpContext.firmwareBuildStamp = firmwareBuildStamp;
    udpContext.firmwareTrack = firmwareTrack;
    udpContext.discoveredNodeTable = &discoveredNodeTable;
    udpContext.computeNodeCapabilityHash = computeNodeCapabilityHash;
#if defined(ENABLE_DOORBELL_DISPLAY)
    udpContext.onAlertMessage = handleDoorbellAlertPacket;
#endif
    udpRuntimeProcessIncoming(udpContext, runtimeUdpParentPort, runtimeUdpSiblingPort);
        /* UDP announcement disabled */
        // processIncomingUDP();

#if defined(ENABLE_DOORBELL_CAMERA)
    pollDoorbellButton();
    if (millis() - doorbellLastMotionCheckMs > 500) {
        MotionEvent motionEvent;
        if (cameraService.checkMotion(motionEvent)) {
            Serial.printf("[DOORBELL] Person alert: %d blocks changed (%.1f%%)\n",
                          motionEvent.changedBlocks, motionEvent.changePercentage);
        }
        doorbellLastMotionCheckMs = millis();
    }
#endif

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

    const unsigned long beaconInterval = udpRuntimeGetBeaconIntervalMs(
        NODE_BEACON_ACKED_INTERVAL_MS,
        NODE_BEACON_UNACKED_INTERVAL_MS);
    if (millis() - lastAnnounce > beaconInterval) {
        if (!isBonecrusherRole()) {
            announcePresence();
        }
        lastAnnounce = millis();
    }

    if (millis() - lastTopologySyncMs > TOPOLOGY_SYNC_INTERVAL_MS) {
        if (!isBonecrusherRole()) {
            syncTopologyUdpPortsFromAggregator();
        }
        lastTopologySyncMs = millis();
    }

    runSupervisorHealthChecks();
    
#ifdef ENABLE_DISPLAY
    // Update LVGL (handles rendering and touch)
    displayService.update();
#endif

#ifdef ENABLE_PRINTER_SCANNER
    // Update printer/scanner service
    if (globalPrinterService) {
        globalPrinterService->loop();
    }
#endif
    // No need for server.handleClient() with AsyncWebServer
    // Add VM logic here
}

