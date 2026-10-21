#pragma once

#include <cstdint>

namespace pmachine {

// Pool handles keep typed values small without owning heap allocations.
enum class ValueKind : uint8_t {
    Integer = 0,
    Real = 1,
    Boolean = 2,
    StringRef = 3,
    EnumRef = 4,
    ObjectRef = 5
};

struct Value {
    ValueKind kind = ValueKind::Integer;
    uint8_t flags = 0;
    uint16_t handle = 0;
    union {
        int32_t i;
        float r;
    };

    Value() : i(0) {}
    Value(int v) : kind(ValueKind::Integer), i(v) {}

    operator int() const {
        if (kind == ValueKind::Real) return static_cast<int32_t>(r);
        return i;
    }

    bool isString() const { return kind == ValueKind::StringRef; }

    static Value makeString(uint16_t poolHandle) {
        Value v;
        v.kind = ValueKind::StringRef;
        v.handle = poolHandle;
        v.i = 0;
        return v;
    }

    static Value makeReal(float value) {
        Value v;
        v.kind = ValueKind::Real;
        v.r = value;
        return v;
    }

    bool isReal() const { return kind == ValueKind::Real; }

    float asReal() const {
        return kind == ValueKind::Real ? r : static_cast<float>(i);
    }

    static Value makeEnum(uint16_t typeIndex, int ordinal) {
        Value v;
        v.kind = ValueKind::EnumRef;
        v.handle = typeIndex;
        v.i = ordinal;
        return v;
    }

    bool isEnum() const { return kind == ValueKind::EnumRef; }
    bool isObject() const { return kind == ValueKind::ObjectRef; }

    static Value makeObject(uint16_t objectHandle) {
        Value v;
        v.kind = ValueKind::ObjectRef;
        v.handle = objectHandle;
        v.i = static_cast<int32_t>(objectHandle) + 1;
        return v;
    }
};

}
