#include <exception>
#include <iostream>
#include <string>

#include "core/Config.h"
#include "platform/pi/PiRuntime.h"

int main(int argc, char** argv) {
    try {
        const std::string configPath = argc > 1 ? argv[1] : "config/node.example.json";
        const auto config = pulse::core::Config::load(configPath);
        pulse::platform::pi::PiRuntime runtime(config);
        return runtime.run();
    } catch (const std::exception& ex) {
        std::cerr << "[pi-node] fatal: " << ex.what() << '\n';
        return 1;
    }
}
