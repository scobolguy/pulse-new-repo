#include "udp_announcement.h"

#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif
#include <ArduinoJson.h>

bool sendNodeBeaconAnnouncement(
    WiFiUDP& udp,
    uint16_t announcePort,
    const char* nodeName,
    const char* deviceRole,
    const char* firmwareBuildStamp,
    const String& capabilityHash,
    UdpAnnouncementState& state,
    uint16_t parentPort,
    uint16_t siblingPort) {
    if (WiFi.status() != WL_CONNECTED) {
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
    announceDoc["firmwareBuildStamp"] = firmwareBuildStamp;
    announceDoc["httpPort"] = 80;
    announceDoc["udpParentPort"] = parentPort;
    announceDoc["udpSiblingPort"] = siblingPort;
    announceDoc["flowDirection"] = "bottom-up";
    announceDoc["ts"] = millis();

    String jsonMsg;
    serializeJson(announceDoc, jsonMsg);
    udp.beginPacket("255.255.255.255", announcePort);
    udp.write((const uint8_t*)jsonMsg.c_str(), jsonMsg.length());
    udp.endPacket();

    state.nodeBeaconLastSentAt = millis();
    state.nodeBeaconLastCapabilityHash = capabilityHash;

    return true;
}
