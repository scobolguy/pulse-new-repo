#pragma once

#include "hosted_frame_storage.h"
#include "managed_heap.h"
#include "managed_objects.h"
#include <atomic>
#include <cstdlib>
#include <string>
#include <vector>

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
    static const size_t STRING_ARENA_BYTES = 12288;
    static const size_t OBJECT_ARENA_BYTES = 8192;

    HostCallStorage calls;
    ManagedStringHeap strings;
    HostedFrameStorage frames;
    ManagedObjects<> objects;

    HostExecutionStorage() {}
    HostExecutionStorage(const HostExecutionStorage&) = delete;
    HostExecutionStorage& operator=(const HostExecutionStorage&) = delete;
    ~HostExecutionStorage() { std::free(stringArena); std::free(objectArena); }

    // Reserves the result buffer and the fixed string arena once, before any worker runs.
    bool prepare(size_t arenaBytes = STRING_ARENA_BYTES) {
        calls.result.text.reserve(1024);
        if (!stringArena) {
            stringArena = static_cast<uint8_t*>(std::malloc(arenaBytes));
            if (!stringArena) return false;
            strings.attach(stringArena, arenaBytes);
        }
        if (!objectArena) {
            objectArena = static_cast<uint8_t*>(std::malloc(OBJECT_ARENA_BYTES));
            if (!objectArena) return false;
            objects.attach(objectArena, OBJECT_ARENA_BYTES);
        }
        return true;
    }

    bool ready() const { return strings.attached() && objects.attached(); }
    uint8_t* objectArenaData() { return objectArena; }
    bool acquire() {
        bool expected = false;
        return ready() && inUse.compare_exchange_strong(expected, true);
    }
    void release() { reset(); inUse.store(false); }

    void reset() {
        calls.reset(0);
        frames.reset();
        strings.reset();
        if (objectArena) objects.attach(objectArena, OBJECT_ARENA_BYTES);
    }

private:
    uint8_t* stringArena = nullptr;
    uint8_t* objectArena = nullptr;
    std::atomic<bool> inUse{false};
};
}
