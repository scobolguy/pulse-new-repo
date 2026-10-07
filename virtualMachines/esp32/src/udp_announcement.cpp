#include "udp_announcement.h"

#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif
#include <ArduinoJson.h>
#include "https_service.h"
#include "async_diagnostics.h"
#include <errno.h>
#if defined(ESP32)
#include <esp_heap_caps.h>
#endif

bool sendCheckedUdpPacket(WiFiUDP& udp, const IPAddress& destination, uint16_t port,
                          const String& payload, const char* label) {
    const uint32_t started = millis();
    const char* phase = "begin";
    errno = 0;
    bool ok = udp.beginPacket(destination, port);
    size_t written = 0;
    if (ok) {
        phase = "write";
        written = udp.write(reinterpret_cast<const uint8_t*>(payload.c_str()), payload.length());
        ok = written == payload.length();
        if (ok) {
            phase = "send";
            ok = udp.endPacket();
        }
    }
    const int socketError = errno;
#if defined(ESP32)
    const unsigned largest = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
#else
    const unsigned largest = 0;
#endif
    if (!ok) {
        Serial.printf("[UDP] %s failed phase=%s destination=%s:%u bytes=%u/%u errno=%d%s elapsed=%lu heap=%u largest=%u wifi=%d rssi=%d\n",
            label, phase, destination.toString().c_str(), port, static_cast<unsigned>(written),
            static_cast<unsigned>(payload.length()), socketError, socketError == ENOMEM ? " (ENOMEM)" : "",
            static_cast<unsigned long>(millis() - started), ESP.getFreeHeap(), largest,
            WiFi.status(), WiFi.RSSI());
    } else {
        PULSE_ASYNC_TRACE("UDP %s sent destination=%s:%u bytes=%u elapsed=%lu largest=%u",
            label, destination.toString().c_str(), port, static_cast<unsigned>(written),
            static_cast<unsigned long>(millis() - started), largest);
    }
    return ok;
}

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
#if defined(ENABLE_HTTPS) && (defined(ESP32) || defined(ESP8266))
    const bool httpsRunning = isHttpsRunning();
    announceDoc["protocol"] = httpsRunning ? "https" : "http";
    if (httpsRunning) {
        announceDoc["httpsPort"] = 443;
    }
#else
    announceDoc["protocol"] = "http";
#endif
    announceDoc["udpParentPort"] = parentPort;
    announceDoc["udpSiblingPort"] = siblingPort;
    announceDoc["flowDirection"] = "bottom-up";
    announceDoc["ts"] = millis();

    String jsonMsg;
    const size_t expected = measureJson(announceDoc);
    if (announceDoc.overflowed() || serializeJson(announceDoc, jsonMsg) != expected) {
        Serial.println("[UDP] nodeBeacon serialization failed");
        return false;
    }
    if (!sendCheckedUdpPacket(udp, IPAddress(255, 255, 255, 255), announcePort, jsonMsg, "nodeBeacon"))
        return false;

    state.nodeBeaconLastSentAt = millis();
    state.nodeBeaconLastCapabilityHash = capabilityHash;

    return true;
}
