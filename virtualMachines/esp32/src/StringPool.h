#pragma once
#include <string>

namespace stringpool {
class StringPool {
public:
    uint16_t add(const std::string&);
    const std::string& get(uint16_t) const;
};
}
