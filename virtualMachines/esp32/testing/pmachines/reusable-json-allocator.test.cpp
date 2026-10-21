#include "../../pmachines/arduino/src/reusable_json_allocator.h"
#include "../../pmachines/arduino/src/buffered_json.h"
#include <cassert>
#include <limits>
#include <string>

class TestAllocator : public ArduinoJson::Allocator {
public:
    size_t allocations = 0, live = 0;
    bool fail = false;
    void* allocate(size_t size) override {
        ++allocations;
        if (fail) return nullptr;
        void* pointer = std::malloc(size);
        if (pointer) ++live;
        return pointer;
    }
    void deallocate(void* pointer) override {
        if (pointer) --live;
        std::free(pointer);
    }
    void* reallocate(void* pointer, size_t size) override {
        if (!pointer) return allocate(size);
        ++allocations;
        return fail ? nullptr : std::realloc(pointer, size);
    }
};

int main() {
    TestAllocator heap;
    pmachine::ReusableJsonAllocator<4096> allocator(&heap);
    heap.fail = true;
    std::string output;
    output.reserve(1024);
    char buffer[1024];
    const char* input = R"({"nodeId":"esp32-vm-2bf4","localAddress":"192.168.2.63","listeners":[{"protocol":"http","host":"192.168.2.63","port":80}],"metadata":{"hardware":"ESP32","runtime":"esp32-pmachine"}})";
    for (int run = 0; run < 100; ++run) {
        allocator.reset();
        JsonDocument doc(&allocator), next(&allocator);
        assert(!deserializeJson(doc, input));
        assert(std::string(doc["nodeId"].as<const char*>()) == "esp32-vm-2bf4");
        assert(!deserializeJson(next, R"({"status":"available","sequence":12,"enabled":true})"));
        for (JsonPairConst pair : next.as<JsonObjectConst>())
            doc[pair.key().c_str()].set(pair.value());
        assert(!doc.overflowed());
        assert(doc["sequence"] == 12);
        const size_t expected = measureJson(doc);
        assert(pmachine::serializeBufferedJson(doc, expected, buffer, output) == expected);
        JsonDocument roundTrip;
        assert(!deserializeJson(roundTrip, output));
        assert(roundTrip["status"] == "available");
    }
    assert(heap.allocations == 0);

    allocator.reset();
    void* small = allocator.allocate(16);
    assert(small && reinterpret_cast<uintptr_t>(small) % alignof(std::max_align_t) == 0);
    std::memset(small, 42, 16);
    assert(allocator.reallocate(small, 8) == small);
    auto* grown = static_cast<unsigned char*>(allocator.reallocate(small, 128));
    assert(grown);
    for (size_t i = 0; i < 16; ++i) assert(grown[i] == 42);
    assert(!allocator.allocate(std::numeric_limits<size_t>::max()));
    assert(!allocator.reallocate(grown, 8192));
    for (size_t i = 0; i < 16; ++i) assert(grown[i] == 42);
    allocator.deallocate(grown);
    allocator.deallocate(nullptr);

    heap.fail = false;
    allocator.reset();
    {
        JsonDocument doc(&allocator);
        const std::string large(8192, 'x');
        doc["large"] = large;
        assert(!doc.overflowed());
        assert(std::string(doc["large"].as<const char*>()) == large);
        assert(heap.live > 0);
        doc.clear();
        assert(heap.live == 0);
    }
    assert(heap.live == 0);
    allocator.reset();
    heap.fail = true;
    {
        JsonDocument doc(&allocator);
        const std::string large(8192, 'x');
        const std::string json = "{\"large\":\"" + large + "\"}";
        assert(deserializeJson(doc, json) == DeserializationError::NoMemory);
        assert(doc.overflowed());
    }
    allocator.reset();
    {
        JsonDocument doc(&allocator);
        assert(!deserializeJson(doc, input));
        assert(!doc.overflowed());
    }
    assert(heap.live == 0);
}
