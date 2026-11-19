#pragma once
#if defined(ESP32)
#include "pmachine.h"
#include "authenticated_page_hashes.h"
#include <ArduinoJson.h>
#include <array>
#include <cstdlib>
#include <limits>
#include <memory>
#include <freertos/semphr.h>

namespace pmachine {
class HostedImage {
public:
    ~HostedImage() { reset(); }
    bool open(FederatedFileSystem& ffs, const String& path, const JsonDocument& map,
              const char* key, const char* keyId, std::string& error);
    bool read(size_t index, PInstruction& instruction, std::string& error);
    void reset();
    size_t size() const { return count; }
    bool isResident() const { return resident != nullptr; }
    const char* hashStorage() const {
        return hashes.inMemory() ? "psram" : hashPagingOwner
            ? hashPagingOwner->pagingBackend() == FFSBackend::Remote ? "ffs-remote" : "ffs-sd" : "none";
    }
    size_t hashStorageBytes() const { return hashes.storageBytes(); }
    size_t cacheHits = 0, pageReads = 0;
    struct CacheStats { size_t reservedBytes, pages; bool psram; };
    static CacheStats cacheStats();
private:
    static constexpr size_t PAGE_BYTES = 512, CACHE_PAGES = 4;
    static constexpr size_t INVALID_PAGE = std::numeric_limits<size_t>::max();
    struct Page {
        std::array<uint8_t, PAGE_BYTES> bytes{};
        HostedImage* owner = nullptr;
        size_t number = INVALID_PAGE;
        size_t length = 0;
        uint32_t age = 0;
    };
    struct SharedCache {
        std::array<Page, CACHE_PAGES> pages;
        Page* psramPages = nullptr;
        size_t psramPageCount = 0, reservedBytes = 0;
        uint32_t tick = 0;
        StaticSemaphore_t mutexStorage;
        SemaphoreHandle_t mutex;
        SharedCache() : mutex(xSemaphoreCreateMutexStatic(&mutexStorage)) {}
    };
    static SharedCache& sharedCache();
    static bool initializeCache(SharedCache& cache, std::string& error);
    File file;
    std::unique_ptr<uint8_t, void(*)(void*)> resident{nullptr, std::free};
    AuthenticatedPageHashes<File> hashes;
    File hashPagingFile;
    FederatedFileSystem* hashPagingOwner = nullptr;
    String hashPagingPath;
    std::array<uint8_t, 32> hashPagingKey{};
    static bool authenticateHash(void* context, size_t page, const uint8_t* digest, uint8_t* tag);
    size_t fileBytes = 0, count = 0, poolBytes = 0;
    bool readBytes(size_t offset, uint8_t* target, size_t length, std::string& error);
    bool hex(size_t offset, size_t digits, uint32_t& value, std::string& error);
};
}
#endif
