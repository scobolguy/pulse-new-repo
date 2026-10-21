#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>

namespace pmachine {

// Last-resort storage for blocks evicted from a ManagedHeap arena. Implementations
// must not throw; returning false makes the heap report exhaustion instead.
class ManagedHeapBacking {
public:
    virtual ~ManagedHeapBacking() {}
    virtual bool store(uint16_t handle, const uint8_t* data, size_t size) = 0;
    virtual bool load(uint16_t handle, uint8_t* data, size_t size) = 0;
    virtual void discard(uint16_t handle) = 0;
    virtual void reset() = 0;
    virtual const char* name() const = 0;
};

// Handle-based arena. Callers keep 16-bit handles, never raw pointers, so the heap
// can slide blocks together (compaction) and evict cold blocks to a backing store.
// Pointers returned by data() stay valid only until the next allocate, store,
// compact, or data() call for a swapped block, unless the block is pinned.
// No method allocates from the system heap.
template <size_t HandleCapacity = 256>
class ManagedHeap {
public:
    static const uint16_t INVALID = 0xFFFF;
    static const size_t HANDLE_CAPACITY = HandleCapacity;
    static const size_t ALIGNMENT = 8;
    static const size_t MAX_ARENA = 0xFFF8;

    struct Stats {
        size_t liveHandles = 0;
        size_t liveBytes = 0;
        size_t peakHandles = 0;
        size_t peakBytes = 0;
        uint32_t allocations = 0;
        uint32_t compactions = 0;
        uint32_t swapOuts = 0;
        uint32_t swapIns = 0;
        uint32_t failures = 0;
    };

    ManagedHeap() { clearEntries(); }

    void attach(uint8_t* memory, size_t size) {
        arena = memory;
        arenaSize = size > MAX_ARENA ? MAX_ARENA : size - size % ALIGNMENT;
        reset();
    }

    void setBacking(ManagedHeapBacking* value) { backing = value; }
    void setCollectInterval(uint16_t value) { collectInterval = value ? value : 1; }
    ManagedHeapBacking* getBacking() const { return backing; }
    bool attached() const { return arena != nullptr && arenaSize > 0; }

    void reset() {
        if (backing) backing->reset();
        clearEntries();
        top = 0;
        clock = 0;
        sinceCollect = 0;
        lastError = nullptr;
        const size_t peakHandles = stats.peakHandles, peakBytes = stats.peakBytes;
        stats = Stats();
        stats.peakHandles = peakHandles;
        stats.peakBytes = peakBytes;
    }

    uint16_t store(const char* data, size_t size) {
        uint16_t handle = INVALID;
        if (!allocate(size, handle)) return INVALID;
        if (size) std::memcpy(arena + entries[handle].offset, data, size);
        entries[handle].size = static_cast<uint16_t>(size);
        return handle;
    }

    bool allocate(size_t size, uint16_t& handle) {
        handle = INVALID;
        if (!attached()) return fail("managed heap is not attached");
        const size_t capacity = roundUp(size ? size : 1);
        if (capacity > arenaSize) return fail("managed heap block exceeds arena");
        uint16_t slot = INVALID;
        for (size_t index = 0; index < HandleCapacity; ++index) {
            const size_t candidate = (nextFree + index) % HandleCapacity;
            if (entries[candidate].state == Free) { slot = static_cast<uint16_t>(candidate); break; }
        }
        if (slot == INVALID) return fail("managed heap handle capacity exceeded");
        if (!reserve(capacity, INVALID)) return false;
        Entry& entry = entries[slot];
        entry.offset = static_cast<uint16_t>(top);
        entry.capacity = static_cast<uint16_t>(capacity);
        entry.size = static_cast<uint16_t>(size);
        entry.state = Resident;
        entry.pins = 0;
        touch(entry);
        top += capacity;
        nextFree = static_cast<uint16_t>((slot + 1) % HandleCapacity);
        ++sinceCollect;
        ++stats.allocations;
        ++stats.liveHandles;
        stats.liveBytes += capacity;
        if (stats.liveHandles > stats.peakHandles) stats.peakHandles = stats.liveHandles;
        if (stats.liveBytes > stats.peakBytes) stats.peakBytes = stats.liveBytes;
        handle = slot;
        return true;
    }

    void release(uint16_t handle) {
        if (!valid(handle)) return;
        Entry& entry = entries[handle];
        if (entry.state == Swapped && backing) backing->discard(handle);
        if (entry.state == Resident && entry.offset + entry.capacity == top) top = entry.offset;
        stats.liveBytes -= entry.capacity;
        --stats.liveHandles;
        entry = Entry();
    }

    bool valid(uint16_t handle) const { return handle < HandleCapacity && entries[handle].state != Free; }
    bool swapped(uint16_t handle) const { return valid(handle) && entries[handle].state == Swapped; }
    size_t size(uint16_t handle) const { return valid(handle) ? entries[handle].size : 0; }

    // Pages a swapped block back in when needed; returns nullptr on failure.
    const char* data(uint16_t handle) {
        if (!valid(handle)) return nullptr;
        Entry& entry = entries[handle];
        if (entry.state == Swapped && !pageIn(handle)) return nullptr;
        touch(entry);
        return reinterpret_cast<const char*>(arena + entry.offset);
    }

    bool pin(uint16_t handle) {
        if (!data(handle) || entries[handle].pins == 0xFF) return false;
        ++entries[handle].pins;
        return true;
    }

    void unpin(uint16_t handle) {
        if (valid(handle) && entries[handle].pins) --entries[handle].pins;
    }

    bool collectDue() const { return sinceCollect >= collectInterval; }

    // Releases every handle the caller reports as unreachable.
    template <typename IsLive>
    size_t sweep(IsLive isLive) {
        size_t released = 0;
        for (size_t index = 0; index < HandleCapacity; ++index) {
            if (entries[index].state == Free || entries[index].pins) continue;
            if (!isLive(static_cast<uint16_t>(index))) { release(static_cast<uint16_t>(index)); ++released; }
        }
        sinceCollect = 0;
        return released;
    }

    // Slides unpinned resident blocks down to close holes; pinned blocks stay put.
    void compact() {
        size_t count = 0;
        for (size_t index = 0; index < HandleCapacity; ++index)
            if (entries[index].state == Resident) order[count++] = static_cast<uint16_t>(index);
        for (size_t index = 1; index < count; ++index) {
            const uint16_t value = order[index];
            size_t cursor = index;
            for (; cursor > 0 && entries[order[cursor - 1]].offset > entries[value].offset; --cursor)
                order[cursor] = order[cursor - 1];
            order[cursor] = value;
        }
        size_t cursor = 0;
        for (size_t index = 0; index < count; ++index) {
            Entry& entry = entries[order[index]];
            if (entry.pins) {
                if (entry.offset + entry.capacity > cursor) cursor = entry.offset + entry.capacity;
                continue;
            }
            if (entry.offset != cursor) {
                std::memmove(arena + cursor, arena + entry.offset, entry.size);
                entry.offset = static_cast<uint16_t>(cursor);
            }
            cursor += entry.capacity;
        }
        top = cursor;
        ++stats.compactions;
    }

    size_t arenaBytes() const { return arenaSize; }
    size_t usedBytes() const { return top; }
    size_t tailFreeBytes() const { return arenaSize - top; }
    size_t residentBytes() const {
        size_t bytes = 0;
        for (size_t index = 0; index < HandleCapacity; ++index)
            if (entries[index].state == Resident) bytes += entries[index].capacity;
        return bytes;
    }
    const Stats& getStats() const { return stats; }
    const char* error() const { return lastError; }
    static size_t handleCapacity() { return HandleCapacity; }

private:
    enum State : uint8_t { Free = 0, Resident = 1, Swapped = 2 };
    struct Entry {
        uint16_t offset = 0;
        uint16_t size = 0;
        uint16_t capacity = 0;
        uint16_t lastUse = 0;
        uint8_t state = Free;
        uint8_t pins = 0;
    };

    static size_t roundUp(size_t size) { return (size + ALIGNMENT - 1) / ALIGNMENT * ALIGNMENT; }

    bool fail(const char* message) {
        lastError = message;
        ++stats.failures;
        return false;
    }

    void clearEntries() {
        for (size_t index = 0; index < HandleCapacity; ++index) entries[index] = Entry();
        nextFree = 0;
    }

    void touch(Entry& entry) {
        if (++clock == 0) {
            for (size_t index = 0; index < HandleCapacity; ++index) entries[index].lastUse = 0;
            clock = 1;
        }
        entry.lastUse = clock;
    }

    // Makes `capacity` contiguous bytes available at `top`: compact first, then evict
    // the least recently used unpinned blocks to the backing store as a last resort.
    bool reserve(size_t capacity, uint16_t keep) {
        if (arenaSize - top >= capacity) return true;
        if (top > residentBytes()) compact();
        while (arenaSize - top < capacity) {
            uint16_t victim = INVALID;
            for (size_t index = 0; index < HandleCapacity; ++index) {
                const Entry& entry = entries[index];
                if (entry.state != Resident || entry.pins || index == keep) continue;
                if (victim == INVALID || entry.lastUse < entries[victim].lastUse) victim = static_cast<uint16_t>(index);
            }
            if (victim == INVALID || !backing) return fail("managed heap arena exhausted");
            Entry& entry = entries[victim];
            if (!backing->store(victim, arena + entry.offset, entry.size))
                return fail("managed heap swap exhausted");
            entry.state = Swapped;
            ++stats.swapOuts;
            compact();
        }
        return true;
    }

    bool pageIn(uint16_t handle) {
        Entry& entry = entries[handle];
        if (!backing) return fail("managed heap block swapped without backing");
        if (!reserve(entry.capacity, handle)) return false;
        if (!backing->load(handle, arena + top, entry.size)) return fail("managed heap swap read failed");
        backing->discard(handle);
        entry.offset = static_cast<uint16_t>(top);
        entry.state = Resident;
        top += entry.capacity;
        ++stats.swapIns;
        return true;
    }

    uint8_t* arena = nullptr;
    size_t arenaSize = 0;
    size_t top = 0;
    uint16_t clock = 0;
    uint16_t nextFree = 0;
    uint16_t sinceCollect = 0;
    uint16_t collectInterval = 64;
    ManagedHeapBacking* backing = nullptr;
    const char* lastError = nullptr;
    Stats stats;
    Entry entries[HandleCapacity];
    uint16_t order[HandleCapacity];
};

// Backing store over caller-supplied memory blocks (PSRAM on ESP32, malloc in tests).
// Each swapped block gets its own allocation, bounded by `budget` bytes in total.
template <size_t HandleCapacity = 256>
class BlockSwapBacking : public ManagedHeapBacking {
public:
    typedef void* (*AllocateFn)(size_t);
    typedef void (*FreeFn)(void*);

    BlockSwapBacking(AllocateFn allocateFn, FreeFn freeFn, size_t budgetBytes, const char* label)
        : allocateBlock(allocateFn), freeBlock(freeFn), budget(budgetBytes), label(label) {
        for (size_t index = 0; index < HandleCapacity; ++index) { blocks[index] = nullptr; sizes[index] = 0; }
    }
    ~BlockSwapBacking() override { reset(); }

    bool store(uint16_t handle, const uint8_t* data, size_t size) override {
        if (handle >= HandleCapacity || used + size > budget) return false;
        discard(handle);
        void* block = allocateBlock(size ? size : 1);
        if (!block) return false;
        if (size) std::memcpy(block, data, size);
        blocks[handle] = block;
        sizes[handle] = size;
        used += size;
        return true;
    }

    bool load(uint16_t handle, uint8_t* data, size_t size) override {
        if (handle >= HandleCapacity || !blocks[handle] || sizes[handle] != size) return false;
        if (size) std::memcpy(data, blocks[handle], size);
        return true;
    }

    void discard(uint16_t handle) override {
        if (handle >= HandleCapacity || !blocks[handle]) return;
        freeBlock(blocks[handle]);
        used -= sizes[handle];
        blocks[handle] = nullptr;
        sizes[handle] = 0;
    }

    void reset() override {
        for (size_t index = 0; index < HandleCapacity; ++index) discard(static_cast<uint16_t>(index));
    }

    const char* name() const override { return label; }
    size_t usedBytes() const { return used; }

private:
    AllocateFn allocateBlock;
    FreeFn freeBlock;
    size_t budget;
    size_t used = 0;
    const char* label;
    void* blocks[HandleCapacity];
    size_t sizes[HandleCapacity];
};

// Backing store over one random-access file. Records are appended; the write offset
// rewinds when the newest record is discarded and resets when the file empties.
template <typename FileOps, size_t HandleCapacity = 256>
class FileSwapBacking : public ManagedHeapBacking {
public:
    FileSwapBacking(FileOps& fileOps, size_t budgetBytes) : file(fileOps), budget(budgetBytes) {
        for (size_t index = 0; index < HandleCapacity; ++index) { offsets[index] = 0; sizes[index] = NONE; }
    }

    bool store(uint16_t handle, const uint8_t* data, size_t size) override {
        if (handle >= HandleCapacity || end + size > budget) return false;
        discard(handle);
        if (!file.writeAt(end, data, size)) return false;
        offsets[handle] = end;
        sizes[handle] = size;
        end += size;
        ++records;
        return true;
    }

    bool load(uint16_t handle, uint8_t* data, size_t size) override {
        if (handle >= HandleCapacity || sizes[handle] != size) return false;
        return file.readAt(offsets[handle], data, size);
    }

    void discard(uint16_t handle) override {
        if (handle >= HandleCapacity || sizes[handle] == NONE) return;
        if (offsets[handle] + sizes[handle] == end) end = offsets[handle];
        sizes[handle] = NONE;
        if (--records == 0) end = 0;
    }

    void reset() override {
        for (size_t index = 0; index < HandleCapacity; ++index) sizes[index] = NONE;
        end = 0;
        records = 0;
    }

    const char* name() const override { return file.name(); }
    size_t usedBytes() const { return end; }

private:
    static const size_t NONE = static_cast<size_t>(-1);
    FileOps& file;
    size_t budget;
    size_t end = 0;
    size_t records = 0;
    size_t offsets[HandleCapacity];
    size_t sizes[HandleCapacity];
};

}
