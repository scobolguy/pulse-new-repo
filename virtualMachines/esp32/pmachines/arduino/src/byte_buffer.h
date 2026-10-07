#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace pmachine {
class ByteBuffer {
public:
    void reset() { active = false; length = 0; capacity = 0; }
    bool create(int size, int& handle, std::string& error) {
        if (active || size < 0 || size > 4096) {
            error = "Byte buffer already active or invalid capacity"; return false;
        }
        generation = generation == INT32_MAX ? 1 : generation + 1;
        active = true; length = 0; capacity = static_cast<size_t>(size);
        handle = generation;
        return true;
    }
    bool append(int handle, int byte, std::string& error) {
        if (!valid(handle, error)) return false;
        if (byte < 0 || byte > 255 || length >= capacity) {
            error = "Invalid byte or byte buffer capacity exceeded"; return false;
        }
        data[length++] = static_cast<uint8_t>(byte);
        return true;
    }
    bool valid(int handle, std::string& error) const {
        if (!active || handle != generation) {
            error = "Invalid or released byte buffer handle"; return false;
        }
        return true;
    }
    const uint8_t* bytes() const { return data.data(); }
    size_t size() const { return length; }
    bool get(int handle, int index, int& value, std::string& error) const {
        if (!valid(handle, error)) return false;
        if (index < 0 || static_cast<size_t>(index) >= length) {
            error = "Invalid byte buffer index"; return false;
        }
        value = data[index]; return true;
    }
    bool set(int handle, int index, int value, std::string& error) {
        int ignored;
        if (!get(handle, index, ignored, error)) return false;
        if (value < 0 || value > 255) { error = "Invalid byte"; return false; }
        data[index] = static_cast<uint8_t>(value); return true;
    }
    bool load(const uint8_t* input, size_t count, int& handle, std::string& error) {
        if (!create(static_cast<int>(count), handle, error)) return false;
        for (size_t index = 0; index < count; ++index) data[index] = input[index];
        length = count; return true;
    }
    bool textView(int handle, const char*& output, size_t& count, std::string& error) const {
        if (!valid(handle, error)) return false;
        for (size_t index = 0; index < length;) {
            const uint8_t first = data[index++];
            if (first < 0x80) continue;
            size_t continuation = 0;
            uint32_t codepoint = 0, minimum = 0;
            if (first >= 0xc2 && first <= 0xdf) {
                continuation = 1; codepoint = first & 0x1f; minimum = 0x80;
            } else if (first >= 0xe0 && first <= 0xef) {
                continuation = 2; codepoint = first & 0x0f; minimum = 0x800;
            } else if (first >= 0xf0 && first <= 0xf4) {
                continuation = 3; codepoint = first & 7; minimum = 0x10000;
            } else { error = "Invalid UTF-8 byte buffer"; return false; }
            if (continuation > length - index) { error = "Invalid UTF-8 byte buffer"; return false; }
            while (continuation--) {
                const uint8_t next = data[index++];
                if ((next & 0xc0) != 0x80) { error = "Invalid UTF-8 byte buffer"; return false; }
                codepoint = (codepoint << 6) | (next & 0x3f);
            }
            if (codepoint < minimum || codepoint > 0x10ffff
                || (codepoint >= 0xd800 && codepoint <= 0xdfff)) {
                error = "Invalid UTF-8 byte buffer"; return false;
            }
        }
        output = reinterpret_cast<const char*>(data.data());
        count = length;
        return true;
    }
    bool text(int handle, std::string& output, std::string& error) {
        const char* input;
        size_t count;
        if (!textView(handle, input, count, error)) return false;
        output.assign(input, count);
        reset();
        return true;
    }
private:
    std::array<uint8_t, 4096> data{};
    size_t length = 0, capacity = 0;
    int generation = 0;
    bool active = false;
};
}
