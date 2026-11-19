#pragma once

#include "hosted_frame_storage.h"
#include "managed_heap.h"
#include "managed_objects.h"
#include <atomic>
#include <cstdlib>
#include <memory>
#include <new>
#include <string>
#include <vector>
#if defined(ESP32)
#include <esp_heap_caps.h>
#endif

namespace pmachine {
using ManagedStringHeap = ManagedHeap<256>;

struct HostValue {
    bool isString = false;
    int integer = 0;
    std::string text;
};

struct HostCallStorage {
    std::vector<HostValue> args;
    HostValue result;
    std::string error;

    explicit HostCallStorage(bool hosted = true) {
        if (hosted) args.reserve(8);
    }

    void reset(size_t argc) {
        args.resize(argc);
        for (auto& arg : args) {
            arg.isString = false;
            arg.integer = 0;
            arg.text.clear();
        }
        result.isString = false;
        result.integer = 0;
        result.text.clear();
        error.clear();
    }
};

struct HostExecutionStorage {
#if defined(PULSE_NETWORK_BOOTSTRAP)
    static const size_t STRING_ARENA_BYTES = 6144;
    static const size_t OBJECT_ARENA_BYTES = 4096;
#else
    static const size_t STRING_ARENA_BYTES = 12288;
    static const size_t OBJECT_ARENA_BYTES = 8192;
#endif

    HostCallStorage calls;
    ManagedStringHeap strings;
    ManagedObjects<> objects;

    HostExecutionStorage() {}
    HostExecutionStorage(const HostExecutionStorage&) = delete;
    HostExecutionStorage& operator=(const HostExecutionStorage&) = delete;
    ~HostExecutionStorage() { std::free(stringArena); std::free(objectArena); }

    // Reserves the result buffer and the fixed string arena once, before any worker runs.
    bool prepare(size_t arenaBytes = STRING_ARENA_BYTES) {
        if (arenaBytes == 0 || arenaBytes > ManagedStringHeap::MAX_ARENA) return false;
        calls.result.text.reserve(1024);
        if (!frameStorage) {
            void* buffer = allocateWorkspace(sizeof(HostedFrameStorage));
            if (!buffer) return false;
            frameStorage.reset(new (buffer) HostedFrameStorage);
        }
        if (!stringArena || strings.arenaBytes() < arenaBytes) {
            if (inUse.load() || strings.getStats().liveHandles != 0) return false;
            auto* replacement = static_cast<uint8_t*>(allocateWorkspace(arenaBytes));
            if (!replacement) return false;
            std::free(stringArena);
            stringArena = replacement;
            strings.attach(stringArena, arenaBytes);
        }
        if (!objectArena) {
            objectArena = static_cast<uint8_t*>(allocateWorkspace(OBJECT_ARENA_BYTES));
            if (!objectArena) return false;
            objects.attach(objectArena, OBJECT_ARENA_BYTES);
        }
        return true;
    }

    bool ready() const { return frameStorage && strings.attached() && objects.attached(); }
    HostedFrameStorage* frames() const { return frameStorage.get(); }
    uint8_t* objectArenaData() { return objectArena; }
    bool acquire() {
        bool expected = false;
        return ready() && inUse.compare_exchange_strong(expected, true);
    }
    void release() { reset(); inUse.store(false); }

    void reset() {
        calls.reset(0);
        if (frameStorage) frameStorage->reset();
        strings.reset();
        if (objectArena) objects.attach(objectArena, OBJECT_ARENA_BYTES);
    }

private:
    static void* allocateWorkspace(size_t size) {
#if defined(ESP32)
        const uint32_t caps = heap_caps_get_total_size(MALLOC_CAP_SPIRAM)
            ? MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT : MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT;
        return heap_caps_malloc(size, caps);
#else
        return std::malloc(size);
#endif
    }

    struct ReleaseFrames {
        void operator()(HostedFrameStorage* frames) const {
            frames->~HostedFrameStorage();
            std::free(frames);
        }
    };
    std::unique_ptr<HostedFrameStorage, ReleaseFrames> frameStorage;
    uint8_t* stringArena = nullptr;
    uint8_t* objectArena = nullptr;
    std::atomic<bool> inUse{false};
};
}
