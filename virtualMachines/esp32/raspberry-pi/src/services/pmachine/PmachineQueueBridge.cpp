#include "services/pmachine/PmachineQueueBridge.h"

#include <array>
#include <cstdio>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <regex>
#include <sstream>

#if defined(_WIN32)
#define POPEN _popen
#define PCLOSE _pclose
#else
#define POPEN popen
#define PCLOSE pclose
#endif

namespace pulse::services::pmachine {

PmachineQueueBridge::PmachineQueueBridge(const core::NodeConfig& config) : config_(config) {}

bool PmachineQueueBridge::pollOnce() {
    const std::string message = dequeueMessage();
    if (message.empty()) return false;
    return runMapperRequest(message, nullptr, true);
}

bool PmachineQueueBridge::runMapperRequest(const std::string& message,
                                           std::string* responseBody,
                                           bool avoidLocalNode) const {
    return runMapperRequest(
        config_.pmachinePcodeFile,
        config_.pmachineProgramMap,
        config_.alertQueue,
        message,
        responseBody,
        avoidLocalNode);
}

bool PmachineQueueBridge::runMapperRequest(const std::string& pcodeFile,
                                           const std::string& programMap,
                                           const std::string& inputQueue,
                                           const std::string& message,
                                           std::string* responseBody,
                                           bool avoidLocalNode) const {
    const RouteTarget target = resolveRouteTarget(avoidLocalNode);
    if (target.ip.empty()) {
        std::cerr << "[pmachine-cpp] no pmachine route target available\n";
        return false;
    }

    const bool ok = runPcodeOnTarget(target, pcodeFile, programMap, inputQueue, message, responseBody);
    if (!ok) {
        std::cerr << "[pmachine-cpp] invocation failed on " << target.ip << ':' << target.port << "\n";
    }
    return ok;
}

std::string PmachineQueueBridge::trimTrailingSlash(const std::string& value) {
    std::string out = value;
    while (!out.empty() && out.back() == '/') out.pop_back();
    return out;
}

std::string PmachineQueueBridge::urlEncode(const std::string& value) {
    std::ostringstream encoded;
    encoded.fill('0');
    encoded << std::hex;

    for (unsigned char c : value) {
        const bool safe =
            (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') ||
            c == '-' || c == '_' || c == '.' || c == '~';
        if (safe) {
            encoded << static_cast<char>(c);
        } else {
            encoded << '%' << std::uppercase << std::setw(2) << static_cast<int>(c) << std::nouppercase;
        }
    }

    return encoded.str();
}

std::string PmachineQueueBridge::jsonEscape(const std::string& value) {
    std::string out;
    out.reserve(value.size() + 8);
    for (char c : value) {
        if (c == '\\') out += "\\\\";
        else if (c == '"') out += "\\\"";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

std::string PmachineQueueBridge::extractFirstMatch(const std::string& text, const std::string& pattern) {
    const std::regex re(pattern);
    std::smatch match;
    if (std::regex_search(text, match, re) && match.size() > 1) {
        return match[1].str();
    }
    return {};
}

std::string PmachineQueueBridge::unescapeJsonString(const std::string& value) {
    std::string out;
    out.reserve(value.size());
    for (std::size_t i = 0; i < value.size(); ++i) {
        const char c = value[i];
        if (c == '\\' && i + 1 < value.size()) {
            const char n = value[i + 1];
            if (n == 'n') {
                out.push_back('\n');
                ++i;
                continue;
            }
            if (n == 'r') {
                out.push_back('\r');
                ++i;
                continue;
            }
            if (n == 't') {
                out.push_back('\t');
                ++i;
                continue;
            }
            out.push_back(n);
            ++i;
            continue;
        }
        out.push_back(c);
    }
    return out;
}

std::string PmachineQueueBridge::httpPostJson(const std::string& url, const std::string& jsonBody) const {
    std::ostringstream cmd;
    cmd << "curl -s --max-time 8 -X POST -H \"content-type: application/json\" -d \""
        << jsonEscape(jsonBody)
        << "\" \""
        << url
        << "\"";

    FILE* pipe = POPEN(cmd.str().c_str(), "r");
    if (!pipe) return {};

    std::string output;
    std::array<char, 512> buf{};
    while (std::fgets(buf.data(), static_cast<int>(buf.size()), pipe) != nullptr) {
        output += buf.data();
    }

    const int status = PCLOSE(pipe);
    if (status != 0) return {};
    return output;
}

std::string PmachineQueueBridge::httpGet(const std::string& url) const {
    std::ostringstream cmd;
    cmd << "curl -s --max-time 8 \"" << url << "\"";

    FILE* pipe = POPEN(cmd.str().c_str(), "r");
    if (!pipe) return {};

    std::string output;
    std::array<char, 512> buf{};
    while (std::fgets(buf.data(), static_cast<int>(buf.size()), pipe) != nullptr) {
        output += buf.data();
    }

    const int status = PCLOSE(pipe);
    if (status != 0) return {};
    return output;
}

PmachineQueueBridge::RouteTarget PmachineQueueBridge::resolveRouteTarget(bool avoidLocalNode) const {
    RouteTarget target;
    const std::string url = trimTrailingSlash(config_.backendUrl) + "/api/pmachine/route/pmachine";
    std::ostringstream body;
    body << "{\"proxy\":false";
    if (avoidLocalNode) {
        body << ",\"forbiddenFailureDomains\":[\"" << jsonEscape(config_.nodeId) << "\"]";
    }
    body << "}";

    const std::string responseBody = httpPostJson(url, body.str());
    if (responseBody.empty()) return target;

    target.ip = extractFirstMatch(responseBody, "\\\"ip\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    const std::string portText = extractFirstMatch(responseBody, "\\\"port\\\"\\s*:\\s*([0-9]+)");
    if (target.ip.empty()) {
        const std::string selectedBlock = extractFirstMatch(responseBody, "\\\"selected\\\"\\s*:\\s*\\{([^\\}]*)\\}");
        if (!selectedBlock.empty()) {
            target.ip = extractFirstMatch(selectedBlock, "\\\"ip\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
        }
    }
    if (target.ip.empty()) return target;

    const std::string selectedPortText = extractFirstMatch(responseBody, "\\\"selected\\\"\\s*:\\s*\\{[^\\}]*\\\"port\\\"\\s*:\\s*([0-9]+)");
    if (!portText.empty()) {
        target.port = std::atoi(portText.c_str());
    } else if (!selectedPortText.empty()) {
        target.port = std::atoi(selectedPortText.c_str());
    }
    if (target.port <= 0) target.port = 80;
    return target;
}

std::string PmachineQueueBridge::dequeueMessage() const {
    const std::string endpoint = trimTrailingSlash(config_.queueManagerUrl) + "/dequeue";
    std::ostringstream body;
    body << "{\"queueName\":\"" << jsonEscape(config_.alertQueue) << "\",\"consumerService\":\"pi-pmachine-bridge\"}";

    const std::string response = httpPostJson(endpoint, body.str());
    if (response.empty()) return {};

    const std::string raw = extractFirstMatch(response, "\\\"message\\\"\\s*:\\s*\\{[^\\}]*\\\"message\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    if (raw.empty()) return {};
    return unescapeJsonString(raw);
}

bool PmachineQueueBridge::runPcodeOnTarget(const RouteTarget& target,
                                           const std::string& pcodeFile,
                                           const std::string& programMap,
                                           const std::string& inputQueue,
                                           const std::string& message,
                                           std::string* responseBody) const {
    std::ostringstream url;
    url << "http://" << target.ip << ':' << target.port
        << "/pmachine/pcode_router_run"
        << "?file=" << urlEncode(pcodeFile)
        << "&programMap=" << urlEncode(programMap)
        << "&inputQueue=" << urlEncode(inputQueue)
        << "&message=" << urlEncode(message);

    const std::string response = httpGet(url.str());
    if (response.empty()) return false;
    if (responseBody != nullptr) {
        *responseBody = response;
    }

    const std::string publishedCount = extractFirstMatch(response, "\\\"publishedCount\\\"\\s*:\\s*([0-9]+)");
    if (publishedCount.empty()) {
        std::cerr << "[pmachine-cpp] response missing publishedCount, treating as non-execution" << " target=" << target.ip << ':' << target.port << "\n";
        return false;
    }

    std::cout << "[pmachine-cpp] ran pcode file=" << pcodeFile
              << " queue=" << inputQueue
              << " publishedCount=" << publishedCount
              << " target=" << target.ip << ':' << target.port << "\n";

    const std::string stdoutLine = extractFirstMatch(response, "\\\"stdout\\\"\\s*:\\s*\\[\\s*\\\"([^\\\"]*)\\\"");
    if (!stdoutLine.empty()) {
        std::cout << "[pmachine-cpp] stdout[0]: " << unescapeJsonString(stdoutLine) << "\n";
    }

    return true;
}

} // namespace pulse::services::pmachine
