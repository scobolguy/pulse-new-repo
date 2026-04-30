#pragma once
#include <ESPAsyncWebServer.h>
#include "pmachine.h"

void registerPMachineRoutes(AsyncWebServer& server, pmachine::PMachine& pm);
