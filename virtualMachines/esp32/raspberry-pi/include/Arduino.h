#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <chrono>
#include <cstdio>
#include <thread>
#include <string>

// Host compatibility shim for building ESP-oriented sources on non-Arduino targets.
class String : public std::string {
public:
    using std::string::string;
    String() = default;
    String(const std::string& s) : std::string(s) {}

    bool startsWith(const String& prefix) const {
        if (prefix.size() > this->size()) return false;
        return this->compare(0, prefix.size(), prefix) == 0;
    }

    bool endsWith(const String& suffix) const {
        if (suffix.size() > this->size()) return false;
        return this->compare(this->size() - suffix.size(), suffix.size(), suffix) == 0;
    }

    String substring(std::size_t beginIndex) const {
        if (beginIndex >= this->size()) return String();
        return this->substr(beginIndex);
    }

    String substring(std::size_t beginIndex, std::size_t endIndex) const {
        if (beginIndex >= this->size() || endIndex <= beginIndex) return String();
        const std::size_t clampedEnd = std::min(endIndex, this->size());
        return this->substr(beginIndex, clampedEnd - beginIndex);
    }

    void trim() {
        auto notSpace = [](unsigned char c) { return !std::isspace(c); };
        auto beginIt = std::find_if(this->begin(), this->end(), notSpace);
        auto endIt = std::find_if(this->rbegin(), this->rend(), notSpace).base();
        if (beginIt >= endIt) {
            this->clear();
            return;
        }
        *this = this->substr(static_cast<std::size_t>(beginIt - this->begin()),
                             static_cast<std::size_t>(endIt - beginIt));
    }

    int toInt() const {
        try {
            return std::stoi(*this);
        } catch (...) {
            return 0;
        }
    }
};

inline unsigned long millis() {
    static const auto start = std::chrono::steady_clock::now();
    const auto now = std::chrono::steady_clock::now();
    return static_cast<unsigned long>(
        std::chrono::duration_cast<std::chrono::milliseconds>(now - start).count());
}

inline void delay(unsigned long ms) {
    std::this_thread::sleep_for(std::chrono::milliseconds(ms));
}

class SerialShim {
public:
    template <typename... Args>
    void printf(const char* fmt, Args... args) const {
        std::printf(fmt, args...);
    }

    void println(const char* msg) const {
        std::puts(msg);
    }

    void println(const std::string& msg) const {
        std::puts(msg.c_str());
    }

    void print(const char* msg) const {
        std::printf("%s", msg);
    }

    void print(const std::string& msg) const {
        std::printf("%s", msg.c_str());
    }

    explicit operator bool() const { return true; }
};

inline SerialShim Serial;
inline SerialShim Serial0;
