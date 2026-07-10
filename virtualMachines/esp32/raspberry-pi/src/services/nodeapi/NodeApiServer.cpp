#include "services/nodeapi/NodeApiServer.h"

#include <algorithm>
#include <array>
#include <cerrno>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <regex>
#include <sstream>
#include <vector>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace pulse::services::nodeapi {

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

std::string toLower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}
}

NodeApiServer::NodeApiServer(const core::NodeConfig& config,
                             const pmachine::PmachineQueueBridge& bridge,
                             const bluetooth::BluetoothGateway& bluetooth,
                             const tts::PiperService& tts)
    : config_(config), bridge_(bridge), bluetooth_(bluetooth), tts_(tts) {}

NodeApiServer::~NodeApiServer() {
    stop();
}

bool NodeApiServer::start() {
    if (!config_.httpEnabled) {
        return false;
    }
    if (running_.exchange(true)) {
        return true;
    }

    if (!bindAndListen()) {
        running_.store(false);
        return false;
    }

    worker_ = std::thread(&NodeApiServer::runLoop, this);
    std::cout << "[node-api] listening on port " << boundPort_ << "\n";
    return true;
}

void NodeApiServer::stop() {
    if (!running_.exchange(false)) {
        return;
    }

    if (listenFd_ != static_cast<int>(kInvalidSocket)) {
        closeSocket(static_cast<SocketType>(listenFd_));
        listenFd_ = static_cast<int>(kInvalidSocket);
    }

    if (worker_.joinable()) {
        worker_.join();
    }
}

int NodeApiServer::port() const {
    return boundPort_ > 0 ? boundPort_ : config_.httpPort;
}

std::string NodeApiServer::trim(const std::string& value) {
    const auto first = std::find_if_not(value.begin(), value.end(), [](unsigned char c) {
        return std::isspace(c) != 0;
    });
    if (first == value.end()) return {};
    const auto last = std::find_if_not(value.rbegin(), value.rend(), [](unsigned char c) {
        return std::isspace(c) != 0;
    }).base();
    return std::string(first, last);
}

std::string NodeApiServer::jsonEscape(const std::string& value) {
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

std::string NodeApiServer::extractJsonString(const std::string& json, const std::string& key) {
    const std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    std::smatch match;
    if (std::regex_search(json, match, re) && match.size() > 1) {
        return match[1].str();
    }
    return {};
}

bool NodeApiServer::extractJsonBool(const std::string& json, const std::string& key, bool fallback) {
    const std::regex re("\\\"" + key + "\\\"\\s*:\\s*(true|false)", std::regex::icase);
    std::smatch match;
    if (std::regex_search(json, match, re) && match.size() > 1) {
        const std::string value = toLower(match[1].str());
        return value == "true";
    }
    return fallback;
}

int NodeApiServer::extractJsonInt(const std::string& json, const std::string& key, int fallback) {
    const std::regex re("\\\"" + key + "\\\"\\s*:\\s*(-?[0-9]+)");
    std::smatch match;
    if (std::regex_search(json, match, re) && match.size() > 1) {
        return std::atoi(match[1].str().c_str());
    }
    return fallback;
}

std::string NodeApiServer::urlDecode(const std::string& value) {
    std::string out;
    out.reserve(value.size());
    for (std::size_t i = 0; i < value.size(); ++i) {
        const char c = value[i];
        if (c == '%' && i + 2 < value.size()) {
            const std::string hex = value.substr(i + 1, 2);
            char* endPtr = nullptr;
            const long parsed = std::strtol(hex.c_str(), &endPtr, 16);
            if (endPtr != nullptr && *endPtr == '\0') {
                out.push_back(static_cast<char>(parsed));
                i += 2;
                continue;
            }
        }
        if (c == '+') {
            out.push_back(' ');
            continue;
        }
        out.push_back(c);
    }
    return out;
}

std::string NodeApiServer::getQueryValue(const std::string& query, const std::string& key) {
    std::istringstream stream(query);
    std::string token;
    while (std::getline(stream, token, '&')) {
        const std::size_t eqPos = token.find('=');
        const std::string lhs = urlDecode(eqPos == std::string::npos ? token : token.substr(0, eqPos));
        if (lhs != key) continue;
        const std::string rhs = (eqPos == std::string::npos) ? std::string{} : token.substr(eqPos + 1);
        return urlDecode(rhs);
    }
    return {};
}

std::string NodeApiServer::buildStatusText(int statusCode) {
    switch (statusCode) {
        case 200: return "OK";
        case 400: return "Bad Request";
        case 404: return "Not Found";
        case 405: return "Method Not Allowed";
        case 500: return "Internal Server Error";
        case 502: return "Bad Gateway";
        default: return "OK";
    }
}

std::string NodeApiServer::buildHttpResponse(int statusCode, const std::string& contentType, const std::string& body) {
    std::ostringstream response;
    response << "HTTP/1.1 " << statusCode << ' ' << buildStatusText(statusCode) << "\r\n";
    response << "Content-Type: " << contentType << "\r\n";
    response << "Content-Length: " << body.size() << "\r\n";
    response << "Connection: close\r\n\r\n";
    response << body;
    return response.str();
}

bool NodeApiServer::bindAndListen() {
#if defined(_WIN32)
    WSADATA data;
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) {
        std::cerr << "[node-api] WSAStartup failed\n";
        return false;
    }
#endif

    SocketType sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock == kInvalidSocket) {
        std::cerr << "[node-api] socket create failed\n";
        return false;
    }

    int reuse = 1;
    setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(static_cast<uint16_t>(config_.httpPort));

    if (bind(sock, reinterpret_cast<const sockaddr*>(&addr), sizeof(addr)) != 0) {
        if (config_.httpPort < 1024) {
            addr.sin_port = htons(8080);
            if (bind(sock, reinterpret_cast<const sockaddr*>(&addr), sizeof(addr)) == 0) {
                boundPort_ = 8080;
                std::cerr << "[node-api] unable to bind privileged port " << config_.httpPort
                          << ", using fallback port 8080\n";
            } else {
                std::cerr << "[node-api] bind failed for ports " << config_.httpPort << " and 8080\n";
                closeSocket(sock);
                return false;
            }
        } else {
            std::cerr << "[node-api] bind failed on port " << config_.httpPort << "\n";
            closeSocket(sock);
            return false;
        }
    } else {
        boundPort_ = config_.httpPort;
    }

    if (listen(sock, 16) != 0) {
        std::cerr << "[node-api] listen failed\n";
        closeSocket(sock);
        return false;
    }

    listenFd_ = static_cast<int>(sock);
    return true;
}

void NodeApiServer::runLoop() {
    while (running_.load()) {
        fd_set readSet;
        FD_ZERO(&readSet);
        FD_SET(static_cast<SocketType>(listenFd_), &readSet);

        timeval tv{};
        tv.tv_sec = 0;
        tv.tv_usec = 200000;

        const int ready = select(listenFd_ + 1, &readSet, nullptr, nullptr, &tv);
        if (ready <= 0) {
            continue;
        }

        sockaddr_in clientAddr{};
        socklen_t clientLen = sizeof(clientAddr);
        const SocketType client = accept(static_cast<SocketType>(listenFd_), reinterpret_cast<sockaddr*>(&clientAddr), &clientLen);
        if (client == kInvalidSocket) {
            continue;
        }

        handleClient(static_cast<int>(client));
        closeSocket(client);
    }
}

bool NodeApiServer::readRequest(int client, ParsedRequest* outRequest) const {
    if (outRequest == nullptr) return false;

    std::string data;
    data.reserve(2048);
    std::array<char, 1024> buffer{};
    std::size_t headerEnd = std::string::npos;

    while (true) {
        const int n = recv(static_cast<SocketType>(client), buffer.data(), static_cast<int>(buffer.size()), 0);
        if (n <= 0) return false;
        data.append(buffer.data(), static_cast<std::size_t>(n));
        headerEnd = data.find("\r\n\r\n");
        if (headerEnd != std::string::npos) break;
        if (data.size() > 64 * 1024) return false;
    }

    const std::string headerChunk = data.substr(0, headerEnd);
    std::istringstream stream(headerChunk);
    std::string requestLine;
    if (!std::getline(stream, requestLine)) return false;
    if (!requestLine.empty() && requestLine.back() == '\r') requestLine.pop_back();

    std::istringstream reqLineStream(requestLine);
    std::string target;
    std::string version;
    ParsedRequest request;
    if (!(reqLineStream >> request.method >> target >> version)) return false;

    const std::size_t qPos = target.find('?');
    request.path = qPos == std::string::npos ? target : target.substr(0, qPos);
    request.query = qPos == std::string::npos ? std::string{} : target.substr(qPos + 1);

    int contentLength = 0;
    std::string line;
    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        const std::size_t colonPos = line.find(':');
        if (colonPos == std::string::npos) continue;

        const std::string key = toLower(trim(line.substr(0, colonPos)));
        const std::string value = trim(line.substr(colonPos + 1));
        if (key == "content-length") {
            contentLength = std::atoi(value.c_str());
        }
    }

    const std::size_t bodyStart = headerEnd + 4;
    if (data.size() > bodyStart) {
        request.body = data.substr(bodyStart);
    }

    while (contentLength > static_cast<int>(request.body.size())) {
        const int n = recv(static_cast<SocketType>(client), buffer.data(), static_cast<int>(buffer.size()), 0);
        if (n <= 0) break;
        request.body.append(buffer.data(), static_cast<std::size_t>(n));
    }

    if (contentLength > 0 && request.body.size() > static_cast<std::size_t>(contentLength)) {
        request.body.resize(static_cast<std::size_t>(contentLength));
    }

    *outRequest = std::move(request);
    return true;
}

void NodeApiServer::handleClient(int client) {
    ParsedRequest request;
    if (!readRequest(client, &request)) {
        writeResponse(client, 400, "application/json", "{\"error\":\"invalid request\"}");
        return;
    }

    if (request.path == "/status") {
        if (request.method != "GET") {
            writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
            return;
        }
        handleStatus(client);
        return;
    }

    if (request.path == "/services/describe") {
        if (request.method != "GET") {
            writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
            return;
        }
        handleServicesDescribe(client);
        return;
    }

    if (request.path == "/BTConnect" || request.path == "/BRConnect") {
        if (request.method != "GET") {
            writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
            return;
        }
        handleBtConnect(client);
        return;
    }

    if (request.path == "/api/bluetooth/scan") {
        handleBluetoothScan(client, request);
        return;
    }

    if (request.path == "/api/bluetooth/connect") {
        handleBluetoothConnect(client, request);
        return;
    }

    if (request.path == "/api/tts/speak") {
        handleTtsSpeak(client, request);
        return;
    }

    if (request.path == "/pmachine/pcode_router_run") {
        handlePmachineRouteRun(client, request);
        return;
    }

    writeResponse(client, 404, "application/json", "{\"error\":\"not found\"}");
}

void NodeApiServer::handleStatus(int client) {
    std::vector<std::string> services = {
        "pmachine",
        "alert-router",
        "ffs"
    };

    if (config_.bluetoothEnabled) services.emplace_back("bluetooth-gateway");
    if (config_.piperEnabled) services.emplace_back("tts-piper");
    if (config_.doorbellEnabled) services.emplace_back("doorbell-alerts");

    std::ostringstream json;
    json << "{";
    json << "\"status\":\"ok\",";
    json << "\"hardware\":\"Raspberry Pi\",";
    json << "\"runtime\":\"cpp-pmachine-rpi\",";
    json << "\"nodeName\":\"" << jsonEscape(config_.nodeId) << "\",";
    json << "\"deviceRole\":\"" << jsonEscape(config_.role) << "\",";
    json << "\"services\":[";
    for (std::size_t i = 0; i < services.size(); ++i) {
        if (i > 0) json << ',';
        json << "\"" << jsonEscape(services[i]) << "\"";
    }
    json << "],";
    json << "\"nodeApiPort\":" << port();
    json << "}";

    writeResponse(client, 200, "application/json", json.str());
}

void NodeApiServer::handleServicesDescribe(int client) {
    std::ostringstream json;
    json << "{";
    json << "\"hardware\":\"Raspberry Pi\",";
    json << "\"nodeName\":\"" << jsonEscape(config_.nodeId) << "\",";
    json << "\"deviceRole\":\"" << jsonEscape(config_.role) << "\",";
    json << "\"runtime\":\"cpp-pmachine-rpi\",";
    json << "\"services\":[";
    json << "{\"name\":\"pmachine\",\"description\":\"PMachine mapper runtime bridge\",\"status\":\"up\",\"endpoint\":\"/pmachine/pcode_router_run\"}";
    if (config_.bluetoothEnabled) {
        json << ",{\"name\":\"bluetooth-gateway\",\"description\":\"Linux BlueZ gateway\",\"status\":\"up\"}";
    }
    if (config_.piperEnabled) {
        json << ",{\"name\":\"tts-piper\",\"description\":\"Piper text-to-speech\",\"status\":\"up\"}";
    }
    if (config_.doorbellEnabled) {
        json << ",{\"name\":\"doorbell-alerts\",\"description\":\"Doorbell alert router\",\"status\":\"up\"}";
    }
    json << "]";
    json << "}";

    writeResponse(client, 200, "application/json", json.str());
}

void NodeApiServer::handleBtConnect(int client) {
        const char* page = R"HTML(<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BTConnect</title>
    <style>
        body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
        .shell { max-width: 860px; margin: 32px auto; padding: 20px; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        .hint { color: #94a3b8; margin-bottom: 18px; }
        .card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
        .row { margin-bottom: 10px; }
        input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #020617; color: #e2e8f0; box-sizing: border-box; }
        button { margin-top: 8px; padding: 10px 14px; border: 0; border-radius: 8px; background: #0ea5e9; color: white; cursor: pointer; }
        .muted { color: #9ca3af; font-size: 13px; }
        .devices { display: grid; grid-template-columns: repeat(auto-fill,minmax(250px,1fr)); gap: 8px; }
        .device { border: 1px solid #334155; border-radius: 10px; padding: 10px; background: #020617; }
        .device h3 { margin: 0 0 6px; font-size: 14px; }
        .device .addr { color: #93c5fd; font-family: Consolas, monospace; font-size: 12px; }
        pre { white-space: pre-wrap; background: #020617; padding: 10px; border-radius: 8px; border: 1px solid #334155; }
    </style>
</head>
<body>
    <div class="shell">
        <h1>BTConnect</h1>
        <div class="hint">Scan Bluetooth devices (BLE + Classic) and connect from this Raspberry Pi node.</div>
        <div class="card">
            <div class="row"><strong>Node API:</strong> /api/bluetooth/scan, /api/bluetooth/connect</div>
            <div class="row"><button id="scanBtn">Scan BLE + Classic</button></div>
            <div class="row muted" id="scanMeta">No scan yet.</div>
            <div class="devices" id="devices"></div>
        </div>
        <div class="card">
            <div class="row"><strong>Audio / TTS:</strong> /api/tts/speak</div>
            <div class="row"><label for="ttsText">Speak text</label><input id="ttsText" value="Hello from Pulse Pi TTS" /></div>
            <button id="ttsBtn">Speak</button>
            <div class="muted">On Linux this uses Piper + aplay. On Windows host this is simulated.</div>
        </div>
        <div class="card">
            <div class="row"><label for="msg">Test mapper message</label><input id="msg" value="hello from BTConnect" /></div>
            <button id="runBtn">Run PMachine Mapper</button>
            <pre id="out">Idle</pre>
        </div>
    </div>
    <script>
        const devicesEl = document.getElementById('devices');
        const scanMeta = document.getElementById('scanMeta');
        const out = document.getElementById('out');

        function renderDevices(payload) {
            const devices = Array.isArray(payload && payload.devices) ? payload.devices : [];
            devicesEl.innerHTML = '';
            if (devices.length === 0) {
                devicesEl.innerHTML = '<div class="muted">No devices found.</div>';
                return;
            }
            for (const d of devices) {
                const card = document.createElement('div');
                card.className = 'device';
                const name = d.name || 'Unknown device';
                const address = d.address || '';
                const transport = d.transport || 'unknown';
                card.innerHTML = '<h3>' + name + '</h3>' +
                    '<div class="addr">' + address + '</div>' +
                    '<div class="muted">transport: ' + transport + '</div>';
                const btn = document.createElement('button');
                btn.textContent = 'Connect';
                btn.addEventListener('click', async () => {
                    out.textContent = 'Connecting to ' + address + '...';
                    try {
                        const res = await fetch('/api/bluetooth/connect', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ address })
                        });
                        out.textContent = 'HTTP ' + res.status + '\n' + await res.text();
                    } catch (err) {
                        out.textContent = 'Connect error: ' + (err && err.message ? err.message : String(err));
                    }
                });
                card.appendChild(btn);
                devicesEl.appendChild(card);
            }
        }

        document.getElementById('scanBtn').addEventListener('click', async () => {
            scanMeta.textContent = 'Scanning...';
            devicesEl.innerHTML = '';
            try {
                const res = await fetch('/api/bluetooth/scan', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ ble: true, classic: true, timeoutSec: 8 })
                });
                const text = await res.text();
                let payload = null;
                try { payload = JSON.parse(text); } catch {}
                scanMeta.textContent = 'HTTP ' + res.status + (payload && payload.status ? ' status=' + payload.status : '');
                renderDevices(payload || {});
                if (!payload) out.textContent = text;
            } catch (err) {
                scanMeta.textContent = 'Scan error';
                out.textContent = 'Scan error: ' + (err && err.message ? err.message : String(err));
            }
        });

        document.getElementById('ttsBtn').addEventListener('click', async () => {
            const text = document.getElementById('ttsText').value || '';
            out.textContent = 'Speaking...';
            try {
                const res = await fetch('/api/tts/speak', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                out.textContent = 'HTTP ' + res.status + '\n' + await res.text();
            } catch (err) {
                out.textContent = 'TTS error: ' + (err && err.message ? err.message : String(err));
            }
        });

        document.getElementById('runBtn').addEventListener('click', async () => {
            const message = document.getElementById('msg').value || '';
            out.textContent = 'Running...';
            try {
                const url = '/pmachine/pcode_router_run?message=' + encodeURIComponent(message);
                const res = await fetch(url);
                const text = await res.text();
                out.textContent = 'HTTP ' + res.status + '\n' + text;
            } catch (err) {
                out.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
            }
        });
    </script>
</body>
</html>)HTML";

        writeResponse(client, 200, "text/html", page);
}

void NodeApiServer::handleBluetoothScan(int client, const ParsedRequest& request) {
    if (request.method != "POST" && request.method != "GET") {
        writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
        return;
    }

    const bool ble = extractJsonBool(request.body, "ble", true);
    const bool classic = extractJsonBool(request.body, "classic", true);
    const int timeoutSec = extractJsonInt(request.body, "timeoutSec", 8);
    const std::string resultJson = bluetooth_.scanDevicesJson(ble, classic, timeoutSec);
    writeResponse(client, 200, "application/json", resultJson);
}

void NodeApiServer::handleBluetoothConnect(int client, const ParsedRequest& request) {
    if (request.method != "POST") {
        writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
        return;
    }

    std::string address = extractJsonString(request.body, "address");
    if (address.empty()) {
        address = getQueryValue(request.query, "address");
    }
    if (address.empty()) {
        writeResponse(client, 400, "application/json", "{\"error\":\"address is required\"}");
        return;
    }

    std::string detail;
    const bool ok = bluetooth_.connectDevice(address, &detail);
    std::ostringstream json;
    json << "{";
    json << "\"status\":\"" << (ok ? "ok" : "error") << "\",";
    json << "\"address\":\"" << jsonEscape(address) << "\",";
    json << "\"detail\":\"" << jsonEscape(detail) << "\"";
    json << "}";
    writeResponse(client, ok ? 200 : 502, "application/json", json.str());
}

void NodeApiServer::handleTtsSpeak(int client, const ParsedRequest& request) {
    if (request.method != "POST") {
        writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
        return;
    }

    std::string text = extractJsonString(request.body, "text");
    if (text.empty()) {
        text = getQueryValue(request.query, "text");
    }
    if (text.empty()) {
        writeResponse(client, 400, "application/json", "{\"error\":\"text is required\"}");
        return;
    }

    tts_.speak(text);

    std::ostringstream json;
    json << "{";
    json << "\"status\":\"ok\",";
    json << "\"text\":\"" << jsonEscape(text) << "\"";
    json << "}";
    writeResponse(client, 200, "application/json", json.str());
}

void NodeApiServer::handlePmachineRouteRun(int client, const ParsedRequest& request) {
    if (request.method != "GET" && request.method != "POST") {
        writeResponse(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
        return;
    }

    std::string pcodeFile = getQueryValue(request.query, "file");
    std::string programMap = getQueryValue(request.query, "programMap");
    std::string inputQueue = getQueryValue(request.query, "inputQueue");
    std::string message = getQueryValue(request.query, "message");

    if (!request.body.empty()) {
        if (pcodeFile.empty()) pcodeFile = extractJsonString(request.body, "file");
        if (programMap.empty()) programMap = extractJsonString(request.body, "programMap");
        if (inputQueue.empty()) inputQueue = extractJsonString(request.body, "inputQueue");
        if (message.empty()) message = extractJsonString(request.body, "message");
    }

    if (pcodeFile.empty()) pcodeFile = config_.pmachinePcodeFile;
    if (programMap.empty()) programMap = config_.pmachineProgramMap;
    if (inputQueue.empty()) inputQueue = config_.alertQueue;

    if (message.empty()) {
        writeResponse(client, 400, "application/json", "{\"error\":\"message is required\"}");
        return;
    }

    std::string bridgeResponse;
    const bool ok = bridge_.runMapperRequest(pcodeFile, programMap, inputQueue, message, &bridgeResponse, true);
    if (!ok || bridgeResponse.empty()) {
        writeResponse(client,
                      502,
                      "application/json",
                      "{\"error\":\"pmachine invocation failed\",\"target\":\"unavailable\"}");
        return;
    }

    writeResponse(client, 200, "application/json", bridgeResponse);
}

void NodeApiServer::writeResponse(int client,
                                  int statusCode,
                                  const std::string& contentType,
                                  const std::string& body) const {
    const std::string response = buildHttpResponse(statusCode, contentType, body);
    send(static_cast<SocketType>(client), response.c_str(), static_cast<int>(response.size()), 0);
}

} // namespace pulse::services::nodeapi
