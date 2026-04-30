#pragma once
#include <Arduino.h>
#include "ConfigSchema.h"
#include "ClusterConfig.h"
#include "ffs/FederatedFileSystem.h"
#include <ESPAsyncWebServer.h>
#define NODE_NAME_PATH "/config/node_name.txt"
#define WIFI_CONFIG_PATH "/config/WiFi.txt"
extern String nodeName;
extern WifiConfig wifiConfig;
extern WifiConfig wifiConfig;
extern ClusterConfig clusterConfig;
extern FederatedFileSystem federatedFS;
extern bool ffsUp;
extern AsyncWebServer server;
// Add more externs as needed
