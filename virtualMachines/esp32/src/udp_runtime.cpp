#include "udp_runtime.h"

#include <ArduinoJson.h>
#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
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
constexpr size_t kMaxDiscoveredNodes = 32;

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

void upsertDiscoveredNode(std::map<String, DiscoveredNode>* table, const String& id, const String& ip) {
    if (table == nullptr || id.length() == 0 || ip.length() == 0) {
        return;
    }

    const unsigned long now = millis();
    auto existing = table->find(id);
    if (existing != table->end()) {
        existing->second.mac = id;
        existing->second.ip = ip;
        existing->second.lastSeen = now;
        return;
    }

    if (table->size() >= kMaxDiscoveredNodes) {
        auto oldest = table->begin();
        for (auto it = table->begin(); it != table->end(); ++it) {
            if (it->second.lastSeen < oldest->second.lastSeen) {
                oldest = it;
            }
        }
        if (oldest != table->end()) {
            table->erase(oldest);
        }
    }

    DiscoveredNode node;
    node.mac = id;
    node.ip = ip;
    node.lastSeen = now;
    (*table)[id] = node;
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
    socket.beginPacket(ip, port);
    socket.write((const uint8_t*)json.c_str(), json.length());
    socket.endPacket();
}

void processIncomingOnSocket(WiFiUDP& socket, const UdpRuntimeContext& context) {
    int packetSize = socket.parsePacket();
    if (packetSize <= 0) {
        return;
    }

    String msg;
    msg.reserve(packetSize + 1);
    while (socket.available()) {
        msg += static_cast<char>(socket.read());
    }

    if (msg.length() == 0) {
        return;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, msg);
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
            return;
        }

        if (kind.equalsIgnoreCase("nodeDetailsRequest")) {
            String requesterHash = doc["capabilityHash"].as<String>();
            const bool capabilityChanged = requesterHash.length() > 0
                && !requesterHash.equalsIgnoreCase(nodeBeaconLastCapabilityHash);
            sendNodeDetailsResponse(socket, context, socket.remoteIP(), socket.remotePort(), context.computeNodeCapabilityHash(), capabilityChanged);
            return;
        }

        if (kind.equalsIgnoreCase("nodeBeacon") || kind.equalsIgnoreCase("machineAvailability")) {
            String senderNodeId = doc["nodeId"].as<String>();
            if (senderNodeId.length() == 0) {
                senderNodeId = doc["nodeName"].as<String>();
            }
            const String senderIp = doc["ip"].as<String>().length() > 0 ? doc["ip"].as<String>() : socket.remoteIP().toString();
            const bool senderFeatureChanged = doc["capabilitiesChanged"].as<bool>() || doc["featureChanged"].as<bool>() || doc["needsDetails"].as<bool>();

            if (senderNodeId.length() > 0 && senderNodeId.equalsIgnoreCase(context.nodeName)) {
                return;
            }

            if (context.discoveredNodeTable && senderNodeId.length() > 0 && senderIp.length() > 0) {
                upsertDiscoveredNode(context.discoveredNodeTable, senderNodeId, senderIp);
            }

            JsonDocument ackDoc;
            ackDoc["kind"] = "nodeBeaconAck";
            ackDoc["nodeId"] = context.nodeName;
            ackDoc["nodeName"] = context.nodeName;
            ackDoc["capabilityHash"] = context.computeNodeCapabilityHash();
            ackDoc["requestDetails"] = true;
            ackDoc["ts"] = millis();
            String ackJson;
            serializeJson(ackDoc, ackJson);
            socket.beginPacket(socket.remoteIP(), socket.remotePort());
            socket.write((const uint8_t*)ackJson.c_str(), ackJson.length());
            socket.endPacket();

            JsonDocument detailReqDoc;
            detailReqDoc["kind"] = "nodeDetailsRequest";
            detailReqDoc["nodeId"] = context.nodeName;
            detailReqDoc["capabilityHash"] = context.computeNodeCapabilityHash();
            detailReqDoc["requestReason"] = senderFeatureChanged ? "feature-changed" : "discovery";
            detailReqDoc["ts"] = millis();
            String detailReqJson;
            serializeJson(detailReqDoc, detailReqJson);
            socket.beginPacket(socket.remoteIP(), socket.remotePort());
            socket.write((const uint8_t*)detailReqJson.c_str(), detailReqJson.length());
            socket.endPacket();

            sendNodeDetailsResponse(socket, context, socket.remoteIP(), socket.remotePort(), context.computeNodeCapabilityHash(), senderFeatureChanged);
            return;
        }
    }

    String parsedId;
    String parsedIp;
    String parsedNodeId;

    int macStart = msg.indexOf(": ");
    int ipStart = msg.indexOf("IP: ");
    if (macStart != -1 && ipStart != -1) {
        parsedId = msg.substring(macStart + 2, ipStart - 1);
        parsedIp = msg.substring(ipStart + 4);
        parsedId.trim();
        parsedIp.trim();
    }

    if (parsedIp.length() == 0 && msg.startsWith("{")) {
        DeserializationError jsonErr = deserializeJson(doc, msg);
        if (!jsonErr) {
            String ipValue = doc["ip"].as<String>();
            String macValue = doc["mac"].as<String>();
            String nodeIdValue = doc["nodeId"].as<String>();
            if (nodeIdValue.length() == 0) {
                nodeIdValue = doc["nodeName"].as<String>();
            }

            if (ipValue.length() > 0) {
                parsedIp = ipValue;
            }
            if (nodeIdValue.length() > 0) {
                parsedNodeId = nodeIdValue;
            }
            if (macValue.length() > 0) {
                parsedId = macValue;
            } else if (parsedNodeId.length() > 0) {
                parsedId = String("node:") + parsedNodeId;
            }
            parsedIp.trim();
            parsedId.trim();
            parsedNodeId.trim();
        }
    }

    if (parsedId.length() > 0 && parsedIp.length() > 0 && context.nodeName && context.discoveredNodeTable) {
        String myMac = WiFi.macAddress();
        myMac.trim();
        String myIp = WiFi.localIP().toString();
        myIp.trim();

        if (parsedId.equalsIgnoreCase(myMac)
            || parsedIp.equals(myIp)
            || (parsedNodeId.length() > 0 && parsedNodeId.equalsIgnoreCase(context.nodeName))) {
            return;
        }

        upsertDiscoveredNode(context.discoveredNodeTable, parsedId, parsedIp);
    }
}
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
        if (!udpParentReady || (siblingPort > 0 && siblingPort != parentPort && !udpSiblingReady)) {
            udpRuntimeEnsureReady(parentPort, siblingPort);
        }
        return;
    }

    udpParentReady = false;
    udpSiblingReady = false;

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
