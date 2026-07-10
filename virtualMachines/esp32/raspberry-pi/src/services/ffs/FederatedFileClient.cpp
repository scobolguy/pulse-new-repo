#include "services/ffs/FederatedFileClient.h"

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
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

namespace pulse::services::ffs {

namespace {
std::string trimTrailingSlash(const std::string& input) {
    if (input.empty()) return input;
    std::string result = input;
    while (!result.empty() && result.back() == '/') {
        result.pop_back();
    }
    return result;
}

std::string sanitizeRelativePath(const std::string& value) {
    std::string out;
    out.reserve(value.size());
    for (char ch : value) {
        if (ch == '\\') {
            out.push_back('/');
        } else {
            out.push_back(ch);
        }
    }
    while (!out.empty() && out.front() == '/') {
        out.erase(out.begin());
    }
    return out;
}
} // namespace

FederatedFileClient::FederatedFileClient(const core::NodeConfig& config) : config_(config) {}

FederatedFileClient::~FederatedFileClient() {
    stop();
}

void FederatedFileClient::start() {
    if (!config_.ffsEnabled) {
        std::cout << "[ffs] disabled in config\n";
        return;
    }
    if (running_.exchange(true)) return;
    worker_ = std::thread(&FederatedFileClient::runLoop, this);
}

void FederatedFileClient::stop() {
    if (!running_.exchange(false)) return;
    if (worker_.joinable()) worker_.join();
}

void FederatedFileClient::runLoop() {
    const int intervalMs = (config_.ffsPollIntervalMs > 1000) ? config_.ffsPollIntervalMs : 1000;
    std::cout << "[ffs] polling deployments every " << intervalMs << "ms\n";

    while (running_.load()) {
        syncOnce();

        int remaining = intervalMs;
        while (running_.load() && remaining > 0) {
            const int slice = (remaining > 100) ? 100 : remaining;
            std::this_thread::sleep_for(std::chrono::milliseconds(slice));
            remaining -= slice;
        }
    }

    std::cout << "[ffs] client stopped\n";
}

void FederatedFileClient::syncOnce() {
    if (!ensureCacheRoot()) {
        std::cerr << "[ffs] failed to prepare cache root: " << config_.ffsCachePath << "\n";
        return;
    }

    const std::string deploymentsJson = readHttpText(buildUrl("/api/fileserver/ffs/services/deployments"));
    if (deploymentsJson.empty()) {
        return;
    }

    const auto deployments = parseDeployments(deploymentsJson);
    std::size_t downloaded = 0;
    for (const auto& dep : deployments) {
        if (dep.pcodePath.empty()) continue;

        if (!dep.targetNodeId.empty() && dep.targetNodeId != "*" && dep.targetNodeId != config_.nodeId) {
            continue;
        }

        const std::string relPath = sanitizeRelativePath(dep.pcodePath);
        if (relPath.empty()) continue;

        const std::filesystem::path outPath = std::filesystem::path(config_.ffsCachePath) / relPath;
        std::error_code ec;
        std::filesystem::create_directories(outPath.parent_path(), ec);
        if (ec) {
            std::cerr << "[ffs] failed to create parent directories for " << outPath.string() << "\n";
            continue;
        }

        const std::string sourceUrl = buildUrl("/api/fileserver/ffs/get?path=" + relPath);
        if (downloadToFile(sourceUrl, outPath.string())) {
            ++downloaded;
        }
    }

    if (downloaded > 0) {
        std::cout << "[ffs] updated " << downloaded << " artifact(s)\n";
    }
}

bool FederatedFileClient::ensureCacheRoot() const {
    std::error_code ec;
    std::filesystem::create_directories(config_.ffsCachePath, ec);
    return !ec;
}

std::string FederatedFileClient::buildUrl(const std::string& path) const {
    return trimTrailingSlash(config_.backendUrl) + path;
}

std::string FederatedFileClient::readHttpText(const std::string& url) const {
    std::ostringstream command;
    command << "curl -s --max-time 5 \"" << url << "\"";

    FILE* pipe = POPEN(command.str().c_str(), "r");
    if (!pipe) {
        std::cerr << "[ffs] failed to execute curl for " << url << "\n";
        return {};
    }

    std::string output;
    char buffer[512];
    while (std::fgets(buffer, static_cast<int>(sizeof(buffer)), pipe) != nullptr) {
        output += buffer;
    }

    const int status = PCLOSE(pipe);
    if (status != 0) {
        return {};
    }

    return output;
}

bool FederatedFileClient::downloadToFile(const std::string& url, const std::string& outPath) const {
    std::ostringstream command;
    command << "curl -s --max-time 8 -o \"" << outPath << "\" \"" << url << "\"";
    const int rc = std::system(command.str().c_str());
    return rc == 0;
}

std::vector<FederatedFileClient::Deployment> FederatedFileClient::parseDeployments(const std::string& json) const {
    std::vector<Deployment> out;

    const std::regex entryRegex("\\{[^\\{\\}]*\\\"pcodePath\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"[^\\{\\}]*\\}");
    const std::regex serviceRegex("\\\"serviceName\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    const std::regex targetRegex("\\\"targetNodeId\\\"\\s*:\\s*(null|\\\"([^\\\"]*)\\\")");

    auto begin = std::sregex_iterator(json.begin(), json.end(), entryRegex);
    auto end = std::sregex_iterator();
    for (auto it = begin; it != end; ++it) {
        Deployment dep;
        const std::string block = it->str();
        dep.pcodePath = (*it)[1].str();

        std::smatch serviceMatch;
        if (std::regex_search(block, serviceMatch, serviceRegex) && serviceMatch.size() > 1) {
            dep.serviceName = serviceMatch[1].str();
        }

        std::smatch targetMatch;
        if (std::regex_search(block, targetMatch, targetRegex)) {
            if (targetMatch.size() > 2) {
                dep.targetNodeId = targetMatch[2].str();
            }
        }

        out.push_back(dep);
    }

    return out;
}

} // namespace pulse::services::ffs
