#pragma once

#include <Arduino.h>
#include <WiFiUdp.h>

struct UdpAnnouncementState {
    bool nodeBeaconAcknowledged = false;
    unsigned long nodeBeaconLastSentAt = 0;
    String nodeBeaconLastCapabilityHash;
};

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
