#include <cassert>
#include <cstring>
#include <map>
#include <string>
#include <vector>
#define PROGMEM
#define FPSTR(pointer) pointer
#define memcpy_P std::memcpy
#include "../../src/sensor_node/program.h"

namespace {
uint32_t now = 0;
int button = 1;
bool valid = true;
std::map<std::string, int> state;
std::vector<std::string> output;
std::vector<uint32_t> samples;

bool call(const std::string& operation, const std::vector<pmachine::HostValue>& args,
          pmachine::HostValue& result, std::string& error, void*) {
    if (operation == "device.clock") result.integer = now & 0x7fffffff;
    else if (operation == "device.elapsed") result.integer = (now - args[0].integer) & 0x7fffffff;
    else if (operation == "device.state_get") result.integer = state[args[0].text];
    else if (operation == "device.state_set") result.integer = state[args[0].text] = args[1].integer;
    else if (operation == "device.gpio_read") { assert(args[0].integer == 14); result.integer = button; }
    else if (operation == "device.dht_read") { assert(args[0].integer == 4); samples.push_back(now); result.integer = valid; }
    else if (operation == "device.dht_temperature" || operation == "device.dht_humidity") {
        assert(valid);
        result.isString = true;
        result.text = operation == "device.dht_temperature" ? "23.0" : "45.0";
    } else { error = "Unknown device binding"; return false; }
    return true;
}

void print(const std::string& line, void*) { output.push_back(line); }

void tick(pmachine::PMachine& machine, uint32_t time, int level = 1, bool good = true) {
    now = time; button = level; valid = good;
    machine.runImage(sensor_program::count, sensor_program::at);
    assert(!machine.didLastRunHitStepLimit());
    assert(machine.getLastRunStepCount() < 2000);
    assert(!machine.getFlowStateSnapshot().count("__runtime_error"));
}
}

int main() {
    pmachine::PMachine machine;
    machine.setHostCallHook(call);
    machine.setTextOutputHook(print);
    tick(machine, 0);
    tick(machine, 10, 0);
    tick(machine, 20, 1);
    tick(machine, 30, 0);
    tick(machine, 79, 0);
    assert(output == std::vector<std::string>{"DHT11 sensor node ready"});
    tick(machine, 80, 0);
    tick(machine, 100, 0);
    assert(output.size() == 2 && output.back() == "Button pressed");
    tick(machine, 200, 1);
    tick(machine, 250, 1);
    assert(output.size() == 2);
    tick(machine, 4999);
    assert(samples.empty());
    tick(machine, 5000);
    assert(output.back() == "DHT11 temperature=23.0 C humidity=45.0 %");
    tick(machine, 10000, 1, false);
    assert(output.back() == "DHT11 read failed");
    tick(machine, 30000);
    assert((samples == std::vector<uint32_t>{5000, 10000, 30000}));
    state.clear(); output.clear(); samples.clear();
    const uint32_t start = 0x7fffffff - 100;
    tick(machine, start);
    tick(machine, start + 90, 0);
    tick(machine, start + 139, 0);
    assert(output.size() == 1);
    tick(machine, start + 140, 0);
    assert(output.back() == "Button pressed");
    tick(machine, start + 5000);
    assert(samples == std::vector<uint32_t>{start + 5000});

    auto invalid = pmachine::loadTextPCode("CALL_EXT device.invalid 0\nHALT\n");
    machine.run(invalid);
    assert(machine.getFlowStateSnapshot().at("__runtime_error") == "Unknown device binding");
}
