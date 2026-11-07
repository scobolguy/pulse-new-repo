#pragma once

#include "pmachine_value.h"
#include <cstring>
#include <string>

namespace pmachine {

inline bool encodeCheckpointScalar(const Value& value, std::string& encoded) {
    uint64_t bits = 0;
    size_t digits = 8;
    switch (value.kind) {
    case ValueKind::Integer: case ValueKind::Boolean:
        bits = static_cast<uint32_t>(value.i); break;
    case ValueKind::Real: {
        uint32_t word = 0;
        std::memcpy(&word, &value.r, sizeof(word));
        bits = word;
        break;
    }
    case ValueKind::Double:
        static_assert(sizeof(double) == sizeof(bits), "Checkpoints require binary64");
        std::memcpy(&bits, &value.d, sizeof(bits));
        digits = 16;
        break;
    default: return false;
    }
    encoded.resize(digits);
    for (size_t index = digits; index > 0; --index) {
        encoded[index - 1] = "0123456789abcdef"[bits & 15];
        bits >>= 4;
    }
    return true;
}

inline bool decodeCheckpointScalar(ValueKind kind, const std::string& encoded, Value& value) {
    const size_t digits = kind == ValueKind::Double ? 16 : 8;
    if (kind != ValueKind::Integer && kind != ValueKind::Boolean &&
        kind != ValueKind::Real && kind != ValueKind::Double) return false;
    if (encoded.size() != digits) return false;
    uint64_t bits = 0;
    for (char character : encoded) {
        const unsigned digit = character >= '0' && character <= '9' ? character - '0'
            : character >= 'a' && character <= 'f' ? character - 'a' + 10 : 16;
        if (digit > 15) return false;
        bits = (bits << 4) | digit;
    }
    value = Value();
    value.kind = kind;
    if (kind == ValueKind::Double) std::memcpy(&value.d, &bits, sizeof(bits));
    else {
        const uint32_t word = static_cast<uint32_t>(bits);
        if (kind == ValueKind::Real) std::memcpy(&value.r, &word, sizeof(word));
        else std::memcpy(&value.i, &word, sizeof(word));
    }
    return true;
}

}
