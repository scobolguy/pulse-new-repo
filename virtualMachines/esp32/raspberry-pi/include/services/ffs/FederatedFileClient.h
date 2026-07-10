#pragma once

#include <atomic>
#include <string>
#include <thread>
#include <vector>

#include "core/Types.h"

namespace pulse::services::ffs {

class FederatedFileClient {
public:
    explicit FederatedFileClient(const core::NodeConfig& config);
    ~FederatedFileClient();

    void start();
    void stop();

private:
    struct Deployment {
        std::string serviceName;
        std::string targetNodeId;
        std::string pcodePath;
    };

    void runLoop();
    void syncOnce();
    bool ensureCacheRoot() const;
    std::string buildUrl(const std::string& path) const;
    std::string readHttpText(const std::string& url) const;
    bool downloadToFile(const std::string& url, const std::string& outPath) const;
    std::vector<Deployment> parseDeployments(const std::string& json) const;

    core::NodeConfig config_;
    std::atomic<bool> running_{false};
    std::thread worker_;
};

} // namespace pulse::services::ffs
