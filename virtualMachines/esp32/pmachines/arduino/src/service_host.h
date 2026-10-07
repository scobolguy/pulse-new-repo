#pragma once

#if defined(ESP32)
#include <ArduinoJson.h>
#include <WiFiUdp.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "pmachine.h"
#include "network_bindings.h"
#include "hosted_image.h"
#include "host_cache.h"
#include <memory>
#include <array>
#include <atomic>

namespace pmachine {

class ServiceHost {
public:
    struct Unit {
        std::unique_ptr<std::deque<PInstruction>> instructions;
        std::shared_ptr<HostedImage> image;
        std::map<std::string, std::vector<std::string>> signatures;
        std::map<std::string, uint8_t> tableCapacities;
        std::map<std::string, std::map<std::string, std::string>> cacheSchemas;
        bool hasTableDeclarations = false;
        uint32_t interval = 0;
        std::vector<std::pair<std::string, std::string>> endpoints;
    };
    struct Context;
    // A daemon may own one UDP port; its datagrams trigger that daemon (method "UDP").
    struct DaemonSpec { Unit unit; uint16_t udpPort = 0; std::string multicastGroup; };
    static constexpr size_t DAEMON_LIMIT = 3;
    ServiceHost();
    // Legacy shape: one daemon; the service owns the required UDP port.
    bool install(Unit service, Unit daemon, const std::string& id, uint16_t port,
                 uint32_t ttl, uint32_t heartbeat, std::string& error,
                 JsonVariantConst networkPeers = JsonVariantConst());
    // Shared-context shape: 1..3 daemons, with six total image leases across two contexts.
    bool install(Unit service, std::vector<DaemonSpec> daemons, const std::string& id, uint16_t port,
                 uint32_t ttl, uint32_t heartbeat, std::string& error,
                 JsonVariantConst networkPeers = JsonVariantConst());
    bool stop(std::string& error, const std::string& id = "");
    struct HttpEvent {
        std::string method, path, body, peer, query, response;
        uint64_t observedAt = 0, deadline = 0, order = 0;
        int status = 200;
        const char* errorText = nullptr;
        bool ok = false, started = false;
        std::shared_ptr<Context> owner;
        std::atomic<bool> ready{false}, abandoned{false}, submitted{false};
    };
    std::shared_ptr<HttpEvent> enqueue(const std::string& method, const std::string& path,
                                      const std::string& body, const std::string& peer,
                                      const std::string& query, int& status, std::string& error);
    std::string status(const std::string& id = "");
    bool handles(const std::string& method, const std::string& path);
    static bool parseUnit(const std::string& pcode, const JsonDocument& map,
                          const char* kind, Unit& unit, std::string& error);
    bool prepare(std::string& error);
    static bool loadImage(FederatedFileSystem& ffs, const String& path, const JsonDocument& map,
                          const char* kind, const char* key, const char* keyId,
                          Unit& unit, std::string& error);
private:
    struct Entry { std::string json; uint64_t deadline; };
    using Table = std::map<std::string, Entry>;
    PMachine machine;
    NetworkBindings network;
    SemaphoreHandle_t mutex = nullptr;
    SemaphoreHandle_t ingressMutex = nullptr;
    static constexpr size_t HTTP_EVENT_LIMIT = 3;
    std::array<std::shared_ptr<HttpEvent>, HTTP_EVENT_LIMIT> httpEvents;
    uint64_t nextHttpOrder = 0;
    TaskHandle_t task = nullptr;
    std::atomic<bool> active{false};
    uint64_t observedAt = 0;
    std::string method, path, body, peer, query;
    uint16_t peerPort = 0;
    WiFiUDP* eventUdp = nullptr;
    uint64_t invocationStartedAt = 0;
    int responseStatus = 200;
    bool jsonNoMemory = false;
    struct JsonMetrics {
        uint32_t parses = 0, parseFailures = 0, parseUs = 0;
        uint32_t serializations = 0, serializationFailures = 0;
        uint32_t measureUs = 0, writeUs = 0;
        size_t inputBytes = 0, outputBytes = 0;
    } jsonMetrics;
public:
    struct Daemon {
        Unit unit;
        uint16_t udpPort = 0;
        std::string multicastGroup;
        std::unique_ptr<WiFiUDP> udp;
        uint64_t nextTick = 0;
        uint32_t timerRuns = 0, udpEvents = 0, failures = 0, droppedDatagrams = 0, shedDatagrams = 0;
        std::string lastError;
    };
    struct Context {
        Unit service;
        std::array<Daemon, DAEMON_LIMIT> daemons;
        size_t daemonCount = 0, nextSource = 0;
        std::map<std::string, Table> tables;
        std::unique_ptr<HostCacheStore> caches{new LocalHostCacheStore()};
        NetworkBindings::Session network;
        WiFiUDP udp;
        uint16_t udpPort = 0;
        uint32_t ttl = 180000, sequence = 0;
        uint64_t nextTick = 0, httpInvocations = 0, udpInvocations = 0, daemonInvocations = 0;
        std::string collectorId, bootId, lastError;
        JsonMetrics lastHttpJsonMetrics;
        bool installed = true;
    };
private:
    static constexpr size_t SERVICE_LIMIT = 2;
    std::array<std::shared_ptr<Context>, SERVICE_LIMIT> services;
    std::shared_ptr<Context> current;
    size_t nextBackgroundService = 0;
    std::string hostError;
    const char* currentBinding = "";
    enum class SerializeResult { ok, tooLarge, noMemory };
    bool parseJson(const std::string&, JsonDocument&);
    bool object(const std::string&, JsonDocument&);
    SerializeResult serialize(const JsonDocument&, std::string&);
    SerializeResult serializeValue(JsonVariantConst, bool overflowed, std::string&);
    static void worker(void* context);
    static bool call(const std::string&, const std::vector<HostValue>&, HostValue&, std::string&, void*);
    bool invoke(const std::string&, const std::vector<HostValue>&, HostValue&, std::string&);
    bool execute(const Unit&, std::string& response);
    bool fail(const std::string& error, std::string& out, int status = 400);
    size_t expire(Table&);
    static bool validateUnit(const JsonDocument& map, const char* kind, Unit& unit, std::string& error);
    std::shared_ptr<HttpEvent> takeHttpEvent();
    void stopHttpEvents(const std::string& id = "");
    void executeHttpEvent(const std::shared_ptr<HttpEvent>& event);
    bool pollUdpEvent();
    void daemonDiagnostics(JsonArray list, const Context& context);
    bool runDaemon(Daemon& daemon);
    bool backgroundTurn(Context& context);
    void describe(JsonObject doc, const Context& context, bool details = true);
};

} // namespace pmachine
#endif
