#pragma once

#include <atomic>
#include <string>
#include <thread>

#include "core/Types.h"

namespace pulse::services::discovery {

class ServicePresencePublisher {
public:
    ServicePresencePublisher(const core::NodeConfig& config, int nodeApiPort);
    ~ServicePresencePublisher();

    void start();
    void stop();

private:
    static std::string trimTrailingSlash(const std::string& value);
    static std::string jsonEscape(const std::string& value);

    std::string detectLocalIpForBackend() const;
    std::string buildAnnounceBody(const std::string& ip) const;
    std::string buildHeartbeatBody(const std::string& ip) const;
    bool httpPost(const std::string& url, const std::string& body) const;
    void runLoop();

    core::NodeConfig config_;
    int nodeApiPort_ = 80;
    std::atomic<bool> running_{false};
    std::thread worker_;
};

} // namespace pulse::services::discovery
