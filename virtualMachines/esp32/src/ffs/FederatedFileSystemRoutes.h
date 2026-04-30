#include "../NodeDiscovery.h"
#pragma once
#include <ESPAsyncWebServer.h>
#include "FederatedFileSystem.h"

void registerFFSRoutes(AsyncWebServer& server, FederatedFileSystem& federatedFS);
