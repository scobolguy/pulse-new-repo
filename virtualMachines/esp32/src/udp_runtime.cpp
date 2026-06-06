#include "udp_runtime.h"

#include <ArduinoJson.h>
#include <WiFi.h>

namespace {
WiFiUDP udpSocket;
bool udpReady = false;
unsigned long lastWifiReconnectAttempt = 0;
String wifiSsid;
String wifiPassword;
bool nodeBeaconAcknowledged = false;
unsigned long nodeBeaconLastSentAt = 0;
unsigned long nodeBeaconLastAckAt = 0;
String nodeBeaconLastCapabilityHash;

void sendNodeDetailsResponse(const UdpRuntimeContext& context, IPAddress ip, uint16_t port, const String& capabilityHash, bool capabilityChanged) {
    if (ip == IPAddress(0, 0, 0, 0) || port == 0) {
        return;
    }

    if (!context.nodeName || !context.deviceRole || !context.firmwareVersion || !context.firmwareTrack) {
        return;
    }
    JsonDocument doc;
    doc["kind"] = "nodeDetails";
    doc["nodeId"] = context.nodeName;
    doc["nodeName"] = context.nodeName;
    doc["ip"] = WiFi.localIP().toString();
    doc["httpPort"] = 80;
    doc["statusUrl"] = String("http://") + WiFi.localIP().toString() + ":80/status";
    doc["servicesUrl"] = String("http://") + WiFi.localIP().toString() + ":80/services/describe";
    doc["capabilityHash"] = capabilityHash;
    doc["capabilitiesChanged"] = capabilityChanged;
    doc["acknowledged"] = nodeBeaconAcknowledged;
    doc["nodeRole"] = context.deviceRole;
    doc["firmwareVersion"] = context.firmwareVersion;
    doc["firmwareTrack"] = context.firmwareTrack;

    String json;
    serializeJson(doc, json);
    udpSocket.beginPacket(ip, port);
    udpSocket.write((const uint8_t*)json.c_str(), json.length());
    udpSocket.endPacket();
}
}

void udpRuntimeConfigureWifiCredentials(const String& ssid, const String& password) {
    wifiSsid = ssid;
    wifiPassword = password;
}

bool udpRuntimeEnsureReady(uint16_t announcePort) {
    if (udpReady) {
        return true;
    }
    udpReady = udpSocket.begin(announcePort);
    if (udpReady) {
        Serial.print("[UDP] Listening on port ");
        Serial.println(announcePort);
    } else {
        Serial.println("[UDP] Failed to bind announce port");
    }
    return udpReady;
}

void udpRuntimeMaintainConnectivity(uint16_t announcePort, unsigned long wifiReconnectIntervalMs) {
    const wl_status_t status = WiFi.status();
    if (status == WL_CONNECTED) {
        if (!udpReady) {
            Serial.println("[WIFI] Connected, restoring UDP listener");
            udpRuntimeEnsureReady(announcePort);
        }
        return;
    }

    udpReady = false;

    const unsigned long now = millis();
    if (now - lastWifiReconnectAttempt < wifiReconnectIntervalMs) {
        return;
    }

    lastWifiReconnectAttempt = now;
    Serial.print("[WIFI] Disconnected (status=");
    Serial.print((int)status);
    Serial.println(") attempting reconnect...");
    WiFi.disconnect();
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
}

void udpRuntimeProcessIncoming(const UdpRuntimeContext& context, uint16_t announcePort) {
    (void)announcePort;
    int packetSize = udpSocket.parsePacket();
    if (packetSize <= 0) {
        return;
    }

    String msg;
    msg.reserve(packetSize + 1);
    while (udpSocket.available()) {
        msg += static_cast<char>(udpSocket.read());
    }

    if (msg.length() == 0) {
        return;
    }

    Serial.print("Received UDP announcement: ");
    Serial.println(msg);

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, msg);
    if (!err && context.nodeName && context.computeNodeCapabilityHash) {
        const String kind = doc["kind"].as<String>();

        if (kind.equalsIgnoreCase("nodeBeaconAck")) {
            nodeBeaconAcknowledged = true;
            nodeBeaconLastAckAt = millis();
            nodeBeaconLastSentAt = millis();
            Serial.println("[UDP] Beacon acknowledged by aggregator");
            return;
        }

        if (kind.equalsIgnoreCase("nodeDetailsRequest")) {
            String requesterHash = doc["capabilityHash"].as<String>();
            const bool capabilityChanged = requesterHash.length() > 0
                && !requesterHash.equalsIgnoreCase(nodeBeaconLastCapabilityHash);
            sendNodeDetailsResponse(context, udpSocket.remoteIP(), udpSocket.remotePort(), context.computeNodeCapabilityHash(), capabilityChanged);
            return;
        }

        if (kind.equalsIgnoreCase("nodeBeacon") || kind.equalsIgnoreCase("machineAvailability")) {
            String senderNodeId = doc["nodeId"].as<String>();
            if (senderNodeId.length() == 0) {
                senderNodeId = doc["nodeName"].as<String>();
            }
            const String senderIp = doc["ip"].as<String>().length() > 0 ? doc["ip"].as<String>() : udpSocket.remoteIP().toString();
            const bool senderFeatureChanged = doc["capabilitiesChanged"].as<bool>() || doc["featureChanged"].as<bool>() || doc["needsDetails"].as<bool>();

            if (senderNodeId.length() > 0 && senderNodeId.equalsIgnoreCase(context.nodeName)) {
                return;
            }

            if (context.discoveredNodeTable && senderNodeId.length() > 0 && senderIp.length() > 0) {
                DiscoveredNode node;
                node.mac = senderNodeId;
                node.ip = senderIp;
                node.lastSeen = millis();
                (*context.discoveredNodeTable)[senderNodeId] = node;
                Serial.println("Node added to discoveredNodeTable.");
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
            udpSocket.beginPacket(udpSocket.remoteIP(), udpSocket.remotePort());
            udpSocket.write((const uint8_t*)ackJson.c_str(), ackJson.length());
            udpSocket.endPacket();

            JsonDocument detailReqDoc;
            detailReqDoc["kind"] = "nodeDetailsRequest";
            detailReqDoc["nodeId"] = context.nodeName;
            detailReqDoc["capabilityHash"] = context.computeNodeCapabilityHash();
            detailReqDoc["requestReason"] = senderFeatureChanged ? "feature-changed" : "discovery";
            detailReqDoc["ts"] = millis();
            String detailReqJson;
            serializeJson(detailReqDoc, detailReqJson);
            udpSocket.beginPacket(udpSocket.remoteIP(), udpSocket.remotePort());
            udpSocket.write((const uint8_t*)detailReqJson.c_str(), detailReqJson.length());
            udpSocket.endPacket();

            sendNodeDetailsResponse(context, udpSocket.remoteIP(), udpSocket.remotePort(), context.computeNodeCapabilityHash(), senderFeatureChanged);
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
            Serial.println("Announcement from self, not adding.");
        } else {
            DiscoveredNode node;
            node.mac = parsedId;
            node.ip = parsedIp;
            node.lastSeen = millis();
            (*context.discoveredNodeTable)[parsedId] = node;
            Serial.println("Node added to discoveredNodeTable.");
        }
    } else {
        Serial.println("Failed to parse announcement: expected legacy MAC/IP text or JSON with ip + (mac|nodeId).");
    }
}

WiFiUDP& udpRuntimeSocket() {
    return udpSocket;
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
