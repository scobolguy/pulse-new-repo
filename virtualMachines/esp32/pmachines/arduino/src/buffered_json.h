#pragma once

#include <ArduinoJson.h>
#include <string>

namespace pmachine {
inline size_t serializeBufferedJson(JsonVariantConst value, size_t expected, std::string& out) {
    out.resize(expected);
    const size_t written = serializeJson(value, out.data(), expected);
    if (written != expected) out.clear();
    return written;
}
}
