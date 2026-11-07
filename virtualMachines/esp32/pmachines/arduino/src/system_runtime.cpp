#include "system_runtime.h"
#include <limits>

namespace pmachine {

bool executeSystemIntrinsic(const std::string& symbol, const SystemScalar* args, size_t count,
                            SystemScalar& result, std::string& error) {
    result = SystemScalar{};
    error.clear();
    const auto fail = [&](const char* message) { error = message; return false; };
    const bool convert = symbol == "system.integer.convert";
    const bool format = symbol == "system.int32.tostring";
    const bool add = symbol == "system.int32.add";
    const bool subtract = symbol == "system.int32.subtract";
    const bool multiply = symbol == "system.int32.multiply";
    const bool divide = symbol == "system.int32.divide";
    const bool remainder = symbol == "system.int32.remainder";
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
        if (left == std::numeric_limits<int32_t>::min() && right == -1)
            return fail("System.OverflowException");
        value = divide ? left / right : left % right;
    }
    if (value < std::numeric_limits<int32_t>::min() || value > std::numeric_limits<int32_t>::max())
        return fail("System.OverflowException");
    result.value = Value(static_cast<int32_t>(value));
    return true;
}

}
