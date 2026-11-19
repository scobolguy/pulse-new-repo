#include "pmachine.h"
#include <cassert>
#include <cstdlib>
#include <iostream>
#include <map>
#include <utility>

namespace {
std::map<void*, size_t> allocations;
size_t calls = 0, failAt = 0, maxAllocation = 0;

void* allocate(size_t bytes, bool& psram) {
    if (++calls == failAt) return nullptr;
    maxAllocation = std::max(maxAllocation, bytes);
    psram = true;
    void* memory = std::malloc(bytes);
    if (memory) allocations[memory] = bytes;
    return memory;
}

void release(void* memory, bool psram) {
    assert(psram);
    assert(allocations.erase(memory) == 1);
    std::free(memory);
}

JsonDocument imageMap(const pmachine::PMachine& machine) {
    JsonDocument doc;
    assert(!deserializeJson(doc, machine.getImageMemoryMapJson()));
    return doc;
}
}

int main() {
    std::vector<uint8_t> bytes(513 * 1024 + 17);
    for (size_t index = 0; index < bytes.size(); ++index) {
        bytes[index] = static_cast<uint8_t>((index * 37 + index / 1024) % 251);
    }
    {
        pmachine::ManagedProgramBuffer buffer(allocate, release);
        assert(buffer.assign(bytes.data(), bytes.size()));
        assert(maxAllocation < 4608);
        assert(buffer.allocatedInternalBytes() == 0);
        assert(buffer.allocatedPsramBytes() < bytes.size() * 11 / 10);
        uint8_t value = 0;
        for (size_t index = 0; index < bytes.size(); ++index) {
            assert(buffer.read(index, value) && value == bytes[index]);
        }
        for (size_t index : {bytes.size() - 1, size_t(4096), size_t(0), size_t(1023),
                             size_t(1024), size_t(65536), size_t(262145)}) {
            assert(buffer.read(index, value) && value == bytes[index]);
        }
        assert(!buffer.read(bytes.size(), value));
        const size_t originalAllocations = allocations.size();
        failAt = calls + 3;
        assert(!buffer.assign(bytes.data(), bytes.size()));
        assert(allocations.size() == originalAllocations);
        assert(buffer.size() == bytes.size());
        assert(buffer.read(4096, value) && value == bytes[4096]);
        failAt = 0;
        assert(buffer.assign(bytes.data(), 1025));
        assert(allocations.size() == 1);
        assert(buffer.read(1024, value) && value == bytes[1024]);
        assert(buffer.assign(nullptr, 0));
        assert(allocations.empty());
        assert(!buffer.read(0, value));
    }
    assert(allocations.empty());

    pmachine::PMachine machine;
    machine.setRuntimeUnit("program", "transient");
    machine.setMemoryConfig(1024, 2);
    assert(machine.loadProgram(bytes, "test://transient", bytes.size(), true));
    auto doc = imageMap(machine);
    assert(std::string(doc["programImageStorage"]) == "managed-chunks");
    assert(doc["programImageBytes"].as<size_t>() == bytes.size());
    for (size_t index : {size_t(0), size_t(4096), size_t(1024), bytes.size() - 1, size_t(0)}) {
        uint8_t value = 0;
        assert(machine.readPCodeByte(static_cast<uint32_t>(index), value));
        assert(value == bytes[index]);
    }
    assert(machine.getPagingStats().evictions >= 2);
    const auto assets = machine.getResidentAssets();
    assert(assets.back().bytes == bytes.size());
    pmachine::PMachine moved(std::move(machine));
    machine.unloadUnit();
    uint8_t value = 0;
    assert(moved.readPCodeByte(65536, value) && value == bytes[65536]);
    pmachine::PMachine assigned;
    assigned.setRuntimeUnit("program", "old");
    assert(assigned.loadProgram({1, 2, 3}, "test://old", 3, true));
    assigned = std::move(moved);
    moved.unloadUnit();
    assert(assigned.readPCodeByte(4096, value) && value == bytes[4096]);
    assigned.traceEnabled = false;
    assigned.run(pmachine::loadTextPCode("PUSH_STR \"managed buffer works\"\nPRINT\nPRINT_NL\nHALT\n"));
    assert(assigned.getFlowState().find("__runtime_error") == assigned.getFlowState().end());
    assert(assigned.getLastRunTextOutput().at(0) == "managed buffer works");
    assert(!assigned.readPCodeByte(0, value));

    for (const char* kind : {"service", "daemon"}) {
        assigned.setRuntimeUnit(kind, "persistent");
        assert(assigned.loadProgram({9, 8, 7}, "test://persistent", 3, true));
        assert(std::string(imageMap(assigned)["programImageStorage"]) == "contiguous");
        assert(assigned.readPCodeByte(1, value) && value == 8);
    }
    assigned.loadUnit("program", "resident");
    assert(assigned.loadProgram({5}, "test://resident", 1, true));
    assert(std::string(imageMap(assigned)["programImageStorage"]) == "contiguous");
    assigned.unloadUnit();
    assigned.setRuntimeUnit("program", "explicit-load");
    assert(assigned.loadProgram({4}, "test://explicit-load", 1));
    assert(std::string(imageMap(assigned)["programImageStorage"]) == "contiguous");
    assigned.setRuntimeUnit("program", "pinned");
    assigned.loadResidentDomain("program-image", "pinned", 1, true);
    assert(assigned.loadProgram({6}, "test://pinned", 1, true));
    assert(std::string(imageMap(assigned)["programImageStorage"]) == "contiguous");
    assigned.unloadUnit();
    assert(assigned.loadProgram({}, "test://empty", 0, true));
    assert(!assigned.readPCodeByte(0, value));
    std::cout << "managed program chunks: bounded allocations, failures, paging, moves and execution passed\n";
}
