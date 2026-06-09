#pragma once
#include <Arduino.h>
#include <vector>
#include <ArduinoJson.h>

struct ClusterEntry {
    String clusterId;
    uint16_t siblingPort = 4100;
    uint16_t parentPort = 4000;
    String parentHost;
    String parentNodeId;
    bool isClusterGateway = false;
};

struct NodeConfig {
    String nodeName;
    String wifiSsid;
    String wifiPassword;
    String activeClusterId = "default";
    uint16_t siblingPort = 4100;
    uint16_t parentPort = 4000;
    String parentHost;
    String parentNodeId;
    bool isClusterGateway = false;
    std::vector<ClusterEntry> clusters;
};

// Loads NodeConfig from /ffs/.NodeConfig.json
bool loadNodeConfig(NodeConfig& config);
// Saves NodeConfig to /ffs/.NodeConfig.json
bool saveNodeConfig(const NodeConfig& config);
