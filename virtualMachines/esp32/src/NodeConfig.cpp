#include "NodeConfig.h"
#include <LittleFS.h>

#define NODE_CONFIG_PATH "/ffs/.NodeConfig.json"

bool loadNodeConfig(NodeConfig& config) {
    File f = LittleFS.open(NODE_CONFIG_PATH, "r");
    if (!f) return false;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    config.nodeName = doc["nodeName"] | "";
    config.wifiSsid = doc["wifiSsid"] | "";
    config.wifiPassword = doc["wifiPassword"] | "";
    config.activeClusterId = doc["activeClusterId"] | "default";
    config.siblingPort = static_cast<uint16_t>(doc["siblingPort"] | 4100);
    config.parentPort = static_cast<uint16_t>(doc["parentPort"] | 4000);
    config.parentHost = doc["parentHost"] | "";
    config.parentNodeId = doc["parentNodeId"] | "";
    config.isClusterGateway = doc["isClusterGateway"] | false;
    config.clusters.clear();
    if (doc["clusters"].is<JsonArray>()) {
        for (JsonObject c : doc["clusters"].as<JsonArray>()) {
            ClusterEntry entry;
            entry.clusterId = c["clusterId"] | "";
            entry.siblingPort = static_cast<uint16_t>(
                c["siblingPort"].is<uint16_t>() ? c["siblingPort"].as<uint16_t>() : (c["udpPort"] | config.siblingPort)
            );
            entry.parentPort = static_cast<uint16_t>(c["parentPort"] | config.parentPort);
            entry.parentHost = c["parentHost"] | config.parentHost;
            entry.parentNodeId = c["parentNodeId"] | config.parentNodeId;
            entry.isClusterGateway = c["isClusterGateway"] | config.isClusterGateway;
            config.clusters.push_back(entry);
        }
    }

    // If an active cluster is specified, apply its network ports as the effective defaults.
    for (const auto& entry : config.clusters) {
        if (entry.clusterId == config.activeClusterId) {
            config.siblingPort = entry.siblingPort;
            config.parentPort = entry.parentPort;
            if (entry.parentHost.length() > 0) {
                config.parentHost = entry.parentHost;
            }
            if (entry.parentNodeId.length() > 0) {
                config.parentNodeId = entry.parentNodeId;
            }
            config.isClusterGateway = entry.isClusterGateway;
            break;
        }
    }

    return true;
}

bool saveNodeConfig(const NodeConfig& config) {
    JsonDocument doc;
    doc["nodeName"] = config.nodeName;
    doc["wifiSsid"] = config.wifiSsid;
    doc["wifiPassword"] = config.wifiPassword;
    doc["activeClusterId"] = config.activeClusterId;
    doc["siblingPort"] = config.siblingPort;
    doc["parentPort"] = config.parentPort;
    doc["parentHost"] = config.parentHost;
    doc["parentNodeId"] = config.parentNodeId;
    doc["isClusterGateway"] = config.isClusterGateway;
    JsonArray arr = doc["clusters"].to<JsonArray>();
    for (const auto& entry : config.clusters) {
        JsonObject c = arr.add<JsonObject>();
        c["clusterId"] = entry.clusterId;
        c["siblingPort"] = entry.siblingPort;
        c["parentPort"] = entry.parentPort;
        c["parentHost"] = entry.parentHost;
        c["parentNodeId"] = entry.parentNodeId;
        c["isClusterGateway"] = entry.isClusterGateway;
        // Backward-compatible alias for older readers.
        c["udpPort"] = entry.siblingPort;
    }
    File f = LittleFS.open(NODE_CONFIG_PATH, "w");
    if (!f) return false;
    serializeJson(doc, f);
    f.close();
    return true;
}
