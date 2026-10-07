#pragma once
#if defined(ESP32)
#include "pmachine.h"
#include <ArduinoJson.h>
#include <array>
#include <memory>
#include <vector>
#include <freertos/semphr.h>

namespace pmachine {
class HostedImage {
public:
    bool open(FederatedFileSystem& ffs, const String& path, const JsonDocument& map,
              const char* key, const char* keyId, std::string& error);
    bool read(size_t index, PInstruction& instruction, std::string& error);
    void reset();
    size_t size() const { return count; }
    size_t cacheHits = 0, pageReads = 0;
private:
    static constexpr size_t PAGE_BYTES = 512, CACHE_PAGES = 4, MAX_PAGES = 64;
    struct Page {
        std::array<uint8_t, PAGE_BYTES> bytes{};
        HostedImage* owner = nullptr;
        size_t number = MAX_PAGES;
        size_t length = 0;
        uint32_t age = 0;
    };
    struct SharedCache {
        std::array<Page, CACHE_PAGES> pages;
        uint32_t tick = 0;
        StaticSemaphore_t mutexStorage;
        SemaphoreHandle_t mutex;
        SharedCache() : mutex(xSemaphoreCreateMutexStatic(&mutexStorage)) {}
    };
    static SharedCache& sharedCache();
    File file;
    std::vector<std::array<uint8_t, 32>> hashes;
    size_t fileBytes = 0, count = 0, poolBytes = 0;
    bool readBytes(size_t offset, uint8_t* target, size_t length, std::string& error);
    bool hex(size_t offset, size_t digits, uint32_t& value, std::string& error);
};
}
#endif
