#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <memory>

namespace pmachine {

template<typename PagingFile>
class AuthenticatedPageHashes {
public:
    using Digest = std::array<uint8_t, 32>;
    using Authenticate = bool (*)(void*, size_t, const uint8_t*, uint8_t*);
    static constexpr size_t RECORD_BYTES = 64;

    void attachMemory(Digest* data, size_t count) {
        reset();
        memory.reset(data);
        pages = count;
    }

    bool attachFile(PagingFile& pagingFile, size_t count, Authenticate mac, void* context) {
        if (!mac || count > std::numeric_limits<uint32_t>::max() / RECORD_BYTES) return false;
        reset();
        file = &pagingFile;
        pages = count;
        authenticate = mac;
        authenticationContext = context;
        return true;
    }

    bool write(size_t page, const uint8_t* digest) {
        if (page >= pages) return false;
        if (memory) {
            std::memcpy(memory[page].data(), digest, memory[page].size());
            return true;
        }
        std::array<uint8_t, RECORD_BYTES> record;
        std::memcpy(record.data(), digest, Digest{}.size());
        return file && authenticate(authenticationContext, page, digest, record.data() + Digest{}.size())
            && file->seek(page * RECORD_BYTES)
            && file->write(record.data(), record.size()) == record.size();
    }

    bool read(size_t page, uint8_t* digest) {
        if (page >= pages) return false;
        if (memory) {
            std::memcpy(digest, memory[page].data(), memory[page].size());
            return true;
        }
        std::array<uint8_t, RECORD_BYTES> record;
        Digest expected;
        if (!file || !file->seek(page * RECORD_BYTES)
            || file->read(record.data(), record.size()) != record.size()
            || !authenticate(authenticationContext, page, record.data(), expected.data())) return false;
        uint8_t difference = 0;
        for (size_t index = 0; index < expected.size(); ++index)
            difference |= expected[index] ^ record[Digest{}.size() + index];
        if (difference) return false;
        std::memcpy(digest, record.data(), expected.size());
        return true;
    }

    void reset() {
        memory.reset();
        file = nullptr;
        pages = 0;
        authenticate = nullptr;
        authenticationContext = nullptr;
    }

    size_t storageBytes() const { return pages * (memory ? sizeof(Digest) : RECORD_BYTES); }
    bool inMemory() const { return memory != nullptr; }

private:
    std::unique_ptr<Digest[], void(*)(void*)> memory{nullptr, std::free};
    PagingFile* file = nullptr;
    size_t pages = 0;
    Authenticate authenticate = nullptr;
    void* authenticationContext = nullptr;
};

}
