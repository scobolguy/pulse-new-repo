#include "../../pmachines/arduino/src/managed_heap.h"
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <new>

static bool denyAllocations = false;

void* operator new(size_t size) {
    if (denyAllocations) std::abort();
    if (void* pointer = std::malloc(size ? size : 1)) return pointer;
    throw std::bad_alloc();
}
void* operator new[](size_t size) { return ::operator new(size); }
void operator delete(void* pointer) noexcept { std::free(pointer); }
void operator delete[](void* pointer) noexcept { std::free(pointer); }
void operator delete(void* pointer, size_t) noexcept { std::free(pointer); }
void operator delete[](void* pointer, size_t) noexcept { std::free(pointer); }

using namespace pmachine;
typedef ManagedHeap<32> Heap;

static bool same(Heap& heap, uint16_t handle, const char* text) {
    const char* data = heap.data(handle);
    return data && heap.size(handle) == std::strlen(text) && std::memcmp(data, text, heap.size(handle)) == 0;
}

static void fill(char* buffer, size_t size, char value) {
    std::memset(buffer, value, size);
    buffer[size] = 0;
}

static void storeReleaseAndCompact() {
    static uint8_t arena[256];
    static Heap heap;
    heap.attach(arena, sizeof(arena));
    denyAllocations = true;
    const uint16_t a = heap.store("alpha", 5);
    const uint16_t b = heap.store("bravo-bravo", 11);
    const uint16_t c = heap.store("charlie", 7);
    assert(a != Heap::INVALID && b != Heap::INVALID && c != Heap::INVALID);
    assert(same(heap, a, "alpha") && same(heap, b, "bravo-bravo") && same(heap, c, "charlie"));
    assert(heap.usedBytes() == 8 + 16 + 8);
    heap.release(b);
    assert(!heap.valid(b));
    char big[257];
    fill(big, 256 - 16, 'z');
    const uint16_t d = heap.store(big, std::strlen(big));
    assert(d != Heap::INVALID);
    assert(heap.getStats().compactions == 1);
    assert(same(heap, a, "alpha") && same(heap, c, "charlie") && same(heap, d, big));
    assert(heap.store("x", 1) == Heap::INVALID);
    assert(std::strcmp(heap.error(), "managed heap arena exhausted") == 0);
    heap.release(c);
    heap.release(d);
    assert(heap.usedBytes() == 16);
    heap.compact();
    assert(heap.usedBytes() == 8 && same(heap, a, "alpha"));
    denyAllocations = false;
}

static void pinnedBlocksStayPut() {
    static uint8_t arena[128];
    static Heap heap;
    heap.attach(arena, sizeof(arena));
    denyAllocations = true;
    const uint16_t a = heap.store("aaaaaaaaaaaaaaa", 15);
    const uint16_t pinned = heap.store("pinned", 6);
    const uint16_t b = heap.store("bbbbbbb", 7);
    assert(heap.pin(pinned));
    const char* before = heap.data(pinned);
    heap.release(a);
    heap.compact();
    assert(heap.data(pinned) == before);
    assert(same(heap, b, "bbbbbbb"));
    char big[129];
    fill(big, 128 - 24 - 8, 'q');
    assert(heap.store(big, std::strlen(big)) != Heap::INVALID);
    assert(heap.data(pinned) == before && same(heap, pinned, "pinned"));
    heap.unpin(pinned);
    denyAllocations = false;
}

static void blockSwapEvictsAndPagesIn() {
    static uint8_t arena[64];
    static Heap heap;
    BlockSwapBacking<32> backing(std::malloc, std::free, 64, "test");
    heap.attach(arena, sizeof(arena));
    heap.setBacking(&backing);
    denyAllocations = true;
    const uint16_t a = heap.store("first-block-0123456789", 22);
    const uint16_t b = heap.store("second-block-012345678", 22);
    const uint16_t c = heap.store("third-block-0123456789", 22);
    assert(c != Heap::INVALID);
    assert(heap.getStats().swapOuts == 1 && heap.swapped(a));
    assert(backing.usedBytes() == 22);
    assert(same(heap, a, "first-block-0123456789"));
    assert(heap.getStats().swapIns == 1 && !heap.swapped(a));
    assert(heap.swapped(b));
    assert(same(heap, b, "second-block-012345678") && same(heap, c, "third-block-0123456789"));
    heap.reset();
    assert(backing.usedBytes() == 0 && heap.usedBytes() == 0);
    denyAllocations = false;
}

struct MemoryFile {
    uint8_t bytes[96];
    bool writeAt(size_t offset, const uint8_t* data, size_t size) {
        if (offset + size > sizeof(bytes)) return false;
        std::memcpy(bytes + offset, data, size);
        return true;
    }
    bool readAt(size_t offset, uint8_t* data, size_t size) {
        if (offset + size > sizeof(bytes)) return false;
        std::memcpy(data, bytes + offset, size);
        return true;
    }
    const char* name() const { return "memory-file"; }
};

static void fileSwapIsBounded() {
    static uint8_t arena[48];
    static Heap heap;
    static MemoryFile file;
    FileSwapBacking<MemoryFile, 32> backing(file, 40);
    heap.attach(arena, sizeof(arena));
    heap.setBacking(&backing);
    denyAllocations = true;
    const uint16_t a = heap.store("aaaaaaaaaaaaaaaaaaaa", 20);
    const uint16_t b = heap.store("bbbbbbbbbbbbbbbbbbbb", 20);
    const uint16_t c = heap.store("cccccccccccccccccccc", 20);
    assert(c != Heap::INVALID && heap.swapped(a) && backing.usedBytes() == 20);
    const uint16_t d = heap.store("dddddddddddddddddddd", 20);
    assert(d != Heap::INVALID && heap.swapped(b) && backing.usedBytes() == 40);
    assert(heap.store("eeeeeeeeeeeeeeeeeeee", 20) == Heap::INVALID);
    assert(std::strcmp(heap.error(), "managed heap swap exhausted") == 0);
    assert(heap.getStats().failures == 1);
    heap.release(b);
    assert(backing.usedBytes() == 20);
    heap.release(a);
    assert(backing.usedBytes() == 0);
    assert(same(heap, c, "cccccccccccccccccccc") && same(heap, d, "dddddddddddddddddddd"));
    denyAllocations = false;
}

static void sweepHandlesAndRepeatedInvocations() {
    static uint8_t arena[512];
    static Heap heap;
    heap.attach(arena, sizeof(arena));
    heap.setCollectInterval(4);
    denyAllocations = true;
    uint16_t handles[32];
    for (size_t index = 0; index < 32; ++index) handles[index] = heap.store("h", 1);
    assert(handles[31] != Heap::INVALID);
    assert(heap.store("h", 1) == Heap::INVALID);
    assert(std::strcmp(heap.error(), "managed heap handle capacity exceeded") == 0);
    assert(heap.collectDue());
    assert(heap.sweep([&](uint16_t handle) { return handle % 2 == 0; }) == 16);
    assert(!heap.collectDue() && heap.getStats().liveHandles == 16);
    assert(heap.store("again", 5) != Heap::INVALID);
    for (size_t invocation = 0; invocation < 1000; ++invocation) {
        heap.reset();
        for (size_t index = 0; index < 8; ++index) assert(heap.store("invocation-data", 15) != Heap::INVALID);
    }
    assert(heap.getStats().peakHandles == 32);
    denyAllocations = false;
}

static void detachedHeapFails() {
    Heap heap;
    assert(heap.store("x", 1) == Heap::INVALID);
    assert(std::strcmp(heap.error(), "managed heap is not attached") == 0);
}

int main() {
    storeReleaseAndCompact();
    pinnedBlocksStayPut();
    blockSwapEvictsAndPagesIn();
    fileSwapIsBounded();
    sweepHandlesAndRepeatedInvocations();
    detachedHeapFails();
    return 0;
}
