#pragma once

#include <ArduinoJson.h>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <new>

namespace pmachine {
template <size_t Capacity>
class ReusableJsonAllocator : public ArduinoJson::Allocator {
public:
    explicit ReusableJsonAllocator(ArduinoJson::Allocator* fallback = nullptr,
                                   ArduinoJson::Allocator* arenaAllocator = nullptr)
        : fallback(fallback), arenaAllocator(arenaAllocator) {}
    ~ReusableJsonAllocator() {
        if (!buffer) return;
        if (arenaAllocator) arenaAllocator->deallocate(buffer);
        else std::free(buffer);
    }
    ReusableJsonAllocator(const ReusableJsonAllocator&) = delete;
    ReusableJsonAllocator& operator=(const ReusableJsonAllocator&) = delete;

    // All documents using this allocator must be destroyed before reset().
    void reset() { used = 0; arenaAttempted = false; }

    void* allocate(size_t size) override {
        const size_t alignment = alignof(std::max_align_t);
        if (size <= Capacity && sizeof(Header) <= Capacity - size) {
            const size_t bytes = sizeof(Header) + size;
            const size_t padding = (alignment - bytes % alignment) % alignment;
            if (bytes <= Capacity - used && padding <= Capacity - used - bytes) {
                if (!buffer && !arenaAttempted) {
                    arenaAttempted = true;
                    buffer = static_cast<unsigned char*>(arenaAllocator
                        ? arenaAllocator->allocate(Capacity) : std::malloc(Capacity));
                }
                if (buffer) {
                    auto* header = new (buffer + used) Header{size};
                    used += bytes + padding;
                    return header + 1;
                }
            }
        }
        return fallback ? fallback->allocate(size) : std::malloc(size);
    }

    void deallocate(void* pointer) override {
        if (!pointer) return;
        if (!owns(pointer)) {
            if (fallback) fallback->deallocate(pointer);
            else std::free(pointer);
        }
    }

    void* reallocate(void* pointer, size_t size) override {
        if (!pointer) return allocate(size);
        if (!owns(pointer))
            return fallback ? fallback->reallocate(pointer, size) : std::realloc(pointer, size);
        auto* header = static_cast<Header*>(pointer) - 1;
        if (size <= header->size) return pointer;
        void* replacement = allocate(size);
        if (replacement) std::memcpy(replacement, pointer, header->size);
        return replacement;
    }

private:
    struct alignas(std::max_align_t) Header { size_t size; };
    bool owns(void* pointer) const {
        const auto address = reinterpret_cast<uintptr_t>(pointer);
        const auto begin = reinterpret_cast<uintptr_t>(buffer);
        return buffer && address >= begin && address - begin < Capacity;
    }

    unsigned char* buffer = nullptr;
    size_t used = 0;
    bool arenaAttempted = false;
    ArduinoJson::Allocator* fallback;
    ArduinoJson::Allocator* arenaAllocator;
};
}
