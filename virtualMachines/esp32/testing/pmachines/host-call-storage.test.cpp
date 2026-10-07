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
}
