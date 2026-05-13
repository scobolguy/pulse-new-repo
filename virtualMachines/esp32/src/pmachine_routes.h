#pragma once
#include <ESPAsyncWebServer.h>
#include "pmachine.h"
#include "ffs/FederatedFileSystem.h"

void registerPMachineRoutes(AsyncWebServer& server, pmachine::PMachine& pm, FederatedFileSystem* ffs = nullptr);
