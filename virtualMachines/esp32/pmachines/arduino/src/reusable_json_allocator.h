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
    explicit ReusableJsonAllocator(ArduinoJson::Allocator* fallback = nullptr)
        : fallback(fallback) {}

    // All documents using this allocator must be destroyed before reset().
    void reset() { used = 0; }

    void* allocate(size_t size) override {
        const size_t alignment = alignof(std::max_align_t);
        if (size <= Capacity && sizeof(Header) <= Capacity - size) {
            const size_t bytes = sizeof(Header) + size;
            const size_t padding = (alignment - bytes % alignment) % alignment;
            if (bytes <= Capacity - used && padding <= Capacity - used - bytes) {
                auto* header = new (buffer + used) Header{size};
                used += bytes + padding;
                return header + 1;
            }
        }
        return fallback ? fallback->allocate(size) : std::malloc(size);
    }

    void deallocate(void* pointer) override {
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
        return address >= begin && address - begin < Capacity;
    }

    alignas(std::max_align_t) unsigned char buffer[Capacity];
    size_t used = 0;
    ArduinoJson::Allocator* fallback;
};
}
