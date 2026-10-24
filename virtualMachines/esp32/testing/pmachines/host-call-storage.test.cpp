#include "../../pmachines/arduino/src/host_call_storage.h"
#include <cassert>
#include <cstdlib>
#include <new>

static size_t allocations = 0;

void* operator new(size_t size) {
    ++allocations;
    if (void* pointer = std::malloc(size ? size : 1)) return pointer;
    throw std::bad_alloc();
}
void operator delete(void* pointer) noexcept { std::free(pointer); }
void operator delete(void* pointer, size_t) noexcept { std::free(pointer); }

int main() {
    pmachine::HostCallStorage storage;
    const std::string encrypted(1160, 'a');
    storage.reset(2);
    storage.args[0].text.reserve(2048);
    storage.result.text.reserve(2048);
    const size_t warmedAllocations = allocations;
    for (int index = 0; index < 580; ++index) {
        storage.reset(1);
        storage.args[0].isString = true;
        storage.args[0].text = encrypted;
        storage.result.integer = 580;
        storage.reset(2);
        storage.args[0].isString = true;
        storage.args[0].text.assign(static_cast<size_t>(index) * 2, 'b');
        storage.args[1].integer = index & 255;
        storage.result.isString = true;
        storage.result.text = storage.args[0].text;
        storage.result.text += "ab";
    }
    assert(allocations == warmedAllocations);
    storage.result.integer = 99;
    storage.error = "prior error";
    storage.reset(0);
    assert(storage.args.empty());
    assert(!storage.result.isString && storage.result.integer == 0);
    assert(storage.result.text.empty() && storage.error.empty());
    storage.reset(8);
    assert(storage.args.size() == 8);
    for (const auto& arg : storage.args) {
        assert(!arg.isString && arg.integer == 0 && arg.text.empty());
    }

    pmachine::HostExecutionStorage execution;
    assert(execution.prepare());
    assert(execution.strings.attached());
    assert(execution.objects.attached());
    assert(execution.acquire());
    assert(!execution.acquire());
    execution.release();
    assert(execution.strings.arenaBytes() == pmachine::HostExecutionStorage::STRING_ARENA_BYTES);
    assert(execution.calls.result.text.capacity() >= 1024);
    const std::string text(512, 'x');
    const size_t preparedAllocations = allocations;
    for (size_t invocation = 0; invocation < 100; ++invocation) {
        execution.reset();
        pmachine::Value object;
        assert(execution.objects.create(1, object));
        const uint16_t string = execution.strings.store("object-string", 13);
        assert(string != pmachine::ManagedStringHeap::INVALID);
        assert(execution.objects.set(object, 0, pmachine::Value::makeString(string)));
        assert(execution.objects.root(object));
        assert(execution.objects.reconcile());
        execution.reset();
        assert(execution.objects.stats().liveHandles == 0);
        assert(execution.calls.result.text.empty());
        assert(execution.strings.usedBytes() == 0);
        for (size_t index = 0; index < 16; ++index)
            assert(execution.strings.store(text.data(), text.size()) != pmachine::ManagedStringHeap::INVALID);
        execution.calls.result.text.assign(295, 'j');
        execution.calls.reset(0);
        assert(execution.calls.result.text.capacity() >= 1024);
        execution.calls.result.text.assign(1024, 'r');
    }
    assert(allocations == preparedAllocations);
    execution.reset();
    assert(execution.strings.getStats().liveHandles == 0);
    assert(execution.prepare());
    assert(allocations == preparedAllocations);
}
