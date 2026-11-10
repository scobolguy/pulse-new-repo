#include "../../pmachines/arduino/src/system_runtime.h"
#include <cassert>
#include <initializer_list>
#include <iostream>
#include <limits>
#include <vector>

using namespace pmachine;

SystemScalar integer(int value) { return {Value(value), {}}; }
SystemScalar text(const std::string& value) { return {Value::makeString(0), value}; }

int main() {
    const auto run = [](const std::string& name, std::initializer_list<SystemScalar> values,
                        const std::string& expectedError = "") {
        std::vector<SystemScalar> args(values);
        SystemScalar result;
        std::string error;
        const bool ok = executeSystemIntrinsic(name, args.data(), args.size(), result, error);
        assert(ok == expectedError.empty());
        assert(error == expectedError);
        return result;
    };
    const int minimum = std::numeric_limits<int32_t>::min();
    const int maximum = std::numeric_limits<int32_t>::max();
    for (const auto& entry : {
        std::pair<std::string, int>{"", 0}, {"ascii", 5}, {"\xc3\xa9", 1},
        {"e\xcc\x81", 2}, {"\xe6\xbc\xa2", 1}, {"\xf0\x9f\x98\x80", 2}
    }) {
        assert(run("system.string.length", {text(entry.first)}).value.i == entry.second);
    }
    for (const std::string value : {"\x80", "\xc0\x80", "\xc2", "\xc2\x41", "\xe0\x80\x80",
                                   "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xf5\x80\x80\x80"})
        run("system.string.length", {text(value)}, "String length requires valid Unicode");
    run("system.string.length", {integer(42)}, "String length requires a string");
    run("system.string.length", {}, "String length requires a string");
    for (const auto* operation : {"divide", "remainder"}) {
        const std::string symbol = "system.int32." + std::string(operation) + ".unchecked";
        assert(run(symbol, {integer(minimum), integer(-1)}).value.i ==
               (std::string(operation) == "divide" ? minimum : 0));
        run(symbol, {integer(1), integer(0)}, "System.DivideByZeroException");
    }
    assert(run("system.int32.divide.unchecked", {integer(42), integer(2)}).value.i == 21);
    assert(run("system.int32.add", {integer(20), integer(22)}).value.i == 42);
    assert(run("system.int32.subtract", {integer(minimum), integer(-1)}).value.i == minimum + 1);
    assert(run("system.int32.multiply", {integer(minimum), integer(1)}).value.i == minimum);
    for (const auto* name : {"system.int32.add", "system.int32.subtract", "system.int32.multiply"}) {
        run(name, {integer(name == std::string("system.int32.subtract") ? minimum : maximum), integer(2)},
            "System.OverflowException");
    }
    assert(run("system.int32.divide", {integer(-7), integer(3)}).value.i == -2);
    assert(run("system.int32.remainder", {integer(-7), integer(3)}).value.i == -1);
    for (const auto* name : {"system.int32.divide", "system.int32.remainder"}) {
        run(name, {integer(1), integer(0)}, "System.DivideByZeroException");
        run(name, {integer(minimum), integer(-1)}, "System.OverflowException");
    }
    const char* types[] = {"sbyte", "byte", "short", "ushort", "int"};
    const int minima[] = {-128, 0, -32768, 0, minimum};
    const int maxima[] = {127, 255, 32767, 65535, maximum};
    for (size_t index = 0; index < 5; ++index) {
        for (const int value : {minima[index], 0, maxima[index]}) {
            for (const int mode : {0, 1})
                assert(run("system.integer.convert", {integer(value), text(types[index]), integer(mode)}).value.i == value);
        }
        if (index == 4) continue;
        run("system.integer.convert", {integer(maxima[index] + 1), text(types[index]), integer(1)},
            "System.OverflowException");
        run("system.integer.convert", {integer(minima[index] - 1), text(types[index]), integer(1)},
            "System.OverflowException");
        assert(run("system.integer.convert", {integer(maxima[index] + 1), text(types[index]), integer(0)}).value.i == minima[index]);
        assert(run("system.integer.convert", {integer(minima[index] - 1), text(types[index]), integer(0)}).value.i == maxima[index]);
    }
    for (int value : {minimum, -1, 0, 1, maximum}) {
        const auto result = run("system.int32.tostring", {integer(value)});
        assert(result.value.isString());
        assert(result.text == std::to_string(value));
    }
    run("system.int32.add", {text("1"), integer(2)}, "System intrinsic requires Int32 arguments");
    run("system.int32.add", {{Value::makeDouble(1), {}}, integer(2)}, "System intrinsic requires Int32 arguments");
    run("system.int32.add", {integer(1)}, "Invalid System intrinsic or argument count");
    run("system.unknown", {}, "Invalid System intrinsic or argument count");
    run("system.integer.convert", {integer(1), text("byte"), integer(2)},
        "Integer conversion requires an explicit overflow mode");
    run("system.integer.convert", {integer(1), text("long"), integer(1)}, "Invalid integer conversion target");
    run("system.integer.convert", {integer(1), integer(2), integer(1)}, "Integer conversion requires a target type");
    std::cout << "System runtime arithmetic, conversion, formatting and failure checks passed\n";
}
