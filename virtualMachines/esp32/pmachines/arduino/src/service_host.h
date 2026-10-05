#pragma once

#if defined(ESP32)
#include <ArduinoJson.h>
#include <WiFiUdp.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "pmachine.h"

namespace pmachine {

class ServiceHost {
public:
    struct Unit {
        std::vector<PInstruction> instructions;
        std::map<std::string, std::vector<std::string>> signatures;
        std::map<std::string, uint8_t> tableCapacities;
        bool hasTableDeclarations = false;
        uint32_t interval = 0;
    };
    ServiceHost();
    bool install(Unit service, Unit daemon, const std::string& id, uint16_t port,
                 uint32_t ttl, uint32_t heartbeat, std::string& error);
    bool stop(std::string& error);
    bool dispatch(const std::string& method, const std::string& path, const std::string& body,
                  const std::string& peer, const std::string& query,
                  int& status, std::string& response);
    std::string status();
    static bool parseUnit(const std::string& pcode, const JsonDocument& map,
                          const char* kind, Unit& unit, std::string& error);
private:
    struct Entry { std::string json; uint64_t deadline; };
    using Table = std::map<std::string, Entry>;
    PMachine machine;
    Unit service, daemon;
    std::map<std::string, Table> tables;
    std::map<std::string, uint8_t> tableCapacities;
    bool hasTableDeclarations = false;
    SemaphoreHandle_t mutex = nullptr;
    TaskHandle_t task = nullptr;
    WiFiUDP udp;
    bool active = false;
    uint16_t udpPort = 0;
    uint32_t ttl = 180000, sequence = 0;
    uint64_t nextTick = 0, observedAt = 0;
    std::string collectorId, bootId, method, path, body, peer, query, lastError;
    uint16_t peerPort = 0;
    int responseStatus = 200;
    static void worker(void* context);
    static bool call(const std::string&, const std::vector<HostValue>&, HostValue&, std::string&, void*);
    bool invoke(const std::string&, const std::vector<HostValue>&, HostValue&, std::string&);
    bool execute(const Unit&, std::string& response);
    bool fail(const std::string& error, std::string& out, int status = 400);
    size_t expire(Table&);
};

} // namespace pmachine
#endif
