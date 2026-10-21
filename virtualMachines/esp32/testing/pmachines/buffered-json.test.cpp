#include "../../pmachines/arduino/src/buffered_json.h"
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
    char buffer[1024];
    std::string output;
    output.reserve(20480);
    JsonDocument doc;
    for (const size_t length : {size_t(0), size_t(293), size_t(1021), size_t(1022),
                               size_t(1023), size_t(8192), size_t(20478)}) {
        const std::string text(length, 'a');
        doc.set(text);
        const size_t expected = measureJson(doc);
        const size_t before = allocations;
        for (int run = 0; run < 100; ++run) {
            assert(pmachine::serializeBufferedJson(doc, expected, buffer, output) == expected);
            assert(output.size() == length + 2);
            assert(output.front() == '"' && output.back() == '"');
            assert(output.compare(1, length, text) == 0);
        }
        assert(allocations == before);
    }
    doc.set("quotes: \" slash: \\ newline:\n");
    const size_t expected = measureJson(doc);
    assert(pmachine::serializeBufferedJson(doc, expected, buffer, output) == expected);
    JsonDocument roundTrip;
    assert(!deserializeJson(roundTrip, output));
    assert(roundTrip.as<std::string>() == doc.as<std::string>());
    doc.set(nullptr);
    assert(pmachine::serializeBufferedJson(doc, measureJson(doc), buffer, output) == 4);
    assert(output == "null");

    pmachine::HostExecutionStorage execution;
    execution.prepare();
    JsonDocument request, response;
    request["nodeId"] = "esp32-vm-2bf4";
    request["localAddress"] = "192.168.2.63";
    const size_t requestBytes = measureJson(request);
    std::string body;
    assert(pmachine::serializeBufferedJson(request, requestBytes, buffer, body) == requestBytes);
    request.clear();
    assert(request.isNull());
    assert(!deserializeJson(request, body));
    assert(request["nodeId"] == "esp32-vm-2bf4");
    response["ok"] = true;
    response["packet"]["nodeId"] = request["nodeId"];
    response["packet"]["kind"] = "nodeBeacon";
    const size_t packetBytes = measureJson(response["packet"]);
    auto& packet = execution.calls.result.text;
    const size_t before = allocations;
    assert(pmachine::serializeBufferedJson(response["packet"], packetBytes, buffer, packet) == packetBytes);
    response.clear();
    assert(packet == "{\"nodeId\":\"esp32-vm-2bf4\",\"kind\":\"nodeBeacon\"}");
    assert(allocations == before);
}
