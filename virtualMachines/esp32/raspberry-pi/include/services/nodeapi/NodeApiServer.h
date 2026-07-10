#pragma once

#include <atomic>
#include <string>
#include <thread>

#include "core/Types.h"
#include "services/bluetooth/BluetoothGateway.h"
#include "services/pmachine/PmachineQueueBridge.h"
#include "services/tts/PiperService.h"

namespace pulse::services::nodeapi {

class NodeApiServer {
public:
    NodeApiServer(const core::NodeConfig& config,
                  const pmachine::PmachineQueueBridge& bridge,
                  const bluetooth::BluetoothGateway& bluetooth,
                  const tts::PiperService& tts);
    ~NodeApiServer();

    bool start();
    void stop();

    int port() const;

private:
    struct ParsedRequest {
        std::string method;
        std::string path;
        std::string query;
        std::string body;
    };

    static std::string trim(const std::string& value);
    static std::string jsonEscape(const std::string& value);
    static std::string extractJsonString(const std::string& json, const std::string& key);
    static bool extractJsonBool(const std::string& json, const std::string& key, bool fallback);
    static int extractJsonInt(const std::string& json, const std::string& key, int fallback);
    static std::string urlDecode(const std::string& value);
    static std::string getQueryValue(const std::string& query, const std::string& key);
    static std::string buildHttpResponse(int statusCode, const std::string& contentType, const std::string& body);
    static std::string buildStatusText(int statusCode);

    bool bindAndListen();
    void runLoop();
    bool readRequest(int client, ParsedRequest* outRequest) const;
    void handleClient(int client);
    void handleStatus(int client);
    void handleServicesDescribe(int client);
    void handleBtConnect(int client);
    void handleBluetoothScan(int client, const ParsedRequest& request);
    void handleBluetoothConnect(int client, const ParsedRequest& request);
    void handleTtsSpeak(int client, const ParsedRequest& request);
    void handlePmachineRouteRun(int client, const ParsedRequest& request);
    void writeResponse(int client, int statusCode, const std::string& contentType, const std::string& body) const;

    core::NodeConfig config_;
    const pmachine::PmachineQueueBridge& bridge_;
    const bluetooth::BluetoothGateway& bluetooth_;
    const tts::PiperService& tts_;
    std::atomic<bool> running_{false};
    std::thread worker_;
    int listenFd_ = -1;
    int boundPort_ = -1;
};

} // namespace pulse::services::nodeapi
