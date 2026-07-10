#include "services/discovery/NetworkAnnouncer.h"

#include <chrono>
#include <ctime>
#include <cstring>
#include <iostream>
#include <sstream>
#include <utility>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace pulse::services::discovery {

namespace {
#if defined(_WIN32)
using SocketHandle = SOCKET;
constexpr SocketHandle kInvalidSocket = INVALID_SOCKET;
#else
using SocketHandle = int;
constexpr SocketHandle kInvalidSocket = -1;
#endif

void closeSocket(SocketHandle sock) {
#if defined(_WIN32)
    closesocket(sock);
#else
    close(sock);
#endif
}
}

NetworkAnnouncer::NetworkAnnouncer(const core::NodeConfig& config,
                                   std::vector<std::string> advertisedServices)
    : config_(config), advertisedServices_(std::move(advertisedServices)) {}

NetworkAnnouncer::~NetworkAnnouncer() {
    stop();
}

void NetworkAnnouncer::start() {
    if (!config_.discoveryEnabled) {
        std::cout << "[discovery] disabled in config\n";
        return;
    }
    if (running_.exchange(true)) return;
    worker_ = std::thread(&NetworkAnnouncer::runLoop, this);
}

void NetworkAnnouncer::stop() {
    if (!running_.exchange(false)) return;
    if (worker_.joinable()) worker_.join();
}

std::string NetworkAnnouncer::buildPayload() const {
    std::ostringstream os;
    os << "{";
    os << "\"kind\":\"pulse.node.announce\",";
    os << "\"nodeId\":\"" << config_.nodeId << "\",";
    os << "\"role\":\"" << config_.role << "\",";
    os << "\"backendUrl\":\"" << config_.backendUrl << "\",";
    os << "\"queueManagerUrl\":\"" << config_.queueManagerUrl << "\",";
    os << "\"alertQueue\":\"" << config_.alertQueue << "\",";
    os << "\"timestamp\":" << static_cast<long long>(std::time(nullptr)) << ",";
    os << "\"services\":[";
    for (std::size_t i = 0; i < advertisedServices_.size(); ++i) {
        if (i > 0) os << ",";
        os << "\"" << advertisedServices_[i] << "\"";
    }
    os << "]";
    os << "}";
    return os.str();
}

bool NetworkAnnouncer::sendAnnouncement(const std::string& payload) const {
#if defined(_WIN32)
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "[discovery] WSAStartup failed\n";
        return false;
    }
#endif

    SocketHandle sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock == kInvalidSocket) {
        std::cerr << "[discovery] unable to create UDP socket\n";
#if defined(_WIN32)
        WSACleanup();
#endif
        return false;
    }

    int broadcastEnable = 1;
    if (setsockopt(sock, SOL_SOCKET, SO_BROADCAST,
                   reinterpret_cast<const char*>(&broadcastEnable),
                   sizeof(broadcastEnable)) != 0) {
        std::cerr << "[discovery] unable to enable broadcast\n";
        closeSocket(sock);
#if defined(_WIN32)
        WSACleanup();
#endif
        return false;
    }

    sockaddr_in targetBroadcast{};
    targetBroadcast.sin_family = AF_INET;
    targetBroadcast.sin_port = htons(static_cast<uint16_t>(config_.discoveryPort));
    targetBroadcast.sin_addr.s_addr = INADDR_BROADCAST;

    const int sendBroadcast = sendto(sock,
                                     payload.c_str(),
                                     static_cast<int>(payload.size()),
                                     0,
                                     reinterpret_cast<const sockaddr*>(&targetBroadcast),
                                     sizeof(targetBroadcast));

    sockaddr_in targetLocal{};
    targetLocal.sin_family = AF_INET;
    targetLocal.sin_port = htons(static_cast<uint16_t>(config_.discoveryPort));
    targetLocal.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    const int sendLocal = sendto(sock,
                                 payload.c_str(),
                                 static_cast<int>(payload.size()),
                                 0,
                                 reinterpret_cast<const sockaddr*>(&targetLocal),
                                 sizeof(targetLocal));

    closeSocket(sock);
#if defined(_WIN32)
    WSACleanup();
#endif

    return (sendBroadcast >= 0) || (sendLocal >= 0);
}

void NetworkAnnouncer::runLoop() {
    std::cout << "[discovery] announcing on UDP broadcast port " << config_.discoveryPort << "\n";
    const int intervalMs = (config_.discoveryIntervalMs > 250) ? config_.discoveryIntervalMs : 250;

    while (running_.load()) {
        const std::string payload = buildPayload();
        const bool ok = sendAnnouncement(payload);
        if (ok) {
            std::cout << "[discovery] announcement sent for node " << config_.nodeId << "\n";
        } else {
            std::cerr << "[discovery] failed to send announcement\n";
        }

        int remaining = intervalMs;
        while (running_.load() && remaining > 0) {
            const int slice = (remaining > 100) ? 100 : remaining;
            std::this_thread::sleep_for(std::chrono::milliseconds(slice));
            remaining -= slice;
        }
    }

    std::cout << "[discovery] announcer stopped\n";
}

} // namespace pulse::services::discovery
