#pragma once
#include <Arduino.h>
#include "ConfigSchema.h"

// Config file paths
#define CONFIG_PATH "/config.json"
#define WIFI_CONFIG_PATH "/wifi.json"
#define NODE_NAME_PATH "/node_name.txt"

// ClusterConfig definition
struct ClusterConfig {
    String clusterId = "default";
    bool isGateway = false;
    static const FieldDescriptor schema[2];
    static constexpr size_t schemaSize = 2;
};

// WifiConfig definition
struct WifiConfig {
    String ssid = "";
    String password = "";
    static const FieldDescriptor schema[2];
    static constexpr size_t schemaSize = 2;
};

// FieldDescriptor arrays (declarations only)
extern const FieldDescriptor ClusterConfig_schema[2];
extern const FieldDescriptor WifiConfig_schema[2];
