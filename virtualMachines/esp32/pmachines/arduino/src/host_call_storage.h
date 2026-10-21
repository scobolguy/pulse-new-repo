#pragma once

#include "hosted_frame_storage.h"
#include "managed_heap.h"
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

    HostCallStorage calls;
    ManagedStringHeap strings;
    HostedFrameStorage frames;

    HostExecutionStorage() {}
    HostExecutionStorage(const HostExecutionStorage&) = delete;
    HostExecutionStorage& operator=(const HostExecutionStorage&) = delete;
    ~HostExecutionStorage() { std::free(stringArena); }

    // Reserves the result buffer and the fixed string arena once, before any worker runs.
    bool prepare(size_t arenaBytes = STRING_ARENA_BYTES) {
        calls.result.text.reserve(1024);
        if (stringArena) return true;
        stringArena = static_cast<uint8_t*>(std::malloc(arenaBytes));
        if (!stringArena) return false;
        strings.attach(stringArena, arenaBytes);
        return true;
    }

    void reset() {
        calls.reset(0);
        frames.reset();
        strings.reset();
    }

private:
    uint8_t* stringArena = nullptr;
};
}
