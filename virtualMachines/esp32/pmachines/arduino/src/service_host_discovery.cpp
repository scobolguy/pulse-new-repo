#include "service_host.h"
#if defined(ESP32)
#include "lan_discovery_image.h"
#include "profile_config.h"
#include <WiFi.h>
#include <esp_timer.h>
#include <esp_system.h>
#include <esp_heap_caps.h>
#include <algorithm>
#include <limits>

namespace pmachine {
namespace {
uint64_t discoveryClock() { return static_cast<uint64_t>(esp_timer_get_time()) / 1000; }
std::string nonce() {
    char value[32];
    snprintf(value, sizeof(value), "%08lx-%08lx", static_cast<unsigned long>(esp_random()),
             static_cast<unsigned long>(esp_random()));
    return value;
}
}

bool ServiceHost::startDiscovery(FederatedFileSystem& ffs, uint16_t udpPort, const std::string& nodeId,
                                 uint16_t httpPort, std::string& error) {
    if (!udpPort || !httpPort || nodeId.empty() || nodeId.size() > 128) {
        error = "LAN discovery requires explicit node identity and bound UDP/HTTP ports"; return false;
    }
    if (!prepare(error)) return false;
    if (xSemaphoreTake(mutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        error = "LAN discovery host busy"; return false;
    }
    bool ok = false;
    try {
        JsonDocument map;
        if (deserializeJson(map, LAN_DISCOVERY_MAP)) error = "Invalid built-in LAN discovery map";
        else {
            const std::string signature = map["signing"]["signature"] | "";
            const String path = String("/lan-") + String(signature.substr(0, 16).c_str()) + ".phi";
            auto file = ffs.openReadFile(path);
            const bool exists = file && file.size() == sizeof(LAN_DISCOVERY_IMAGE) - 1;
            file.close();
            bool written = exists;
            if (!exists) {
                const int handle = ffs.openFile(path, "w");
                written = handle >= 0;
                for (size_t offset = 0; written && offset < sizeof(LAN_DISCOVERY_IMAGE) - 1; offset += 512) {
                    const size_t length = std::min(size_t(512), sizeof(LAN_DISCOVERY_IMAGE) - 1 - offset);
                    written = ffs.writeBytes(handle,
                        reinterpret_cast<const uint8_t*>(LAN_DISCOVERY_IMAGE + offset), length) == length;
                }
                if (handle >= 0) written = ffs.closeFile(handle) && written;
                if (!written) ffs.remove(path);
            }
            if (!written) error = "Unable to persist signed LAN discovery policy";
            else {
                auto context = std::make_shared<Context>();
                context->service.internalPolicy = true;
                // The internal policy has its own image lease; installed services retain all six.
                context->service.image = std::shared_ptr<HostedImage>(new HostedImage(), [](HostedImage* image) {
                    image->reset(); delete image;
                });
                if (context->service.image->open(ffs, path, map, PROFILE_PCODE_SIGNING_KEY,
                                                PROFILE_PCODE_SIGNING_KEY_ID, error)
                    && validateUnit(map, "service", context->service, error)) {
                    context->collectorId = nodeId;
                    context->bootId = nonce();
                    discovery = std::move(context);
                    discoveryPort = udpPort;
                    discoveryHttpPort = httpPort;
                    discoveryPollAt = 0;
                    ok = true;
                }
            }
        }
    } catch (const std::bad_alloc&) { error = "LAN discovery bootstrap allocation failed"; }
    hostError = ok ? "" : error;
    xSemaphoreGive(mutex);
    return ok;
}

bool ServiceHost::discoveryCall(const char* route, const JsonDocument& request, JsonDocument& response) {
    if (!discovery || measureJson(request) > 8192 || request.overflowed()) return false;
    current = discovery;
    method = "POST"; path = route; body.clear();
    if (serializeJson(request, body) != measureJson(request)) return false;
    peer.clear(); query.clear(); parentTransactionId.clear(); ingressAggregatorId.clear();
    observedAt = discoveryClock(); eventUdp = nullptr;
    std::string output;
    if (!execute(discovery->service, output) || deserializeJson(response, output)
        || !response["ok"].as<bool>()) return false;
    return true;
}

std::vector<ServiceHost::AggregatorTarget> ServiceHost::reportTargetsFor(const Context& context) const {
    // Explicit URLs and credentials override transport-learned URLs for the same identity.
    auto targets = context.lifecycle.reportTargets;
    for (const auto& learned : learnedReportTargets) {
        if (std::none_of(targets.begin(), targets.end(), [&](const AggregatorTarget& target) {
            return target.aggregatorId == learned.aggregatorId;
        })) targets.push_back(learned);
    }
    return targets;
}

bool ServiceHost::publishDiscoveryTargets(JsonVariantConst targets) {
    if (!targets.is<JsonArrayConst>() || measureJson(targets) > 8192) return false;
    std::string snapshot;
    if (serializeJson(targets, snapshot) != measureJson(targets)) return false;
    std::vector<AggregatorTarget> reports;
    for (JsonVariantConst target : targets.as<JsonArrayConst>()) {
        AggregatorTarget learned;
        learned.aggregatorId = target["aggregatorId"].as<std::string>();
        learned.endpoint = target["endpoint"].as<std::string>() + "/api/runtime/instances/report";
        reports.push_back(std::move(learned));
    }
    discoveryTargets = std::move(snapshot);
    learnedReportTargets = std::move(reports);
    return true;
}

void ServiceHost::discoveryTurn() {
    if (!discovery) return;
    const uint64_t timestamp = discoveryClock();
    if (timestamp < discoveryPollAt) return;
    discoveryPollAt = timestamp + discoveryPollMs;
    if (WiFi.status() != WL_CONNECTED) {
        discoveryUdp.stop(); discoverySocketReady = false;
        discoveryAddress.clear(); discoveryEndpoint.clear(); discoveryTargets = "[]"; learnedReportTargets.clear();
        discoveryRequestId.clear(); discoveryNextAt = -1;
        return;
    }
    const std::string address = WiFi.localIP().toString().c_str();
    if (address != discoveryAddress) {
        discoveryUdp.stop(); discoverySocketReady = false;
        discoveryTargets = "[]"; learnedReportTargets.clear(); discoveryRequestId.clear();
        discoveryNextAt = -1; discoveryAdvertiseAt = 0; discoveryEndpoint.clear(); discoveryAddress = address;
    }
    if (!discoverySocketReady) {
        // An ephemeral owned socket avoids consuming the firmware's beacon/ingress port.
        discoverySocketReady = discoveryUdp.begin(0);
        if (!discoverySocketReady) return;
        JsonDocument request, settings;
        if (!discoveryCall("/settings", request, settings)) {
            discoverySocketReady = false; discoveryUdp.stop(); return;
        }
        discoveryPollMs = settings["pollMs"] | 1000;
        discoveryJitterMs = settings["jitterMs"] | 1000;
        discoveryAdvertiseMs = settings["announcementIntervalMs"] | 10000;
        discoveryClockPeriodMs = settings["clockPeriodMs"] | 1073741824;
        if (!discoveryClockPeriodMs || discoveryClockPeriodMs > INT32_MAX) {
            discoverySocketReady = false; discoveryUdp.stop(); return;
        }
        discoveryPacketLimit = std::min(size_t(4096), settings["maxPacketBytes"].as<size_t>());
    }
    // Only Pascalish compares these wrapped deadlines; transport scheduling uses the 64-bit clock.
    const int32_t policyTime = static_cast<int32_t>(timestamp % discoveryClockPeriodMs);
    JsonDocument request, response, targets;
    if (timestamp >= discoveryAdvertiseAt) {
        request["nodeId"] = discovery->collectorId;
        request["localAddress"] = address;
        auto listener = request["listeners"].to<JsonArray>().add<JsonObject>();
        listener["protocol"] = "http"; listener["host"] = address; listener["port"] = discoveryHttpPort;
        auto metadata = request["metadata"].to<JsonObject>();
        metadata["hardware"] = "ESP32"; metadata["runtime"] = "esp32-pmachine";
        auto advertised = metadata["services"].to<JsonArray>();
        advertised.add("pmachine");
        for (const auto& context : services) if (context) advertised.add(context->collectorId);
        if (discoveryCall("/advertise", request, response)) {
            discoveryEndpoint = response["endpoint"].as<std::string>();
            std::string packet;
            if (measureJson(response["packet"]) <= discoveryPacketLimit
                && serializeJson(response["packet"], packet) == measureJson(response["packet"])) {
                const IPAddress broadcast(uint32_t(WiFi.localIP()) | ~uint32_t(WiFi.subnetMask()));
                if (discoveryUdp.beginPacket(broadcast, discoveryPort) == 1) {
                    const bool written = discoveryUdp.write(reinterpret_cast<const uint8_t*>(packet.data()), packet.size()) == packet.size();
                    const bool sent = discoveryUdp.endPacket() == 1;
                    if (written && sent) discoveryAdvertiseAt = timestamp + discoveryAdvertiseMs;
                }
            }
        }
        request.clear(); response.clear();
    }
    if (deserializeJson(targets, discoveryTargets)) return;
    request["targets"].set(targets.as<JsonVariantConst>());
    request["nowMs"] = policyTime;
    if (!discoveryCall("/targets", request, response) || !publishDiscoveryTargets(response["targets"])) {
        learnedReportTargets.clear(); return;
    }
    // Drain a bounded number of replies; every acceptance/expiry decision belongs to Pascalish.
    for (size_t index = 0; index < 4; ++index) {
        const int bytes = discoveryUdp.parsePacket();
        if (bytes <= 0) break;
        if (static_cast<size_t>(bytes) > discoveryPacketLimit || ESP.getFreeHeap() < 32768
            || heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) < 8192) {
            discoveryUdp.flush(); continue;
        }
        const String source = discoveryUdp.remoteIP().toString();
        std::string packet(bytes, '\0');
        if (discoveryUdp.read(reinterpret_cast<uint8_t*>(&packet[0]), bytes) != bytes) {
            discoveryUdp.flush(); continue;
        }
        JsonDocument message;
        if (deserializeJson(message, packet)) continue;
        request.clear(); response.clear();
        request["packet"].set(message.as<JsonVariantConst>());
        request["peer"] = source;
        request["localAddress"] = address;
        request["requestId"] = discoveryRequestId;
        request["nowMs"] = policyTime;
        if (deserializeJson(targets, discoveryTargets)) continue;
        request["targets"].set(targets.as<JsonVariantConst>());
        if (discoveryCall("/accept", request, response)) {
            if (publishDiscoveryTargets(response["targets"])) discoveryPollAt = 0;
        }
    }
    request.clear(); response.clear();
    request["nowMs"] = policyTime; request["nextAt"] = discoveryNextAt;
    if (!discoveryCall("/poll", request, response) || !response["send"].as<bool>()) return;
    const std::string requestId = nonce();
    request.clear(); response.clear();
    request["nodeId"] = discovery->collectorId; request["bootId"] = discovery->bootId;
    request["requestId"] = requestId; request["nowMs"] = policyTime;
    request["jitterMs"] = discoveryJitterMs ? esp_random() % (discoveryJitterMs + 1) : 0;
    if (!discoveryCall("/request", request, response)) return;
    std::string packet;
    if (measureJson(response["packet"]) > discoveryPacketLimit
        || serializeJson(response["packet"], packet) != measureJson(response["packet"])) return;
    const IPAddress broadcast(uint32_t(WiFi.localIP()) | ~uint32_t(WiFi.subnetMask()));
    if (discoveryUdp.beginPacket(broadcast, discoveryPort) == 1
        && discoveryUdp.write(reinterpret_cast<const uint8_t*>(packet.data()), packet.size()) == packet.size()
        && discoveryUdp.endPacket() == 1) {
        discoveryRequestId = requestId;
        discoveryNextAt = response["nextAt"].as<int32_t>();
    }
}
}
#endif
