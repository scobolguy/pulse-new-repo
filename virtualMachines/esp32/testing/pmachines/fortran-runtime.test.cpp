#include "../../pmachines/arduino/src/fortran_runtime.h"
#include "../../pmachines/arduino/src/managed_objects.h"
#include "../../pmachines/arduino/src/hosted_frame_storage.h"
#include <cassert>
#include <cmath>
#include <iostream>

using namespace pmachine;
static FortranScalar i(int value) { return FortranScalar(Value(value)); }
static FortranScalar r(double value) { return FortranScalar(Value::makeReal(value)); }
static FortranScalar d(double value) { return FortranScalar(Value::makeDouble(value)); }
static FortranScalar s(const std::string& value) { return FortranScalar(value); }

int main() {
    std::vector<FortranScalar> result;
    std::string error;
    auto call = [&](const std::string& name, const std::vector<FortranScalar>& args) {
        assert(executeFortranNumeric("fortran." + name, args, result, error));
        assert(error.empty());
        assert(!result.empty());
        return result[0].value;
    };
    const double precise = 1.0000000000000002;
    assert(Value::makeDouble(precise).asReal() == precise);
    assert(Value::makeReal(precise).asReal() == 1);
    assert(call("double", {s("1.0000000000000002")}).asReal() == precise);
    assert(call("math", {d(precise * precise), s("sqrt")}).asReal() == precise);
    assert(call("math", {r(4), s("sqrt")}).kind == ValueKind::Real);
    assert(call("int", {d(4294967295.0)}).i == -1);
    assert(call("nint", {r(-1.5)}).i == -2);
    assert(call("anint", {d(-1.5)}).isDouble() && result[0].value.asReal() == -2);
    assert(call("mod", {d(-7.5), d(2)}).asReal() == -1.5);
    assert(call("dim", {i(2), i(3)}).i == 0);
    assert(call("max", {d(precise), d(1)}).asReal() == precise);
    assert(call("ipow", {i(2), i(32)}).i == 0);
    assert(call("ipow", {i(-1), i(-3)}).i == -1);
    assert(call("pow", {d(2), i(-3)}).asReal() == 0.125);
    assert(call("docount", {i(3), i(1), i(1)}).i == 0);
    assert(call("csqrt", {r(-3), r(4)}).asReal() == 1);
    assert(result.size() == 2 && result[1].value.asReal() == 2);
    assert(call("cpowi", {r(0), r(1), i(-3)}).asReal() == 0);
    assert(result[1].value.asReal() == 1);
    call("replace", {s("abcdef"), i(2), i(4), s("X")});
    assert(result[0].text == "aX  ef");
    call("overlay", {s("abcdef"), s("XY")});
    assert(result[0].text == "XYcdef");
    assert(call("ccmp", {s("A"), s("A ")}).i == 0);
    assert(call("index", {s("ABC"), s("B")}).i == 2);
    assert(call("ichar", {s("Z")}).i == 90);

    for (const auto& invalid : std::vector<std::pair<std::string, std::vector<FortranScalar>>>{
        {"unknown", {}}, {"abs", {}}, {"abs", {s("bad")}}, {"len", {i(0)}},
        {"max", {i(1)}}, {"math", {r(-1), s("sqrt")}},
        {"math", {r(0), s("log")}}, {"math", {r(2), s("acos")}}, {"math", {r(1), s("unknown")}},
        {"mod", {i(1), i(0)}}, {"docount", {i(1), i(2), i(0)}}, {"double", {s("bad")}},
        {"cdiv", {r(1), r(2), r(0), r(0)}}, {"clog", {r(0), r(0)}},
        {"pow", {r(-1), r(2)}}, {"char", {i(256)}}, {"ichar", {s("AB")}},
        {"substr", {s("AB"), i(0), i(1)}}, {"subscript", {i(0), i(1), i(2), s("A")}},
    }) {
        assert(!executeFortranNumeric("fortran." + invalid.first, invalid.second, result, error));
        assert(error.find("FORTRAN runtime error:") == 0);
    }

    static uint8_t arena[1024];
    static ManagedObjects<> objects;
    objects.attach(arena, sizeof(arena));
    Value object, stored;
    assert(objects.create(1, object));
    assert(objects.set(object, 0, Value::makeDouble(precise)));
    assert(objects.get(object, 0, stored) && stored.isDouble() && stored.asReal() == precise);
    static HostedFrameStorage frames;
    assert(!frames.store("D", stored));
    assert(frames.find("D")->asReal() == precise);
    assert(!frames.push(1) && !frames.store("D", Value::makeDouble(2)));
    int pc = 0;
    assert(frames.pop(pc) && frames.find("D")->asReal() == precise);
    std::cout << "FORTRAN firmware numeric, complex, CHARACTER, diagnostics and binary64 storage passed\n";
}
