#pragma once

#include "pmachine_value.h"
#include <cstddef>
#include <string>

namespace pmachine {

struct SystemScalar {
    Value value;
    std::string text;
};

bool executeSystemIntrinsic(const std::string& symbol, const SystemScalar* args, size_t count,
                            SystemScalar& result, std::string& error);

}
