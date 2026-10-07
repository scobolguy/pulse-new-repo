#pragma once

#include <string>
#include <vector>

namespace pmachine {
struct HostValue {
    bool isString = false;
    int integer = 0;
    std::string text;
};

struct HostCallStorage {
    std::vector<HostValue> args;
    HostValue result;
    std::string error;

    explicit HostCallStorage(bool hosted = true) {
        if (hosted) args.reserve(8);
    }

    void reset(size_t argc) {
        args.resize(argc);
        for (auto& arg : args) {
            arg.isString = false;
            arg.integer = 0;
            arg.text.clear();
        }
        result.isString = false;
        result.integer = 0;
        result.text.clear();
        error.clear();
    }
};
}
