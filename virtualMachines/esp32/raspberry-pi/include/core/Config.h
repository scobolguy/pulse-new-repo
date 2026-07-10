#pragma once

#include <string>
#include "core/Types.h"

namespace pulse::core {

class Config {
public:
    static NodeConfig load(const std::string& path);
};

} // namespace pulse::core
