#pragma once

#include <FS.h>
#include <ESPAsyncWebServer.h>
#include <stdint.h>

namespace pulse {
namespace ota {

struct Status {
    bool enabled;
    bool bootFilesystemMounted;
    bool pendingTrial;
    bool firmwareRollbackConfigured;
    bool firmwareUpdatesEnabled;
    uint8_t activeBootSlot;
    uint8_t pendingBootSlot;
    uint8_t activeFirmwareSlot;
    uint8_t pendingFirmwareSlot;
    const char* error;
};

bool begin();
fs::FS& bootFileSystem();
// False with lastError() == "OTA transaction is busy; retry" is retryable.
bool confirmBoot();
bool rejectBoot(const char* reason);
void registerRoutes(AsyncWebServer& server);
bool enabled();
Status status();
const char* lastError();

}  // namespace ota
}  // namespace pulse
