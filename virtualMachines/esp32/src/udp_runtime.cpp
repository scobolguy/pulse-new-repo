#include "udp_runtime.h"
#include "udp_announcement.h"
#include "udp_ingress_policy.h"

#include <ArduinoJson.h>
#include <atomic>
#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#include <esp_heap_caps.h>
#endif
#if defined(ENABLE_HTTPS) && (defined(ESP32) || defined(ESP8266))
#include "https_service.h"
#endif

namespace {
WiFiUDP udpParentSocket;
WiFiUDP udpSiblingSocket;
bool udpParentReady = false;
bool udpSiblingReady = false;
uint16_t udpBoundParentPort = 0;
uint16_t udpBoundSiblingPort = 0;
unsigned long lastWifiReconnectAttempt = 0;
String wifiSsid;
String wifiPassword;
bool nodeBeaconAcknowledged = false;
unsigned long nodeBeaconLastSentAt = 0;
unsigned long nodeBeaconLastAckAt = 0;
String nodeBeaconLastCapabilityHash;
constexpr uint32_t kBeaconWarmupMs = 5000;
bool beaconWarmupArmed = false;
bool beaconWarmupComplete = false;
uint32_t beaconWarmupStartedAt = 0;
char incomingPacket[udp_ingress::kMaxPacketBytes + 1];
std::atomic<uint32_t> incomingReceived{0};
std::atomic<uint32_t> droppedOversized{0};
std::atomic<uint32_t> droppedLowMemory{0};
std::atomic<uint32_t> droppedIncomplete{0};
std::atomic<uint32_t> droppedAllocation{0};
uint32_t lastDropLogAt = 0;
bool dropLogged = false;

void logIncomingDrop(const char* reason, int packetSize) {
    const uint32_t now = millis();
    if (dropLogged && static_cast<uint32_t>(now - lastDropLogAt) < 5000) return;
    dropLogged = true;
    lastDropLogAt = now;
    Serial.printf("[UDP] Incoming drop reason=%s bytes=%d oversized=%lu lowMemory=%lu incomplete=%lu allocation=%lu heap=%lu\n",
        reason, packetSize,
        static_cast<unsigned long>(droppedOversized.load()),
        static_cast<unsigned long>(droppedLowMemory.load()),
        static_cast<unsigned long>(droppedIncomplete.load()),
        static_cast<unsigned long>(droppedAllocation.load()),
        static_cast<unsigned long>(ESP.getFreeHeap()));
}

bool bindUdpSocket(WiFiUDP& socket, bool& ready, uint16_t& boundPort, uint16_t nextPort, const char* label) {
    if (nextPort == 0) {
        return false;
    }

    if (ready && boundPort == nextPort) {
        return true;
    }

    if (ready && boundPort != nextPort) {
        socket.stop();
        ready = false;
        boundPort = 0;
    }

    ready = socket.begin(nextPort);
    if (!ready) {
        Serial.print("[UDP] Failed to bind ");
        Serial.print(label);
        Serial.print(" port ");
        Serial.println(nextPort);
        return false;
    }

    boundPort = nextPort;
    return true;
}

void sendNodeDetailsResponse(WiFiUDP& socket, const UdpRuntimeContext& context, IPAddress ip, uint16_t port, const String& capabilityHash, bool capabilityChanged) {
    if (ip == IPAddress(0, 0, 0, 0) || port == 0) {
        return;
    }

    if (!context.nodeName || !context.deviceRole || !context.firmwareVersion || !context.firmwareBuildStamp || !context.firmwareTrack) {
        return;
    }
    JsonDocument doc;
    doc["kind"] = "nodeDetails";
    doc["nodeId"] = context.nodeName;
    doc["nodeName"] = context.nodeName;
    doc["ip"] = WiFi.localIP().toString();
    doc["httpPort"] = 80;
#if defined(ENABLE_HTTPS) && (defined(ESP32) || defined(ESP8266))
    const bool httpsRunning = isHttpsRunning();
    const String protocol = httpsRunning ? "https" : "http";
    const uint16_t servicePort = httpsRunning ? 443 : 80;
    doc["protocol"] = protocol;
    if (httpsRunning) {
        doc["httpsPort"] = servicePort;
    }
#else
    const String protocol = "http";
    const uint16_t servicePort = 80;
    doc["protocol"] = protocol;
#endif
    const String serviceBaseUrl = protocol + "://" + WiFi.localIP().toString() + ":" + String(servicePort);
    doc["statusUrl"] = serviceBaseUrl + "/status";
    doc["servicesUrl"] = serviceBaseUrl + "/services/describe";
    doc["capabilityHash"] = capabilityHash;
    doc["capabilitiesChanged"] = capabilityChanged;
    doc["acknowledged"] = nodeBeaconAcknowledged;
    doc["nodeRole"] = context.deviceRole;
    doc["firmwareVersion"] = context.firmwareVersion;
    doc["firmwareBuildStamp"] = context.firmwareBuildStamp;
    doc["firmwareTrack"] = context.firmwareTrack;

    String json;
    serializeJson(doc, json);
    sendCheckedUdpPacket(socket, ip, port, json, "nodeDetails");
}

void processIncomingOnSocket(WiFiUDP& socket, const UdpRuntimeContext& context) {
    int packetSize = socket.parsePacket();
    if (packetSize <= 0) {
        return;
    }

    ++incomingReceived;
#if defined(ARDUINO_ARCH_ESP8266)
    const uint32_t largestBlock = ESP.getMaxFreeBlockSize();
#else
    const uint32_t largestBlock = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
#endif
    const auto decision = udp_ingress::decide(packetSize, ESP.getFreeHeap(), largestBlock);
    if (decision != udp_ingress::Decision::accept) {
        socket.flush();
        if (decision == udp_ingress::Decision::oversized) {
            ++droppedOversized;
            logIncomingDrop("oversized", packetSize);
        } else {
            ++droppedLowMemory;
            logIncomingDrop("low-memory", packetSize);
        }
        return;
    }
    const int bytesRead = socket.read(reinterpret_cast<uint8_t*>(incomingPacket), packetSize);
    if (bytesRead != packetSize) {
        socket.flush();
        ++droppedIncomplete;
        logIncomingDrop("incomplete", packetSize);
        return;
    }
    incomingPacket[packetSize] = '\0';
    const String msg(incomingPacket, static_cast<unsigned int>(packetSize));
    if (msg.length() != static_cast<size_t>(packetSize)) {
        ++droppedAllocation;
        logIncomingDrop("allocation", packetSize);
        return;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, msg);
    if (err == DeserializationError::NoMemory) {
        ++droppedAllocation;
        logIncomingDrop("json-allocation", packetSize);
        return;
    }
    if (!err && context.nodeName && context.computeNodeCapabilityHash) {
        const String kind = doc["kind"].as<String>();

        if (kind.equalsIgnoreCase("doorbellAlert")
            || kind.equalsIgnoreCase("cameraAlert")
            || kind.equalsIgnoreCase("personAlert")) {
            if (context.onAlertMessage) {
                context.onAlertMessage(msg, socket.remoteIP(), socket.remotePort());
            }
            return;
        }

        if (kind.equalsIgnoreCase("nodeBeaconAck")) {
            nodeBeaconAcknowledged = true;
            nodeBeaconLastAckAt = millis();
            nodeBeaconLastSentAt = millis();
            const int32_t httpPort = doc["httpPort"] | 0;
            if (context.onAggregatorAck && doc["nodeId"].is<const char*>() && httpPort > 0 && httpPort <= 65535) {
                context.onAggregatorAck(doc["nodeId"].as<const char*>(), socket.remoteIP(),
                                        static_cast<uint16_t>(httpPort));
            }
            return;
        }

        if (kind.equalsIgnoreCase("nodeDetailsRequest")) {
            String requesterHash = doc["capabilityHash"].as<String>();
            const bool capabilityChanged = requesterHash.length() > 0
                && !requesterHash.equalsIgnoreCase(nodeBeaconLastCapabilityHash);
            sendNodeDetailsResponse(socket, context, socket.remoteIP(), socket.remotePort(), context.computeNodeCapabilityHash(), capabilityChanged);
            return;
        }

        // Sibling tracking is the aggregators' job; other nodes' beacons are ignored.
    }
}
}

UdpIngressStats udpRuntimeGetIngressStats() {
    UdpIngressStats stats;
    stats.received = incomingReceived.load();
    stats.droppedOversized = droppedOversized.load();
    stats.droppedLowMemory = droppedLowMemory.load();
    stats.droppedIncomplete = droppedIncomplete.load();
    stats.droppedAllocation = droppedAllocation.load();
    return stats;
}

void udpRuntimeConfigureWifiCredentials(const String& ssid, const String& password) {
    wifiSsid = ssid;
    wifiPassword = password;
}

bool udpRuntimeEnsureReady(uint16_t parentPort, uint16_t siblingPort) {
    const bool parentOk = bindUdpSocket(udpParentSocket, udpParentReady, udpBoundParentPort, parentPort, "parent");
    bool siblingOk = true;

    if (siblingPort > 0 && siblingPort != parentPort) {
        siblingOk = bindUdpSocket(udpSiblingSocket, udpSiblingReady, udpBoundSiblingPort, siblingPort, "sibling");
    } else {
        if (udpSiblingReady) {
            udpSiblingSocket.stop();
            udpSiblingReady = false;
            udpBoundSiblingPort = 0;
        }
    }

    return parentOk && siblingOk;
}

void udpRuntimeMaintainConnectivity(uint16_t parentPort, uint16_t siblingPort, unsigned long wifiReconnectIntervalMs) {
    const wl_status_t status = WiFi.status();
    if (status == WL_CONNECTED) {
        if (!beaconWarmupArmed) udpRuntimeDeferBeacons();
        if (!udpParentReady || (siblingPort > 0 && siblingPort != parentPort && !udpSiblingReady)) {
            udpRuntimeEnsureReady(parentPort, siblingPort);
        }
        return;
    }

    udpParentReady = false;
    udpSiblingReady = false;
    beaconWarmupArmed = false;
    beaconWarmupComplete = false;

    if (wifiSsid.isEmpty()) {
        return;
    }

    const unsigned long now = millis();
    if (now - lastWifiReconnectAttempt < wifiReconnectIntervalMs) {
        return;
    }

    lastWifiReconnectAttempt = now;
    WiFi.disconnect();
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
}

void udpRuntimeProcessIncoming(const UdpRuntimeContext& context, uint16_t parentPort, uint16_t siblingPort) {
    (void)parentPort;
    (void)siblingPort;
    processIncomingOnSocket(udpParentSocket, context);
    if (udpSiblingReady && udpBoundSiblingPort != udpBoundParentPort) {
        processIncomingOnSocket(udpSiblingSocket, context);
    }
}

WiFiUDP& udpRuntimeSocket() {
    return udpParentSocket;
}

uint16_t udpRuntimeGetBoundParentPort() {
    return udpBoundParentPort;
}

uint16_t udpRuntimeGetBoundSiblingPort() {
    return udpBoundSiblingPort;
}

void udpRuntimeResetBeaconState() {
    nodeBeaconAcknowledged = false;
    nodeBeaconLastSentAt = 0;
    nodeBeaconLastAckAt = 0;
}

void udpRuntimeDeferBeacons() {
    beaconWarmupStartedAt = millis();
    beaconWarmupArmed = true;
    beaconWarmupComplete = false;
    Serial.printf("[UDP] Discovery beacon warm-up started at %lu; deferring sends for %lu ms\n",
        static_cast<unsigned long>(beaconWarmupStartedAt), static_cast<unsigned long>(kBeaconWarmupMs));
}

bool udpRuntimeCanSendBeacon() {
    if (WiFi.status() != WL_CONNECTED || !beaconWarmupArmed) return false;
    if (!beaconWarmupComplete) {
        if (static_cast<uint32_t>(millis() - beaconWarmupStartedAt) < kBeaconWarmupMs) return false;
        beaconWarmupComplete = true;
        Serial.printf("[UDP] Discovery beacon warm-up complete after %lu ms\n",
            static_cast<unsigned long>(static_cast<uint32_t>(millis() - beaconWarmupStartedAt)));
    }
    return true;
}

unsigned long udpRuntimeGetBeaconIntervalMs(unsigned long ackedIntervalMs, unsigned long unackedIntervalMs) {
    return nodeBeaconAcknowledged ? ackedIntervalMs : unackedIntervalMs;
}

bool udpRuntimeIsBeaconAcknowledged() {
    return nodeBeaconAcknowledged;
}

unsigned long udpRuntimeGetBeaconLastSentAt() {
    return nodeBeaconLastSentAt;
}

unsigned long udpRuntimeGetBeaconLastAckAt() {
    return nodeBeaconLastAckAt;
}

const String& udpRuntimeGetBeaconCapabilityHash() {
    return nodeBeaconLastCapabilityHash;
}

UdpAnnouncementState udpRuntimeGetAnnouncementState() {
    UdpAnnouncementState state;
    state.nodeBeaconAcknowledged = nodeBeaconAcknowledged;
    state.nodeBeaconLastSentAt = nodeBeaconLastSentAt;
    state.nodeBeaconLastCapabilityHash = nodeBeaconLastCapabilityHash;
    return state;
}

void udpRuntimeApplyAnnouncementState(const UdpAnnouncementState& state) {
    nodeBeaconAcknowledged = state.nodeBeaconAcknowledged;
    nodeBeaconLastSentAt = state.nodeBeaconLastSentAt;
    nodeBeaconLastCapabilityHash = state.nodeBeaconLastCapabilityHash;
}
