#pragma once

#include <atomic>
#include <string>
#include <thread>
#include <vector>

#include "core/Types.h"

namespace pulse::services::discovery {

class NetworkAnnouncer {
public:
    NetworkAnnouncer(const core::NodeConfig& config, std::vector<std::string> advertisedServices);
    ~NetworkAnnouncer();

    void start();
    void stop();

private:
    std::string buildPayload() const;
    void runLoop();
    bool sendAnnouncement(const std::string& payload) const;

    core::NodeConfig config_;
    std::vector<std::string> advertisedServices_;
    std::atomic<bool> running_{false};
    std::thread worker_;
};

} // namespace pulse::services::discovery
