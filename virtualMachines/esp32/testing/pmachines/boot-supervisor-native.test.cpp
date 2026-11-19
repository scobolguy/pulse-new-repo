#include "pmachine.h"
#include <array>
#include <cassert>
#include <fstream>
#include <iostream>
#include <iterator>

struct Hardware {
    std::array<int, 32> state{};
    int now = 0;
    int profiles = 0;
    bool connected = false;
    bool ap = false;
    bool apSucceeds = false;
    bool mounted = false;
    std::vector<int> backends;
};

static bool call(const std::string& name, const std::vector<pmachine::HostValue>& args,
                 pmachine::HostValue& result, std::string& error, void* context) {
    auto& hardware = *static_cast<Hardware*>(context);
    result.isString = false;
    result.integer = 0;
    if (name == "host.boot_millis") result.integer = hardware.now;
    else if (name == "host.boot_state_get") result.integer = hardware.state.at(args.at(0).integer);
    else if (name == "host.boot_state_set") hardware.state.at(args.at(0).integer) = args.at(1).integer;
    else if (name == "host.boot_profile_count") result.integer = hardware.profiles;
    else if (name == "host.boot_wifi_connected") result.integer = hardware.connected;
    else if (name == "host.boot_ap_active") result.integer = hardware.ap;
    else if (name == "host.boot_ap_start") result.integer = hardware.ap = hardware.apSucceeds;
    else if (name == "host.boot_ap_stop") {
        hardware.ap = false;
        result.integer = 1;
    } else if (name == "host.boot_ffs_ready") result.integer = hardware.connected && hardware.mounted;
    else if (name == "host.boot_ffs_start") {
        assert(hardware.connected);
        const int backend = args.at(0).integer;
        hardware.backends.push_back(backend);
        result.integer = hardware.mounted = backend == 1;
    } else if (name == "host.boot_remote_configured" || name == "host.boot_remote_available"
               || name == "host.boot_profile_start" || name == "host.boot_log") {
        result.integer = 0;
    } else {
        error = name == "host.raise_error" ? args.at(0).text : "Unexpected boot call: " + name;
        return false;
    }
    return true;
}

int main(int argc, char** argv) {
    assert(argc == 2);
    std::ifstream input(argv[1], std::ios::binary);
    assert(input);
    const std::string text{std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
    const auto parsed = pmachine::loadTextPCode(text);
    const auto& instructions = parsed;
    Hardware hardware;
    pmachine::PMachine machine;
    pmachine::HostExecutionStorage storage;
    assert(storage.prepare(4096));
    machine.setHostCallHook(call, &hardware);
    const auto tick = [&](int now) {
        hardware.now = now;
        machine.runImage(instructions.size(), [&](size_t index) {
            return instructions[index];
        }, &storage);
        const auto failure = machine.getFlowState().find("__runtime_error");
        if (failure != machine.getFlowState().end()) {
            std::cerr << failure->second << '\n';
            std::abort();
        }
        assert(!machine.didLastRunHitStepLimit());
        assert(!machine.getHostedStorageError() || !machine.getHostedStorageError()[0]);
    };
    tick(0);
    assert(!hardware.ap && hardware.state[31] == 0 && hardware.backends.empty());
    hardware.apSucceeds = true;
    tick(5000);
    assert(hardware.ap && hardware.state[31] == 0 && hardware.backends.empty());
    tick(5100);
    assert(hardware.state[31] == 1);
    hardware.connected = true;
    tick(5200);
    assert((hardware.backends == std::vector<int>{0, 1}));
    assert(hardware.mounted && hardware.ap);
    tick(8200);
    assert(!hardware.ap);
    hardware.connected = false;
    hardware.profiles = 1;
    tick(8300);
    tick(10000);
    assert(hardware.profiles == 1 && hardware.ap);
    assert((hardware.backends == std::vector<int>{0, 1}));
    std::cout << "Arduino PMachine executed local boot P-code successfully\n";
}
