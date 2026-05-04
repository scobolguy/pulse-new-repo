#include "NodeConfig.h"
#include <LittleFS.h>

#define NODE_CONFIG_PATH "/ffs/.NodeConfig.json"

bool loadNodeConfig(NodeConfig& config) {
    File f = LittleFS.open(NODE_CONFIG_PATH, "r");
    if (!f) return false;
    DynamicJsonDocument doc(1024);
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    config.nodeName = doc["nodeName"] | "";
    config.clusters.clear();
    if (doc["clusters"].is<JsonArray>()) {
        for (JsonObject c : doc["clusters"].as<JsonArray>()) {
            ClusterEntry entry;
            entry.clusterId = c["clusterId"] | "";
            entry.udpPort = c["udpPort"] | 0;
            config.clusters.push_back(entry);
        }
    }
    return true;
}

bool saveNodeConfig(const NodeConfig& config) {
    DynamicJsonDocument doc(1024);
    doc["nodeName"] = config.nodeName;
    JsonArray arr = doc.createNestedArray("clusters");
    for (const auto& entry : config.clusters) {
        JsonObject c = arr.createNestedObject();
        c["clusterId"] = entry.clusterId;
        c["udpPort"] = entry.udpPort;
    }
    File f = LittleFS.open(NODE_CONFIG_PATH, "w");
    if (!f) return false;
    serializeJson(doc, f);
    f.close();
    return true;
}
