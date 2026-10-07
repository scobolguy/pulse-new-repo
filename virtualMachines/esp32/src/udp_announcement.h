#pragma once

#include <Arduino.h>
#include <WiFiUdp.h>

struct UdpAnnouncementState {
    bool nodeBeaconAcknowledged = false;
    unsigned long nodeBeaconLastSentAt = 0;
    String nodeBeaconLastCapabilityHash;
};

bool sendCheckedUdpPacket(WiFiUDP& udp, const IPAddress& destination, uint16_t port,
                          const String& payload, const char* label);

bool sendNodeBeaconAnnouncement(
    WiFiUDP& udp,
    uint16_t announcePort,
    const char* nodeName,
    const char* deviceRole,
    const char* firmwareBuildStamp,
    const String& capabilityHash,
    UdpAnnouncementState& state,
    uint16_t parentPort,
    uint16_t siblingPort);
