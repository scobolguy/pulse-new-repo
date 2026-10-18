#include "native_service.hpp"

#include <algorithm>
#include <cctype>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
using Socket = SOCKET;
static constexpr Socket INVALID_SOCKET_VALUE = INVALID_SOCKET;
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>
using Socket = int;
static constexpr Socket INVALID_SOCKET_VALUE = -1;
#endif

namespace {

volatile std::sig_atomic_t stopRequested = 0;

void requestStop(int) {
    stopRequested = 1;
}

struct Options {
    std::string pcode;
    std::string programMap;
    std::string host = "127.0.0.1";
    int port = 0;
    uint64_t maxSteps = 0;
    uint64_t maxFileBytes = 262144;
    bool debug = false;
    std::map<std::string, pulse::native::StorageRootGrant> storageRoots;
};

std::string lower(std::string text) {
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return text;
}

int parsePort(const std::string& value, const char* option, int maximum) {
    size_t consumed = 0;
    const long parsed = std::stol(value, &consumed);
    if (consumed != value.size() || parsed < 0 || parsed > maximum) {
        throw std::runtime_error(std::string("Invalid value for ") + option);
    }
    return static_cast<int>(parsed);
}

uint64_t parseBudget(const std::string& value) {
    size_t consumed = 0;
    const auto parsed = std::stoull(value, &consumed);
    if (consumed != value.size() || parsed == 0) throw std::runtime_error("Invalid --max-steps value");
    return parsed;
}

uint64_t parsePositiveSize(const std::string& value, const char* option) {
    size_t consumed = 0;
    const auto parsed = std::stoull(value, &consumed);
    if (consumed != value.size() || parsed == 0 || parsed > 1000000) {
        throw std::runtime_error(std::string("Invalid value for ") + option);
    }
    return parsed;
}

void addStorageRoot(Options& options, const std::string& value, bool readOnly) {
    const auto separator = value.find('=');
    if (separator == std::string::npos || separator == 0 || separator + 1 >= value.size()) {
        throw std::runtime_error("Storage root must be ALIAS=ABSOLUTE_PATH");
    }
    const auto alias = value.substr(0, separator);
    if (alias.size() > 64 || alias.front() < 'a' || alias.front() > 'z' ||
        !std::all_of(alias.begin(), alias.end(), [](unsigned char character) {
            return (character >= 'a' && character <= 'z') ||
                (character >= '0' && character <= '9') || character == '_' || character == '-';
        })) {
        throw std::runtime_error("Invalid storage root alias");
    }
    if (!options.storageRoots.emplace(alias,
        pulse::native::StorageRootGrant{value.substr(separator + 1), readOnly}).second) {
        throw std::runtime_error("Duplicate storage root alias: " + alias);
    }
}

Options parseOptions(int argc, char** argv) {
    Options options;
    for (int i = 1; i < argc; ++i) {
        const std::string argument = argv[i];
        auto next = [&]() -> std::string {
            if (i + 1 >= argc) throw std::runtime_error("Missing value for " + argument);
            return argv[++i];
        };
        if (argument == "--pcode") options.pcode = next();
        else if (argument == "--program-map") options.programMap = next();
        else if (argument == "--host") options.host = next();
        else if (argument == "--port") options.port = parsePort(next(), "--port", 65535);
        else if (argument == "--max-steps") options.maxSteps = parseBudget(next());
        else if (argument == "--max-file-bytes") options.maxFileBytes = parsePositiveSize(next(), "--max-file-bytes");
        else if (argument == "--debug") options.debug = true;
        else if (argument == "--storage-root") addStorageRoot(options, next(), true);
        else if (argument == "--writable-storage-root") addStorageRoot(options, next(), false);
        else if (argument == "--help") {
            std::cout << "Usage: pulse_native_service_host --pcode FILE --program-map FILE "
                         "[--host ADDRESS] [--port 0..65535] [--max-steps N] [--debug] "
                         "[--max-file-bytes N] [--storage-root ALIAS=ABSOLUTE_PATH] "
                         "[--writable-storage-root ALIAS=ABSOLUTE_PATH]\n";
            std::exit(0);
        } else throw std::runtime_error("Unknown option: " + argument);
    }
    if (options.pcode.empty() || options.programMap.empty()) {
        throw std::runtime_error("--pcode and --program-map are required");
    }
    if (options.host.empty()) throw std::runtime_error("--host must not be empty");
    return options;
}

void closeSocket(Socket socket) {
    if (socket == INVALID_SOCKET_VALUE) return;
#ifdef _WIN32
    closesocket(socket);
#else
    close(socket);
#endif
}

class SocketRuntime {
public:
    SocketRuntime() {
#ifdef _WIN32
        WSADATA data{};
        if (WSAStartup(MAKEWORD(2, 2), &data) != 0) throw std::runtime_error("WSAStartup failed");
#endif
    }
    ~SocketRuntime() {
#ifdef _WIN32
        WSACleanup();
#endif
    }
};

bool sendAll(Socket socket, const std::string& data) {
    size_t sent = 0;
    while (sent < data.size()) {
#ifdef _WIN32
        const int result = send(socket, data.data() + sent,
            static_cast<int>(std::min<size_t>(data.size() - sent, std::numeric_limits<int>::max())), 0);
#else
        const auto result = send(socket, data.data() + sent, data.size() - sent, 0);
#endif
        if (result <= 0) return false;
        sent += static_cast<size_t>(result);
    }
    return true;
}

std::string quoteJson(const std::string& value) {
    std::string result = "\"";
    for (const unsigned char c : value) {
        switch (c) {
            case '"': result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default:
                if (c < 0x20) {
                    static const char hex[] = "0123456789abcdef";
                    result += "\\u00";
                    result += hex[c >> 4];
                    result += hex[c & 0x0f];
                } else result += static_cast<char>(c);
        }
    }
    result += '"';
    return result;
}

struct ParsedRequest {
    pulse::native::HttpRequest request;
    std::string error;
    int errorStatus = 400;
};

ParsedRequest readRequest(Socket client, const sockaddr_in& peer, uint64_t maxBodyBytes) {
    ParsedRequest result;
    std::string buffer;
    constexpr size_t MAX_HEADER_BYTES = 32768;
    char chunk[8192];
    size_t headerEnd = std::string::npos;
    while ((headerEnd = buffer.find("\r\n\r\n")) == std::string::npos) {
#ifdef _WIN32
        const int received = recv(client, chunk, static_cast<int>(sizeof(chunk)), 0);
#else
        const auto received = recv(client, chunk, sizeof(chunk), 0);
#endif
        if (received <= 0) {
            result.error = "Incomplete HTTP request headers";
            return result;
        }
        buffer.append(chunk, static_cast<size_t>(received));
        if (buffer.size() > MAX_HEADER_BYTES) {
            result.error = "HTTP headers exceed the request limit";
            result.errorStatus = 413;
            return result;
        }
    }

    const std::string headers = buffer.substr(0, headerEnd);
    const size_t firstLineEnd = headers.find("\r\n");
    std::istringstream requestLine(headers.substr(0, firstLineEnd));
    std::string target;
    std::string version;
    if (!(requestLine >> result.request.method >> target >> version) ||
        version.rfind("HTTP/1.", 0) != 0 || target.empty() || target.front() != '/') {
        result.error = "Invalid HTTP request line";
        return result;
    }
    const auto query = target.find('?');
    result.request.path = target.substr(0, query);

    size_t contentLength = 0;
    bool hasContentLength = false;
    size_t lineStart = firstLineEnd == std::string::npos ? headers.size() : firstLineEnd + 2;
    while (lineStart < headers.size()) {
        const auto lineEnd = headers.find("\r\n", lineStart);
        const auto line = headers.substr(lineStart, lineEnd == std::string::npos ? std::string::npos : lineEnd - lineStart);
        const auto colon = line.find(':');
        if (colon == std::string::npos) {
            result.error = "Invalid HTTP header";
            return result;
        }
        const auto name = lower(line.substr(0, colon));
        auto value = line.substr(colon + 1);
        const auto valueStart = value.find_first_not_of(" \t");
        value = valueStart == std::string::npos ? std::string{} : value.substr(valueStart);
        if (name == "content-length") {
            try {
                const auto length = parsePort(value, "Content-Length", static_cast<int>(std::min<uint64_t>(maxBodyBytes, std::numeric_limits<int>::max())));
                contentLength = static_cast<size_t>(length);
                hasContentLength = true;
            } catch (const std::exception&) {
                result.error = "Invalid or oversized Content-Length";
                result.errorStatus = 413;
                return result;
            }
        } else if (name == "transfer-encoding" && lower(value) != "identity") {
            result.error = "Transfer-Encoding is not supported";
            result.errorStatus = 501;
            return result;
        }
        if (lineEnd == std::string::npos) break;
        lineStart = lineEnd + 2;
    }
    if (!hasContentLength && result.request.method != "GET" && result.request.method != "HEAD") {
        result.error = "Content-Length is required";
        return result;
    }
    if (contentLength > maxBodyBytes) {
        result.error = "HTTP body exceeds the request limit";
        result.errorStatus = 413;
        return result;
    }
    const size_t bodyStart = headerEnd + 4;
    while (buffer.size() - bodyStart < contentLength) {
#ifdef _WIN32
        const int received = recv(client, chunk, static_cast<int>(sizeof(chunk)), 0);
#else
        const auto received = recv(client, chunk, sizeof(chunk), 0);
#endif
        if (received <= 0) {
            result.error = "Incomplete HTTP request body";
            return result;
        }
        buffer.append(chunk, static_cast<size_t>(received));
    }
    result.request.body = buffer.substr(bodyStart, contentLength);
    char address[INET_ADDRSTRLEN]{};
    if (inet_ntop(AF_INET, &peer.sin_addr, address, sizeof(address))) result.request.peer = address;
    result.request.peerPort = ntohs(peer.sin_port);
    return result;
}

std::string statusText(int status) {
    switch (status) {
        case 200: return "OK";
        case 201: return "Created";
        case 202: return "Accepted";
        case 204: return "No Content";
        case 400: return "Bad Request";
        case 404: return "Not Found";
        case 405: return "Method Not Allowed";
        case 413: return "Payload Too Large";
        case 422: return "Unprocessable Entity";
        case 500: return "Internal Server Error";
        case 501: return "Not Implemented";
        case 503: return "Service Unavailable";
        default: return "Response";
    }
}

void sendResponse(Socket client, const pulse::native::HttpResponse& response) {
    std::ostringstream headers;
    headers << "HTTP/1.1 " << response.status << ' ' << statusText(response.status) << "\r\n"
            << "Content-Type: application/json; charset=utf-8\r\n"
            << "Cache-Control: no-store\r\n"
            << "Content-Length: " << response.jsonBody.size() << "\r\n"
            << "Connection: close\r\n\r\n";
    sendAll(client, headers.str());
    sendAll(client, response.jsonBody);
}

void sendError(Socket client, int status, const std::string& message) {
    sendResponse(client, pulse::native::HttpResponse{status, "{\"error\":" + quoteJson(message) + "}"});
}

Socket createListener(const std::string& host, int port, int& boundPort) {
    Socket listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listener == INVALID_SOCKET_VALUE) throw std::runtime_error("Unable to create HTTP socket");
    int reuse = 1;
    setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(static_cast<unsigned short>(port));
    if (inet_pton(AF_INET, host.c_str(), &address.sin_addr) != 1) {
        closeSocket(listener);
        throw std::runtime_error("--host must be an IPv4 address");
    }
    if (bind(listener, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0 || listen(listener, 16) != 0) {
        closeSocket(listener);
        throw std::runtime_error("Unable to bind or listen on the requested HTTP address");
    }
    sockaddr_in actual{};
#ifdef _WIN32
    int actualLength = sizeof(actual);
#else
    socklen_t actualLength = sizeof(actual);
#endif
    if (getsockname(listener, reinterpret_cast<sockaddr*>(&actual), &actualLength) != 0) {
        closeSocket(listener);
        throw std::runtime_error("Unable to read the HTTP listener address");
    }
    boundPort = ntohs(actual.sin_port);
    return listener;
}

void serve(Socket listener, const pulse::native::NativeService& service, uint64_t maxBodyBytes, uint64_t maxSteps) {
    while (!stopRequested) {
        fd_set readSet;
        FD_ZERO(&readSet);
        FD_SET(listener, &readSet);
        timeval timeout{};
        timeout.tv_sec = 0;
        timeout.tv_usec = 250000;
#ifdef _WIN32
        const int ready = select(0, &readSet, nullptr, nullptr, &timeout);
#else
        const int ready = select(listener + 1, &readSet, nullptr, nullptr, &timeout);
#endif
        if (ready <= 0 || !FD_ISSET(listener, &readSet)) continue;
        sockaddr_in peer{};
#ifdef _WIN32
        int peerLength = sizeof(peer);
#else
        socklen_t peerLength = sizeof(peer);
#endif
        const Socket client = accept(listener, reinterpret_cast<sockaddr*>(&peer), &peerLength);
        if (client == INVALID_SOCKET_VALUE) continue;
#ifdef _WIN32
        const DWORD timeoutMs = 10000;
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));
#else
        timeval receiveTimeout{};
        receiveTimeout.tv_sec = 10;
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &receiveTimeout, sizeof(receiveTimeout));
#endif
        const auto parsed = readRequest(client, peer, maxBodyBytes);
        if (!parsed.error.empty()) {
            sendError(client, parsed.errorStatus, parsed.error);
        } else if (parsed.request.method == "GET" && parsed.request.path == "/pmachine/service_host/status") {
            std::string filesystemSupported = "[";
            if (service.filesystemReadEnabled()) filesystemSupported += "\"filesystem.read\"";
            if (service.filesystemWriteEnabled()) {
                if (service.filesystemReadEnabled()) filesystemSupported += ',';
                filesystemSupported += "\"filesystem.write\"";
            }
            filesystemSupported += ']';
            const std::string capabilities = "{\"version\":1,\"profile\":\"desktop\",\"runtime\":\"native\","
                "\"filesystem\":" + std::string(service.filesystemReadEnabled() ? "true" : "false") +
                ",\"supported\":" + filesystemSupported + ",\"limits\":{\"maxBodyBytes\":1048576,"
                "\"maxResponseBytes\":1048576,\"maxSteps\":" +
                (maxSteps ? std::to_string(maxSteps) : "null") + "}}";
            sendResponse(client, pulse::native::HttpResponse{200,
                "{\"running\":true,\"serviceId\":" + quoteJson(service.serviceId()) +
                ",\"capabilities\":" + capabilities + "}"});
        } else {
            try {
                const auto response = service.dispatch(parsed.request);
                if (response.jsonBody.size() > 1048576) {
                    sendError(client, 503, "Native HTTP response exceeds 1048576 bytes");
                } else {
                    sendResponse(client, response);
                }
            } catch (const std::exception& error) {
                const auto* httpError = dynamic_cast<const pulse::native::HttpError*>(&error);
                sendError(client, httpError ? httpError->status() : 500, error.what());
            }
        }
        closeSocket(client);
    }
}

} // namespace

int main(int argc, char** argv) {
    try {
        const auto options = parseOptions(argc, argv);
        SocketRuntime socketRuntime;
        const pulse::native::NativeService service(
            pulse::native::readFile(options.pcode),
            pulse::native::readFile(options.programMap),
            options.maxSteps,
            options.storageRoots,
            options.maxFileBytes);
        if (options.debug) {
            service.debugDispatch(std::cin, std::cout);
            return 0;
        }
        int boundPort = 0;
        const Socket listener = createListener(options.host, options.port, boundPort);
        std::signal(SIGINT, requestStop);
        std::signal(SIGTERM, requestStop);
        std::cout << "LISTENING service=" << service.serviceId() << " runtime=native host=" << options.host
                  << " port=" << boundPort << std::endl;
        serve(listener, service, 1048576, options.maxSteps);
        closeSocket(listener);
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "[native-service-host] " << error.what() << std::endl;
        return 1;
    }
}
