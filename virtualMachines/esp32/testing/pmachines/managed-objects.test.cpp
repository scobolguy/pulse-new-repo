#include "../../pmachines/arduino/src/managed_objects.h"
#include "../../pmachines/arduino/src/hosted_frame_storage.h"
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

int main() {
    static uint8_t arena[16 * 64 * sizeof(Value)];
    static ManagedObjects<> objects;
    static HostedFrameStorage frames;
    objects.attach(arena, sizeof(arena));
    denyAllocations = true;
    Value a, b, value, grown;
    assert(sizeof(Value) <= 16);
    assert(objects.create(3, a) && objects.create(1, b));
    assert(objects.get(a, 0, value) && value.kind == ValueKind::Integer && value.i == 0);
    assert(objects.set(a, 0, b));
    assert(objects.set(a, 1, Value::makeString(17)));
    assert(objects.set(a, 2, Value::makeReal(1.25f)));
    assert(!objects.set(b, 0, a) && std::strstr(objects.error(), "cycle"));
    assert(!objects.set(a, 0, a));
    assert(objects.get(a, 0, value) && value.isObject() && value.handle == b.handle);
    assert(!objects.get(Value(0), 0, value) && std::strstr(objects.error(), "nil"));
    assert(!objects.get(Value(1), 0, value) && std::strstr(objects.error(), "required"));
    assert(!objects.get(a, 3, value));
    assert(!objects.create(65, value));
    size_t length = 99;
    assert(objects.length(Value(0), length) && length == 0);
    assert(objects.resize(a, 4, grown));
    assert(grown.handle != a.handle);
    assert(objects.get(grown, 0, value) && value.isObject() && value.handle == b.handle);
    assert(objects.get(grown, 1, value) && value.isString() && value.handle == 17);
    assert(objects.get(grown, 2, value) && value.isReal() && value.r == 1.25f);
    assert(objects.get(grown, 3, value) && value.i == 0);
    assert(!frames.store("alias", grown));
    assert(!frames.push(12) && !frames.store("parameter", grown));
    objects.beginRoots();
    frames.forEachValue([&](Value root) { assert(objects.root(root)); });
    assert(objects.reconcile());
    assert(objects.stats().liveHandles == 2 && objects.references(grown) == 2 && objects.references(b) == 1);
    bool stringMarked = false;
    objects.forEachValue([&](Value field) { if (field.isString() && field.handle == 17) stringMarked = true; });
    assert(stringMarked);
    int returnPc;
    assert(frames.pop(returnPc) && returnPc == 12);
    assert(!frames.store("alias", Value(0)));
    objects.beginRoots();
    frames.forEachValue([&](Value root) { assert(objects.root(root)); });
    assert(objects.reconcile() && objects.stats().liveHandles == 0);

    objects.attach(arena, sizeof(arena));
    Value roots[128];
    for (size_t index = 0; index < 128; ++index) assert(objects.create(0, roots[index]));
    assert(objects.stats().liveHandles == 128 && objects.stats().compactions == 0);
    assert(!objects.create(0, value) && std::strstr(objects.error(), "handle capacity"));
    objects.beginRoots();
    for (size_t index = 0; index < 128; ++index) assert(objects.root(roots[index]));
    assert(objects.reconcile() && objects.stats().liveHandles == 128);
    objects.beginRoots();
    assert(objects.reconcile() && objects.stats().liveHandles == 0);

    objects.attach(arena, sizeof(arena));
    for (size_t index = 0; index < 16; ++index) {
        assert(objects.create(64, roots[index]));
        assert(objects.set(roots[index], 63, Value(static_cast<int>(index + 100))));
    }
    assert(objects.stats().liveBytes == sizeof(arena) && !objects.create(1, value));
    assert(objects.stats().compactions == 0);
    objects.beginRoots();
    for (size_t index = 1; index < 16; index += 2) assert(objects.root(roots[index]));
    assert(objects.reconcile() && objects.stats().liveBytes == sizeof(arena) / 2);
    assert(objects.create(64, grown) && objects.stats().compactions == 1);
    for (size_t index = 1; index < 16; index += 2)
        assert(objects.get(roots[index], 63, value) && value.i == static_cast<int>(index + 100));

    objects.attach(arena, sizeof(arena));
    assert(objects.create(1, a) && objects.create(1, b));
    objects.beginRoots();
    assert(objects.root(b) && objects.reconcile());
    for (size_t attempt = 2; attempt < 64; ++attempt) assert(objects.create(0, value));
    assert(objects.stats().compactions == 1);
    assert(objects.resize(Value(0), 2, grown));
    assert(objects.length(grown, length) && length == 2);
    assert(objects.resize(grown, 0, value) && objects.length(value, length) && length == 0);

    static uint8_t stringArena[128];
    static ManagedHeap<16> strings;
    strings.attach(stringArena, sizeof(stringArena));
    objects.attach(arena, sizeof(arena));
    assert(objects.create(1, a));
    const uint16_t text = strings.store("field-only string", 17);
    assert(text != ManagedHeap<16>::INVALID);
    assert(objects.set(a, 0, Value::makeString(text)));
    objects.beginRoots();
    assert(objects.root(a) && objects.reconcile());
    for (size_t iteration = 0; iteration < 128; ++iteration) {
        bool live[16] = {};
        objects.forEachValue([&](Value field) { if (field.isString()) live[field.handle] = true; });
        strings.sweep([&](uint16_t handle) { return live[handle]; });
        assert(strings.store("discard", 7) != ManagedHeap<16>::INVALID);
        assert(objects.get(a, 0, value) && value.isString());
        assert(strings.valid(value.handle));
        assert(std::memcmp(strings.data(value.handle), "field-only string", 17) == 0);
    }
    objects.beginRoots();
    assert(objects.reconcile());
    strings.sweep([](uint16_t) { return false; });
    assert(strings.getStats().liveHandles == 0);
    denyAllocations = false;
}
