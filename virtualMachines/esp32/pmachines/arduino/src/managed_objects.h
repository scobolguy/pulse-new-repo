#pragma once

#include "managed_heap.h"
#include "pmachine_value.h"
#include <cstring>
#include <limits>

namespace pmachine {

// Root counts are refreshed at instruction boundaries; edges are owned by objects.
// Native borrowers copy fields out, so no arena pointers escape the safe point.
template <size_t Capacity = 128>
class ManagedObjects {
public:
    static const size_t MAX_FIELDS = 64;

    void attach(uint8_t* memory, size_t bytes) {
        heap.attach(memory, bytes);
        std::memset(fieldsByHandle, 0, sizeof(fieldsByHandle));
        beginRoots();
        std::memset(refs, 0, sizeof(refs));
        activity = 0;
        lastError = nullptr;
    }
    bool attached() const { return heap.attached(); }

    bool create(size_t fields, Value& result) {
        if (fields > MAX_FIELDS) return fail("object field capacity exceeded");
        if (++activity >= 64) {
            activity = 0;
            if (heap.usedBytes() > heap.residentBytes()) heap.compact();
        }
        uint16_t handle;
        if (!heap.allocate((fields ? fields : 1) * sizeof(Value), handle)) return fail(heap.error());
        fieldsByHandle[handle] = static_cast<uint16_t>(fields);
        refs[handle] = 0;
        roots[handle] = 0;
        Value zero;
        for (size_t index = 0; index < (fields ? fields : 1); ++index) write(handle, index, zero);
        result = Value::makeObject(handle);
        return true;
    }

    bool get(Value object, size_t index, Value& result) {
        if (!check(object, index)) return false;
        result = read(object.handle, index);
        return true;
    }

    bool set(Value object, size_t index, Value value) {
        if (!check(object, index)) return false;
        if (value.isObject()) {
            if (!heap.valid(value.handle)) return fail("invalid object handle");
            bool seen[Capacity] = {};
            if (reaches(value.handle, object.handle, seen)) return fail("reference cycle is not supported");
        }
        write(object.handle, index, value);
        return true;
    }

    bool length(Value object, size_t& count) {
        if (object.kind == ValueKind::Integer && object.i == 0) { count = 0; return true; }
        if (!object.isObject()) return fail("object reference required");
        if (!heap.valid(object.handle)) return fail("invalid object handle");
        count = fieldsByHandle[object.handle];
        return true;
    }

    bool resize(Value object, size_t fields, Value& result) {
        size_t oldCount;
        if (!length(object, oldCount)) return false;
        if (!create(fields, result)) return false;
        for (size_t index = 0; index < fields && index < oldCount; ++index)
            write(result.handle, index, read(object.handle, index));
        return true;
    }

    void beginRoots() { std::memset(roots, 0, sizeof(roots)); }
    bool root(Value value) {
        if (!value.isObject()) return true;
        if (!heap.valid(value.handle)) return fail("invalid object root");
        if (roots[value.handle] == std::numeric_limits<uint32_t>::max()) return fail("object reference count overflow");
        ++roots[value.handle];
        return true;
    }

    bool reconcile() {
        std::memcpy(refs, roots, sizeof(refs));
        for (size_t handle = 0; handle < Capacity; ++handle) {
            if (!heap.valid(static_cast<uint16_t>(handle))) continue;
            for (size_t index = 0; index < fieldsByHandle[handle]; ++index) {
                const Value value = read(static_cast<uint16_t>(handle), index);
                if (!value.isObject()) continue;
                if (!heap.valid(value.handle)) return fail("invalid object edge");
                if (refs[value.handle] == std::numeric_limits<uint32_t>::max()) return fail("object reference count overflow");
                ++refs[value.handle];
            }
        }
        bool released;
        do {
            released = false;
            for (size_t handle = 0; handle < Capacity; ++handle) {
                if (!heap.valid(static_cast<uint16_t>(handle)) || refs[handle]) continue;
                for (size_t index = 0; index < fieldsByHandle[handle]; ++index) {
                    const Value value = read(static_cast<uint16_t>(handle), index);
                    if (value.isObject()) --refs[value.handle];
                }
                heap.release(static_cast<uint16_t>(handle));
                released = true;
            }
        } while (released);
        return true;
    }

    template <typename Visit>
    void forEachValue(Visit visit) {
        for (size_t handle = 0; handle < Capacity; ++handle) {
            if (!heap.valid(static_cast<uint16_t>(handle))) continue;
            for (size_t index = 0; index < fieldsByHandle[handle]; ++index)
                visit(read(static_cast<uint16_t>(handle), index));
        }
    }

    uint32_t references(Value value) const { return value.isObject() && heap.valid(value.handle) ? refs[value.handle] : 0; }
    const typename ManagedHeap<Capacity>::Stats& stats() const { return heap.getStats(); }
    const char* error() const { return lastError; }

private:
    bool fail(const char* message) { lastError = message; return false; }
    bool check(Value value, size_t index) {
        if (value.kind == ValueKind::Integer && value.i == 0) return fail("nil object dereference");
        if (!value.isObject()) return fail("object reference required");
        if (!heap.valid(value.handle)) return fail("invalid object handle");
        return index < fieldsByHandle[value.handle] || fail("object field index out of range");
    }
    Value read(uint16_t handle, size_t index) {
        Value value;
        std::memcpy(&value, heap.data(handle) + index * sizeof(Value), sizeof(Value));
        return value;
    }
    void write(uint16_t handle, size_t index, Value value) {
        std::memcpy(const_cast<char*>(heap.data(handle)) + index * sizeof(Value), &value, sizeof(Value));
    }
    bool reaches(uint16_t handle, uint16_t target, bool (&seen)[Capacity]) {
        if (handle == target) return true;
        if (seen[handle]) return false;
        seen[handle] = true;
        for (size_t index = 0; index < fieldsByHandle[handle]; ++index) {
            const Value value = read(handle, index);
            if (value.isObject() && reaches(value.handle, target, seen)) return true;
        }
        return false;
    }

    ManagedHeap<Capacity> heap;
    uint16_t fieldsByHandle[Capacity] = {};
    uint32_t roots[Capacity] = {};
    uint32_t refs[Capacity] = {};
    uint16_t activity = 0;
    const char* lastError = nullptr;
};
}
