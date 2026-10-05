#include "service_host.h"
#if defined(ESP32)
#include <esp_timer.h>
#include <esp_system.h>
#include <limits>
#include <new>

namespace pmachine {
namespace {
constexpr size_t BODY_LIMIT = 2048, RESPONSE_LIMIT = 20480, STORAGE_LIMIT = 16384;
uint64_t now() { return static_cast<uint64_t>(esp_timer_get_time()) / 1000; }
struct Binding { const char* name; const char* args; bool text; };
const Binding bindings[] = {
    {"clock", "", false}, {"event_body", "", true}, {"event_peer", "", true},
    {"event_port", "", false}, {"event_method", "", true}, {"event_path", "", true},
    {"event_query", "s", true},
    {"collector_id", "", true}, {"boot_id", "", true}, {"next_sequence", "", false},
    {"observation_ttl", "", false}, {"announcement", "ss", true},
    {"json_text", "ss", true}, {"json_set", "ssv", true}, {"json_embed", "sss", true},
    {"json_merge", "ss", true}, {"table_get", "ss", true}, {"table_put", "sssi", false},
    {"table_expire", "s", false}, {"table_snapshot", "ssi", true},
    {"udp_reply", "s", false}, {"http_status", "i", false}
};
const Binding* binding(const std::string& symbol) {
    if (symbol.rfind("host.", 0) != 0) return nullptr;
    for (const auto& item : bindings) if (symbol.substr(5) == item.name) return &item;
    return nullptr;
}
bool object(const std::string& json, JsonDocument& doc) {
    return !deserializeJson(doc, json) && doc.is<JsonObject>();
}
bool identifier(const std::string& text) {
    return !text.empty() && text.size() <= 256 && text.find_first_not_of(" \t\r\n") != std::string::npos;
}
enum class SerializeResult { ok, tooLarge, noMemory };
SerializeResult serialize(const JsonDocument& doc, std::string& out) {
    const size_t size = measureJson(doc);
    if (size > RESPONSE_LIMIT) return SerializeResult::tooLarge;
    if (doc.overflowed()) return SerializeResult::noMemory;
    out.clear();
    try {
        out.reserve(size);
        return serializeJson(doc, out) == size ? SerializeResult::ok : SerializeResult::noMemory;
    } catch (const std::bad_alloc&) {
        return SerializeResult::noMemory;
    }
}
}

ServiceHost::ServiceHost() {
    machine.setHostCallHook(call, this);
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
    out.instructions = loadTextPCode(pcode);
    if (out.instructions.empty() || out.instructions.size() > 512) {
        error = "Hosted instruction capacity exceeded"; return false;
    }
    for (const auto& instruction : out.instructions) {
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
            if (instruction.intOperand < 0 || instruction.intOperand >= static_cast<int>(out.instructions.size())) {
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

bool ServiceHost::install(Unit newService, Unit newDaemon, const std::string& id, uint16_t port,
                          uint32_t newTtl, uint32_t heartbeat, std::string& error) {
    if (!identifier(id) || !port || !heartbeat || newTtl <= heartbeat || newTtl > 180000) {
        error = "TTL must exceed heartbeat interval, with maximum 180000 ms; valid collector ID/port required";
        return false;
    }
    if (!mutex) mutex = xSemaphoreCreateMutex();
    if (!mutex || xSemaphoreTake(mutex, 0) != pdTRUE) { error = "Service host busy or unavailable"; return false; }
    if (active) { error = "Stop the existing host before installing"; xSemaphoreGive(mutex); return false; }
    if (ESP.getFreeHeap() < 48000 || !udp.begin(port)) {
        error = "Insufficient heap or UDP bind failed"; xSemaphoreGive(mutex); return false;
    }
    service = std::move(newService);
    daemon = std::move(newDaemon);
    tableCapacities = service.tableCapacities;
    hasTableDeclarations = service.hasTableDeclarations;
    collectorId = id;
    char nonce[32];
    snprintf(nonce, sizeof(nonce), "%08lx-%08lx", static_cast<unsigned long>(esp_random()),
             static_cast<unsigned long>(esp_random()));
    bootId = nonce;
    ttl = newTtl;
    udpPort = port;
    sequence = 0;
    tables.clear();
    lastError.clear();
    nextTick = now();
    active = true;
    if (!task && xTaskCreate(worker, "pascalish-host", 16384, this, 1, &task) != pdPASS) {
        active = false; udp.stop(); service = Unit(); daemon = Unit();
        error = "Cannot create service host task"; xSemaphoreGive(mutex); return false;
    }
    xSemaphoreGive(mutex);
    return true;
}

bool ServiceHost::stop(std::string& error) {
    if (!mutex) return true;
    if (xSemaphoreTake(mutex, 0) != pdTRUE) { error = "Service host busy"; return false; }
    active = false;
    if (task) { vTaskDelete(task); task = nullptr; }
    udp.stop();
    tables.clear();
    tableCapacities.clear();
    hasTableDeclarations = false;
    service = Unit();
    daemon = Unit();
    machine.clearProcedureSignatures();
    xSemaphoreGive(mutex);
    return true;
}

bool ServiceHost::fail(const std::string& error, std::string& out, int status) {
    out = error;
    responseStatus = status;
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
    const auto* spec = binding(symbol);
    if (!spec || args.size() != strlen(spec->args)) return fail("Invalid host binding or arity", error);
    for (size_t i = 0; i < args.size(); ++i) {
        if ((spec->args[i] == 's' && !args[i].isString) || (spec->args[i] == 'i' && args[i].isString))
            return fail("Invalid host argument type", error);
        if (args[i].isString && args[i].text.size() > RESPONSE_LIMIT)
            return fail("Host argument size exceeded", error, 413);
    }
    result.isString = spec->text;
    const std::string op = spec->name;
    if (op == "event_body") result.text = body;
    else if (op == "event_peer") result.text = peer;
    else if (op == "event_port") result.integer = peerPort;
    else if (op == "event_method") result.text = method;
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
    } else if (op.rfind("json_", 0) == 0) {
        JsonDocument doc;
        if (!object(args[0].text, doc)) return fail("Expected JSON object", error);
        if (op == "json_merge") {
            JsonDocument next;
            if (!object(args[1].text, next)) return fail("Expected merge object", error);
            for (JsonPairConst pair : next.as<JsonObjectConst>()) doc[pair.key().c_str()].set(pair.value());
        } else {
            if (!identifier(args[1].text)) return fail("Invalid JSON key", error);
            if (op == "json_text") {
                if (!doc[args[1].text].is<const char*>()) return fail("Expected string field", error);
                result.text = doc[args[1].text].as<std::string>();
                return true;
            } else if (op == "json_set") {
                if (args[2].isString) doc[args[1].text] = args[2].text;
                else doc[args[1].text] = args[2].integer;
            } else {
                JsonDocument value;
                if (deserializeJson(value, args[2].text)) return fail("Invalid embedded JSON", error);
                doc[args[1].text].set(value.as<JsonVariantConst>());
            }
        }
        const auto serialized = serialize(doc, result.text);
        if (serialized != SerializeResult::ok)
            return fail("JSON response serialization failed", error,
                        serialized == SerializeResult::tooLarge ? 413 : 503);
    } else if (op.rfind("table_", 0) == 0) {
        if (!identifier(args[0].text)) return fail("Invalid table name", error);
        const auto definition = tableCapacities.find(args[0].text);
        if (hasTableDeclarations && definition == tableCapacities.end())
            return fail("Undeclared table", error);
        if (!tables.count(args[0].text) && tables.size() >= 2) return fail("Table capacity exceeded", error, 503);
        auto& table = tables[args[0].text];
        if (op == "table_expire") result.integer = expire(table);
        else if (op == "table_snapshot") {
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
                value["remainingTtlMs"] = entry->second.deadline - timestamp;
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
    responseStatus = 200;
    machine.setProcedureSignatures(unit.signatures);
    machine.run(unit.instructions);
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

bool ServiceHost::dispatch(const std::string& newMethod, const std::string& newPath, const std::string& newBody,
                           const std::string& newPeer, const std::string& newQuery,
                           int& statusCode, std::string& response) {
    const auto ingress = now();
    if (newBody.size() > BODY_LIMIT) { statusCode = 413; response = "Event body too large"; return false; }
    if (!mutex || xSemaphoreTake(mutex, 0) != pdTRUE) { statusCode = 503; response = "Service host busy or unavailable"; return false; }
    if (!active) { statusCode = 503; response = "Service host stopped"; xSemaphoreGive(mutex); return false; }
    method = newMethod; path = newPath; body = newBody; peer = newPeer;
    query = newQuery; peerPort = 0; observedAt = ingress;
    const bool ok = execute(service, response);
    statusCode = responseStatus;
    xSemaphoreGive(mutex);
    return ok;
}

void ServiceHost::worker(void* context) {
    auto& host = *static_cast<ServiceHost*>(context);
    for (;;) {
        if (xSemaphoreTake(host.mutex, 0) == pdTRUE) {
            if (host.active) {
                const int size = host.udp.parsePacket();
                if (size > 0) {
                    if (size <= static_cast<int>(BODY_LIMIT)) {
                        std::string payload(size, '\0');
                        const auto address = host.udp.remoteIP().toString();
                        const auto port = host.udp.remotePort();
                        if (host.udp.read(reinterpret_cast<uint8_t*>(&payload[0]), size) == size) {
                            host.method = "POST"; host.path = "/events/udp"; host.body = std::move(payload);
                            host.peer = address.c_str(); host.query = "{}";
                            host.peerPort = port; host.observedAt = now();
                            std::string response;
                            host.execute(host.service, response);
                        } else {
                            host.lastError = "Incomplete UDP datagram";
                            Serial.println("[SERVICE-HOST] Incomplete UDP datagram");
                        }
                    } else {
                        host.udp.flush(); host.lastError = "UDP event body too large";
                        Serial.println("[SERVICE-HOST] UDP event body too large");
                    }
                }
                if (now() >= host.nextTick) {
                    host.method = "TIMER"; host.path = "/daemon"; host.body.clear();
                    host.peer.clear(); host.query = "{}"; host.peerPort = 0; host.observedAt = now();
                    std::string response;
                    host.execute(host.daemon, response);
                    host.nextTick = now() + host.daemon.interval;
                }
            }
            xSemaphoreGive(host.mutex);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

std::string ServiceHost::status() {
    if (!mutex) return "{\"running\":false,\"hostBindingsVersion\":1}";
    if (xSemaphoreTake(mutex, pdMS_TO_TICKS(550)) != pdTRUE) return "{\"busy\":true,\"hostBindingsVersion\":1}";
    JsonDocument doc;
    doc["running"] = active; doc["hostBindingsVersion"] = 1; doc["runtime"] = "pascalish-esp32";
    doc["collectorId"] = collectorId; doc["bootId"] = bootId; doc["udpPort"] = udpPort;
    doc["observationTtlMs"] = ttl; doc["daemonIntervalMs"] = daemon.interval;
    doc["lastError"] = lastError;
    size_t count = 0;
    for (const auto& table : tables) count += table.second.size();
    doc["entries"] = count;
    std::string result;
    serializeJson(doc, result);
    xSemaphoreGive(mutex);
    return result;
}
} // namespace pmachine
#endif
