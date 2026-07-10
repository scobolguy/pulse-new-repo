#include <chrono>
#include <cstring>
#include <ctime>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

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

std::vector<int> parsePorts(int argc, char** argv) {
    std::vector<int> ports;

    for (int i = 1; i < argc; ++i) {
        std::stringstream ss(argv[i]);
        std::string token;
        while (std::getline(ss, token, ',')) {
            if (token.empty()) continue;
            const int parsed = std::atoi(token.c_str());
            if (parsed > 0 && parsed <= 65535) {
                ports.push_back(parsed);
            }
        }
    }

    if (ports.empty()) {
        // ESP32 default parent/sibling beacon ports + RPi discovery default.
        ports = {4210, 4211, 4101};
    }

    return ports;
}
}

int main(int argc, char** argv) {
    const std::vector<int> ports = parsePorts(argc, argv);
    std::cout.setf(std::ios::unitbuf);

#if defined(_WIN32)
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "[listener] WSAStartup failed\n";
        return 1;
    }
#endif

    std::vector<std::pair<SocketHandle, int>> sockets;
    sockets.reserve(ports.size());

    for (const int port : ports) {
        SocketHandle sock = socket(AF_INET, SOCK_DGRAM, 0);
        if (sock == kInvalidSocket) {
            std::cerr << "[listener] unable to create UDP socket for port " << port << "\n";
            continue;
        }

        int reuse = 1;
        (void)setsockopt(sock, SOL_SOCKET, SO_REUSEADDR,
                         reinterpret_cast<const char*>(&reuse), sizeof(reuse));

        sockaddr_in bindAddr{};
        bindAddr.sin_family = AF_INET;
        bindAddr.sin_port = htons(static_cast<uint16_t>(port));
        bindAddr.sin_addr.s_addr = INADDR_ANY;

        if (bind(sock, reinterpret_cast<const sockaddr*>(&bindAddr), sizeof(bindAddr)) != 0) {
            std::cerr << "[listener] bind failed on port " << port << "\n";
            closeSocket(sock);
            continue;
        }

        sockets.push_back({sock, port});
        std::cout << "[listener] listening on UDP " << port << "\n";
    }

    if (sockets.empty()) {
        std::cerr << "[listener] no sockets bound\n";
#if defined(_WIN32)
        WSACleanup();
#endif
        return 1;
    }

    while (true) {
        fd_set readSet;
        FD_ZERO(&readSet);

#if !defined(_WIN32)
        int maxFd = 0;
#endif

        for (const auto& entry : sockets) {
            FD_SET(entry.first, &readSet);
#if !defined(_WIN32)
            if (entry.first > maxFd) maxFd = entry.first;
#endif
        }

        timeval timeout{};
        timeout.tv_sec = 1;
        timeout.tv_usec = 0;

#if defined(_WIN32)
        const int ready = select(0, &readSet, nullptr, nullptr, &timeout);
#else
        const int ready = select(maxFd + 1, &readSet, nullptr, nullptr, &timeout);
#endif

        if (ready <= 0) {
            continue;
        }

        for (const auto& entry : sockets) {
            const SocketHandle sock = entry.first;
            const int boundPort = entry.second;
            if (!FD_ISSET(sock, &readSet)) {
                continue;
            }

            char buffer[4096];
            sockaddr_in from{};
#if defined(_WIN32)
            int fromLen = sizeof(from);
#else
            socklen_t fromLen = sizeof(from);
#endif

            const int len = recvfrom(sock, buffer, sizeof(buffer) - 1, 0,
                                     reinterpret_cast<sockaddr*>(&from), &fromLen);
            if (len <= 0) {
                continue;
            }

            buffer[len] = '\0';
            char ip[INET_ADDRSTRLEN] = {0};
            inet_ntop(AF_INET, &(from.sin_addr), ip, INET_ADDRSTRLEN);

            const auto now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
            std::cout << "[listener] " << std::ctime(&now)
                      << "on " << boundPort << " from " << ip << ":" << ntohs(from.sin_port) << "\n"
                      << buffer << "\n\n";
        }
    }

    for (const auto& entry : sockets) {
        closeSocket(entry.first);
    }
#if defined(_WIN32)
    WSACleanup();
#endif
    return 0;
}
