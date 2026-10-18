// Internal helpers shared by the COBOL engine translation units.
#pragma once

#include "cobol_vm.h"

#include <set>
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

// COBOL indexed/sequential/relative files; a C++ port of libraries/isam/isam.pas and the
// pcode-isam.mjs adapter.
class IsamFiles {
public:
    explicit IsamFiles(IsamStorage& storage) : storage(storage) {}
    int open(const std::string& root, const std::string& path, const std::string& keyName, const std::string& mode);
    std::string read(int handle, const std::string& key);
    std::string readAlternate(int handle, const std::string& alternateName, const std::string& key);
    std::string readNext(int handle);
    std::string currentKey(int handle);
    int count(int handle);
    int start(int handle, const std::string& key, const std::string& comparison);
    int write(int handle, const std::string& key, const std::string& record);
    int rewrite(int handle, const std::string& key, const std::string& record);
    int remove(int handle, const std::string& key);
    int close(int handle, bool lock);
    std::string status(int handle);

private:
    struct AlternateKey {
        std::string name;
        int offset = 0;
        int length = 1;
        bool duplicates = false;
    };
    using Row = std::pair<std::string, std::string>;
    struct Handle {
        int id = 0;
        std::string root, path, keyName, mode, organization, access, lastWriteKey, cursor, status;
        std::vector<AlternateKey> alternateKeys;
        bool available = false, positioned = false, pending = false, eof = false, isVirtual = false;
        std::vector<Row> records;
    };
    struct Outcome {
        std::string status = "00";
        std::string record;
    };

    Handle* find(int handle);
    std::string identity(const std::string& root, const std::string& path) const;
    void loadImage(Handle& file, std::vector<Row>& rows);
    bool persist(Handle& file, const std::vector<Row>& rows, std::string& status);
    Outcome operate(const std::string& operation, int handle, const std::string& key,
                    const std::string& record, const std::string& extra);
    void operateOn(Handle& file, const std::string& operation, const std::string& key,
                   const std::string& record, const std::string& extra, Outcome& outcome);

    IsamStorage& storage;
    int next = 1;
    std::vector<Handle> handles;
    std::map<int, std::string> statuses;
    std::set<std::string> openFiles;
    std::set<std::string> lockedFiles;
};

// Host bindings implemented by the engine, mirroring the service-host-bindings contract
// together with the desktop text, intrinsic, date and ISAM implementations.
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
    IsamFiles& isam;
    const std::function<double()>& random;
};
int findBinding(const std::string& lowerName);  // -1 when the engine has no implementation
const BindingSpec& bindingSpec(int id);
BindingValue callBinding(int id, const std::vector<BindingValue>& args, BindingContext& context);

}  // namespace detail
}  // namespace cobolvm
