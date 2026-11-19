#pragma once

#if defined(ENABLE_PMACHINE)
#include <FS.h>
#include "pmachine.h"
#include "wifi_provisioning.h"
#include <array>
#if defined(ESP32)
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#endif
#include <string>
#include <utility>
#include <vector>

namespace pulse { namespace boot {

struct Hardware {
    bool (*apStart)();
    bool (*apStop)();
    bool (*apActive)();
    bool (*ffsReady)();
    bool (*ffsStart)(int backend);
    bool (*remoteConfigured)();
    bool (*remoteAvailable)();
};

class Runtime {
public:
    bool begin(fs::FS& filesystem, WiFiProvisioning& provisioning, const Hardware& hardware);
    bool poll();
    bool handleProvisioningRequest(AsyncWebServerRequest* request);
    bool executePolicy(const std::vector<pmachine::PInstruction>& instructions,
        const std::map<std::string, std::vector<std::string>>& signatures,
        pmachine::HostCallHook hook, void* context, std::string& error);
    bool invokeJson(const std::string& name, const std::vector<pmachine::HostValue>& args,
        pmachine::HostValue& result, std::string& error);
    bool healthy() const { return healthy_; }
    const std::string& error() const { return error_; }

private:
    static bool call(const std::string& name, const std::vector<pmachine::HostValue>& args,
                     pmachine::HostValue& result, std::string& error, void* context);
    bool invoke(const std::string& name, const std::vector<pmachine::HostValue>& args,
                pmachine::HostValue& result, std::string& error);
    pmachine::PMachine machine_;
    pmachine::HostExecutionStorage storage_;
    std::vector<pmachine::PInstruction> instructions_;
    std::vector<pmachine::PInstruction> provisioningInstructions_;
    std::array<int, 32> state_{};
    std::array<std::pair<std::string, std::string>, 16> requestParams_{};
    std::vector<WiFiCredentials> profiles_;
#if defined(ESP32)
    SemaphoreHandle_t executionMutex_ = nullptr;
#endif
    WiFiProvisioning* provisioning_ = nullptr;
    Hardware hardware_{};
    std::string error_;
    uint32_t lastTick_ = 0;
    bool loaded_ = false;
    bool healthy_ = false;
    bool profileReadErrorLogged_ = false;
    bool profilesLoaded_ = false;
    uint32_t profileRevision_ = 0;
    int scanCount_ = -1;
    int responseStatus_ = 500;
    int responseReboot_ = 0;
    std::string requestMethod_;
    std::string requestPath_;
    std::string responseBody_;
    bool provisioningLoaded_ = false;
};

Runtime& runtime();

}}
#endif
