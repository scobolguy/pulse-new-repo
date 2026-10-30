#include "fortran_runtime.h"
#include <algorithm>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstdlib>
#include <limits>

namespace pmachine {
namespace {
    int arity(const std::string& op) {
        if (op == "max" || op == "min") return -2;
        if (op == "cdiv" || op == "cpow" || op == "replace" || op == "subscript") return 4;
        if (op == "cpowi" || op == "substr" || op == "docount") return 3;
        if (op == "cabs" || op == "csqrt" || op == "cexp" || op == "clog" || op == "csin" || op == "ccos"
            || op == "mod" || op == "sign" || op == "dim" || op == "atan2" || op == "math" || op == "ipow"
            || op == "pow" || op == "index" || op == "ccmp" || op == "pad" || op == "fit" || op == "overlay") return 2;
        if (op == "badprocedure" || op == "double" || op == "int" || op == "nint" || op == "anint"
            || op == "aint" || op == "abs" || op == "len" || op == "char" || op == "ichar") return 1;
        return -1;
    }

    int32_t integer(double x) {
        const double wrapped = std::fmod(std::trunc(x), 4294967296.0);
        const double unsignedValue = wrapped < 0 ? wrapped + 4294967296.0 : wrapped;
        return unsignedValue >= 2147483648.0 ? static_cast<int32_t>(unsignedValue - 4294967296.0)
            : static_cast<int32_t>(unsignedValue);
    }

    Value real(double x, bool wide = false) { return wide ? Value::makeDouble(x) : Value::makeReal(x); }
    Value keep(Value model, double x) { return model.isReal() ? real(x, model.isDouble()) : Value(integer(x)); }
    std::string pad(const std::string& text, size_t length) {
        return text.size() < length ? text + std::string(length - text.size(), ' ') : text.substr(0, length);
    }
}

bool executeFortranNumeric(const std::string& symbol, const std::vector<FortranScalar>& args,
                          std::vector<FortranScalar>& results, std::string& error) {
    results.clear();
    error.clear();
    auto fail = [&](const std::string& reason) { error = "FORTRAN runtime error: " + reason; return false; };
    if (symbol.compare(0, 8, "fortran.") != 0) return fail("Invalid library namespace");
    const std::string op = symbol.substr(8);
    const int count = arity(op);
    if (count == -1) return fail("Unknown FORTRAN library routine " + symbol);
    if ((count == -2 && args.size() < 2) || (count >= 0 && args.size() != static_cast<size_t>(count)))
        return fail("Invalid argument count for " + symbol);
    for (size_t index = 0; index < args.size(); ++index) {
        if (op == "double" && args[index].isString()) continue;
        const bool character = op == "len" || op == "index" || op == "ichar" || op == "ccmp"
            || op == "fit" || op == "overlay" || ((op == "pad" || op == "substr" || op == "replace") && index == 0)
            || (op == "replace" && index == 3) || (op == "subscript" && index == 3) || (op == "math" && index == 1);
        if (args[index].isString() != character || (!character && !args[index].value.isReal()
            && args[index].value.kind != ValueKind::Integer && args[index].value.kind != ValueKind::Boolean))
            return fail("Invalid argument type for " + symbol);
    }
    auto num = [&](size_t index) { return args[index].value.asReal(); };
    auto put = [&](Value value) { results.emplace_back(value); return true; };
    auto text = [&](const std::string& value) { results.emplace_back(value); return true; };
    const double a = args.empty() ? 0 : num(0), b = args.size() < 2 ? 0 : num(1);
    if (op == "badprocedure") return fail("Invalid procedure argument");
    if (op == "double") {
        if (!args[0].isString()) return put(Value::makeDouble(a));
        char* end = nullptr;
        const double value = std::strtod(args[0].text.c_str(), &end);
        if (end == args[0].text.c_str() || *end != '\0' || !std::isfinite(value))
            return fail("Invalid DOUBLE PRECISION literal");
        return put(Value::makeDouble(value));
    }
    if (op == "len") return put(Value(static_cast<int>(args[0].text.size())));
    if (op == "index") {
        const auto index = args[0].text.find(args[1].text);
        return put(Value(index == std::string::npos ? 0 : static_cast<int>(index + 1)));
    }
    if (op == "char") {
        if (a < 0 || a > 255 || a != std::trunc(a)) return fail("CHAR argument is outside 0-255");
        return text(std::string(1, static_cast<char>(static_cast<unsigned char>(a))));
    }
    if (op == "ichar") {
        if (args[0].text.size() != 1) return fail("ICHAR requires a character argument of length 1");
        return put(Value(static_cast<unsigned char>(args[0].text[0])));
    }
    if (op == "ccmp") {
        const size_t length = std::max(args[0].text.size(), args[1].text.size());
        const int compare = pad(args[0].text, length).compare(pad(args[1].text, length));
        return put(Value(compare < 0 ? -1 : compare > 0 ? 1 : 0));
    }
    if (op == "pad" || op == "fit") {
        const double length = op == "pad" ? b : static_cast<double>(args[0].text.size());
        if (length < 0 || length > 8192 || length != std::trunc(length)) return fail("Invalid CHARACTER length");
        return text(pad(args[op == "pad" ? 0 : 1].text, static_cast<size_t>(length)));
    }
    if (op == "overlay") {
        const auto& actual = args[0].text;
        const auto& dummy = args[1].text;
        return text((dummy + (dummy.size() < actual.size() ? actual.substr(dummy.size()) : "")).substr(0, actual.size()));
    }
    if (op == "substr" || op == "replace") {
        const double last = num(2);
        const auto& source = args[0].text;
        if (b < 1 || b != std::trunc(b) || last != std::trunc(last) || last < b || last > source.size())
            return fail("Substring bounds outside CHARACTER value");
        const auto start = static_cast<size_t>(b - 1), end = static_cast<size_t>(last);
        if (op == "substr") return text(source.substr(start, end - start));
        return text(source.substr(0, start) + pad(args[3].text, end - start) + source.substr(end));
    }
    if (op == "subscript") {
        if (a < b || a > num(2)) return fail("Array subscript outside declared bounds: " + args[3].text);
        return put(args[0].value);
    }
    if (op == "int" || op == "nint" || op == "aint" || op == "anint") {
        if (!std::isfinite(a)) return fail("INTEGER conversion of a non-finite value");
        const double x = op == "nint" || op == "anint" ? std::copysign(std::floor(std::abs(a) + 0.5), a) : std::trunc(a);
        return put(op == "int" || op == "nint" ? Value(integer(x)) : keep(args[0].value, x));
    }
    if (op == "abs") return put(keep(args[0].value, std::abs(a)));
    if (op == "mod") {
        if (b == 0) return fail("MOD with a zero second argument");
        return put(keep(args[0].value, a - std::trunc(a / b) * b));
    }
    if (op == "sign") return put(keep(args[0].value, b >= 0 ? std::abs(a) : -std::abs(a)));
    if (op == "dim") return put(keep(args[0].value, std::max(a - b, 0.0)));
    if (op == "max" || op == "min") {
        size_t best = 0;
        for (size_t index = 1; index < args.size(); ++index)
            if (op == "max" ? num(index) > num(best) : num(index) < num(best)) best = index;
        return put(args[best].value);
    }
    if (op == "docount") {
        const double step = num(2);
        if (step == 0) return fail("DO increment parameter is zero");
        const double count = (b - a + step) / step;
        if (!std::isfinite(count)) return fail("DO iteration count is out of range");
        return put(Value(std::max(integer(count), int32_t(0))));
    }
    if (op == "atan2") {
        if (a == 0 && b == 0) return fail("ATAN2 with both arguments zero");
        return put(real(std::atan2(a, b), args[0].value.isDouble() || args[1].value.isDouble()));
    }
    if (op == "ipow") {
        if (a == 0 && b <= 0) return fail("Zero raised to a non-positive power");
        if (b < 0) return put(Value(a == 1 ? 1 : a == -1 ? (integer(b) % 2 ? -1 : 1) : 0));
        uint32_t base = static_cast<uint32_t>(integer(a)), out = 1, power = static_cast<uint32_t>(integer(b));
        while (power) { if (power & 1) out *= base; base *= base; power >>= 1; }
        return put(Value(integer(static_cast<double>(out))));
    }
    if (op == "pow") {
        if (a < 0 && args[1].value.isReal()) return fail("Negative REAL base raised to a REAL power");
        if (a == 0 && b <= 0) return fail("Zero raised to a non-positive power");
        return put(real(std::pow(a, b), args[0].value.isDouble() || args[1].value.isDouble()));
    }
    if (op == "math") {
        const auto& name = args[1].text;
        double x;
        if (name == "sqrt") { if (a < 0) return fail("SQRT of a negative argument"); x = std::sqrt(a); }
        else if (name == "log") { if (a <= 0) return fail("LOG of a non-positive argument"); x = std::log(a); }
        else if (name == "log10") { if (a <= 0) return fail("LOG10 of a non-positive argument"); x = std::log10(a); }
        else if (name == "exp") x = std::exp(a);
        else if (name == "sin") x = std::sin(a);
        else if (name == "cos") x = std::cos(a);
        else if (name == "tan") x = std::tan(a);
        else if (name == "asin") { if (std::abs(a) > 1) return fail("ASIN argument outside [-1,1]"); x = std::asin(a); }
        else if (name == "acos") { if (std::abs(a) > 1) return fail("ACOS argument outside [-1,1]"); x = std::acos(a); }
        else if (name == "atan") x = std::atan(a);
        else if (name == "sinh") x = std::sinh(a);
        else if (name == "cosh") x = std::cosh(a);
        else if (name == "tanh") x = std::tanh(a);
        else return fail("Unknown math intrinsic " + name);
        return put(real(x, args[0].value.isDouble()));
    }
    if (op == "cabs") return put(real(std::hypot(a, b)));
    const std::complex<double> z(a, b);
    std::complex<double> out;
    if (op == "cdiv") {
        const std::complex<double> divisor(num(2), num(3));
        if (divisor == std::complex<double>(0, 0)) return fail("COMPLEX division by zero");
        out = z / divisor;
    } else if (op == "csqrt") out = std::sqrt(z);
    else if (op == "cexp") out = std::exp(z);
    else if (op == "clog" || op == "cpow") {
        if (a == 0 && b == 0) return fail("LOG of zero COMPLEX argument");
        out = op == "clog" ? std::log(z) : std::exp(std::log(z) * std::complex<double>(num(2), num(3)));
    } else if (op == "csin") out = std::sin(z);
    else if (op == "ccos") out = std::cos(z);
    else if (op == "cpowi") {
        const double exponent = num(2);
        if (exponent != std::trunc(exponent) || exponent < std::numeric_limits<int32_t>::min()
            || exponent > std::numeric_limits<int32_t>::max()) return fail("Invalid COMPLEX integer exponent");
        int64_t power = static_cast<int64_t>(exponent);
        const bool negative = power < 0;
        if (negative) power = -power;
        out = {1, 0};
        auto factor = z;
        while (power) { if (power & 1) out *= factor; factor *= factor; power >>= 1; }
        if (negative) {
            if (out == std::complex<double>(0, 0)) return fail("COMPLEX division by zero");
            out = 1.0 / out;
        }
    } else return fail("Unknown FORTRAN library routine " + symbol);
    put(real(out.real()));
    put(real(out.imag()));
    return true;
}
}
