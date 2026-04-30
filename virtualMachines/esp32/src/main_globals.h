#pragma once
#include <Arduino.h>
#include "ConfigSchema.h"
#include "ffs/FederatedFileSystem.h"
#include <ESPAsyncWebServer.h>

extern String nodeName;
extern WifiConfig wifiConfig;
extern ClusterConfig clusterConfig;
extern FederatedFileSystem federatedFS;
extern bool ffsUp;
extern AsyncWebServer server;
// Add more externs as needed
