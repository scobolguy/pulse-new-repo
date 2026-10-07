#include "../../pmachines/arduino/src/byte_buffer.h"
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
    pmachine::ByteBuffer buffer;
    std::string error, output;
    int handle = 0, next = 0;
    assert(buffer.create(4096, handle, error));
    const size_t before = allocations;
    for (int i = 0; i < 4096; ++i) assert(buffer.append(handle, i & 255, error));
    assert(allocations == before);
    assert(buffer.size() == 4096);
    int value = 0;
    assert(buffer.get(handle, 4095, value, error) && value == 255);
    assert(buffer.set(handle, 4095, 65, error));
    assert(buffer.get(handle, 4095, value, error) && value == 65);
    assert(allocations == before);
    assert(!buffer.get(handle, -1, value, error));
    assert(!buffer.set(handle, 4096, 0, error));
    assert(!buffer.set(handle, 0, 256, error));
    assert(!buffer.append(handle, 0, error));
    assert(buffer.size() == 4096);
    assert(!buffer.create(1, next, error));
    buffer.reset();
    assert(!buffer.valid(handle, error));
    const std::string text("\xef\xbb\xbf" "caf\xc3\xa9\0", 9);
    assert(buffer.create(text.size(), next, error));
    assert(next != handle);
    for (unsigned char byte : text) assert(buffer.append(next, byte, error));
    assert(buffer.text(next, output, error));
    assert(output == text);
    assert(!buffer.valid(next, error));
    for (const auto& invalid : {std::string("\xff"), std::string("\xc0\x80"),
            std::string("\xed\xa0\x80"), std::string("\xf4\x90\x80\x80"), std::string("\xe2\x82")}) {
        assert(buffer.create(invalid.size(), next, error));
        for (unsigned char byte : invalid) assert(buffer.append(next, byte, error));
        assert(!buffer.text(next, output, error));
        buffer.reset();
    }
    assert(buffer.create(0, next, error));
    assert(buffer.text(next, output, error) && output.empty());
    assert(!buffer.create(-1, next, error));
    assert(!buffer.create(4097, next, error));
    const uint8_t input[] = {65, 66, 67};
    const size_t beforeLoad = allocations;
    assert(buffer.load(input, 3, next, error));
    assert(buffer.size() == 3 && buffer.bytes()[1] == 66);
    assert(allocations == beforeLoad);
    const char* view = nullptr;
    size_t count = 0;
    assert(buffer.textView(next, view, count, error));
    assert(view == reinterpret_cast<const char*>(buffer.bytes()) && count == 3);
    assert(allocations == beforeLoad && buffer.valid(next, error));
    assert(buffer.text(next, output, error) && output == "ABC");
    assert(!buffer.textView(next, view, count, error));
}
