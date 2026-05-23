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
#include <HTTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#endif
//bool ffsUp = false;

#include <ESPAsyncWebServer.h>
#include "NodeDiscovery.h"

#include "NodeConfig.h"
#include "profile_config.h"

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
bool otaEnabled = false;

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "1.0.0"
#endif

const char* firmwareVersion = FIRMWARE_VERSION;
const char* deviceRole = DEVICE_ROLE;
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
    if (!LittleFS.exists(supervisorConfigPath)) {
        return;
    }

    File f = LittleFS.open(supervisorConfigPath, "r");
    if (!f) {
        Serial.println("[SUPERVISOR] Failed to open config file for read");
        return;
    }

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
    if (!http.begin(probe.url)) {
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
    const bool ok = client.connect(host.c_str(), port, 2500);
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
    if (!http.begin(supervisorHeartbeatUrl)) {
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
    if (!http.begin(url)) return -1;
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(timeoutMs);
    const int code = http.POST(body);
    responseBody = (code > 0) ? http.getString() : "";
    http.end();
    return code;
}

int httpPostForm(const String& url, const String& body, String& responseBody, uint16_t timeoutMs = 6000) {
    HTTPClient http;
    if (!http.begin(url)) return -1;
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    http.setTimeout(timeoutMs);
    const int code = http.POST(body);
    responseBody = (code > 0) ? http.getString() : "";
    http.end();
    return code;
}

int httpGet(const String& url, String& responseBody, uint16_t timeoutMs = 4000) {
    HTTPClient http;
    if (!http.begin(url)) return -1;
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

#if defined(ESP32)
void bonecrusherWorkerTask(void* param) {
    (void)param;
    for (;;) {
        runBonecrusherWorkerIteration();
        const uint32_t delayMs = bonecrusherConfig.enabled
          ? (bonecrusherConfig.pollIntervalMs > 20 ? bonecrusherConfig.pollIntervalMs : 20)
          : 1000;
        vTaskDelay(pdMS_TO_TICKS(delayMs));
    }
}

void startBonecrusherWorkerTaskIfNeeded() {
    if (!isBonecrusherRole()) return;
    if (bonecrusherWorkerTaskHandle != nullptr) return;
    BaseType_t ok = xTaskCreatePinnedToCore(
        bonecrusherWorkerTask,
        "bonecrusherWorker",
        8192,
        nullptr,
        1,
        &bonecrusherWorkerTaskHandle,
        1
    );
    if (ok != pdPASS) {
        ok = xTaskCreate(
            bonecrusherWorkerTask,
            "bonecrusherWorker",
            8192,
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
#endif



void notFound(AsyncWebServerRequest *request) {
    request->send(404, "text/plain", "Not found");
}

void setupOtaService() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[OTA] WiFi not connected; OTA disabled");
        otaEnabled = false;
        return;
    }

    ArduinoOTA.setHostname(nodeName.c_str());
    ArduinoOTA.onStart([]() {
        Serial.println("[OTA] Update started");
    });
    ArduinoOTA.onEnd([]() {
        Serial.println("[OTA] Update complete");
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        if (total == 0) return;
        unsigned int pct = (progress * 100U) / total;
        Serial.printf("[OTA] Progress: %u%%\n", pct);
    });
    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("[OTA] Error[%u]\n", static_cast<unsigned int>(error));
    });

    ArduinoOTA.begin();
    otaEnabled = true;
    Serial.print("[OTA] Ready. Hostname=");
    Serial.print(nodeName);
    Serial.print(" IP=");
    Serial.println(WiFi.localIP());
    Serial.print("[OTA] Firmware version=");
    Serial.println(firmwareVersion);
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
        doc["firmwareVersion"] = firmwareVersion;
        doc["deviceRole"] = deviceRole;
        doc["preferredTaskType"] = preferredTaskType;
        doc["firmwareTrack"] = firmwareTrack;
        doc["otaEnabled"] = otaEnabled;
        doc["maxMessageBytes"] = static_cast<uint32_t>(maxMessageBytes);
        doc["maxConcurrentTasks"] = static_cast<uint32_t>(maxConcurrentTasks);
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
        json += "\"firmwareVersion\":\"" + String(firmwareVersion) + "\",";
        json += "\"deviceRole\":\"" + String(deviceRole) + "\",";
        json += "\"preferredTaskType\":\"" + String(preferredTaskType) + "\",";
        json += "\"firmwareTrack\":\"" + String(firmwareTrack) + "\",";
        json += String("\"otaEnabled\":") + (otaEnabled ? "true" : "false") + ",";
        json += "\"maxMessageBytes\":" + String((unsigned long)maxMessageBytes) + ",";
        json += "\"maxConcurrentTasks\":" + String((unsigned long)maxConcurrentTasks) + ",";
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

    server.on("/supervisor/status", HTTP_GET, [](AsyncWebServerRequest *request){
        JsonDocument doc;
        doc["deviceRole"] = deviceRole;
        auto supervisor = doc["supervisor"].to<JsonObject>();
        appendSupervisorStatus(supervisor);
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
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

            String msg = String(incoming);
            String parsedId;
            String parsedIp;
            String parsedNodeId;

            // Legacy format: "ESP32-VM online: <MAC> IP: <IP>"
            int macStart = msg.indexOf(": ");
            int ipStart = msg.indexOf("IP: ");
            if (macStart != -1 && ipStart != -1) {
                parsedId = msg.substring(macStart + 2, ipStart - 1);
                parsedIp = msg.substring(ipStart + 4);
                parsedId.trim();
                parsedIp.trim();
            }

            // JSON format: {"kind":"machineAvailability", "ip":"...", "nodeId":"..."}
            if (parsedIp.length() == 0 && msg.startsWith("{")) {
                JsonDocument doc;
                DeserializationError err = deserializeJson(doc, msg);
                if (!err) {
                    const char* ip = doc["ip"] | nullptr;
                    const char* mac = doc["mac"] | nullptr;
                    const char* nodeId = doc["nodeId"] | doc["nodeName"] | nullptr;

                    if (ip != nullptr) {
                        parsedIp = String(ip);
                    }
                    if (nodeId != nullptr) {
                        parsedNodeId = String(nodeId);
                    }
                    if (mac != nullptr) {
                        parsedId = String(mac);
                    } else if (parsedNodeId.length() > 0) {
                        parsedId = String("node:") + parsedNodeId;
                    }
                    parsedIp.trim();
                    parsedId.trim();
                    parsedNodeId.trim();
                }
            }

            if (parsedId.length() > 0 && parsedIp.length() > 0) {
                String myMac = WiFi.macAddress();
                myMac.trim();
                String myIp = WiFi.localIP().toString();
                myIp.trim();

                if (parsedId.equalsIgnoreCase(myMac)
                    || parsedIp.equals(myIp)
                    || (parsedNodeId.length() > 0 && parsedNodeId.equalsIgnoreCase(nodeName))) {
                    Serial.println("Announcement from self, not adding.");
                } else {
                    DiscoveredNode node;
                    node.mac = parsedId;
                    node.ip = parsedIp;
                    node.lastSeen = millis();
                    discoveredNodeTable[parsedId] = node;
                    Serial.println("Node added to discoveredNodeTable.");
                }
            } else {
                Serial.println("Failed to parse announcement: expected legacy MAC/IP text or JSON with ip + (mac|nodeId).");
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

    const String localIp = WiFi.localIP().toString();
    const String mac = WiFi.macAddress();

    String legacyMsg = String("ESP32-VM online: ") + mac + " IP: " + localIp;
    int legacyBegin = udp.beginPacket("255.255.255.255", ANNOUNCE_PORT);
    size_t legacyWritten = udp.write((const uint8_t*)legacyMsg.c_str(), legacyMsg.length());
    int legacyEnd = udp.endPacket();

    JsonDocument announceDoc;
    announceDoc["kind"] = "machineAvailability";
    announceDoc["serviceName"] = "esp32-node";
    announceDoc["nodeId"] = nodeName;
    announceDoc["nodeName"] = nodeName;
    announceDoc["ip"] = localIp;
    announceDoc["mac"] = mac;
    announceDoc["status"] = "available";
    announceDoc["available"] = true;
    announceDoc["draining"] = false;
    announceDoc["port"] = 80;
    announceDoc["deviceRole"] = deviceRole;
    announceDoc["ts"] = millis();

    String jsonMsg;
    serializeJson(announceDoc, jsonMsg);
    int jsonBegin = udp.beginPacket("255.255.255.255", ANNOUNCE_PORT);
    size_t jsonWritten = udp.write((const uint8_t*)jsonMsg.c_str(), jsonMsg.length());
    int jsonEnd = udp.endPacket();

    Serial.print("[ANNOUNCE] legacy begin=");
    Serial.print(legacyBegin);
    Serial.print(" write=");
    Serial.print((unsigned int)legacyWritten);
    Serial.print(" end=");
    Serial.print(legacyEnd);
    Serial.print(" | json begin=");
    Serial.print(jsonBegin);
    Serial.print(" write=");
    Serial.print((unsigned int)jsonWritten);
    Serial.print(" end=");
    Serial.print(jsonEnd);
    Serial.print(" ip=");
    Serial.println(localIp);
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

    // 3. Ensure /devices, /services, and /flows directories exist at root at boot
    File root = LittleFS.open("/");
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

    initializeBonecrusherWorkerDefaults();
    loadBonecrusherWorkerConfig();
    if (bonecrusherConfig.workerId.length() == 0) {
        bonecrusherConfig.workerId = nodeName;
    }

    // 6. Set hostname, start UDP, and announce presence (must be after WiFi is up and nodeName is set)
    WiFi.setHostname(nodeName.c_str());
    setupOtaService();
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
#if defined(ESP32)
    startBonecrusherWorkerTaskIfNeeded();
#endif
}

void loop() {
    maintainConnectivity();

    if (otaEnabled) {
        ArduinoOTA.handle();
    }

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

    runSupervisorHealthChecks();
    // No need for server.handleClient() with AsyncWebServer
    // Add VM logic here
}

