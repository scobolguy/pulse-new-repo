#pragma once
#include <Arduino.h>
#include <map>

struct DiscoveredNode {
    String mac;
    String ip;
    unsigned long lastSeen;
};

extern std::map<String, DiscoveredNode> discoveredNodeTable;
