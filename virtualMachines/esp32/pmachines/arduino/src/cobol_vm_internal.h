// Internal helpers shared by the COBOL engine translation units.
#pragma once

#include "cobol_vm.h"

#include <stdexcept>

namespace cobolvm {
namespace detail {

// Raised for any condition the JS runtime reports by throwing; ends the run.
struct VmError : std::runtime_error {
    using std::runtime_error::runtime_error;
};
[[noreturn]] void fail(const std::string& message);

// Strings are held as Latin-1 bytes so lengths and offsets match JS UTF-16 indices for
// every character a COBOL program can hold; code points above 0xFF become '?'.
std::string utf8ToLatin1(const std::string& text);
std::string latin1ToUtf8(const std::string& text);
size_t utf8ByteLength(const std::string& latin1);
bool isJsWhitespace(unsigned char c);
std::string jsTrim(const std::string& text);
std::string jsNumberToString(double value);
double jsStringToNumber(const std::string& text);
double jsParseInt(const std::string& text);  // NaN when no digits
bool isSafeInteger(double value);
std::string upperLatin1(const std::string& text);
std::string lowerLatin1(const std::string& text);
int collateCompare(const std::string& left, const std::string& right);  // ICU localeCompare sign
std::string formatRealE6(float value);

// Exact fixed-point decimal: sign, magnitude digits (no leading zeros, "0" for zero), scale.
struct Decimal {
    bool negative = false;
    std::string magnitude = "0";
    int scale = 0;
};
Decimal decimalFromString(const std::string& text);
Decimal decimalFromNumberText(const std::string& text);
Decimal decimalFromInteger(double value);
Decimal decimalFromUnscaled(const std::string& unscaled, int scale);
Decimal rescaleDecimal(const Decimal& value, int scale, bool roundHalfUp);
std::string formatDecimal(const Decimal& value);
Decimal decimalArithmetic(char op, const Decimal& left, const Decimal& right);
int compareDecimals(const Decimal& left, const Decimal& right);
std::string formatCobolDisplay(const Decimal& value, int precision, int scale, int signMode);
std::string formatCobolEdited(const Decimal& value, const std::string& mask, bool decimalComma, bool blankWhenZero);
int decimalDigitCount(const Decimal& value);
double decimalToNumber(const Decimal& value);

// Minimal JSON DOM over Latin-1 text.
struct Json {
    enum Type : uint8_t { Null, Bool, Number, String, Array, Object } type = Null;
    bool boolean = false;
    double number = 0;
    std::string text;
    std::vector<Json> items;
    std::vector<std::pair<std::string, Json>> members;
    const Json* get(const std::string& key) const;
};
bool parseJson(const std::string& latin1, Json& out);
std::string jsonQuote(const std::string& latin1);

// Host bindings known to the engine, mirroring the service-host-bindings contract. Text,
// intrinsic and date bindings run in the engine; delegated ones (ISAM) go to the host.
enum class ArgKind : uint8_t { String, Integer, Number };
enum class ResultKind : uint8_t { String, Integer, Decimal, Number };
struct BindingSpec {
    const char* name;
    uint8_t arity;
    ArgKind args[4];
    ResultKind result;
};
struct BindingValue {
    bool isString = false;
    double number = 0;
    std::string text;  // Latin-1
};
struct BindingContext {
    const std::function<double()>& random;
};
int findBinding(const std::string& lowerName);  // -1 when the engine has no implementation
const BindingSpec& bindingSpec(int id);
bool isDelegatedBinding(int id);
BindingValue callBinding(int id, const std::vector<BindingValue>& args, BindingContext& context);

}  // namespace detail
}  // namespace cobolvm
