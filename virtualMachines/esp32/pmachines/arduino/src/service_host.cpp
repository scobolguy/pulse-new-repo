#include "service_host.h"
#include "bounded_text.h"
#include "async_diagnostics.h"
#if defined(ESP32)
#include <WiFi.h>
#include <lwip/sockets.h>
#include <fcntl.h>
#include <esp_timer.h>
#include <esp_system.h>
#include <esp_heap_caps.h>
#include <limits>
#include <new>
#include <stdexcept>

namespace pmachine {
namespace {
class OwnedDaemonUdp : public WiFiUDP {
public:
    bool beginOwned(uint16_t port, const std::string& group) {
        socketHandle = socket(AF_INET, SOCK_DGRAM, 0);
        if (socketHandle < 0) return false;
        sockaddr_in local{};
        local.sin_family = AF_INET; local.sin_port = htons(port); local.sin_addr.s_addr = INADDR_ANY;
        if (fcntl(socketHandle, F_SETFL, O_NONBLOCK) < 0 ||
            bind(socketHandle, reinterpret_cast<sockaddr*>(&local), sizeof(local)) < 0) {
            stop(); return false;
        }
        if (!group.empty()) {
            IPAddress address;
            if (WiFi.status() != WL_CONNECTED || !address.fromString(group.c_str())) { stop(); return false; }
            membership.imr_interface.s_addr = static_cast<uint32_t>(WiFi.localIP());
            membership.imr_multiaddr.s_addr = static_cast<uint32_t>(address);
            if (setsockopt(socketHandle, IPPROTO_IP, IP_ADD_MEMBERSHIP, &membership, sizeof(membership)) < 0) {
                stop(); return false;
            }
            joined = true;
        }
        return true;
    }
    void stop() override {
        if (socketHandle >= 0) {
            if (joined) setsockopt(socketHandle, IPPROTO_IP, IP_DROP_MEMBERSHIP, &membership, sizeof(membership));
            close(socketHandle);
        }
        socketHandle = -1; joined = false; packetSize = 0;
    }
    int parsePacket() override {
        if (socketHandle < 0) return 0;
        // Peek only the ingress bound + one byte: oversized datagrams never allocate a receive buffer.
        uint8_t preview[1025];
        socklen_t length = sizeof(receivedPeer);
        packetSize = recvfrom(socketHandle, preview, sizeof(preview), MSG_PEEK | MSG_DONTWAIT,
            reinterpret_cast<sockaddr*>(&receivedPeer), &length);
        if (packetSize == 0) return 1; // Route an empty datagram through the explicit incomplete/drop counter.
        return packetSize > 0 ? packetSize : 0;
    }
    int available() override { return packetSize > 0 ? packetSize : 0; }
    int read(unsigned char* data, size_t length) override {
        if (socketHandle < 0) return -1;
        const int count = recv(socketHandle, data, length, MSG_DONTWAIT);
        packetSize = 0; return count;
    }
    int read(char* data, size_t length) override { return read(reinterpret_cast<unsigned char*>(data), length); }
    int read() override { uint8_t byte; return read(&byte, 1) == 1 ? byte : -1; }
    int peek() override {
        uint8_t byte;
        return socketHandle >= 0 && recv(socketHandle, &byte, 1, MSG_PEEK | MSG_DONTWAIT) == 1 ? byte : -1;
    }
    void flush() override {
        uint8_t discarded;
        if (socketHandle >= 0) recv(socketHandle, &discarded, 1, MSG_DONTWAIT);
        packetSize = 0;
    }
    IPAddress remoteIP() override { return IPAddress(receivedPeer.sin_addr.s_addr); }
    uint16_t remotePort() override { return ntohs(receivedPeer.sin_port); }
    int beginPacket(IPAddress ip, uint16_t port) override {
        sendPeer = sockaddr_in{};
        sendPeer.sin_family = AF_INET; sendPeer.sin_port = htons(port);
        sendPeer.sin_addr.s_addr = static_cast<uint32_t>(ip);
        sent = false; packetStarted = socketHandle >= 0 && port != 0;
        return packetStarted;
    }
    int beginPacket(const char* ip, uint16_t port) override {
        IPAddress address;
        return address.fromString(ip) ? beginPacket(address, port) : 0;
    }
    size_t write(const uint8_t* data, size_t length) override {
        if (!packetStarted || sent || length > 2048) return 0;
        const int count = sendto(socketHandle, data, length, MSG_DONTWAIT,
            reinterpret_cast<sockaddr*>(&sendPeer), sizeof(sendPeer));
        sent = count >= 0 && static_cast<size_t>(count) == length;
        return count > 0 ? static_cast<size_t>(count) : 0;
    }
    size_t write(uint8_t byte) override { return write(&byte, 1); }
    int endPacket() override { packetStarted = false; return sent; }
    ~OwnedDaemonUdp() { stop(); }
private:
    int socketHandle = -1, packetSize = 0;
    ip_mreq membership{};
    sockaddr_in receivedPeer{}, sendPeer{};
    bool joined = false, packetStarted = false, sent = false;
};
constexpr size_t BODY_LIMIT = 2048, RESPONSE_LIMIT = 20480, STORAGE_LIMIT = 16384;
// Daemon datagrams above this size are dropped; below the heap floor they are shed.
constexpr size_t DAEMON_DATAGRAM_LIMIT = 1024, DAEMON_UDP_HEAP_FLOOR = 8192;
// Two installed contexts, up to four images each, with six image leases total;
// failed installations return their slots.
std::array<HostedImage, 6> hostedImages;
std::array<std::atomic<bool>, 6> hostedImageUsed{};
std::shared_ptr<HostedImage> reserveHostedImage() {
    for (size_t index = 0; index < hostedImages.size(); ++index) {
        bool expected = false;
        if (!hostedImageUsed[index].compare_exchange_strong(expected, true)) continue;
        return std::shared_ptr<HostedImage>(&hostedImages[index], [index](HostedImage* image) {
            image->reset();
            hostedImageUsed[index].store(false);
        });
    }
    return nullptr;
}
uint64_t now() { return static_cast<uint64_t>(esp_timer_get_time()) / 1000; }
struct Binding { const char* name; const char* args; bool text; };
struct SemaphoreRelease {
    SemaphoreHandle_t handle;
    ~SemaphoreRelease() { if (handle) xSemaphoreGive(handle); }
};
const Binding bindings[] = {
    {"clock", "", false}, {"event_body", "", true}, {"event_bytes", "", true}, {"event_peer", "", true},
    {"event_port", "", false}, {"event_method", "", true}, {"event_path", "", true},
    {"event_query", "s", true},
    {"collector_id", "", true}, {"boot_id", "", true}, {"next_sequence", "", false},
    {"observation_ttl", "", false}, {"announcement", "ss", true},
    {"json_text", "ss", true}, {"json_value", "ss", true}, {"json_integer", "ss", false},
    {"json_path_text", "ss", true}, {"json_path_integer", "ss", false},
    {"buffer_json_path_text", "is", true}, {"buffer_json_path_integer", "is", false},
    {"text_header", "ss", true}, {"text_lower", "s", true},
    {"text_index", "ss", false}, {"text_slice", "sii", true},
    {"json_set", "ssv", true}, {"json_embed", "sss", true},
    {"json_merge", "ss", true}, {"json_append", "ssv", true}, {"raise_error", "s", false},
    {"table_get", "ss", true}, {"table_put", "sssi", false},
    {"table_expire", "s", false}, {"table_snapshot", "ssi", true},
    {"table_snapshot_values", "ssi", true},
    {"cache_get", "ss", true}, {"cache_put", "sssi", false}, {"cache_remove", "ss", false},
    {"cache_next", "ss", true}, {"cache_count", "s", false}, {"cache_snapshot", "sss", true},
    {"udp_reply", "s", false}, {"http_status", "i", false},
    {"bytes_from_text", "s", true}, {"bytes_text", "s", true},
    {"bytes_length", "s", false}, {"bytes_get", "si", false},
    {"bytes_append", "si", true}, {"bytes_slice", "sii", true},
    {"bytes_join", "ss", true},
    {"bytes_crc32", "s", true}, {"bytes_aes_ecb_decrypt", "ss", true},
    {"bytes_aes_gcm_decrypt", "sssss", true},
    {"buffer_create", "i", false}, {"buffer_append", "ii", false},
    {"buffer_length", "i", false}, {"buffer_get", "ii", false}, {"buffer_set", "iii", false},
    {"buffer_hex", "i", true}, {"buffer_text", "i", true}, {"buffer_release", "i", false},
    {"byte_xor", "ii", false}, {"tcp_exchange", "sisiii", true},
    {"tcp_exchange_buffer", "sisiii", false},
    {"udp_exchange", "sisii", true}
};
const Binding* binding(const std::string& symbol) {
    if (symbol.rfind("host.", 0) != 0) return nullptr;
    for (const auto& item : bindings) if (symbol.substr(5) == item.name) return &item;
    return nullptr;
}
bool identifier(const std::string& text) {
    return !text.empty() && text.size() <= 256 && text.find_first_not_of(" \t\r\n") != std::string::npos;
}
}

ServiceHost::ServiceHost() {
    machine.setHostCallHook(call, this);
}

bool ServiceHost::parseJson(const std::string& json, JsonDocument& doc) {
    const uint32_t started = micros();
    const auto error = deserializeJson(doc, json);
    jsonNoMemory = error == DeserializationError::NoMemory;
    const uint32_t elapsed = micros() - started;
    ++jsonMetrics.parses; jsonMetrics.inputBytes += json.size(); jsonMetrics.parseUs += elapsed;
    if (error) ++jsonMetrics.parseFailures;
    PULSE_ASYNC_TRACE("JSON parse binding=%s bytes=%u elapsedUs=%lu error=%s overflow=%d largest=%u",
        currentBinding, static_cast<unsigned>(json.size()), static_cast<unsigned long>(elapsed),
        error.c_str(), doc.overflowed(), static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
    return !error;
}

bool ServiceHost::object(const std::string& json, JsonDocument& doc) {
    if (!parseJson(json, doc)) return false;
    if (doc.is<JsonObject>()) return true;
    ++jsonMetrics.parseFailures;
    PULSE_ASYNC_TRACE("JSON object type mismatch binding=%s bytes=%u", currentBinding,
        static_cast<unsigned>(json.size()));
    return false;
}

ServiceHost::SerializeResult ServiceHost::serialize(const JsonDocument& doc, std::string& out) {
    return serializeValue(doc.as<JsonVariantConst>(), doc.overflowed(), out);
}

ServiceHost::SerializeResult ServiceHost::serializeValue(JsonVariantConst value, bool overflowed,
                                                         std::string& out) {
    ++jsonMetrics.serializations;
    const uint32_t measureStarted = micros();
    const size_t size = measureJson(value);
    const uint32_t measureUs = micros() - measureStarted;
    jsonMetrics.measureUs += measureUs;
    SerializeResult result = size > RESPONSE_LIMIT ? SerializeResult::tooLarge
        : (overflowed ? SerializeResult::noMemory : SerializeResult::ok);
    const size_t capacityBefore = out.capacity();
    const uint32_t writeStarted = micros();
    size_t written = 0;
    if (result == SerializeResult::ok) {
        out.clear();
        try {
            out.reserve(size);
            written = serializeJson(value, out);
            if (written != size) result = SerializeResult::noMemory;
        } catch (const std::bad_alloc&) {
            result = SerializeResult::noMemory;
        }
    }
    const uint32_t writeUs = micros() - writeStarted;
    jsonMetrics.writeUs += writeUs; jsonMetrics.outputBytes += written;
    if (result != SerializeResult::ok) ++jsonMetrics.serializationFailures;
    PULSE_ASYNC_TRACE("JSON serialize binding=%s expected=%u written=%u measureUs=%lu writeUs=%lu capacity=%u->%u result=%d overflow=%d largest=%u",
        currentBinding, static_cast<unsigned>(size), static_cast<unsigned>(written),
        static_cast<unsigned long>(measureUs), static_cast<unsigned long>(writeUs),
        static_cast<unsigned>(capacityBefore), static_cast<unsigned>(out.capacity()),
        static_cast<int>(result), overflowed,
        static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
    return result;
}

bool ServiceHost::parseUnit(const std::string& pcode, const JsonDocument& map,
                           const char* kind, Unit& out, std::string& error) {
    if (pcode.empty() || pcode.size() > 8192 || map["hostBindingsVersion"] != 1
        || std::string(map["runtimeUnit"]["kind"] | "") != kind) {
        error = "Unsupported hosted unit or artifact size"; return false;
    }
    bool target = false;
    for (JsonVariantConst item : map["targets"].as<JsonArrayConst>())
        if (std::string(item.as<const char*>() ? item.as<const char*>() : "") == "esp32") target = true;
    if (!target) { error = "Hosted artifact does not target ESP32"; return false; }
    const size_t lines = 1 + std::count(pcode.begin(), pcode.end(), '\n');
    const size_t instructionBytes = lines * sizeof(PInstruction);
    Serial.printf("[SERVICE-HOST] Parsing %u bytes, %u lines, %u instruction bytes; heap=%u largest=%u\n",
        static_cast<unsigned>(pcode.size()), static_cast<unsigned>(lines),
        static_cast<unsigned>(instructionBytes), ESP.getFreeHeap(),
        static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
    if (ESP.getFreeHeap() < instructionBytes + 32768
        || heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) < 16384) {
        error = "Insufficient heap to parse hosted instructions safely"; return false;
    }
    try {
        out.instructions.reset(new std::deque<PInstruction>(loadHostedTextPCode(pcode)));
    } catch (const std::bad_alloc&) {
        Serial.printf("[SERVICE-HOST] Instruction allocation failed; heap=%u largest=%u\n",
            ESP.getFreeHeap(),
            static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
        error = "Hosted instruction allocation failed"; return false;
    }
    if (out.instructions->empty() || out.instructions->size() > 512) {
        error = "Hosted instruction capacity exceeded"; return false;
    }
    return validateUnit(map, kind, out, error);
}

bool ServiceHost::loadImage(FederatedFileSystem& ffs, const String& path, const JsonDocument& map,
                            const char* kind, const char* key, const char* keyId,
                            Unit& out, std::string& error) {
    const char* stage = "image-cache";
    try {
        out.image = reserveHostedImage();
        if (!out.image) { error = "Hosted image capacity exceeded"; return false; }
        stage = "image-open";
        if (!out.image->open(ffs, path, map, key, keyId, error)) return false;
        stage = "image-metadata";
        return validateUnit(map, kind, out, error);
    } catch (const std::bad_alloc&) {
        Serial.printf("[SERVICE-HOST] Install allocation failed unit=%s stage=%s cacheBytes=%u heap=%u largest=%u\n",
            kind, stage, static_cast<unsigned>(sizeof(HostedImage)), ESP.getFreeHeap(),
            static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
        error = "Hosted image cache or metadata allocation failed"; return false;
    }
}

bool ServiceHost::validateUnit(const JsonDocument& map, const char* kind, Unit& out, std::string& error) {
    if (map["hostBindingsVersion"] != 1 || std::string(map["runtimeUnit"]["kind"] | "") != kind) {
        error = "Unsupported hosted image metadata"; return false;
    }
    bool target = false;
    for (JsonVariantConst item : map["targets"].as<JsonArrayConst>())
        if (std::string(item.as<const char*>() ? item.as<const char*>() : "") == "esp32") target = true;
    if (!target) { error = "Hosted artifact does not target ESP32"; return false; }
    if (std::string(kind) == "service" && !map["serviceEndpoints"].isNull()) {
        if (!map["serviceEndpoints"].is<JsonArrayConst>() || map["serviceEndpoints"].size() > 16) {
            error = "Invalid hosted endpoint declarations"; return false;
        }
        for (JsonVariantConst endpoint : map["serviceEndpoints"].as<JsonArrayConst>()) {
            const std::string verb = endpoint["verb"] | "";
            const std::string path = endpoint["path"] | "";
            if ((verb != "GET" && verb != "POST") || path.size() > 256
                || (path != "/health" && path != "/events/udp" && path.rfind("/api/", 0) != 0)) {
                error = "Hosted endpoints require GET/POST and /api/ paths, /health or /events/udp"; return false;
            }
            const auto route = std::make_pair(verb, path);
            if (std::find(out.endpoints.begin(), out.endpoints.end(), route) != out.endpoints.end()) {
                error = "Duplicate hosted endpoint"; return false;
            }
            out.endpoints.push_back(route);
        }
    }
    const size_t count = out.image ? out.image->size() : out.instructions ? out.instructions->size() : 0;
    for (size_t index = 0; index < count; ++index) {
        PInstruction instruction;
        if (out.image) {
            if (!out.image->read(index, instruction, error)) return false;
        } else instruction = (*out.instructions)[index];
        switch (instruction.opcode) {
        case OP_CALL_EXT: {
            const auto* spec = binding(instruction.strOperand);
            if (!spec || instruction.value != static_cast<int>(strlen(spec->args))) {
                error = "Unknown hosted binding or invalid arity"; return false;
            }
            break;
        }
        case OP_CALL_LABEL:
            if (instruction.value < 0 || instruction.value > 8) { error = "Invalid call arity"; return false; }
            // Fall through to validate the resolved local target.
        case OP_JMP: case OP_JZ:
            if (instruction.intOperand < 0 || instruction.intOperand >= static_cast<int>(count)) {
                error = "Invalid hosted branch target"; return false;
            }
            break;
        case OP_PUSH_STR: case OP_PUSH_INT: case OP_LOAD_NAME: case OP_STORE_NAME:
        case OP_RET: case OP_MAP_RETURN: case OP_HALT:
        case OP_STREQ: case OP_STRNEQ: case OP_EQ: case OP_NEQ: case OP_LT:
        case OP_LE: case OP_GT: case OP_GE: case OP_OR: case OP_AND: case OP_NOT:
        case OP_ADD: case OP_SUB: case OP_MUL: case OP_DIV: case OP_NOP:
            break;
        default: error = "Opcode unavailable in bounded ESP32 host"; return false;
        }
    }
    if (std::string(kind) == "service" && !map["hostTables"].isNull()) {
        if (!map["hostTables"].is<JsonArrayConst>() || map["hostTables"].as<JsonArrayConst>().size() > 2) {
            error = "Invalid hosted table declarations"; return false;
        }
        const auto definitions = map["hostTables"].as<JsonArrayConst>();
        out.hasTableDeclarations = !definitions.isNull() && definitions.size() > 0;
        for (JsonVariantConst definition : definitions) {
            const std::string name = definition["name"] | "";
            const int capacity = definition["capacity"] | 0;
            if (!identifier(name) || capacity < 1 || capacity > 255
                || out.tableCapacities.count(name)) {
                error = "Invalid or duplicate hosted table declaration"; return false;
            }
            out.tableCapacities[name] = static_cast<uint8_t>(capacity);
        }
    }
    if (!map["hostCaches"].isNull()) {
        if (!map["hostCaches"].is<JsonArrayConst>() || map["hostCaches"].size() > 2) {
            error = "Invalid hosted cache declarations"; return false;
        }
        for (JsonVariantConst definition : map["hostCaches"].as<JsonArrayConst>()) {
            const std::string name = definition["name"] | "";
            if (!identifier(name) || name.find_first_of("ABCDEFGHIJKLMNOPQRSTUVWXYZ") != std::string::npos
                || !definition["capacity"].is<int>() || definition["capacity"] != 50 || out.cacheSchemas.count(name)
                || !definition["fields"].is<JsonArrayConst>() || definition["fields"].size() < 1
                || definition["fields"].size() > 32) { error = "Invalid hosted cache declaration"; return false; }
            auto& fields = out.cacheSchemas[name];
            for (JsonVariantConst field : definition["fields"].as<JsonArrayConst>()) {
                const std::string key = field["name"] | "", type = field["type"] | "";
                if (!identifier(key) || fields.count(key)
                    || (type != "string" && type != "integer" && type != "boolean")) {
                    error = "Invalid hosted cache schema"; return false;
                }
                fields[key] = type;
            }
        }
    }
    for (JsonPairConst pair : map["procedures"].as<JsonObjectConst>()) {
        auto& params = out.signatures[pair.key().c_str()];
        for (JsonVariantConst param : pair.value()["params"].as<JsonArrayConst>()) {
            if (!param.is<const char*>() || params.size() >= 8) { error = "Invalid hosted signature"; return false; }
            params.emplace_back(param.as<const char*>());
        }
    }
    if (std::string(kind) == "daemon") {
        if (!map["runtimeUnit"]["refreshMs"].is<uint32_t>()) { error = "Invalid daemon interval"; return false; }
        out.interval = map["runtimeUnit"]["refreshMs"].as<uint32_t>();
        if (out.interval < 10 || out.interval > 180000) { error = "Invalid daemon interval"; return false; }
    }
    return true;
}

bool ServiceHost::prepare(std::string& error) {
    if (!mutex) mutex = xSemaphoreCreateMutex();
    if (!ingressMutex) ingressMutex = xSemaphoreCreateMutex();
    if (!ingressMutex) { error = "Cannot reserve service host ingress mutex"; return false; }
    if (!mutex || xSemaphoreTake(mutex, 0) != pdTRUE) {
        error = "Service host busy or unavailable"; return false;
    }
    bool ok = std::any_of(services.begin(), services.end(), [](const std::shared_ptr<Context>& item) { return !item; });
    if (!ok) error = "Hosted service capacity exceeded (maximum two)";
    else {
        try {
            hostError.reserve(256);
        } catch (const std::bad_alloc&) {
            error = "Cannot reserve service host diagnostics"; ok = false;
        }
        if (ok && !task && xTaskCreate(worker, "pascalish-host", 16384, this, 1, &task) != pdPASS) {
            error = "Cannot reserve service host worker stack"; ok = false;
        }
    }
    xSemaphoreGive(mutex);
    return ok;
}

bool ServiceHost::install(Unit newService, Unit newDaemon, const std::string& id, uint16_t port,
                          uint32_t newTtl, uint32_t heartbeat, std::string& error,
                          JsonVariantConst networkPeers) {
    if (!port) { error = "Valid collector UDP port required"; return false; }
    std::vector<DaemonSpec> daemons(1);
    daemons[0].unit = std::move(newDaemon);
    return install(std::move(newService), std::move(daemons), id, port, newTtl, heartbeat, error, networkPeers);
}

bool ServiceHost::install(Unit newService, std::vector<DaemonSpec> newDaemons, const std::string& id, uint16_t port,
                          uint32_t newTtl, uint32_t heartbeat, std::string& error,
                          JsonVariantConst networkPeers) {
    if (!identifier(id) || !heartbeat || newTtl <= heartbeat || newTtl > 180000) {
        error = "TTL must exceed heartbeat interval, with maximum 180000 ms; valid collector ID required";
        return false;
    }
    if (newDaemons.empty() || newDaemons.size() > DAEMON_LIMIT) {
        error = "Hosted daemon count must be 1..3"; return false;
    }
    std::vector<uint16_t> ports;
    if (port) ports.push_back(port);
    for (const auto& daemon : newDaemons) {
        if (!daemon.multicastGroup.empty()) {
            IPAddress group;
            if (!daemon.udpPort || !group.fromString(daemon.multicastGroup.c_str()) ||
                daemon.multicastGroup != group.toString().c_str() || group[0] < 224 || group[0] > 239) {
                error = "Multicast group requires literal multicast IPv4 and owned UDP port"; return false;
            }
        }
        for (const auto& cache : daemon.unit.cacheSchemas) {
            const auto serviceCache = newService.cacheSchemas.find(cache.first);
            if (serviceCache == newService.cacheSchemas.end() || serviceCache->second != cache.second) {
                error = "Daemon cache declaration must match its service cache"; return false;
            }
        }
        if (!daemon.udpPort) continue;
        if (std::find(ports.begin(), ports.end(), daemon.udpPort) != ports.end()) {
            error = "Duplicate collector ID, UDP port or route; each hosted UDP port needs one owner"; return false;
        }
        ports.push_back(daemon.udpPort);
    }
    if (!task && !prepare(error)) return false;
    if (!mutex || xSemaphoreTake(mutex, 0) != pdTRUE) { error = "Service host busy or unavailable"; return false; }
    bool ok = false;
    try {
        auto slot = std::find(services.begin(), services.end(), nullptr);
        if (slot == services.end()) error = "Hosted service capacity exceeded (maximum two)";
        else {
            bool conflict = false;
            for (const auto& existing : services) if (existing) {
                if (existing->collectorId == id) conflict = true;
                for (const auto owned : ports) {
                    if (existing->udpPort == owned) conflict = true;
                    for (size_t index = 0; index < existing->daemonCount; ++index)
                        if (existing->daemons[index].udpPort == owned) conflict = true;
                }
                if (existing->service.endpoints.empty() || newService.endpoints.empty()) conflict = true;
                for (const auto& route : newService.endpoints) {
                    if (route.second == "/health" || route.second == "/events/udp") continue;
                    if (std::find(existing->service.endpoints.begin(), existing->service.endpoints.end(), route)
                        != existing->service.endpoints.end()) conflict = true;
                }
            }
            if (conflict) error = "Duplicate collector ID, UDP port or route; multi-service images need endpoint metadata";
            else {
                auto context = std::make_shared<Context>();
                context->lastError.reserve(256);
                if (network.configure(networkPeers, context->network, error)) {
                    Serial.printf("[SERVICE-HOST] Installing id=%s port=%u heap=%u largest=%u\n",
                        id.c_str(), port, ESP.getFreeHeap(),
                        static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
                    bool bound = true;
                    if (ESP.getFreeHeap() < 32768) {
                        error = "Insufficient heap for hosted UDP socket"; bound = false;
                    }
                    else if (port && !context->udp.begin(port)) {
                        const int socketError = errno;
                        Serial.printf("[SERVICE-HOST] UDP bind failed id=%s port=%u errno=%d\n",
                            id.c_str(), port, socketError);
                        error = "Hosted UDP bind failed"; bound = false;
                    }
                    for (size_t index = 0; bound && index < newDaemons.size(); ++index) {
                        auto& daemon = context->daemons[index];
                        daemon.unit = std::move(newDaemons[index].unit);
                        daemon.udpPort = newDaemons[index].udpPort;
                        daemon.multicastGroup = newDaemons[index].multicastGroup;
                        daemon.lastError.reserve(128);
                        daemon.nextTick = now() + (slot == services.begin() ? 0 : 100) + index * 50;
                        context->daemonCount = index + 1;
                        if (!daemon.udpPort) continue;
                        auto* udp = new OwnedDaemonUdp();
                        daemon.udp.reset(udp);
                        if (!udp->beginOwned(daemon.udpPort, daemon.multicastGroup)) {
                            const int socketError = errno;
                            Serial.printf("[SERVICE-HOST] Daemon UDP bind failed id=%s port=%u errno=%d\n",
                                id.c_str(), daemon.udpPort, socketError);
                            error = "Hosted daemon UDP bind failed"; bound = false;
                        }
                    }
                    if (!bound) {
                        context->udp.stop();
                        for (auto& daemon : context->daemons) if (daemon.udp) daemon.udp->stop();
                    }
                    else {
                        context->service = std::move(newService);
                        context->collectorId = id;
                        char nonce[32];
                        snprintf(nonce, sizeof(nonce), "%08lx-%08lx", static_cast<unsigned long>(esp_random()),
                                 static_cast<unsigned long>(esp_random()));
                        context->bootId = nonce;
                        context->ttl = newTtl;
                        context->udpPort = port;
                        xSemaphoreTake(ingressMutex, portMAX_DELAY);
                        *slot = std::move(context);
                        active = true;
                        xSemaphoreGive(ingressMutex);
                        ok = true;
                    }
                }
            }
        }
    } catch (const std::bad_alloc&) { error = "Hosted service installation allocation failed"; }
    xSemaphoreGive(mutex);
    return ok;
}

bool ServiceHost::stop(std::string& error, const std::string& id) {
    if (!mutex) return true;
    if (xSemaphoreTake(mutex, 0) != pdTRUE) { error = "Service host busy"; return false; }
    if (!id.empty() && std::none_of(services.begin(), services.end(),
        [&](const std::shared_ptr<Context>& item) { return item && item->collectorId == id; })) {
        error = "Hosted service not found"; xSemaphoreGive(mutex); return false;
    }
    xSemaphoreTake(ingressMutex, portMAX_DELAY);
    for (auto& context : services) if (context && (id.empty() || context->collectorId == id)) {
        context->installed = false;
        context->udp.stop();
        for (auto& daemon : context->daemons) if (daemon.udp) daemon.udp->stop();
        if (current == context) current.reset();
        context.reset();
    }
    active = std::any_of(services.begin(), services.end(), [](const std::shared_ptr<Context>& item) { return bool(item); });
    xSemaphoreGive(ingressMutex);
    stopHttpEvents(id);
    machine.clearProcedureSignatures();
    xSemaphoreGive(mutex);
    return true;
}

bool ServiceHost::fail(const std::string& error, std::string& out, int status) {
    out = jsonNoMemory ? "Hosted JSON allocation failed" : error;
    responseStatus = jsonNoMemory ? 503 : status;
    return false;
}

size_t ServiceHost::expire(Table& table) {
    const auto timestamp = now();
    size_t count = 0;
    for (auto entry = table.begin(); entry != table.end();) {
        if (entry->second.deadline <= timestamp) { entry = table.erase(entry); ++count; }
        else ++entry;
    }
    return count;
}

bool ServiceHost::call(const std::string& symbol, const std::vector<HostValue>& args,
                       HostValue& result, std::string& error, void* context) {
    return static_cast<ServiceHost*>(context)->invoke(symbol, args, result, error);
}

bool ServiceHost::invoke(const std::string& symbol, const std::vector<HostValue>& args,
                         HostValue& result, std::string& error) {
    if (!current) return fail("Hosted service context unavailable", error, 503);
    auto& tables = current->tables;
    auto& tableCapacities = current->service.tableCapacities;
    const bool hasTableDeclarations = current->service.hasTableDeclarations;
    auto& collectorId = current->collectorId;
    auto& bootId = current->bootId;
    auto& sequence = current->sequence;
    const auto ttl = current->ttl;
    auto& udp = eventUdp ? *eventUdp : current->udp;
    const auto* spec = binding(symbol);
    if (!spec || args.size() != strlen(spec->args)) return fail("Invalid host binding or arity", error);
    for (size_t i = 0; i < args.size(); ++i) {
        if ((spec->args[i] == 's' && !args[i].isString) || (spec->args[i] == 'i' && args[i].isString))
            return fail("Invalid host argument type", error);
        if (args[i].isString && args[i].text.size() > RESPONSE_LIMIT)
            return fail("Host argument size exceeded", error, 413);
    }
    result.isString = spec->text;
    currentBinding = spec->name;
    const std::string op = spec->name;
    if (op.rfind("bytes_", 0) == 0 || (op.rfind("buffer_", 0) == 0 && op.rfind("buffer_json_", 0) != 0)
        || op == "byte_xor" || op == "tcp_exchange" || op == "tcp_exchange_buffer" || op == "udp_exchange") {
        if (!network.invoke(op, args, result, error)) return fail(error, error, 502);
    }
    else if (op == "event_body") result.text = body;
    else if (op == "event_bytes") {
        result.text = NetworkBindings::eventBytes(body);
    }
    else if (op == "event_peer") result.text = peer;
    else if (op == "event_port") result.integer = peerPort;
    else if (op == "event_method") result.text = method;
    else if (op == "raise_error") return fail("Program failure: " + args[0].text, error, 500);
    else if (op == "event_path") result.text = path;
    else if (op == "event_query") {
        JsonDocument queryDoc;
        if (!object(query, queryDoc)) return fail("Invalid event query", error, 500);
        result.text = queryDoc[args[0].text] | "";
    }
    else if (op == "collector_id") result.text = collectorId;
    else if (op == "boot_id") result.text = bootId;
    else if (op == "observation_ttl") result.integer = ttl;
    else if (op == "clock") {
        if (now() > INT32_MAX) return fail("Host integer clock exhausted", error, 503);
        result.integer = static_cast<int>(now());
    } else if (op == "next_sequence") {
        if (sequence >= INT32_MAX) return fail("Collector sequence exhausted; reinstall host", error, 503);
        result.integer = ++sequence;
    } else if (op == "http_status") {
        if (args[0].integer < 200 || args[0].integer > 599) return fail("Invalid HTTP status", error);
        responseStatus = args[0].integer;
    } else if (op == "udp_reply") {
        if (!peerPort || args[0].text.size() > BODY_LIMIT) return fail("UDP reply requires a bounded UDP event", error);
        IPAddress address;
        if (!address.fromString(peer.c_str()) || !udp.beginPacket(address, peerPort)
            || udp.write(reinterpret_cast<const uint8_t*>(args[0].text.data()), args[0].text.size()) != args[0].text.size()
            || !udp.endPacket()) return fail("UDP reply failed", error, 503);
    } else if (op == "announcement") {
        JsonDocument input, output;
        if (args[0].text.size() > BODY_LIMIT || !object(args[0].text, input))
            return fail("Invalid announcement JSON", error);
        const std::string kind = input["kind"] | "";
        if (!kind.empty() && kind != "nodeBeacon" && kind != "machineAvailability")
            return fail("Unsupported announcement kind", error);
        for (const char* key : {"nodeId", "nodeName", "ip"}) {
            if (!input[key].isNull() && (!input[key].is<const char*>() || !identifier(input[key].as<std::string>())))
                return fail("Invalid announcement identity", error);
        }
        const std::string ip = input["ip"] | args[1].text.c_str();
        const std::string name = input["nodeName"] | ip.c_str();
        const std::string id = input["nodeId"] | name.c_str();
        int port = input["port"] | (input["httpPort"] | 80);
        if (!identifier(ip) || !identifier(id) || port < 1 || port > 65535)
            return fail("Invalid announcement address or port", error);
        output["nodeId"] = id; output["nodeName"] = name; output["ip"] = ip; output["port"] = port;
        const bool available = input["available"] | true;
        const bool draining = input["draining"] | false;
        const std::string status = input["status"] | (available ? "available" : "unavailable");
        output["available"] = available;
        output["draining"] = draining;
        output["status"] = status;
        auto availability = output["availability"].to<JsonObject>();
        availability["available"] = available; availability["draining"] = draining; availability["status"] = status;
        if (kind != "nodeBeacon" || input["services"].is<JsonArray>() || !input["runtime"].isNull()
            || !input["hardware"].isNull() || !input["capabilities"].isNull()) {
            JsonObject details = output["details"].to<JsonObject>();
            details["nodeName"] = name;
            details["runtime"] = input["runtime"] | "pmachine";
            details["hardware"] = input["hardware"] | "ESP32";
            auto services = details["services"].to<JsonArray>();
            for (JsonVariantConst advertised : input["services"].as<JsonArrayConst>()) {
                const std::string name = advertised.is<const char*>() ? advertised.as<std::string>()
                    : std::string(advertised["name"] | (advertised["serviceName"] | ""));
                if (!identifier(name)) return fail("Each service must have a name", error);
                auto service = services.add<JsonObject>();
                service["name"] = name;
                service["endpoint"] = advertised.is<JsonObjectConst>() ? advertised["endpoint"] | "/pmachine/service" : "/pmachine/service";
                service["status"] = advertised.is<JsonObjectConst>() ? advertised["status"] | "up" : "up";
                if (advertised.is<JsonObjectConst>() && advertised["metadata"].is<JsonObjectConst>())
                    service["metadata"] = advertised["metadata"];
                else service["metadata"].to<JsonObject>();
            }
            if (input["capabilities"].is<JsonArrayConst>()) details["capabilities"] = input["capabilities"];
            else details["capabilities"].to<JsonArray>();
        }
        const auto serialized = serialize(output, result.text);
        if (serialized != SerializeResult::ok)
            return fail("Announcement serialization failed", error,
                        serialized == SerializeResult::tooLarge ? 413 : 503);
    } else if (op.rfind("text_", 0) == 0) {
        const auto& text = args[0].text;
        if (text.size() > 1024) return fail("Invalid ASCII text bounds", error);
        for (unsigned char ch : text) if (ch > 127) return fail("Invalid ASCII text bounds", error);
        if (op == "text_header") {
            if (!headerText(text, args[1].text, result.text, error)) return false;
        } else if (op == "text_lower") {
            result.text = text;
            for (char& ch : result.text) ch = asciiLower(ch);
        } else if (op == "text_index") {
            if (args[1].text.size() > 1024) return fail("Invalid ASCII text bounds", error);
            for (unsigned char ch : args[1].text) if (ch > 127) return fail("Invalid ASCII text bounds", error);
            const auto found = text.find(args[1].text);
            result.integer = found == std::string::npos ? -1 : static_cast<int>(found);
        } else {
            const int start = args[1].integer, count = args[2].integer;
            if (start < 0 || count < 0 || static_cast<size_t>(start) > text.size() ||
                static_cast<size_t>(count) > text.size() - start) return fail("Invalid text slice", error);
            result.text = text.substr(start, count);
        }
    } else if (op == "json_path_text" || op == "json_path_integer"
               || op == "buffer_json_path_text" || op == "buffer_json_path_integer") {
        const char* input = args[0].text.data();
        size_t inputBytes = args[0].text.size();
        if (op.rfind("buffer_", 0) == 0
            && !network.bufferTextView(args[0].integer, input, inputBytes, error)) return false;
        const auto& path = args[1].text;
        if (path.empty() || path.size() > 128) return fail("Invalid JSON path", error);
        std::array<std::string, 8> parts;
        size_t count = 0, start = 0;
        for (;;) {
            const size_t end = path.find('.', start);
            const size_t length = (end == std::string::npos ? path.size() : end) - start;
            if (!length || count == parts.size()) return fail("Invalid JSON path", error);
            parts[count++] = path.substr(start, length);
            if (end == std::string::npos) break;
            start = end + 1;
        }
        JsonDocument filter, doc;
        JsonObject node = filter.to<JsonObject>();
        for (size_t index = 0; index + 1 < count; ++index)
            node = node[parts[index]].to<JsonObject>();
        node[parts[count - 1]] = true;
        const auto parsed = deserializeJson(doc, input, inputBytes, DeserializationOption::Filter(filter));
        ++jsonMetrics.parses; jsonMetrics.inputBytes += inputBytes;
        if (parsed || filter.overflowed()) {
            ++jsonMetrics.parseFailures;
            return fail("JSON path parse failed", error, parsed == DeserializationError::NoMemory ? 503 : 400);
        }
        JsonVariantConst value = doc.as<JsonVariantConst>();
        for (size_t index = 0; index < count; ++index) {
            if (!value.is<JsonObjectConst>()) return fail("Expected JSON path object", error);
            value = value[parts[index]];
        }
        if (op == "json_path_text" || op == "buffer_json_path_text") {
            if (!value.is<const char*>()) return fail("Expected string field", error);
            result.text = value.as<std::string>();
        } else {
            if (!value.is<int32_t>()) return fail("Expected integer field", error);
            result.integer = value.as<int32_t>();
        }
    } else if (op.rfind("json_", 0) == 0) {
        JsonDocument doc;
        if (!object(args[0].text, doc)) return fail("Expected JSON object", error);
        if (op == "json_merge") {
            JsonDocument next;
            if (!object(args[1].text, next)) return fail("Expected merge object", error);
            for (JsonPairConst pair : next.as<JsonObjectConst>()) doc[pair.key().c_str()].set(pair.value());
        } else {
            if (!identifier(args[1].text)) return fail("Invalid JSON key", error);
            if (op == "json_value") {
                if (!doc.as<JsonObjectConst>().containsKey(args[1].text.c_str()))
                    return fail("Missing JSON field", error);
                const auto serialized = serializeValue(doc[args[1].text], doc.overflowed(), result.text);
                if (serialized != SerializeResult::ok)
                    return fail("JSON field serialization failed", error,
                                serialized == SerializeResult::tooLarge ? 413 : 503);
                return true;
            } else if (op == "json_integer") {
                if (!doc[args[1].text].is<int32_t>()) return fail("Expected integer field", error);
                result.integer = doc[args[1].text].as<int32_t>();
                return true;
            } else if (op == "json_text") {
                if (!doc[args[1].text].is<const char*>()) return fail("Expected string field", error);
                result.text = doc[args[1].text].as<std::string>();
                return true;
            } else if (op == "json_set") {
                if (args[2].isString) doc[args[1].text] = args[2].text;
                else doc[args[1].text] = args[2].integer;
            } else if (op == "json_append") {
                JsonArray array;
                if (!doc.as<JsonObjectConst>().containsKey(args[1].text.c_str()))
                    array = doc[args[1].text].to<JsonArray>();
                else if (doc[args[1].text].is<JsonArray>()) array = doc[args[1].text].as<JsonArray>();
                else return fail("JSON append target must be an array", error);
                const bool added = args[2].isString ? array.add(args[2].text) : array.add(args[2].integer);
                if (!added) return fail("JSON append allocation failed", error, 503);
            } else {
                JsonDocument value;
                if (!parseJson(args[2].text, value)) return fail("Invalid embedded JSON", error);
                doc[args[1].text].set(value.as<JsonVariantConst>());
            }
        }
        const auto serialized = serialize(doc, result.text);
        if (serialized != SerializeResult::ok)
            return fail("JSON response serialization failed", error,
                        serialized == SerializeResult::tooLarge ? 413 : 503);
    } else if (op.rfind("cache_", 0) == 0) {
        const auto definition = current->service.cacheSchemas.find(args[0].text);
        if (definition == current->service.cacheSchemas.end()) return fail("Undeclared cache", error);
        if (op == "cache_snapshot") {
            HostCacheStore::Snapshot page;
            std::string snapshotError;
            const auto timestamp = now();
            if (!current->caches->snapshot(args[0].text, args[1].text, args[2].text, timestamp, page, snapshotError))
                return fail(snapshotError, error, 409);
            JsonDocument doc;
            doc["version"] = 1; doc["collectorId"] = current->collectorId; doc["bootId"] = current->bootId;
            doc["revision"] = std::to_string(page.revision); doc["sequence"] = page.revision;
            doc["sampledAtMs"] = timestamp; doc["total"] = page.total; doc["nextCursor"] = page.nextCursor;
            auto records = doc["records"].to<JsonArray>();
            for (const auto& entry : page.records) {
                JsonDocument device;
                if (!object(entry.json, device)) return fail("Invalid cached snapshot record", error);
                auto record = records.add<JsonObject>();
                record["key"] = entry.key; record["device"] = device.as<JsonObjectConst>();
                record["observationMs"] = entry.observedAt; record["observationSequence"] = entry.sequence;
                record["remainingTTLms"] = entry.remainingTtl;
            }
            if (serialize(doc, result.text) != SerializeResult::ok || result.text.size() > 2048)
                return fail("Snapshot page exceeds 2048 bytes or allocation failed", error, 503);
            return true;
        }
        // Reads observe the cache as of invocation start and never refresh or expire entries.
        if (op == "cache_count") {
            result.integer = static_cast<int>(current->caches->count(args[0].text, invocationStartedAt));
            return true;
        }
        if (op == "cache_next") {
            if (args[1].text.size() > 256)
                return fail("Invalid cache cursor", error);
            current->caches->next(args[0].text, args[1].text, invocationStartedAt, result.text);
            return true;
        }
        if (!identifier(args[1].text)) return fail("Invalid cache key", error);
        const auto timestamp = now();
        if (op == "cache_get") {
            std::string cacheError;
            if (!current->caches->get(args[0].text, args[1].text, invocationStartedAt, result.text, cacheError))
                return fail(cacheError, error);
        } else if (op == "cache_remove") {
            result.integer = current->caches->remove(args[0].text, args[1].text, timestamp) ? 1 : 0;
        } else {
            const auto ttlMs = args[3].integer;
            JsonDocument value;
            if (ttlMs < 1 || ttlMs > 2147483647 || args[2].text.size() > BODY_LIMIT
                || !object(args[2].text, value)) return fail("Invalid cache item or TTL", error);
            const auto objectValue = value.as<JsonObjectConst>();
            if (objectValue.size() != definition->second.size()) return fail("Cache item does not match declared type", error);
            for (const auto& field : definition->second) {
                const auto item = objectValue[field.first];
                if (field.second == "string" ? !item.is<const char*>()
                    : !item.is<int32_t>() || (field.second == "boolean" && item.as<int32_t>() != 0 && item.as<int32_t>() != 1))
                    return fail("Cache item does not match declared type", error);
            }
            std::string cacheError;
            if (!current->caches->put(args[0].text, args[1].text, args[2].text, static_cast<uint32_t>(ttlMs), timestamp, cacheError))
                return fail(cacheError, error, 503);
            result.integer = 1;
        }
    } else if (op.rfind("table_", 0) == 0) {
        if (!identifier(args[0].text)) return fail("Invalid table name", error);
        const auto definition = tableCapacities.find(args[0].text);
        if (hasTableDeclarations && definition == tableCapacities.end())
            return fail("Undeclared table", error);
        if (!tables.count(args[0].text) && tables.size() >= 2) return fail("Table capacity exceeded", error, 503);
        auto& table = tables[args[0].text];
        if (op == "table_expire") result.integer = expire(table);
        else if (op == "table_snapshot" || op == "table_snapshot_values") {
            if (args[1].text.size() > 256 || args[2].integer < 1 || args[2].integer > 5)
                return fail("Invalid table snapshot cursor or limit", error);
            JsonDocument snapshot;
            auto array = snapshot["nodes"].to<JsonArray>();
            const auto timestamp = now();
            std::string nextCursor;
            bool hasMore = false;
            auto entry = args[1].text.empty() ? table.begin() : table.upper_bound(args[1].text);
            for (; entry != table.end(); ++entry) {
                if (entry->second.deadline <= timestamp) continue;
                if (array.size() >= static_cast<size_t>(args[2].integer)) {
                    hasMore = true;
                    break;
                }
                JsonDocument value;
                if (!object(entry->second.json, value)) return fail("Stored observation is invalid", error, 500);
                if (op == "table_snapshot") value["remainingTtlMs"] = entry->second.deadline - timestamp;
                array.add(value.as<JsonObjectConst>());
                nextCursor = entry->first;
            }
            snapshot["continuation"] = hasMore ? "continue" : "end";
            snapshot["nextCursor"] = hasMore ? nextCursor : "";
            const auto serialized = serialize(snapshot, result.text);
            if (serialized != SerializeResult::ok)
                return fail("Snapshot serialization failed", error,
                            serialized == SerializeResult::tooLarge ? 413 : 503);
        } else {
            if (!identifier(args[1].text)) return fail("Invalid table key", error);
            const auto found = table.find(args[1].text);
            if (op == "table_get") {
                result.text = found != table.end() && found->second.deadline > now() ? found->second.json : "{}";
            } else {
                const auto lifetime = args[3].integer;
                JsonDocument value;
                if (args[2].text.size() > BODY_LIMIT || !object(args[2].text, value)
                    || lifetime < 1 || lifetime > 180000) return fail("Invalid observation or TTL", error);
                expire(table);
                const size_t capacity = definition == tableCapacities.end() ? 16 : definition->second;
                if (!table.count(args[1].text) && table.size() >= capacity) return fail("Entry capacity exceeded", error, 503);
                size_t bytes = args[1].text.size() + args[2].text.size();
                for (const auto& bucket : tables) for (const auto& entry : bucket.second)
                    if (bucket.first != args[0].text || entry.first != args[1].text)
                        bytes += entry.first.size() + entry.second.json.size();
                if (bytes > STORAGE_LIMIT) return fail("Table storage capacity exceeded", error, 503);
                if (observedAt + lifetime <= now()) return fail("Announcement expired before execution", error, 503);
                table[args[1].text] = {args[2].text, observedAt + lifetime};
            }
        }
    } else return fail("Unavailable host binding", error);
    return true;
}

bool ServiceHost::execute(const Unit& unit, std::string& response) {
    auto& lastError = current->lastError;
    network.select(current->network);
    network.resetBuffers();
    struct BufferReset {
        NetworkBindings& network;
        ~BufferReset() { network.resetBuffers(); }
    } bufferReset{network};
    responseStatus = 200;
    jsonNoMemory = false;
    jsonMetrics = JsonMetrics{};
    invocationStartedAt = now();
    if (xTaskGetCurrentTaskHandle() != task) {
        lastError = "Hosted execution attempted outside its worker";
        Serial.printf("[SERVICE-HOST] %s\n", lastError.c_str());
        return fail(lastError, response, 503);
    }
    try {
        machine.setProcedureSignatures(unit.signatures);
        if (unit.image) machine.runImage(unit.image->size(), [&](size_t index) {
            PInstruction instruction;
            std::string error;
            if (!unit.image->read(index, instruction, error)) throw std::runtime_error(error);
            return instruction;
        });
        else if (unit.instructions) machine.run(*unit.instructions);
        else throw std::runtime_error("Hosted unit has no instruction source");
    } catch (const std::bad_alloc&) {
        lastError = "Hosted execution allocation failed at pc " + std::to_string(machine.getExecutionPc());
        Serial.printf("[SERVICE-HOST] %s; stage=%s requestedBytes=%u binding=%s heap=%u largest=%u\n", lastError.c_str(),
            machine.getAllocationStage(), static_cast<unsigned>(machine.getAllocationBytes()), currentBinding,
            ESP.getFreeHeap(), static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
        return fail(lastError, response, 503);
    } catch (const std::runtime_error& error) {
        lastError = error.what();
        Serial.printf("[SERVICE-HOST] %s\n", lastError.c_str());
        return fail(lastError, response, 503);
    }
    auto state = machine.getFlowStateSnapshot();
    for (const auto& item : state) if (item.first != "__response" && item.first.find("error") != std::string::npos) {
        lastError = item.second; response = item.second;
        if (responseStatus < 400) responseStatus = 500;
        Serial.printf("[SERVICE-HOST] %s\n", lastError.c_str());
        return false;
    }
    if (machine.didLastRunHitStepLimit()) {
        lastError = "Hosted instruction budget exceeded"; response = lastError; responseStatus = 503;
        Serial.println("[SERVICE-HOST] Instruction budget exceeded"); return false;
    }
    const auto found = state.find("__response");
    if (found == state.end()) response = "{}";
    else response = std::move(found->second);
    if (response.size() > RESPONSE_LIMIT) return fail("Hosted response too large", response, 503);
    return true;
}

std::shared_ptr<ServiceHost::HttpEvent> ServiceHost::enqueue(
        const std::string& newMethod, const std::string& newPath, const std::string& newBody,
        const std::string& newPeer, const std::string& newQuery, int& statusCode, std::string& error) {
    statusCode = 503;
    if (newBody.size() > BODY_LIMIT || newQuery.size() > BODY_LIMIT
        || newPath.size() > 256 || newPeer.size() > 64 || newMethod.size() > 8) {
        statusCode = 413; error = "Hosted event capacity exceeded"; return nullptr;
    }
    if (!ingressMutex || xSemaphoreTake(ingressMutex, 0) != pdTRUE) {
        error = "Service host ingress busy or unavailable"; return nullptr;
    }
    std::shared_ptr<HttpEvent> event;
    if (!active) error = "Service host stopped";
    else {
        std::shared_ptr<Context> owner;
        for (const auto& candidate : services) if (candidate) {
            if (candidate->service.endpoints.empty()
                || std::find(candidate->service.endpoints.begin(), candidate->service.endpoints.end(),
                    std::make_pair(newMethod, newPath)) != candidate->service.endpoints.end()) {
                owner = candidate; break;
            }
        }
        if (!owner) {
            statusCode = 404; error = "Hosted route not installed";
            xSemaphoreGive(ingressMutex); return nullptr;
        }
        auto slot = httpEvents.end();
        for (auto item = httpEvents.begin(); item != httpEvents.end(); ++item) {
            if (*item && (*item)->abandoned.load() && (!(*item)->started || (*item)->ready.load()))
                item->reset();
            if (!*item && slot == httpEvents.end()) slot = item;
        }
        if (slot == httpEvents.end()) {
            statusCode = 429; error = "Service host HTTP event queue full";
        } else {
            try {
                event = std::make_shared<HttpEvent>();
                event->owner = owner;
                event->method = newMethod; event->path = newPath; event->body = newBody;
                event->peer = newPeer; event->query = newQuery;
                event->observedAt = now(); event->deadline = event->observedAt + 12000;
                event->order = ++nextHttpOrder;
                *slot = event;
            } catch (const std::bad_alloc&) {
                event.reset(); error = "Hosted event allocation failed";
            }
        }
    }
    xSemaphoreGive(ingressMutex);
    if (event) PULSE_ASYNC_TRACE("HTTP queued event=%llu path=%s",
        static_cast<unsigned long long>(event->order), event->path.c_str());
    return event;
}

bool ServiceHost::handles(const std::string& method, const std::string& path) {
    if (path == "/events/udp") return false;
    if (!ingressMutex || xSemaphoreTake(ingressMutex, pdMS_TO_TICKS(20)) != pdTRUE) return false;
    bool found = false;
    for (const auto& context : services) if (context) {
        const auto& endpoints = context->service.endpoints;
        if (std::find(endpoints.begin(), endpoints.end(), std::make_pair(method, path)) != endpoints.end()) {
            found = true; break;
        }
    }
    xSemaphoreGive(ingressMutex);
    return found;
}

std::shared_ptr<ServiceHost::HttpEvent> ServiceHost::takeHttpEvent() {
    xSemaphoreTake(ingressMutex, portMAX_DELAY);
    std::shared_ptr<HttpEvent> next;
    for (auto& event : httpEvents) {
        if (event && event->abandoned.load() && (!event->started || event->ready.load())) event.reset();
        if (event && event->submitted.load() && !event->started
            && (!next || event->order < next->order)) next = event;
    }
    if (next) next->started = true;
    xSemaphoreGive(ingressMutex);
    return next;
}

void ServiceHost::stopHttpEvents(const std::string& id) {
    if (!ingressMutex) return;
    xSemaphoreTake(ingressMutex, portMAX_DELAY);
    for (auto& event : httpEvents) {
        if (event && !id.empty() && (!event->owner || event->owner->collectorId != id)) continue;
        if (event && !event->ready.load()) {
            event->status = 503; event->ok = false;
            event->errorText = "Service host stopped before event execution";
            event->ready.store(true);
        }
        if (event) event->owner.reset();
        event.reset();
    }
    xSemaphoreGive(ingressMutex);
}

void ServiceHost::executeHttpEvent(const std::shared_ptr<HttpEvent>& event) {
    current = event->owner;
    if (!current || !current->installed) {
        event->status = 503; event->errorText = "Hosted service stopped";
        event->owner.reset();
        event->ready.store(true); return;
    }
    auto& lastError = current->lastError;
    auto& lastHttpJsonMetrics = current->lastHttpJsonMetrics;
    const uint32_t executionStartedAt = millis();
    jsonMetrics = JsonMetrics{};
    PULSE_ASYNC_TRACE("HTTP worker begin event=%llu queueAge=%llu path=%s stack=%u",
        static_cast<unsigned long long>(event->order),
        static_cast<unsigned long long>(now() - event->observedAt), event->path.c_str(),
        static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)));
    try {
        if (event->abandoned.load() || now() >= event->deadline) {
            event->status = 504;
            event->errorText = "Hosted event expired before execution";
            Serial.println("[SERVICE-HOST] HTTP event expired or disconnected before execution");
        } else {
            method = std::move(event->method); path = std::move(event->path);
            body = std::move(event->body); peer = std::move(event->peer);
            query = std::move(event->query);
            peerPort = 0; observedAt = event->observedAt; eventUdp = nullptr;
            ++current->httpInvocations;
            event->ok = execute(current->service, event->response);
            event->status = responseStatus;
        }
    } catch (const std::bad_alloc&) {
        event->ok = false; event->status = 503;
        event->response.clear();
        event->errorText = "Hosted event allocation failed";
        lastError = "HTTP event allocation failed";
        Serial.println("[SERVICE-HOST] HTTP event allocation failed");
    }
    lastHttpJsonMetrics = jsonMetrics;
    PULSE_ASYNC_TRACE("HTTP JSON totals event=%llu parses=%lu failures=%lu parseUs=%lu serializations=%lu failures=%lu measureUs=%lu writeUs=%lu input=%u output=%u largest=%u stack=%u",
        static_cast<unsigned long long>(event->order),
        static_cast<unsigned long>(jsonMetrics.parses), static_cast<unsigned long>(jsonMetrics.parseFailures),
        static_cast<unsigned long>(jsonMetrics.parseUs), static_cast<unsigned long>(jsonMetrics.serializations),
        static_cast<unsigned long>(jsonMetrics.serializationFailures),
        static_cast<unsigned long>(jsonMetrics.measureUs), static_cast<unsigned long>(jsonMetrics.writeUs),
        static_cast<unsigned>(jsonMetrics.inputBytes), static_cast<unsigned>(jsonMetrics.outputBytes),
        static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)),
        static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)));
    event->owner.reset();
    event->ready.store(true);
    PULSE_ASYNC_TRACE("HTTP worker ready event=%llu status=%d bytes=%u elapsed=%lu",
        static_cast<unsigned long long>(event->order), event->status,
        static_cast<unsigned>(event->response.size()),
        static_cast<unsigned long>(millis() - executionStartedAt));
}

bool ServiceHost::pollUdpEvent() {
    if (!current->udpPort) return false;
    auto& udp = current->udp;
    auto& lastError = current->lastError;
    const int size = udp.parsePacket();
    if (size <= 0) return false;
    if (size > static_cast<int>(BODY_LIMIT)) {
        udp.flush(); lastError = "UDP event body too large";
        Serial.println("[SERVICE-HOST] UDP event body too large");
        return false;
    }
    std::string payload(size, '\0');
    const auto address = udp.remoteIP().toString();
    const auto port = udp.remotePort();
    if (udp.read(reinterpret_cast<uint8_t*>(&payload[0]), size) != size) {
        lastError = "Incomplete UDP datagram";
        Serial.println("[SERVICE-HOST] Incomplete UDP datagram");
        return false;
    }
    method = "POST"; path = "/events/udp"; body = std::move(payload);
    peer = address.c_str(); query = "{}";
    peerPort = port; observedAt = now(); eventUdp = &udp;
    std::string response;
    ++current->udpInvocations;
    execute(current->service, response);
    eventUdp = nullptr;
    return true;
}

// Runs at most one daemon invocation: a pending owned datagram first, otherwise a due timer turn.
bool ServiceHost::runDaemon(Daemon& daemon) {
    bool udpEvent = false;
    if (daemon.udp) {
        const int size = daemon.udp->parsePacket();
        if (size > 0) {
            if (size > static_cast<int>(DAEMON_DATAGRAM_LIMIT)) {
                daemon.udp->flush(); ++daemon.droppedDatagrams;
                Serial.printf("[SERVICE-HOST] Daemon datagram dropped bytes=%d port=%u\n", size, daemon.udpPort);
                return true;
            } else {
                // Release the socket's pbuf before testing VM headroom or allocating its event string.
                std::array<uint8_t, DAEMON_DATAGRAM_LIMIT> payload;
                if (daemon.udp->read(payload.data(), size) != size) {
                    ++daemon.droppedDatagrams; daemon.lastError = "Incomplete daemon UDP datagram";
                    Serial.println("[SERVICE-HOST] Incomplete daemon UDP datagram");
                    return true;
                }
                const size_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
                if (largest < DAEMON_UDP_HEAP_FLOOR) {
                    ++daemon.shedDatagrams;
                    Serial.printf("[SERVICE-HOST] Daemon datagram shed bytes=%d largest=%u\n", size,
                        static_cast<unsigned>(largest));
                    return true;
                }
                const auto address = daemon.udp->remoteIP().toString();
                method = "UDP"; path = "/daemon/udp";
                body.assign(reinterpret_cast<const char*>(payload.data()), size);
                peer = address.c_str(); query = "{}"; peerPort = daemon.udp->remotePort();
                eventUdp = daemon.udp.get();
                ++daemon.udpEvents;
                udpEvent = true;
            }
        }
    }
    if (!udpEvent) {
        if (now() < daemon.nextTick) return false;
        method = "TIMER"; path = "/daemon"; body.clear(); peer.clear(); query = "{}";
        peerPort = 0; eventUdp = nullptr;
        ++daemon.timerRuns; ++current->daemonInvocations;
        daemon.nextTick = now() + daemon.unit.interval;
    }
    observedAt = now();
    std::string response;
    const bool ok = execute(daemon.unit, response);
    eventUdp = nullptr;
    if (!ok) {
        ++daemon.failures;
        daemon.lastError = current->lastError.substr(0, 127);
    } else if (udpEvent || !daemon.udp) daemon.lastError.clear();
    return true;
}

// One background turn per context: rotates service UDP and each daemon, running at most one program.
bool ServiceHost::backgroundTurn(Context& context) {
    const size_t sources = context.daemonCount + 1;
    for (size_t offset = 0; offset < sources; ++offset) {
        const size_t source = (context.nextSource + offset) % sources;
        const bool ran = source == 0 ? pollUdpEvent() : runDaemon(context.daemons[source - 1]);
        if (!ran) continue;
        context.nextSource = (source + 1) % sources;
        return true;
    }
    return false;
}

void ServiceHost::worker(void* context) {
    auto& host = *static_cast<ServiceHost*>(context);
    for (;;) {
        if (xSemaphoreTake(host.mutex, 0) == pdTRUE) {
            if (host.active) {
                try {
                    const auto event = host.takeHttpEvent();
                    if (event) host.executeHttpEvent(event);
                    for (size_t offset = 0; offset < SERVICE_LIMIT; ++offset) {
                        const auto context = host.services[(host.nextBackgroundService + offset) % SERVICE_LIMIT];
                        if (!context) continue;
                        host.current = context;
                        host.backgroundTurn(*context);
                        // Only one service gets a UDP/daemon turn per worker pass.
                        host.nextBackgroundService = (host.nextBackgroundService + offset + 1) % SERVICE_LIMIT;
                        break;
                    }
                } catch (const std::bad_alloc&) {
                    if (host.current) host.current->lastError = "Worker event allocation failed";
                    else host.hostError = "Worker event allocation failed";
                    Serial.println("[SERVICE-HOST] Worker event allocation failed");
                }
            }
            xSemaphoreGive(host.mutex);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

std::string ServiceHost::status(const std::string& id) {
    if (!mutex) return "{\"running\":false,\"hostBindingsVersion\":1}";
    if (xSemaphoreTake(mutex, 0) != pdTRUE)
        return "{\"busy\":true,\"hostBindingsVersion\":1,\"executionModel\":\"single-worker\"}";
    SemaphoreRelease release{mutex};
    try {
    JsonDocument doc;
    doc["running"] = active.load(); doc["hostBindingsVersion"] = 1; doc["runtime"] = "pascalish-esp32";
    doc["executionModel"] = "single-worker";
    doc["httpEventCapacity"] = HTTP_EVENT_LIMIT;
    doc["serviceCapacity"] = SERVICE_LIMIT;
    doc["workerTaskCount"] = task ? 1 : 0;
    size_t pending = 0;
    if (ingressMutex) {
        xSemaphoreTake(ingressMutex, portMAX_DELAY);
        for (const auto& event : httpEvents) if (event && !event->ready.load()) ++pending;
        xSemaphoreGive(ingressMutex);
    }
    doc["pendingHttpEvents"] = pending;
    const Context* selected = nullptr;
    size_t serviceCount = 0;
    if (id.empty()) {
        auto list = doc["services"].to<JsonArray>();
        for (const auto& context : services) if (context) {
            ++serviceCount;
            if (!selected) selected = context.get();
            describe(list.add<JsonObject>(), *context, false);
        }
    } else {
        for (const auto& context : services) if (context) {
            ++serviceCount;
            if (context->collectorId == id) selected = context.get();
        }
    }
    doc["serviceCount"] = serviceCount;
    if (selected) {
        if (id.empty()) {
            describe(doc.as<JsonObject>(), *selected, serviceCount < 2);
            if (serviceCount > 1) {
                auto summary = doc["network"].to<JsonObject>();
                summary["allowedPeers"] = selected->network.allowed.size();
                summary["exchanges"] = selected->network.exchanges;
                summary["failures"] = selected->network.failures;
            }
        }
        else {
            doc["collectorId"] = selected->collectorId;
            doc["bootId"] = selected->bootId;
            doc["udpPort"] = selected->udpPort;
            doc["observationTtlMs"] = selected->ttl;
            doc["daemonIntervalMs"] = selected->daemons[0].unit.interval;
            doc["lastError"] = selected->lastError;
            daemonDiagnostics(doc["daemons"].to<JsonArray>(), *selected);
            doc["cacheEntries"] = selected->caches->entries();
            doc["cacheBytes"] = selected->caches->storageBytes();
            size_t count = 0;
            for (const auto& table : selected->tables) count += table.second.size();
            doc["entries"] = count;
            doc["httpInvocations"] = selected->httpInvocations;
            doc["udpInvocations"] = selected->udpInvocations;
            doc["daemonInvocations"] = selected->daemonInvocations;
            auto network = doc["network"].to<JsonObject>();
            network["allowedPeers"] = selected->network.allowed.size();
        }
    } else if (!id.empty()) doc["error"] = "Hosted service not found";
    doc["freeHeapBytes"] = ESP.getFreeHeap();
    doc["largestFreeBlockBytes"] = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
    if (task) doc["workerStackHighWaterBytes"] = uxTaskGetStackHighWaterMark(task);
    std::string result;
    if (doc.overflowed()) throw std::bad_alloc();
    const auto bytes = measureJson(doc);
    result.reserve(bytes);
    if (serializeJson(doc, result) != bytes) throw std::bad_alloc();
    return result;
    } catch (const std::bad_alloc&) {
        Serial.println("[SERVICE-HOST] Status allocation failed");
        return "{\"error\":\"Hosted status allocation failed\",\"unavailable\":true}";
    }
}

void ServiceHost::daemonDiagnostics(JsonArray list, const Context& context) {
    for (size_t index = 0; index < context.daemonCount; ++index) {
        const auto& daemon = context.daemons[index];
        auto item = list.add<JsonObject>();
        item["index"] = index;
        item["intervalMs"] = daemon.unit.interval;
        item["udpPort"] = daemon.udpPort;
        if (!daemon.multicastGroup.empty()) {
            item["multicastGroup"] = daemon.multicastGroup;
            item["multicastInterface"] = WiFi.localIP().toString();
        }
        item["timerRuns"] = daemon.timerRuns;
        item["udpEvents"] = daemon.udpEvents;
        item["failures"] = daemon.failures;
        item["droppedDatagrams"] = daemon.droppedDatagrams;
        item["shedDatagrams"] = daemon.shedDatagrams;
        item["lastError"] = daemon.lastError;
        if (daemon.unit.image) item["instructionCount"] = daemon.unit.image->size();
    }
}

void ServiceHost::describe(JsonObject doc, const Context& context, bool details) {
    const auto& collectorId = context.collectorId;
    const auto& bootId = context.bootId;
    const auto udpPort = context.udpPort;
    const auto ttl = context.ttl;
    const auto& daemon = context.daemons[0].unit;
    const auto& service = context.service;
    const auto& tables = context.tables;
    const auto& lastError = context.lastError;
    const auto& lastHttpJsonMetrics = context.lastHttpJsonMetrics;
    doc["collectorId"] = collectorId; doc["bootId"] = bootId; doc["udpPort"] = udpPort;
    doc["observationTtlMs"] = ttl; doc["daemonIntervalMs"] = daemon.interval;
    doc["lastError"] = lastError;
    size_t count = 0;
    for (const auto& table : tables) count += table.second.size();
    doc["entries"] = count;
    if (service.image) {
        doc["instructionStorage"] = "ffs-paged";
        doc["instructionCount"] = service.image->size();
        doc["instructionPageReads"] = service.image->pageReads;
        doc["instructionCacheHits"] = service.image->cacheHits;
    }
    doc["httpInvocations"] = context.httpInvocations;
    doc["udpInvocations"] = context.udpInvocations;
    doc["daemonInvocations"] = context.daemonInvocations;
    doc["cacheEntries"] = context.caches->entries();
    doc["cacheBytes"] = context.caches->storageBytes();
    daemonDiagnostics(doc["daemons"].to<JsonArray>(), context);
    if (!details) return;
    network.diagnostics(doc["network"].to<JsonObject>(), context.network);
    auto json = doc["lastHttpJson"].to<JsonObject>();
    json["parses"] = lastHttpJsonMetrics.parses;
    json["parseFailures"] = lastHttpJsonMetrics.parseFailures;
    json["parseUs"] = lastHttpJsonMetrics.parseUs;
    json["serializations"] = lastHttpJsonMetrics.serializations;
    json["serializationFailures"] = lastHttpJsonMetrics.serializationFailures;
    json["measureUs"] = lastHttpJsonMetrics.measureUs;
    json["writeUs"] = lastHttpJsonMetrics.writeUs;
    json["inputBytes"] = lastHttpJsonMetrics.inputBytes;
    json["outputBytes"] = lastHttpJsonMetrics.outputBytes;
}
} // namespace pmachine
#endif
