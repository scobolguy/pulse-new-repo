#include "services/discovery/ServicePresencePublisher.h"

#include <array>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#define POPEN _popen
#define PCLOSE _pclose
#else
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#define POPEN popen
#define PCLOSE pclose
#endif

namespace pulse::services::discovery {

namespace {
#if defined(_WIN32)
using SocketType = SOCKET;
constexpr SocketType kInvalidSocket = INVALID_SOCKET;
#else
using SocketType = int;
constexpr SocketType kInvalidSocket = -1;
#endif

void closeSocket(SocketType sock) {
#if defined(_WIN32)
    closesocket(sock);
#else
    close(sock);
#endif
}

std::string extractHostFromUrl(const std::string& url) {
    const std::size_t schemePos = url.find("://");
    const std::size_t hostStart = (schemePos == std::string::npos) ? 0 : schemePos + 3;
    if (hostStart >= url.size()) return {};

    std::size_t hostEnd = url.find('/', hostStart);
    if (hostEnd == std::string::npos) hostEnd = url.size();

    std::string hostPort = url.substr(hostStart, hostEnd - hostStart);
    const std::size_t colonPos = hostPort.rfind(':');
    if (colonPos != std::string::npos) {
        hostPort = hostPort.substr(0, colonPos);
    }
    return hostPort;
}
}

ServicePresencePublisher::ServicePresencePublisher(const core::NodeConfig& config, int nodeApiPort)
    : config_(config), nodeApiPort_(nodeApiPort > 0 ? nodeApiPort : 80) {}

ServicePresencePublisher::~ServicePresencePublisher() {
    stop();
}

void ServicePresencePublisher::start() {
    if (running_.exchange(true)) return;
    worker_ = std::thread(&ServicePresencePublisher::runLoop, this);
}

void ServicePresencePublisher::stop() {
    if (!running_.exchange(false)) return;
    if (worker_.joinable()) worker_.join();
}

std::string ServicePresencePublisher::trimTrailingSlash(const std::string& value) {
    std::string out = value;
    while (!out.empty() && out.back() == '/') out.pop_back();
    return out;
}

std::string ServicePresencePublisher::jsonEscape(const std::string& value) {
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

std::string ServicePresencePublisher::detectLocalIpForBackend() const {
#if defined(_WIN32)
    WSADATA data;
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) return "127.0.0.1";
#endif

    const std::string host = extractHostFromUrl(config_.backendUrl);
    if (host.empty()) return "127.0.0.1";

    addrinfo hints{};
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_DGRAM;

    addrinfo* result = nullptr;
    if (getaddrinfo(host.c_str(), "80", &hints, &result) != 0 || result == nullptr) {
#if defined(_WIN32)
        WSACleanup();
#endif
        return "127.0.0.1";
    }

    SocketType sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock == kInvalidSocket) {
        freeaddrinfo(result);
#if defined(_WIN32)
        WSACleanup();
#endif
        return "127.0.0.1";
    }

    const int connResult = connect(sock, result->ai_addr, static_cast<int>(result->ai_addrlen));
    freeaddrinfo(result);

    if (connResult != 0) {
        closeSocket(sock);
#if defined(_WIN32)
        WSACleanup();
#endif
        return "127.0.0.1";
    }

    sockaddr_in localAddr{};
    socklen_t localLen = sizeof(localAddr);
    if (getsockname(sock, reinterpret_cast<sockaddr*>(&localAddr), &localLen) != 0) {
        closeSocket(sock);
#if defined(_WIN32)
        WSACleanup();
#endif
        return "127.0.0.1";
    }

    char ipBuffer[INET_ADDRSTRLEN] = {0};
    const char* printed = inet_ntop(AF_INET, &localAddr.sin_addr, ipBuffer, sizeof(ipBuffer));
    closeSocket(sock);
#if defined(_WIN32)
    WSACleanup();
#endif

    return printed ? std::string(printed) : std::string("127.0.0.1");
}

std::string ServicePresencePublisher::buildAnnounceBody(const std::string& ip) const {
    std::ostringstream body;
    body << "{";
    body << "\"nodeId\":\"" << jsonEscape(config_.nodeId) << "\",";
    body << "\"nodeName\":\"" << jsonEscape(config_.nodeId) << "\",";
    body << "\"ip\":\"" << jsonEscape(ip) << "\",";
    body << "\"port\":" << nodeApiPort_ << ",";
    body << "\"status\":\"available\",";
    body << "\"available\":true,";
    body << "\"runtime\":\"cpp-pmachine-rpi\",";
    body << "\"hardware\":\"Raspberry Pi\",";
    body << "\"capabilities\":[\"pmachine\",\"pcode-router\",\"mapper\"],";
    body << "\"services\":[{";
    body << "\"name\":\"pmachine\",";
    body << "\"endpoint\":\"/pmachine/pcode_router_run\",";
    body << "\"status\":\"up\",";
    body << "\"metadata\":{";
    body << "\"runtime\":\"cpp-pmachine-rpi\",";
    body << "\"hardware\":\"Raspberry Pi\",";
    body << "\"failureDomain\":\"" << jsonEscape(config_.nodeId) << "\",";
    body << "\"capabilities\":[\"pmachine\",\"pcode-router\",\"mapper\"]";
    body << "}";
    body << "}]";
    body << "}";
    return body.str();
}

std::string ServicePresencePublisher::buildHeartbeatBody(const std::string& ip) const {
    std::ostringstream body;
    body << "{";
    body << "\"serviceName\":\"pmachine\",";
    body << "\"instanceId\":\"pmachine:" << jsonEscape(config_.nodeId) << ':' << nodeApiPort_ << "\",";
    body << "\"nodeId\":\"" << jsonEscape(config_.nodeId) << "\",";
    body << "\"ip\":\"" << jsonEscape(ip) << "\",";
    body << "\"port\":" << nodeApiPort_ << ",";
    body << "\"status\":\"up\",";
    body << "\"metadata\":{";
    body << "\"route\":\"/pmachine/pcode_router_run\",";
    body << "\"runtime\":\"cpp-pmachine-rpi\",";
    body << "\"hardware\":\"Raspberry Pi\",";
    body << "\"failureDomain\":\"" << jsonEscape(config_.nodeId) << "\",";
    body << "\"capabilities\":[\"pmachine\",\"pcode-router\",\"mapper\"]";
    body << "}";
    body << "}";
    return body.str();
}

bool ServicePresencePublisher::httpPost(const std::string& url, const std::string& body) const {
    std::ostringstream cmd;
    cmd << "curl -s --max-time 5 -X POST -H \"content-type: application/json\" -d \""
        << jsonEscape(body)
        << "\" \""
        << url
        << "\"";

    FILE* pipe = POPEN(cmd.str().c_str(), "r");
    if (!pipe) return false;

    std::string output;
    std::array<char, 256> buf{};
    while (std::fgets(buf.data(), static_cast<int>(buf.size()), pipe) != nullptr) {
        output += buf.data();
    }

    const int status = PCLOSE(pipe);
    if (status != 0) return false;

    return output.find("\"status\":\"ok\"") != std::string::npos;
}

void ServicePresencePublisher::runLoop() {
    const int intervalMs = (config_.discoveryIntervalMs > 1000) ? config_.discoveryIntervalMs : 3000;
    const std::string backendBase = trimTrailingSlash(config_.backendUrl);

    while (running_.load()) {
        const std::string ip = detectLocalIpForBackend();
        const bool announceOk = httpPost(backendBase + "/api/pmachine/announce", buildAnnounceBody(ip));
        const bool heartbeatOk = httpPost(backendBase + "/api/registry/service-instances/heartbeat", buildHeartbeatBody(ip));

        if (announceOk && heartbeatOk) {
            std::cout << "[presence] published pmachine service heartbeat for node " << config_.nodeId << "\n";
        } else {
            std::cerr << "[presence] publish failed announce=" << (announceOk ? "ok" : "fail")
                      << " heartbeat=" << (heartbeatOk ? "ok" : "fail") << "\n";
        }

        int remaining = intervalMs;
        while (running_.load() && remaining > 0) {
            const int slice = (remaining > 200) ? 200 : remaining;
            std::this_thread::sleep_for(std::chrono::milliseconds(slice));
            remaining -= slice;
        }
    }
}

} // namespace pulse::services::discovery
