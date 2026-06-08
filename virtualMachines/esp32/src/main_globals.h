#pragma once
#include <Arduino.h>
#include "ConfigSchema.h"
#include "NodeConfig.h"
#include "ffs/FederatedFileSystem.h"
#include <ESPAsyncWebServer.h>
#include "config_types.h"

extern String nodeName;
extern NodeConfig nodeConfig;
extern WifiConfig wifiConfig;
extern ClusterConfig clusterConfig;
extern FederatedFileSystem federatedFS;
extern bool ffsUp;
extern AsyncWebServer server;
// DevicePin support
#include "DevicePin.h"
extern DevicePin* devicePin;
extern int devicePinNumber;
// Add more externs as needed
