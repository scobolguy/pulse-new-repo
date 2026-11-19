#include "../../pmachines/arduino/src/authenticated_page_hashes.h"
#include <algorithm>
#include <cassert>
#include <new>
#include <vector>

namespace {
struct PagingFile {
    std::vector<uint8_t> bytes;
    size_t cursor = 0;
    bool seekFails = false, shortWrite = false;
    bool seek(size_t offset) {
        cursor = offset;
        return !seekFails;
    }
    size_t write(const uint8_t* source, size_t count) {
        if (shortWrite) --count;
        bytes.resize(std::max(bytes.size(), cursor + count));
        std::memcpy(bytes.data() + cursor, source, count);
        cursor += count;
        return count;
    }
    size_t read(uint8_t* target, size_t count) {
        count = std::min(count, bytes.size() - std::min(cursor, bytes.size()));
        std::memcpy(target, bytes.data() + cursor, count);
        cursor += count;
        return count;
    }
};

struct Authentication {
    uint8_t key;
    bool fails = false;
};

// Storage tests inject a deterministic authenticator; firmware supplies HMAC-SHA256.
bool authenticate(void* opaque, size_t page, const uint8_t* digest, uint8_t* tag) {
    const auto& state = *static_cast<Authentication*>(opaque);
    if (state.fails) return false;
    for (size_t byte = 0; byte < 32; ++byte)
        tag[byte] = digest[byte] ^ state.key ^ static_cast<uint8_t>(uint64_t(page) >> ((byte % 8) * 8));
    return true;
}
}

int main() {
    using Hashes = pmachine::AuthenticatedPageHashes<PagingFile>;
    Hashes hashes;
    Hashes::Digest first{}, second{}, result{};
    first.fill(19);
    second.fill(73);

    auto* memory = static_cast<Hashes::Digest*>(std::malloc(2 * sizeof(Hashes::Digest)));
    assert(memory);
    for (size_t page = 0; page < 2; ++page) new (&memory[page]) Hashes::Digest();
    hashes.attachMemory(memory, 2);
    assert(hashes.inMemory() && hashes.storageBytes() == 64);
    assert(hashes.write(0, first.data()) && hashes.write(1, second.data()));
    assert(hashes.read(1, result.data()) && result == second);
    assert(hashes.read(0, result.data()) && result == first);
    assert(!hashes.read(2, result.data()) && !hashes.write(2, first.data()));

    PagingFile file;
    Authentication authentication;
    authentication.key = 41;
    assert(hashes.attachFile(file, 2, authenticate, &authentication));
    assert(!hashes.inMemory() && hashes.storageBytes() == 128);
    assert(hashes.write(0, first.data()) && hashes.write(1, second.data()));
    assert(hashes.read(1, result.data()) && result == second);
    assert(hashes.read(0, result.data()) && result == first);
    const auto original = file.bytes;
    for (size_t byte : {size_t(0), size_t(31), size_t(32), size_t(63)}) {
        file.bytes[byte] ^= 1;
        result.fill(255);
        assert(!hashes.read(0, result.data()));
        assert(std::all_of(result.begin(), result.end(), [](uint8_t value) { return value == 255; }));
        file.bytes = original;
    }
    std::swap_ranges(file.bytes.begin(), file.bytes.begin() + 64, file.bytes.begin() + 64);
    assert(!hashes.read(0, result.data()) && !hashes.read(1, result.data()));
    file.bytes = original;
    ++authentication.key;
    assert(!hashes.read(0, result.data()));
    --authentication.key;
    file.bytes.resize(63);
    assert(!hashes.read(0, result.data()));
    file.bytes = original;
    file.seekFails = true;
    assert(!hashes.read(0, result.data()) && !hashes.write(0, first.data()));
    file.seekFails = false;
    file.shortWrite = true;
    assert(!hashes.write(0, first.data()));
    file.shortWrite = false;
    authentication.fails = true;
    assert(!hashes.write(0, first.data()) && !hashes.read(0, result.data()));
    authentication.fails = false;
    assert(!hashes.read(2, result.data()) && !hashes.write(2, first.data()));
    assert(!hashes.attachFile(file, size_t(UINT32_MAX) / 64 + 1, authenticate, &authentication));
    assert(!hashes.attachFile(file, 2, nullptr, &authentication));
    hashes.reset();
    assert(!hashes.read(0, result.data()) && !hashes.write(0, first.data()));
    assert(hashes.storageBytes() == 0);
}
