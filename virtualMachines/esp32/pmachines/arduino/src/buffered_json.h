#pragma once

#include <ArduinoJson.h>
#include <string>

namespace pmachine {
template <size_t Capacity>
size_t serializeBufferedJson(JsonVariantConst value, size_t expected,
                             char (&buffer)[Capacity], std::string& out) {
    if (out.capacity() < expected) out.reserve(expected);
    size_t written;
    if (expected <= Capacity) {
        written = serializeJson(value, buffer, Capacity);
        if (written == expected) out.assign(buffer, written);
    } else {
        out.resize(expected);
        written = serializeJson(value, &out[0], expected);
    }
    if (written != expected) out.clear();
    return written;
}
}
