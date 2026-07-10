#pragma once

#include "core/Config.h"

namespace pulse::platform::pi {

class PiRuntime {
public:
    explicit PiRuntime(const core::NodeConfig& config);
    int run();

private:
    core::NodeConfig config_;
};

} // namespace pulse::platform::pi
