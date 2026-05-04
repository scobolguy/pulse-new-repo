#pragma once
#include <Arduino.h>
#include <vector>
#include <ArduinoJson.h>

struct ClusterEntry {
    String clusterId;
    int udpPort;
};

struct NodeConfig {
    String nodeName;
    std::vector<ClusterEntry> clusters;
};

// Loads NodeConfig from /ffs/.NodeConfig.json
bool loadNodeConfig(NodeConfig& config);
// Saves NodeConfig to /ffs/.NodeConfig.json
bool saveNodeConfig(const NodeConfig& config);
