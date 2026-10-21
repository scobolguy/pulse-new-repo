#include "../../pmachines/arduino/src/hosted_frame_storage.h"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <new>

static bool denyAllocations = false;
static size_t allocations = 0;

void* operator new(size_t size) {
    if (denyAllocations) std::abort();
    ++allocations;
    if (void* pointer = std::malloc(size ? size : 1)) return pointer;
    throw std::bad_alloc();
}
void* operator new[](size_t size) { return ::operator new(size); }
void operator delete(void* pointer) noexcept { std::free(pointer); }
void operator delete[](void* pointer) noexcept { std::free(pointer); }
void operator delete(void* pointer, size_t) noexcept { std::free(pointer); }
void operator delete[](void* pointer, size_t) noexcept { std::free(pointer); }

using namespace pmachine;

static void scopesAndValues() {
    HostedFrameStorage frames;
    assert(!frames.find("missing"));
    assert(!frames.store("text", Value::makeString(7)));
    assert(!frames.store("real", Value::makeReal(1.25f)));
    assert(!frames.store("enum", Value::makeEnum(2, 5)));
    assert(frames.find("real")->asReal() == 1.25f);
    assert(frames.find("enum")->handle == 2 && frames.find("enum")->i == 5);
    char temporaryName[] = "copied";
    assert(!frames.store(temporaryName, 9));
    temporaryName[0] = 'X';
    assert(frames.find("copied")->i == 9);
    const size_t rootBytes = frames.nameBytes();
    assert(!frames.push(42));
    assert(!frames.containsLocal("text"));
    assert(frames.find("text")->handle == 7);
    assert(!frames.store("text", Value::makeString(8)));
    assert(frames.containsLocal("text"));
    assert(frames.find("text")->handle == 8);
    assert(!frames.push(99));
    assert(!frames.store("text", Value::makeString(9)));
    bool live[10] = {};
    frames.forEachValue([&](const Value& value) {
        if (value.isString()) live[value.handle] = true;
    });
    assert(live[7] && live[8] && live[9]);
    int returnPc = 0;
    assert(frames.pop(returnPc) && returnPc == 99);
    assert(frames.find("text")->handle == 8);
    assert(frames.pop(returnPc) && returnPc == 42);
    assert(frames.find("text")->handle == 7);
    assert(frames.size() == 4 && frames.nameBytes() == rootBytes);
    size_t strings = 0, bindings = 0;
    frames.forEachValue([&](const Value& value) {
        if (value.isString()) { ++strings; assert(value.handle == 7); }
    });
    frames.forEachBinding(0, [&](const char* name, const Value& value) {
        assert(frames.find(name)->kind == value.kind);
        ++bindings;
    });
    assert(strings == 1 && bindings == 4);
    assert(!frames.pop(returnPc));
    frames.reset();
    assert(!frames.find("text") && frames.size() == 0 && frames.nameBytes() == 0);
    assert(frames.depth() == 1 && frames.slotHighWater() == 0);
}

static void boundaries() {
    BoundedHostedFrames<3, 32, 3, 2> frames;
    assert(!frames.store("a", 1));
    assert(!frames.store("b", 2));
    const size_t bytes = frames.nameBytes();
    assert(frames.store("c", 3));
    assert(!frames.store("a", 11)); // Updates must work even at the per-frame limit.
    assert(frames.find("a")->i == 11 && frames.nameBytes() == bytes);
    assert(!frames.find("c"));
    assert(!frames.push(10));
    assert(!frames.store("a", 12));
    assert(frames.store("d", 4)); // Aggregate slot limit, not the per-frame limit.
    assert(frames.size() == 3 && !frames.find("d"));
    assert(!frames.push(20));
    assert(frames.push(30));
    assert(frames.depth() == 3);
    int returnPc = 0;
    assert(frames.pop(returnPc) && returnPc == 20);
    assert(frames.pop(returnPc) && returnPc == 10);
    assert(frames.find("a")->i == 11);
    assert(!frames.push(40));
    assert(!frames.store("reused", 4));
    assert(frames.slotHighWater() == 3 && frames.depthHighWater() == 3);

    BoundedHostedFrames<3, 6, 3> names;
    assert(!names.store("abc", 1));
    assert(!names.store("x", 2)); // Exactly six bytes, including terminators.
    assert(names.store("", 3));
    assert(!names.store("abc", 4));
    assert(names.nameBytes() == 6 && names.find("abc")->i == 4);
    names.reset();
    assert(!names.push(1));
    assert(!names.store("12345", 6));
    assert(names.nameHighWater() == 6);
    assert(names.pop(returnPc));
    assert(names.nameBytes() == 0);
    assert(!names.store("12345", 7));
}

static void repeatedInvocations() {
    HostedFrameStorage frames;
    for (size_t invocation = 0; invocation < 1000; ++invocation) {
        frames.reset();
        for (int index = 0; index < 128; ++index) {
            char name[24];
            std::snprintf(name, sizeof(name), "global_%d", index);
            assert(!frames.store(name, index));
        }
        assert(frames.store("one_too_many", 0));
        assert(!frames.store("global_0", 99));
        for (int depth = 1; depth < 32; ++depth) {
            assert(!frames.push(depth));
            assert(!frames.store("parameter", Value::makeString(static_cast<uint16_t>(depth))));
            assert(!frames.store("local", depth));
        }
        assert(frames.push(32));
        assert(frames.slotHighWater() == 190 && frames.depthHighWater() == 32);
        for (int depth = 31; depth > 0; --depth) {
            assert(frames.find("local")->i == depth);
            int returnPc = 0;
            assert(frames.pop(returnPc) && returnPc == depth);
        }
        assert(!frames.find("local") && !frames.find("parameter"));
        assert(frames.find("global_0")->i == 99);
        assert(frames.size() == 128);
    }
}

int main() {
    const size_t before = allocations;
    denyAllocations = true;
    scopesAndValues();
    boundaries();
    repeatedInvocations();
    denyAllocations = false;
    assert(allocations == before);
    std::puts("PASS hosted slots: scopes, typed values, liveness, limits and 1000 allocation-denied invocations");
}
