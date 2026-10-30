#pragma once
#include <cstdint>

namespace pmachine {
class AssemblerishTrigger {
    uint32_t at = 0;
    bool stable = false, candidate = false, pending = false;
public:
    void reset(uint32_t now, bool level) {
        at = now;
        stable = candidate = level;
        pending = false;
    }
    bool timer(uint32_t now, uint32_t interval) {
        if (static_cast<uint32_t>(now - at) < interval) return false;
        at = now;
        return true;
    }
    bool edge(uint32_t now, bool observed, bool level, uint32_t debounce) {
        if (observed || (pending && level != candidate)) {
            candidate = level;
            at = now;
            pending = true;
        }
        if (!pending || static_cast<uint32_t>(now - at) < debounce) return false;
        pending = false;
        if (stable == level) return false;
        stable = level;
        return true;
    }
};
}
