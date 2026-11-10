#include "system_runtime.h"
#include <Arduino.h>
#include <limits>
#include <thread>

namespace pmachine {

bool executeSystemIntrinsic(const std::string& symbol, const SystemScalar* args, size_t count,
                            SystemScalar& result, std::string& error) {
    result = SystemScalar{};
    error.clear();
    const auto fail = [&](const char* message) { error = message; return false; };
    if (symbol == "system.string.length") {
        if (count != 1 || args == nullptr || !args[0].value.isString())
            return fail("String length requires a string");
        const auto& text = args[0].text;
        int64_t length = 0;
        for (size_t index = 0; index < text.size();) {
            const auto first = static_cast<unsigned char>(text[index++]);
            uint32_t code = first;
            unsigned remaining = 0;
            uint32_t minimum = 0;
            if (first >= 0xc2 && first <= 0xdf) { code = first & 0x1f; remaining = 1; minimum = 0x80; }
            else if (first >= 0xe0 && first <= 0xef) { code = first & 0x0f; remaining = 2; minimum = 0x800; }
            else if (first >= 0xf0 && first <= 0xf4) { code = first & 0x07; remaining = 3; minimum = 0x10000; }
            else if (first >= 0x80) return fail("String length requires valid Unicode");
            if (text.size() - index < remaining) return fail("String length requires valid Unicode");
            for (unsigned offset = 0; offset < remaining; ++offset) {
                const auto next = static_cast<unsigned char>(text[index++]);
                if ((next & 0xc0) != 0x80) return fail("String length requires valid Unicode");
                code = (code << 6) | (next & 0x3f);
            }
            if (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
                return fail("String length requires valid Unicode");
            length += code > 0xffff ? 2 : 1;
            if (length > std::numeric_limits<int32_t>::max()) return fail("System.OverflowException");
        }
        result.value = Value(static_cast<int32_t>(length));
        return true;
    }
    if (symbol == "system.reference.notnull") {
        if (count != 1 || args == nullptr
            || args[0].value.kind == ValueKind::Integer && args[0].value.i == 0
            || args[0].value.isReference() && args[0].value.handle == 0)
            return fail("NullPointerException: non-null assertion failed");
        result = args[0];
        return true;
    }
    if (symbol == "system.exception.throw") {
        if (count != 1 || args == nullptr)
            return fail("Kotlin throw requires one value");
        return fail(("KotlinThrow: " + args[0].text).c_str());
    }
    if (symbol == "system.assert.equals") {
        if (count != 2 || args == nullptr
            || args[0].value.kind != ValueKind::Integer
            || args[1].value.kind != ValueKind::Integer)
            return fail("Assertion equality requires Int32 arguments");
        if (args[0].value.i != args[1].value.i) {
            error = "AssertionError: expected " + std::to_string(args[0].value.i)
                + ", actual " + std::to_string(args[1].value.i);
            return false;
        }
        return true;
    }
    if (symbol == "system.coroutine.yield") {
        if (count != 0) return fail("Coroutine yield takes no arguments");
#if defined(ARDUINO)
        ::yield();
#else
        std::this_thread::yield();
#endif
        return true;
    }
    const bool convert = symbol == "system.integer.convert";
    const bool format = symbol == "system.int32.tostring";
    const bool add = symbol == "system.int32.add";
    const bool subtract = symbol == "system.int32.subtract";
    const bool multiply = symbol == "system.int32.multiply";
    const bool unchecked = symbol == "system.int32.divide.unchecked" || symbol == "system.int32.remainder.unchecked";
    const bool divide = symbol == "system.int32.divide" || symbol == "system.int32.divide.unchecked";
    const bool remainder = symbol == "system.int32.remainder" || symbol == "system.int32.remainder.unchecked";
    if ((!convert && !format && !add && !subtract && !multiply && !divide && !remainder) ||
        count != (convert ? 3u : format ? 1u : 2u) || args == nullptr)
        return fail("Invalid System intrinsic or argument count");
    for (size_t index = 0; index < count; ++index) {
        if (convert && index == 1) {
            if (!args[index].value.isString()) return fail("Integer conversion requires a target type");
        } else if (args[index].value.kind != ValueKind::Integer) {
            return fail("System intrinsic requires Int32 arguments");
        }
    }
    const int64_t left = args[0].value.i;
    if (format) {
        result.value = Value::makeString(0);
        result.text = std::to_string(args[0].value.i);
        return true;
    }
    if (convert) {
        const int mode = args[2].value.i;
        if (mode != 0 && mode != 1) return fail("Integer conversion requires an explicit overflow mode");
        const auto& type = args[1].text;
        int bits = 0;
        bool isSigned = false;
        if (type == "sbyte") { bits = 8; isSigned = true; }
        else if (type == "byte") bits = 8;
        else if (type == "short") { bits = 16; isSigned = true; }
        else if (type == "ushort") bits = 16;
        else if (type == "int") { bits = 32; isSigned = true; }
        else return fail("Invalid integer conversion target");
        const int64_t modulus = int64_t{1} << bits;
        const int64_t minimum = isSigned ? -(modulus / 2) : 0;
        const int64_t maximum = isSigned ? modulus / 2 - 1 : modulus - 1;
        if (mode == 1 && (left < minimum || left > maximum)) return fail("System.OverflowException");
        int64_t narrowed = left % modulus;
        if (narrowed < 0) narrowed += modulus;
        if (isSigned && narrowed > maximum) narrowed -= modulus;
        result.value = Value(static_cast<int32_t>(narrowed));
        return true;
    }
    const int64_t right = args[1].value.i;
    int64_t value = 0;
    if (add) value = left + right;
    else if (subtract) value = left - right;
    else if (multiply) value = left * right;
    else {
        if (right == 0) return fail("System.DivideByZeroException");
        if (left == std::numeric_limits<int32_t>::min() && right == -1) {
            if (!unchecked) return fail("System.OverflowException");
            result.value = Value(divide ? std::numeric_limits<int32_t>::min() : 0);
            return true;
        }
        value = divide ? left / right : left % right;
    }
    if (value < std::numeric_limits<int32_t>::min() || value > std::numeric_limits<int32_t>::max())
        return fail("System.OverflowException");
    result.value = Value(static_cast<int32_t>(value));
    return true;
}

}
