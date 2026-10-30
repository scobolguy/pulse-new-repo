#pragma once

#include <atomic>

class SerialConsoleLease {
public:
    SerialConsoleLease() = default;
    SerialConsoleLease(const SerialConsoleLease&) = delete;
    SerialConsoleLease& operator=(const SerialConsoleLease&) = delete;
    ~SerialConsoleLease() { if (owned) busy().store(false); }

    bool acquire() {
        if (owned) return true;
        bool expected = false;
        owned = busy().compare_exchange_strong(expected, true);
        return owned;
    }

private:
    bool owned = false;
    static std::atomic<bool>& busy() {
        static std::atomic<bool> value{false};
        return value;
    }
};
