#pragma once

#include <Arduino.h>
#include <WiFiUdp.h>
#include <map>

#include "NodeDiscovery.h"
#include "udp_announcement.h"

struct UdpRuntimeContext {
    const char* nodeName = nullptr;
    const char* deviceRole = nullptr;
    const char* firmwareVersion = nullptr;
    const char* firmwareTrack = nullptr;

    std::map<String, DiscoveredNode>* discoveredNodeTable = nullptr;
    String (*computeNodeCapabilityHash)() = nullptr;
    void (*onAlertMessage)(const String& payload, IPAddress sourceIp, uint16_t sourcePort) = nullptr;
};

void udpRuntimeConfigureWifiCredentials(const String& ssid, const String& password);
bool udpRuntimeEnsureReady(uint16_t parentPort, uint16_t siblingPort);
void udpRuntimeMaintainConnectivity(uint16_t parentPort, uint16_t siblingPort, unsigned long wifiReconnectIntervalMs);
void udpRuntimeProcessIncoming(const UdpRuntimeContext& context, uint16_t parentPort, uint16_t siblingPort);
WiFiUDP& udpRuntimeSocket();
uint16_t udpRuntimeGetBoundParentPort();
uint16_t udpRuntimeGetBoundSiblingPort();

void udpRuntimeResetBeaconState();
unsigned long udpRuntimeGetBeaconIntervalMs(unsigned long ackedIntervalMs, unsigned long unackedIntervalMs);
bool udpRuntimeIsBeaconAcknowledged();
unsigned long udpRuntimeGetBeaconLastSentAt();
unsigned long udpRuntimeGetBeaconLastAckAt();
const String& udpRuntimeGetBeaconCapabilityHash();
UdpAnnouncementState udpRuntimeGetAnnouncementState();
void udpRuntimeApplyAnnouncementState(const UdpAnnouncementState& state);
