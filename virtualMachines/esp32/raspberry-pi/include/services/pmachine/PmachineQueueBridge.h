#pragma once

#include <string>

#include "core/Types.h"

namespace pulse::services::pmachine {

class PmachineQueueBridge {
public:
    explicit PmachineQueueBridge(const core::NodeConfig& config);

    bool pollOnce();
    bool runMapperRequest(const std::string& message,
                          std::string* responseBody = nullptr,
                          bool avoidLocalNode = false) const;
    bool runMapperRequest(const std::string& pcodeFile,
                          const std::string& programMap,
                          const std::string& inputQueue,
                          const std::string& message,
                          std::string* responseBody = nullptr,
                          bool avoidLocalNode = false) const;

private:
    struct RouteTarget {
        std::string ip;
        int port = 80;
    };

    static std::string trimTrailingSlash(const std::string& value);
    static std::string urlEncode(const std::string& value);
    static std::string jsonEscape(const std::string& value);
    static std::string extractFirstMatch(const std::string& text, const std::string& pattern);
    static std::string unescapeJsonString(const std::string& value);

    std::string httpPostJson(const std::string& url, const std::string& jsonBody) const;
    std::string httpGet(const std::string& url) const;
    RouteTarget resolveRouteTarget(bool avoidLocalNode) const;
    std::string dequeueMessage() const;
    bool runPcodeOnTarget(const RouteTarget& target,
                          const std::string& pcodeFile,
                          const std::string& programMap,
                          const std::string& inputQueue,
                          const std::string& message,
                          std::string* responseBody) const;

    core::NodeConfig config_;
};

} // namespace pulse::services::pmachine
