#include "hosted_image.h"
#if defined(ESP32)
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <mbedtls/sha256.h>
#include <cstring>

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
void HostedImage::reset() {
    auto& cache = sharedCache();
    if (cache.mutex && xSemaphoreTake(cache.mutex, portMAX_DELAY) == pdTRUE) {
        for (auto& page : cache.pages) if (page.owner == this) {
            page.owner = nullptr; page.number = MAX_PAGES; page.length = 0; page.age = 0;
        }
        xSemaphoreGive(cache.mutex);
    }
    file.close();
    fileBytes = count = poolBytes = cacheHits = pageReads = 0;
    std::vector<std::array<uint8_t, 32>>().swap(hashes);
}

bool HostedImage::open(FederatedFileSystem& ffs, const String& path, const JsonDocument& map,
                       const char* key, const char* keyId, std::string& error) {
    file = ffs.openReadFile(path);
    fileBytes = file ? file.size() : 0;
    if (fileBytes < 20 || fileBytes > PAGE_BYTES * MAX_PAGES) {
        error = "Invalid hosted image file size"; return false;
    }
    hashes.resize((fileBytes + PAGE_BYTES - 1) / PAGE_BYTES);
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
    for (size_t offset = 0; ok && offset < fileBytes; offset += PAGE_BYTES) {
        const size_t length = std::min(PAGE_BYTES, fileBytes - offset);
        ok = file.read(buffer.data(), length) == length
            && mbedtls_md_hmac_update(&context, buffer.data(), length) == 0
            && mbedtls_sha256_ret(buffer.data(), length, hashes[offset / PAGE_BYTES].data(), 0) == 0;
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
    if (!readBytes(0, magic, 4, error) || memcmp(magic, "PHI1", 4)
        || !hex(4, 8, instructionCount, error) || !hex(12, 8, constants, error)
        || instructionCount < 1 || instructionCount > 512
        || constants > (PAGE_BYTES * MAX_PAGES - 20) / 2
        || fileBytes != 20 + instructionCount * 24 + constants * 2) {
        error = "Invalid hosted image header"; return false;
    }
    count = instructionCount; poolBytes = constants;
    return true;
}

bool HostedImage::readBytes(size_t offset, uint8_t* target, size_t length, std::string& error) {
    if (offset > fileBytes || length > fileBytes - offset) {
        error = "Hosted image read out of bounds"; return false;
    }
    auto& cache = sharedCache();
    if (!cache.mutex || xSemaphoreTake(cache.mutex, portMAX_DELAY) != pdTRUE) {
        error = "Hosted instruction cache unavailable"; return false;
    }
    CacheRelease release{cache.mutex};
    while (length) {
        const size_t number = offset / PAGE_BYTES;
        Page* page = nullptr;
        for (auto& item : cache.pages) if (item.owner == this && item.number == number) { page = &item; break; }
        if (page) ++cacheHits;
        else {
            page = &cache.pages[0];
            for (auto& item : cache.pages) if (item.age < page->age) page = &item;
            page->owner = nullptr;
            page->number = MAX_PAGES;
            page->length = std::min(PAGE_BYTES, fileBytes - number * PAGE_BYTES);
            uint8_t digest[32];
            if (file.size() != fileBytes || !file.seek(number * PAGE_BYTES)
                || file.read(page->bytes.data(), page->length) != page->length
                || mbedtls_sha256_ret(page->bytes.data(), page->length, digest, 0) != 0
                || memcmp(digest, hashes[number].data(), 32)) {
                error = "Hosted image changed or storage read failed"; return false;
            }
            page->owner = this;
            page->number = number;
            ++pageReads;
        }
        if (++cache.tick == 0) {
            for (auto& item : cache.pages) item.age = 0;
            cache.tick = 1;
        }
        page->age = cache.tick;
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
