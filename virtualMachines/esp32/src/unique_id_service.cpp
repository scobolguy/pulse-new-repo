#include "unique_id_service.h"

#ifndef DISABLE_UNIQUE_ID_SERVICE

#include <FS.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#include <esp_system.h>
#endif

#ifdef ENABLE_TIME_AUTHORITY
#include "time_authority.h"
#endif

namespace {

constexpr const char* COUNTER_DIR = "/id";
constexpr const char* COUNTER_PATH = "/id/.uid-counter.json";
constexpr uint32_t COUNTER_SAVE_INTERVAL = 64;

struct UniqueIdState {
    bool started = false;
    String nodeName;
    String deviceId;
    uint32_t counter = 0;
    uint32_t bootNonce = 0;
    unsigned long long lastRawNowMs = 0;
    unsigned long long lastNowMs = 0;
    uint32_t rollbackGuardCount = 0;
};

UniqueIdState gUid;

uint64_t fnv1a64(const uint8_t* data, size_t len) {
    uint64_t hash = 1469598103934665603ULL;
    for (size_t i = 0; i < len; ++i) {
        hash ^= static_cast<uint64_t>(data[i]);
        hash *= 1099511628211ULL;
    }
    return hash;
}

String hexU64(uint64_t value, uint8_t width = 16) {
    char buf[24];
    snprintf(buf, sizeof(buf), "%0*llX", width, static_cast<unsigned long long>(value));
    return String(buf);
}

String hexU32(uint32_t value, uint8_t width = 8) {
    char buf[16];
    snprintf(buf, sizeof(buf), "%0*lX", width, static_cast<unsigned long>(value));
    return String(buf);
}

String hexU16(uint16_t value, uint8_t width = 4) {
    char buf[8];
    snprintf(buf, sizeof(buf), "%0*X", width, static_cast<unsigned int>(value));
    return String(buf);
}

void loadCounter() {
    if (!LittleFS.exists(COUNTER_PATH)) {
        gUid.counter = 0;
        return;
    }

    File f = LittleFS.open(COUNTER_PATH, "r");
    if (!f) {
        gUid.counter = 0;
        return;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        gUid.counter = 0;
        return;
    }

    if (doc["counter"].is<uint32_t>()) {
        gUid.counter = doc["counter"].as<uint32_t>();
    }
}

void saveCounter() {
    if (!LittleFS.exists(COUNTER_DIR)) {
        LittleFS.mkdir(COUNTER_DIR);
    }

    JsonDocument doc;
    doc["counter"] = gUid.counter;
    doc["nodeName"] = gUid.nodeName;

    File f = LittleFS.open(COUNTER_PATH, "w");
    if (!f) {
        return;
    }
    serializeJson(doc, f);
    f.close();
}

unsigned long long bestNowMs() {
#ifdef ENABLE_TIME_AUTHORITY
    const unsigned long long authorityNow = timeAuthorityNowMs();
    if (authorityNow > 0) {
        return authorityNow;
    }
#endif
    return static_cast<unsigned long long>(millis());
}

uint32_t random32() {
#if defined(ARDUINO_ARCH_ESP8266)
    uint32_t high = static_cast<uint32_t>(random(0, 65536));
    uint32_t low = static_cast<uint32_t>(random(0, 65536));
    return (high << 16) | low;
#else
    return esp_random();
#endif
}

} // namespace

void uniqueIdBegin(const String& nodeName) {
    gUid.nodeName = nodeName;

#if defined(ARDUINO_ARCH_ESP8266)
    randomSeed(static_cast<unsigned long>(micros()) ^ ESP.getChipId());
#else
    randomSeed(static_cast<unsigned long>(esp_random()));
#endif

    uint8_t mac[6] = {0, 0, 0, 0, 0, 0};
    WiFi.macAddress(mac);

    const uint64_t macHash = fnv1a64(mac, sizeof(mac));
    gUid.deviceId = String("dev-") + hexU64(macHash, 16);

    gUid.bootNonce = random32();
    if (gUid.bootNonce == 0) {
        gUid.bootNonce = 1;
    }

    loadCounter();
    saveCounter();
    gUid.started = true;
}

String uniqueIdGetDeviceId() {
    if (!gUid.started) {
        return "uninitialized";
    }
    return gUid.deviceId;
}

String uniqueIdNext(const String& kind) {
    if (!gUid.started) {
        uniqueIdBegin("unknown");
    }

    const unsigned long long rawNowMs = bestNowMs();
    unsigned long long nowMs = rawNowMs;
    if (gUid.lastNowMs > 0 && nowMs <= gUid.lastNowMs) {
        nowMs = gUid.lastNowMs + 1;
        gUid.rollbackGuardCount += 1;
    }

    gUid.lastRawNowMs = rawNowMs;
    gUid.lastNowMs = nowMs;
    gUid.counter += 1;

    const uint16_t rand16 = static_cast<uint16_t>(random32() & 0xFFFFU);
    const String prefix = (kind.length() > 0) ? kind : "evt";

    String id;
    id.reserve(96);
    id += prefix;
    id += "-";
    id += gUid.deviceId;
    id += "-";
    id += hexU64(static_cast<uint64_t>(nowMs), 12);
    id += "-";
    id += hexU32(gUid.counter, 8);
    id += "-";
    id += hexU16(rand16, 4);
    id += "-";
    id += hexU32(gUid.bootNonce, 8);

    if ((gUid.counter % COUNTER_SAVE_INTERVAL) == 0U) {
        saveCounter();
    }

    return id;
}

String uniqueIdBuildStatusJson() {
    JsonDocument doc;
    doc["enabled"] = true;
    doc["started"] = gUid.started;
    doc["strategy"] = "hybrid-mac-hash-time-counter-random";
    doc["nodeName"] = gUid.nodeName;
    doc["deviceId"] = gUid.deviceId;
    doc["counter"] = gUid.counter;
    doc["bootNonce"] = gUid.bootNonce;
    doc["lastRawNowMs"] = gUid.lastRawNowMs;
    doc["lastNowMs"] = gUid.lastNowMs;
    doc["rollbackGuardCount"] = gUid.rollbackGuardCount;

    String out;
    serializeJson(doc, out);
    return out;
}

uint32_t uniqueIdGetCounter() {
    return gUid.counter;
}

#endif
