#include "hosted_image.h"
#if defined(ESP32)
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <mbedtls/sha256.h>
#include <cstring>
#include <esp_heap_caps.h>
#include <esp_system.h>
#include <limits>
#include <new>

namespace pmachine {
namespace {
struct CacheRelease {
    SemaphoreHandle_t mutex;
    ~CacheRelease() { xSemaphoreGive(mutex); }
};
}
HostedImage::SharedCache& HostedImage::sharedCache() {
    static SharedCache cache;
    return cache;
}
bool HostedImage::initializeCache(SharedCache& cache, std::string& error) {
    if (cache.psramPages || !ESP.getPsramSize()) return true;
    const size_t budget = ESP.getPsramSize() / 4;
    const size_t pageCount = budget / sizeof(Page);
    if (!pageCount) { error = "PSRAM too small for hosted instruction cache"; return false; }
    void* memory = heap_caps_malloc(budget, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!memory) { error = "Insufficient PSRAM for hosted instruction cache"; return false; }
    auto* pages = static_cast<Page*>(memory);
    for (size_t i = 0; i < pageCount; ++i) new (&pages[i]) Page();
    cache.psramPages = pages;
    cache.psramPageCount = pageCount;
    cache.reservedBytes = budget;
    return true;
}
HostedImage::CacheStats HostedImage::cacheStats() {
    auto& cache = sharedCache();
    if (!cache.mutex || xSemaphoreTake(cache.mutex, portMAX_DELAY) != pdTRUE) return {0, 0, false};
    CacheRelease release{cache.mutex};
    return {cache.reservedBytes, cache.psramPages ? cache.psramPageCount : CACHE_PAGES,
            cache.psramPages != nullptr};
}
void HostedImage::reset() {
    auto& cache = sharedCache();
    if (cache.mutex && xSemaphoreTake(cache.mutex, portMAX_DELAY) == pdTRUE) {
        for (auto& page : cache.pages) if (page.owner == this) {
            page.owner = nullptr; page.number = INVALID_PAGE; page.length = 0; page.age = 0;
        }
        for (size_t i = 0; i < cache.psramPageCount; ++i) {
            auto& page = cache.psramPages[i];
            if (page.owner == this) {
                page.owner = nullptr; page.number = INVALID_PAGE; page.length = 0; page.age = 0;
            }
        }
        xSemaphoreGive(cache.mutex);
    }
    file.close();
    resident.reset();
    hashes.reset();
    hashPagingFile.close();
    if (hashPagingOwner) {
        const auto status = hashPagingOwner->removePagingFile(hashPagingPath);
        if (status != FFSStatus::OK && status != FFSStatus::ERR_NOT_FOUND)
            Serial.printf("[HOSTED-IMAGE] Failed to remove hash paging file: %s\n", hashPagingPath.c_str());
    }
    hashPagingOwner = nullptr;
    hashPagingPath = "";
    hashPagingKey.fill(0);
    fileBytes = count = poolBytes = cacheHits = pageReads = 0;
}

bool HostedImage::authenticateHash(void* context, size_t page, const uint8_t* digest, uint8_t* tag) {
    const auto& key = static_cast<HostedImage*>(context)->hashPagingKey;
    std::array<uint8_t, 40> input;
    const uint64_t index = page;
    for (size_t byte = 0; byte < 8; ++byte) input[byte] = static_cast<uint8_t>(index >> (byte * 8));
    memcpy(input.data() + 8, digest, 32);
    const auto* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    return info && mbedtls_md_hmac(info, key.data(), key.size(), input.data(), input.size(), tag) == 0;
}

bool HostedImage::open(FederatedFileSystem& ffs, const String& path, const JsonDocument& map,
                       const char* key, const char* keyId, std::string& error) {
    file = ffs.openReadFile(path);
    // The verified page cache already buffers reads; avoid a second 4 KiB VFS buffer per image.
    if (file && ffs.backend() != FFSBackend::Remote && !file.setBufferSize(PAGE_BYTES))
        Serial.println("[HOSTED-IMAGE] Could not reduce local file read buffer");
    fileBytes = file ? file.size() : 0;
    const std::string profile = map["hostImageProfile"] | "storage-backed";
    if ((profile != "storage-backed" && profile != "bounded" && profile != "extended")
        || fileBytes < 20) {
        error = "Invalid hosted image profile or file size"; return false;
    }
    const size_t pages = fileBytes / PAGE_BYTES + (fileBytes % PAGE_BYTES != 0);
    using PageHash = AuthenticatedPageHashes<File>::Digest;
    if (pages > std::numeric_limits<size_t>::max() / sizeof(PageHash)) {
        error = "Hosted image page metadata exceeds addressable storage"; return false;
    }
    const size_t hashBytes = pages * sizeof(PageHash);
    if (ESP.getPsramSize()) {
        auto* memory = static_cast<PageHash*>(
            heap_caps_malloc(hashBytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        if (!memory) { error = "Insufficient PSRAM for authenticated hosted image hashes"; return false; }
        for (size_t page = 0; page < pages; ++page) new (&memory[page]) PageHash();
        hashes.attachMemory(memory, pages);
    } else {
        char path[64];
        snprintf(path, sizeof(path), "/pmachine-hashes-%08lx%08lx%08lx%08lx.swap",
            static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()),
            static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()));
        hashPagingPath = path;
        hashPagingFile = ffs.openPagingFile(hashPagingPath);
        if (!hashPagingFile) {
            error = "Authenticated image hashes require PSRAM, SD or remote FFS; local flash paging is prohibited";
            return false;
        }
        hashPagingOwner = &ffs;
        esp_fill_random(hashPagingKey.data(), hashPagingKey.size());
        if (!hashes.attachFile(hashPagingFile, pages, authenticateHash, this)) {
            error = "Hosted image hash paging exceeds addressable storage"; return false;
        }
    }
    if (map["hostImageResident"] == true) {
        resident.reset(static_cast<uint8_t*>(heap_caps_malloc(fileBytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)));
        if (!resident) { error = "Insufficient PSRAM for resident hosted image"; return false; }
    }
    const auto signing = map["signing"];
    if (std::string(signing["algorithm"] | "") != "hmac-sha256"
        || std::string(signing["keyId"] | "") != keyId
        || std::string(map["hostImageFormat"] | "") != "PHI1") {
        error = "Invalid hosted image signing metadata"; return false;
    }
    mbedtls_md_context_t context;
    mbedtls_md_init(&context);
    const auto* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    bool ok = info && mbedtls_md_setup(&context, info, 1) == 0
        && mbedtls_md_hmac_starts(&context, reinterpret_cast<const uint8_t*>(key), strlen(key)) == 0;
    std::array<uint8_t, PAGE_BYTES> buffer;
    std::array<uint8_t, 32> pageHash;
    for (size_t offset = 0; ok && offset < fileBytes;) {
        const size_t length = std::min(PAGE_BYTES, fileBytes - offset);
        ok = file.read(buffer.data(), length) == length
            && mbedtls_md_hmac_update(&context, buffer.data(), length) == 0
            && mbedtls_sha256_ret(buffer.data(), length, pageHash.data(), 0) == 0;
        if (ok && !hashes.write(offset / PAGE_BYTES, pageHash.data())) {
            mbedtls_md_free(&context);
            error = "Authenticated hosted image hash storage write failed"; return false;
        }
        if (ok && resident) memcpy(resident.get() + offset, buffer.data(), length);
        offset += length;
    }
    uint8_t digest[32];
    ok = ok && mbedtls_md_hmac_finish(&context, digest) == 0;
    mbedtls_md_free(&context);
    char signature[65];
    for (size_t i = 0; ok && i < 32; ++i) snprintf(signature + i * 2, 3, "%02x", digest[i]);
    if (!ok || std::string(signing["signature"] | "") != signature) {
        error = "Hosted image signature verification failed"; return false;
    }
    uint8_t magic[4];
    uint32_t instructionCount, constants;
    if (!readBytes(0, magic, 4, error)
        || !hex(4, 8, instructionCount, error) || !hex(12, 8, constants, error)) return false;
    if (memcmp(magic, "PHI1", 4) || instructionCount < 1
        || instructionCount > (fileBytes - 20) / 24) {
        error = "Invalid hosted image header"; return false;
    }
    const size_t constantPoolOffset = 20 + static_cast<size_t>(instructionCount) * 24;
    const size_t constantPoolCharacters = fileBytes - constantPoolOffset;
    if ((constantPoolCharacters & 1) || constants != constantPoolCharacters / 2) {
        error = "Invalid hosted image constant pool size"; return false;
    }
    count = instructionCount; poolBytes = constants;
    if (resident) file.close();
    return true;
}

bool HostedImage::readBytes(size_t offset, uint8_t* target, size_t length, std::string& error) {
    if (offset > fileBytes || length > fileBytes - offset) {
        error = "Hosted image read out of bounds"; return false;
    }
    if (resident) {
        memcpy(target, resident.get() + offset, length);
        ++cacheHits;
        return true;
    }
    auto& cache = sharedCache();
    if (!cache.mutex || xSemaphoreTake(cache.mutex, portMAX_DELAY) != pdTRUE) {
        error = "Hosted instruction cache unavailable"; return false;
    }
    CacheRelease release{cache.mutex};
    if (!initializeCache(cache, error)) return false;
    while (length) {
        const size_t number = offset / PAGE_BYTES;
        Page* page = nullptr;
        if (cache.psramPages) {
            const size_t ownerHash = reinterpret_cast<uintptr_t>(this) >> 4;
            page = &cache.psramPages[(ownerHash * 2654435761u + number) % cache.psramPageCount];
        } else {
            for (auto& item : cache.pages) if (item.owner == this && item.number == number) { page = &item; break; }
            if (!page) {
                page = &cache.pages[0];
                for (auto& item : cache.pages) if (item.age < page->age) page = &item;
            }
        }
        if (page->owner == this && page->number == number) ++cacheHits;
        else {
            page->owner = nullptr;
            page->number = INVALID_PAGE;
            page->length = std::min(PAGE_BYTES, fileBytes - number * PAGE_BYTES);
            uint8_t digest[32];
            uint8_t expected[32];
            if (file.size() != fileBytes || !file.seek(number * PAGE_BYTES)
                || file.read(page->bytes.data(), page->length) != page->length
                || mbedtls_sha256_ret(page->bytes.data(), page->length, digest, 0) != 0
                || !hashes.read(number, expected) || memcmp(digest, expected, 32)) {
                error = "Hosted image changed or storage read failed"; return false;
            }
            page->owner = this;
            page->number = number;
            ++pageReads;
        }
        if (!cache.psramPages) {
            if (++cache.tick == 0) {
                for (auto& item : cache.pages) item.age = 0;
                cache.tick = 1;
            }
            page->age = cache.tick;
        }
        const size_t amount = std::min(length, page->length - offset % PAGE_BYTES);
        memcpy(target, page->bytes.data() + offset % PAGE_BYTES, amount);
        offset += amount; target += amount; length -= amount;
    }
    return true;
}

bool HostedImage::hex(size_t offset, size_t digits, uint32_t& value, std::string& error) {
    uint8_t bytes[8];
    if (digits > sizeof(bytes) || !readBytes(offset, bytes, digits, error)) return false;
    value = 0;
    for (size_t i = 0; i < digits; ++i) {
        const uint8_t ch = bytes[i];
        if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) {
            error = "Invalid hosted image hexadecimal field"; return false;
        }
        value = (value << 4) | (ch <= '9' ? ch - '0' : ch - 'a' + 10);
    }
    return true;
}

bool HostedImage::read(size_t index, PInstruction& instruction, std::string& error) {
    if (index >= count) { error = "Hosted image instruction out of bounds"; return false; }
    const size_t offset = 20 + index * 24;
    uint32_t opcode, argc, operand, textOffset, textLength;
    if (!hex(offset, 2, opcode, error) || !hex(offset + 2, 2, argc, error)
        || !hex(offset + 4, 8, operand, error) || !hex(offset + 12, 8, textOffset, error)
        || !hex(offset + 20, 4, textLength, error)) return false;
    if (argc > 8 || textLength > 2048 || textOffset > poolBytes || textLength > poolBytes - textOffset) {
        error = "Invalid hosted image instruction fields"; return false;
    }
    instruction = PInstruction();
    instruction.opcode = opcode;
    instruction.value = argc;
    instruction.intOperand = static_cast<int32_t>(operand);
    instruction.strOperand.reserve(textLength);
    for (size_t i = 0; i < textLength; ++i) {
        uint32_t byte;
        if (!hex(20 + count * 24 + (textOffset + i) * 2, 2, byte, error)) return false;
        if (!byte) { error = "NUL in hosted image constant"; return false; }
        instruction.strOperand.push_back(static_cast<char>(byte));
    }
    if (opcode == OP_CALL_LABEL) {
        instruction.label = std::move(instruction.strOperand);
        instruction.type = OperandType::INT;
    } else if (opcode == OP_PUSH_INT) instruction.type = OperandType::INT;
    else if (textLength || opcode == OP_PUSH_STR) instruction.type = OperandType::STRING;
    return true;
}
}
#endif
