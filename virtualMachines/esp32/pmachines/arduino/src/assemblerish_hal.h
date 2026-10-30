#pragma once

#if defined(ESP32)
#include <ArduinoJson.h>
#include "pmachine.h"
#include "service_host.h"

namespace pmachine {

bool installAssemblerish(const std::string& pcode, JsonObjectConst configuration,
                        JsonArrayConst allowedPins, ServiceHost& handlers, std::string& error);
bool stopAssemblerish(std::string& error);
void assemblerishStatus(JsonObject status);

}
#endif
