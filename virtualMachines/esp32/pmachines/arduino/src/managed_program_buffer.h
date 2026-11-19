#pragma once

#include "managed_heap.h"
#include <algorithm>
#include <new>
#include <utility>

namespace pmachine {

class ManagedProgramBuffer {
public:
    using Allocate = void* (*)(size_t, bool&);
    using Release = void (*)(void*, bool);

    ManagedProgramBuffer(Allocate allocate, Release release)
        : allocate(allocate), release(release) {}
    ~ManagedProgramBuffer() { reset(); }
    ManagedProgramBuffer(const ManagedProgramBuffer&) = delete;
    ManagedProgramBuffer& operator=(const ManagedProgramBuffer&) = delete;

    bool assign(const uint8_t* bytes, size_t count) {
        if (!bytes && count) return false;
        ManagedProgramBuffer replacement(allocate, release);
        Node** tail = &replacement.first;
        size_t offset = 0;
        while (offset < count) {
            bool psram = false;
            void* allocation = allocate(sizeof(Node), psram);
            if (!allocation) return false;
            Node* node = new (allocation) Node;
            node->psram = psram;
            node->heap.attach(node->arena, sizeof(node->arena));
            *tail = node;
            tail = &node->next;
            ++replacement.nodes;
            (psram ? replacement.psramBytes : replacement.internalBytes) += sizeof(Node);
            for (size_t index = 0; index < HANDLES && offset < count; ++index) {
                const size_t length = std::min(PAGE_BYTES, count - offset);
                node->handles[index] = node->heap.store(
                    reinterpret_cast<const char*>(bytes + offset), length);
                if (node->handles[index] == Heap::INVALID) return false;
                offset += length;
            }
        }
        replacement.length = count;
        reset();
        std::swap(first, replacement.first);
        std::swap(length, replacement.length);
        std::swap(nodes, replacement.nodes);
        std::swap(internalBytes, replacement.internalBytes);
        std::swap(psramBytes, replacement.psramBytes);
        return true;
    }

    bool read(size_t offset, uint8_t& value) const {
        if (offset >= length) return false;
        const size_t nodeIndex = offset / ARENA_BYTES;
        if (!cached || nodeIndex < cachedIndex) {
            cached = first;
            cachedIndex = 0;
        }
        while (cachedIndex < nodeIndex) {
            cached = cached->next;
            ++cachedIndex;
        }
        const size_t local = offset % ARENA_BYTES;
        const char* bytes = cached->heap.data(cached->handles[local / PAGE_BYTES]);
        if (!bytes) return false;
        value = static_cast<uint8_t>(bytes[local % PAGE_BYTES]);
        return true;
    }

    size_t size() const { return length; }
    size_t chunkCount() const { return nodes; }
    size_t allocatedInternalBytes() const { return internalBytes; }
    size_t allocatedPsramBytes() const { return psramBytes; }

private:
    static constexpr size_t PAGE_BYTES = 1024, HANDLES = 4;
    static constexpr size_t ARENA_BYTES = PAGE_BYTES * HANDLES;
    using Heap = ManagedHeap<HANDLES>;
    struct Node {
        Node* next = nullptr;
        bool psram = false;
        Heap heap;
        uint16_t handles[HANDLES]{};
        alignas(Heap::ALIGNMENT) uint8_t arena[ARENA_BYTES];
    };

    void reset() {
        while (first) {
            Node* next = first->next;
            const bool psram = first->psram;
            first->~Node();
            release(first, psram);
            first = next;
        }
        cached = nullptr;
        cachedIndex = length = nodes = internalBytes = psramBytes = 0;
    }

    Allocate allocate;
    Release release;
    Node* first = nullptr;
    mutable Node* cached = nullptr;
    mutable size_t cachedIndex = 0;
    size_t length = 0, nodes = 0, internalBytes = 0, psramBytes = 0;
};

}
