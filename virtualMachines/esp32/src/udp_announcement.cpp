#include "udp_announcement.h"

#include <WiFi.h>
#include <ArduinoJson.h>

bool sendNodeBeaconAnnouncement(
    WiFiUDP& udp,
    uint16_t announcePort,
    const char* nodeName,
    const char* deviceRole,
    const String& capabilityHash,
    UdpAnnouncementState& state) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[ANNOUNCE] Skipped: WiFi not connected");
        return false;
    }

    const String localIp = WiFi.localIP().toString();
    const bool capabilityChanged = state.nodeBeaconLastCapabilityHash.length() > 0
        && !capabilityHash.equals(state.nodeBeaconLastCapabilityHash);

    JsonDocument announceDoc;
    announceDoc["kind"] = "nodeBeacon";
    announceDoc["nodeId"] = nodeName;
    announceDoc["nodeName"] = nodeName;
    announceDoc["capabilityHash"] = capabilityHash;
    announceDoc["capabilitiesChanged"] = capabilityChanged;
    announceDoc["needsDetails"] = !state.nodeBeaconAcknowledged || capabilityChanged;
    announceDoc["beaconState"] = state.nodeBeaconAcknowledged ? "steady" : "rapid";
    announceDoc["ip"] = localIp;
    announceDoc["status"] = "here";
    announceDoc["deviceRole"] = deviceRole;
    announceDoc["httpPort"] = 80;
    announceDoc["ts"] = millis();

    String jsonMsg;
    serializeJson(announceDoc, jsonMsg);
    int jsonBegin = udp.beginPacket("255.255.255.255", announcePort);
    size_t jsonWritten = udp.write((const uint8_t*)jsonMsg.c_str(), jsonMsg.length());
    int jsonEnd = udp.endPacket();

    state.nodeBeaconLastSentAt = millis();
    state.nodeBeaconLastCapabilityHash = capabilityHash;

    Serial.print("[BEACON] begin=");
    Serial.print(jsonBegin);
    Serial.print(" write=");
    Serial.print((unsigned int)jsonWritten);
    Serial.print(" end=");
    Serial.print(jsonEnd);
    Serial.print(" acked=");
    Serial.print(state.nodeBeaconAcknowledged ? "true" : "false");
    Serial.print(" featureChanged=");
    Serial.print(capabilityChanged ? "true" : "false");
    Serial.print(" ip=");
    Serial.println(localIp);

    return true;
}
