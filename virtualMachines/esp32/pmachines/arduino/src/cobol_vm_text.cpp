// Text, JS number semantics, exact decimals and JSON for the COBOL engine.
#include "cobol_vm_internal.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace cobolvm {
namespace detail {

void fail(const std::string& message) {
    throw VmError(message);
}

// ---------------------------------------------------------------------------------------
// Text

std::string utf8ToLatin1(const std::string& text) {
    std::string out;
    out.reserve(text.size());
    for (size_t i = 0; i < text.size();) {
        const unsigned char c = static_cast<unsigned char>(text[i]);
        if (c < 0x80) {
            out.push_back(static_cast<char>(c));
            ++i;
            continue;
        }
        int length = (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : (c & 0xF8) == 0xF0 ? 4 : 0;
        if (length == 0 || i + length > text.size()) {
            out.push_back('?');
            ++i;
            continue;
        }
        uint32_t codePoint = c & (0x7F >> length);
        bool valid = true;
        for (int k = 1; k < length; ++k) {
            const unsigned char next = static_cast<unsigned char>(text[i + k]);
            if ((next & 0xC0) != 0x80) {
                valid = false;
                break;
            }
            codePoint = (codePoint << 6) | (next & 0x3F);
        }
        if (!valid) {
            out.push_back('?');
            ++i;
            continue;
        }
        out.push_back(codePoint <= 0xFF ? static_cast<char>(codePoint) : '?');
        i += length;
    }
    return out;
}

std::string latin1ToUtf8(const std::string& text) {
    std::string out;
    out.reserve(text.size());
    for (unsigned char c : text) {
        if (c < 0x80) {
            out.push_back(static_cast<char>(c));
        } else {
            out.push_back(static_cast<char>(0xC0 | (c >> 6)));
            out.push_back(static_cast<char>(0x80 | (c & 0x3F)));
        }
    }
    return out;
}

size_t utf8ByteLength(const std::string& latin1) {
    size_t length = latin1.size();
    for (unsigned char c : latin1) {
        if (c >= 0x80) ++length;
    }
    return length;
}

bool isJsWhitespace(unsigned char c) {
    return c == 0x20 || (c >= 0x09 && c <= 0x0D) || c == 0xA0;
}

std::string jsTrim(const std::string& text) {
    size_t first = 0;
    size_t last = text.size();
    while (first < last && isJsWhitespace(static_cast<unsigned char>(text[first]))) ++first;
    while (last > first && isJsWhitespace(static_cast<unsigned char>(text[last - 1]))) --last;
    return text.substr(first, last - first);
}

bool isSafeInteger(double value) {
    return std::isfinite(value) && std::floor(value) == value && std::fabs(value) <= 9007199254740991.0;
}

// Number.prototype.toString(): shortest round-trip digits in JS notation.
std::string jsNumberToString(double value) {
    if (std::isnan(value)) return "NaN";
    if (value == 0) return "0";
    if (std::isinf(value)) return value < 0 ? "-Infinity" : "Infinity";
    const std::string sign = value < 0 ? "-" : "";
    const double magnitude = std::fabs(value);
    char buffer[48];
    if (magnitude < 9007199254740992.0 && std::floor(magnitude) == magnitude) {
        std::snprintf(buffer, sizeof(buffer), "%.0f", magnitude);
        return sign + buffer;
    }
    int precision = 1;
    for (; precision <= 17; ++precision) {
        std::snprintf(buffer, sizeof(buffer), "%.*e", precision - 1, magnitude);
        if (std::strtod(buffer, nullptr) == magnitude) break;
    }
    std::string digits;
    const char* cursor = buffer;
    for (; *cursor && *cursor != 'e' && *cursor != 'E'; ++cursor) {
        if (*cursor >= '0' && *cursor <= '9') digits.push_back(*cursor);
    }
    const int exponent = *cursor ? std::atoi(cursor + 1) : 0;
    while (digits.size() > 1 && digits.back() == '0') digits.pop_back();
    const int k = static_cast<int>(digits.size());
    const int n = exponent + 1;
    if (k <= n && n <= 21) return sign + digits + std::string(n - k, '0');
    if (0 < n && n <= 21) return sign + digits.substr(0, n) + "." + digits.substr(n);
    if (-6 < n && n <= 0) return sign + "0." + std::string(-n, '0') + digits;
    const int e = n - 1;
    const std::string exponentText = std::string(e >= 0 ? "+" : "-") + std::to_string(e >= 0 ? e : -e);
    if (k == 1) return sign + digits + "e" + exponentText;
    return sign + digits.substr(0, 1) + "." + digits.substr(1) + "e" + exponentText;
}

static double parseRadixDigits(const std::string& text, size_t start, int radix) {
    if (start >= text.size()) return NAN;
    double value = 0;
    for (size_t i = start; i < text.size(); ++i) {
        const char c = static_cast<char>(std::tolower(static_cast<unsigned char>(text[i])));
        int digit = -1;
        if (c >= '0' && c <= '9') digit = c - '0';
        else if (c >= 'a' && c <= 'f') digit = 10 + (c - 'a');
        if (digit < 0 || digit >= radix) return NAN;
        value = value * radix + digit;
    }
    return value;
}

// Number(string): StringToNumber with JS whitespace and literal rules.
double jsStringToNumber(const std::string& raw) {
    const std::string text = jsTrim(raw);
    if (text.empty()) return 0;
    if (text.size() > 2 && text[0] == '0') {
        const char prefix = static_cast<char>(std::tolower(static_cast<unsigned char>(text[1])));
        if (prefix == 'x') return parseRadixDigits(text, 2, 16);
        if (prefix == 'o') return parseRadixDigits(text, 2, 8);
        if (prefix == 'b') return parseRadixDigits(text, 2, 2);
    }
    size_t i = 0;
    bool negative = false;
    if (text[i] == '+' || text[i] == '-') {
        negative = text[i] == '-';
        ++i;
    }
    if (text.compare(i, std::string::npos, "Infinity") == 0) return negative ? -INFINITY : INFINITY;
    size_t integerDigits = 0;
    while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) {
        ++i;
        ++integerDigits;
    }
    size_t fractionDigits = 0;
    if (i < text.size() && text[i] == '.') {
        ++i;
        while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) {
            ++i;
            ++fractionDigits;
        }
    }
    if (integerDigits + fractionDigits == 0) return NAN;
    if (i < text.size() && (text[i] == 'e' || text[i] == 'E')) {
        ++i;
        if (i < text.size() && (text[i] == '+' || text[i] == '-')) ++i;
        size_t exponentDigits = 0;
        while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) {
            ++i;
            ++exponentDigits;
        }
        if (exponentDigits == 0) return NAN;
    }
    if (i != text.size()) return NAN;
    return std::strtod(text.c_str(), nullptr);
}

double jsParseInt(const std::string& text) {
    size_t i = 0;
    while (i < text.size() && isJsWhitespace(static_cast<unsigned char>(text[i]))) ++i;
    std::string number;
    if (i < text.size() && (text[i] == '+' || text[i] == '-')) number.push_back(text[i++]);
    const size_t digitsStart = i;
    while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) number.push_back(text[i++]);
    if (i == digitsStart) return NAN;
    return std::strtod(number.c_str(), nullptr);
}

std::string upperLatin1(const std::string& text) {
    std::string out;
    out.reserve(text.size());
    for (unsigned char c : text) {
        if (c >= 'a' && c <= 'z') out.push_back(static_cast<char>(c - 32));
        else if (c == 0xDF) out.append("SS");
        else if (c >= 0xE0 && c <= 0xFE && c != 0xF7) out.push_back(static_cast<char>(c - 32));
        else out.push_back(static_cast<char>(c));
    }
    return out;
}

std::string lowerLatin1(const std::string& text) {
    std::string out(text);
    for (char& ch : out) {
        const unsigned char c = static_cast<unsigned char>(ch);
        if ((c >= 'A' && c <= 'Z') || (c >= 0xC0 && c <= 0xDE && c != 0xD7)) ch = static_cast<char>(c + 32);
    }
    return out;
}

namespace {
struct CollationEntry {
    uint8_t primary;
    uint8_t expansionPrimary;
    uint8_t secondary;
    uint8_t tertiary;
    uint8_t expands;
};
const CollationEntry COLLATION[256] = {
#include "cobol_vm_collation.inc"
};

struct CollationKey {
    std::vector<uint8_t> primary, secondary, tertiary;
};

CollationKey collationKey(const std::string& text) {
    CollationKey key;
    for (unsigned char c : text) {
        const CollationEntry& entry = COLLATION[c];
        if (entry.primary == 0) continue;
        key.primary.push_back(entry.primary);
        key.secondary.push_back(entry.secondary);
        key.tertiary.push_back(entry.tertiary);
        if (entry.expands) {
            key.primary.push_back(entry.expansionPrimary);
            key.secondary.push_back(entry.secondary);
            key.tertiary.push_back(entry.tertiary);
        }
    }
    return key;
}

int compareLevel(const std::vector<uint8_t>& left, const std::vector<uint8_t>& right) {
    const size_t count = std::min(left.size(), right.size());
    for (size_t i = 0; i < count; ++i) {
        if (left[i] != right[i]) return left[i] < right[i] ? -1 : 1;
    }
    if (left.size() == right.size()) return 0;
    return left.size() < right.size() ? -1 : 1;
}
}  // namespace

int collateCompare(const std::string& left, const std::string& right) {
    const CollationKey a = collationKey(left);
    const CollationKey b = collationKey(right);
    int result = compareLevel(a.primary, b.primary);
    if (result == 0) result = compareLevel(a.secondary, b.secondary);
    if (result == 0) result = compareLevel(a.tertiary, b.tertiary);
    return result;
}

std::string formatRealE6(float value) {
    char buffer[48];
    std::snprintf(buffer, sizeof(buffer), "%.6E", static_cast<double>(value));
    return buffer;
}

// ---------------------------------------------------------------------------------------
// Exact decimals

namespace {
std::string stripMagnitude(const std::string& digits) {
    const size_t first = digits.find_first_not_of('0');
    return first == std::string::npos ? std::string("0") : digits.substr(first);
}

int compareMagnitudes(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return a.size() < b.size() ? -1 : 1;
    const int result = a.compare(b);
    return result < 0 ? -1 : (result > 0 ? 1 : 0);
}

std::string addMagnitudes(const std::string& a, const std::string& b) {
    std::string out;
    out.reserve(std::max(a.size(), b.size()) + 1);
    int carry = 0;
    size_t i = a.size();
    size_t j = b.size();
    while (i > 0 || j > 0 || carry) {
        int sum = carry;
        if (i > 0) sum += a[--i] - '0';
        if (j > 0) sum += b[--j] - '0';
        out.push_back(static_cast<char>('0' + (sum % 10)));
        carry = sum / 10;
    }
    std::reverse(out.begin(), out.end());
    return stripMagnitude(out);
}

// a - b where a >= b.
std::string subtractMagnitudes(const std::string& a, const std::string& b) {
    std::string out;
    out.reserve(a.size());
    int borrow = 0;
    size_t i = a.size();
    size_t j = b.size();
    while (i > 0) {
        int difference = (a[--i] - '0') - borrow - (j > 0 ? (b[--j] - '0') : 0);
        borrow = difference < 0 ? 1 : 0;
        if (difference < 0) difference += 10;
        out.push_back(static_cast<char>('0' + difference));
    }
    std::reverse(out.begin(), out.end());
    return stripMagnitude(out);
}

std::string multiplyMagnitudes(const std::string& a, const std::string& b) {
    if (a == "0" || b == "0") return "0";
    std::vector<uint32_t> cells(a.size() + b.size(), 0);
    for (size_t i = a.size(); i-- > 0;) {
        const uint32_t left = static_cast<uint32_t>(a[i] - '0');
        if (left == 0) continue;
        for (size_t j = b.size(); j-- > 0;) {
            cells[i + j + 1] += left * static_cast<uint32_t>(b[j] - '0');
        }
    }
    for (size_t k = cells.size(); k-- > 1;) {
        cells[k - 1] += cells[k] / 10;
        cells[k] %= 10;
    }
    std::string out;
    out.reserve(cells.size());
    for (uint32_t cell : cells) out.push_back(static_cast<char>('0' + cell));
    return stripMagnitude(out);
}

// Truncating long division; divisor must be non-zero.
std::string divideMagnitudes(const std::string& numerator, const std::string& divisor) {
    std::string quotient;
    quotient.reserve(numerator.size());
    std::string remainder = "0";
    for (char digit : numerator) {
        remainder = remainder == "0" ? std::string(1, digit) : remainder + digit;
        remainder = stripMagnitude(remainder);
        int count = 0;
        while (compareMagnitudes(remainder, divisor) >= 0) {
            remainder = subtractMagnitudes(remainder, divisor);
            ++count;
        }
        quotient.push_back(static_cast<char>('0' + count));
    }
    return stripMagnitude(quotient);
}

std::string shiftMagnitude(const std::string& magnitude, int places) {
    if (magnitude == "0" || places <= 0) return magnitude;
    return magnitude + std::string(static_cast<size_t>(places), '0');
}

Decimal makeDecimal(bool negative, std::string magnitude, int scale) {
    Decimal value;
    value.magnitude = stripMagnitude(magnitude);
    value.negative = negative && value.magnitude != "0";
    value.scale = std::max(0, scale);
    return value;
}

// Signed unscaled add of two decimals already at the same scale.
Decimal addSigned(const Decimal& a, const Decimal& b, bool subtract, int scale) {
    const bool bNegative = subtract ? !b.negative : b.negative;
    if (a.negative == bNegative) return makeDecimal(a.negative, addMagnitudes(a.magnitude, b.magnitude), scale);
    const int order = compareMagnitudes(a.magnitude, b.magnitude);
    if (order == 0) return makeDecimal(false, "0", scale);
    if (order > 0) return makeDecimal(a.negative, subtractMagnitudes(a.magnitude, b.magnitude), scale);
    return makeDecimal(bNegative, subtractMagnitudes(b.magnitude, a.magnitude), scale);
}

std::string padStart(const std::string& text, size_t width, char fill) {
    return text.size() >= width ? text : std::string(width - text.size(), fill) + text;
}
}  // namespace

Decimal decimalFromUnscaled(const std::string& unscaled, int scale) {
    std::string text = jsTrim(unscaled);
    bool negative = false;
    if (!text.empty() && (text[0] == '-' || text[0] == '+')) {
        negative = text[0] == '-';
        text.erase(0, 1);
    }
    if (text.empty() || text.find_first_not_of("0123456789") != std::string::npos) {
        fail("Cannot convert " + unscaled + " to a BigInt");
    }
    return makeDecimal(negative, text, scale);
}

Decimal decimalFromString(const std::string& raw) {
    std::string text = jsTrim(raw);
    std::replace(text.begin(), text.end(), ',', '.');
    size_t i = 0;
    bool negative = false;
    if (i < text.size() && (text[i] == '+' || text[i] == '-')) {
        negative = text[i] == '-';
        ++i;
    }
    const size_t integerStart = i;
    while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) ++i;
    std::string integerPart = text.substr(integerStart, i - integerStart);
    std::string fraction;
    if (i < text.size() && text[i] == '.') {
        ++i;
        const size_t fractionStart = i;
        while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) ++i;
        fraction = text.substr(fractionStart, i - fractionStart);
    }
    if (i != text.size()) return Decimal();
    return makeDecimal(negative, (integerPart.empty() ? std::string("0") : integerPart) + fraction,
                       static_cast<int>(fraction.size()));
}

// decimalFromNumber(String(value)) for finite host results.
Decimal decimalFromNumberText(const std::string& text) {
    size_t i = 0;
    std::string sign;
    if (i < text.size() && (text[i] == '+' || text[i] == '-')) sign = std::string(1, text[i++]);
    const size_t integerStart = i;
    while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) ++i;
    const std::string integerPart = text.substr(integerStart, i - integerStart);
    std::string fraction;
    if (i < text.size() && text[i] == '.') {
        const size_t fractionStart = ++i;
        while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) ++i;
        fraction = text.substr(fractionStart, i - fractionStart);
        if (fraction.empty()) fail("Cannot convert host number to P-code decimal");
    }
    int exponent = 0;
    if (i < text.size() && (text[i] == 'e' || text[i] == 'E')) {
        ++i;
        const size_t exponentStart = i;
        if (i < text.size() && (text[i] == '+' || text[i] == '-')) ++i;
        const size_t digitsStart = i;
        while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) ++i;
        if (i == digitsStart) fail("Cannot convert host number to P-code decimal");
        exponent = std::atoi(text.substr(exponentStart, i - exponentStart).c_str());
    }
    if (integerPart.empty() || i != text.size()) fail("Cannot convert host number to P-code decimal");
    const std::string digits = integerPart + fraction;
    const int decimalPosition = static_cast<int>(integerPart.size()) + exponent;
    std::string whole;
    std::string decimal;
    if (decimalPosition <= 0) {
        whole = "0";
        decimal = std::string(static_cast<size_t>(-decimalPosition), '0') + digits;
    } else {
        whole = digits.substr(0, static_cast<size_t>(decimalPosition));
        if (whole.size() < static_cast<size_t>(decimalPosition)) whole.append(decimalPosition - whole.size(), '0');
        decimal = static_cast<size_t>(decimalPosition) < digits.size() ? digits.substr(decimalPosition) : "";
    }
    return decimalFromString(sign + whole + (decimal.empty() ? "" : "." + decimal));
}

Decimal decimalFromInteger(double value) {
    if (!std::isfinite(value)) {
        fail("The number " + jsNumberToString(value) + " cannot be converted to a BigInt because it is not an integer");
    }
    const double truncated = std::trunc(value);
    if (std::fabs(truncated) < 9.0e18) {
        const long long integer = static_cast<long long>(truncated);
        const unsigned long long magnitude = integer < 0
            ? static_cast<unsigned long long>(-(integer + 1)) + 1ULL
            : static_cast<unsigned long long>(integer);
        return makeDecimal(integer < 0, std::to_string(magnitude), 0);
    }
    char buffer[400];
    std::snprintf(buffer, sizeof(buffer), "%.0f", std::fabs(truncated));
    return makeDecimal(truncated < 0, buffer, 0);
}

Decimal rescaleDecimal(const Decimal& value, int scale, bool roundHalfUp) {
    scale = std::max(0, scale);
    if (value.scale == scale) return value;
    if (scale > value.scale) {
        return makeDecimal(value.negative, shiftMagnitude(value.magnitude, scale - value.scale), scale);
    }
    const size_t dropped = static_cast<size_t>(value.scale - scale);
    const std::string& digits = value.magnitude;
    std::string quotient;
    char firstDropped = '0';
    if (digits.size() <= dropped) {
        quotient = "0";
        if (digits.size() == dropped) firstDropped = digits[0];
    } else {
        quotient = digits.substr(0, digits.size() - dropped);
        firstDropped = digits[digits.size() - dropped];
    }
    // COBOL ROUNDED is half-up away from zero.
    if (roundHalfUp && firstDropped >= '5') quotient = addMagnitudes(quotient, "1");
    return makeDecimal(value.negative, quotient, scale);
}

std::string formatDecimal(const Decimal& value) {
    const std::string digits = padStart(value.magnitude, static_cast<size_t>(value.scale) + 1, '0');
    const size_t wholeLength = digits.size() - static_cast<size_t>(value.scale);
    std::string out = value.negative ? "-" : "";
    out += wholeLength == 0 ? std::string("0") : digits.substr(0, wholeLength);
    if (value.scale > 0) out += "." + digits.substr(wholeLength);
    return out;
}

double decimalToNumber(const Decimal& value) {
    return jsStringToNumber(formatDecimal(value));
}

static const int DECIMAL_DIVISION_SCALE = 20;

Decimal decimalArithmetic(char op, const Decimal& a, const Decimal& b) {
    if (op == '*') {
        return makeDecimal(a.negative != b.negative, multiplyMagnitudes(a.magnitude, b.magnitude), a.scale + b.scale);
    }
    if (op == '/') {
        if (b.magnitude == "0") return makeDecimal(false, "0", a.scale);
        const int scale = std::max(std::max(a.scale, b.scale), DECIMAL_DIVISION_SCALE);
        const std::string numerator = shiftMagnitude(a.magnitude, scale + b.scale - a.scale);
        return makeDecimal(a.negative != b.negative, divideMagnitudes(numerator, b.magnitude), scale);
    }
    const int scale = std::max(a.scale, b.scale);
    return addSigned(rescaleDecimal(a, scale, false), rescaleDecimal(b, scale, false), op == '-', scale);
}

int compareDecimals(const Decimal& rawA, const Decimal& rawB) {
    const int scale = std::max(rawA.scale, rawB.scale);
    const Decimal a = rescaleDecimal(rawA, scale, false);
    const Decimal b = rescaleDecimal(rawB, scale, false);
    if (a.negative != b.negative) return a.negative ? -1 : 1;
    const int order = compareMagnitudes(a.magnitude, b.magnitude);
    return a.negative ? -order : order;
}

std::string formatCobolDisplay(const Decimal& value, int precision, int scale, int signMode) {
    const Decimal decimal = rescaleDecimal(value, scale, false);
    const std::string digits = padStart(decimal.magnitude, static_cast<size_t>(std::max(0, precision)), '0');
    if (signMode == 1) return std::string(decimal.negative ? "-" : "+") + digits;
    if (signMode == 2) return digits + (decimal.negative ? "-" : "+");
    return std::string(decimal.negative ? "-" : "") + digits;
}

// Literal port of formatCobolEdited in runtime.mjs, including its quirks.
std::string formatCobolEdited(const Decimal& value, const std::string& mask, bool decimalComma, bool blankWhenZero) {
    const int length = static_cast<int>(mask.size());
    auto isDigitMarker = [](char c) { return c == '9' || c == 'Z' || c == '*'; };
    const size_t decimalFound = mask.rfind(decimalComma ? ',' : '.');
    const int decimalAt = decimalFound == std::string::npos ? -1 : static_cast<int>(decimalFound);
    int scale = 0;
    if (decimalAt >= 0) {
        for (int i = decimalAt + 1; i < length; ++i) if (isDigitMarker(mask[i])) ++scale;
    }
    const int integerEnd = decimalAt < 0 ? length : decimalAt;
    int lastRequiredDigit = -1;
    if (length > 0) {
        for (int i = std::min(std::max(integerEnd - 1, 0), length - 1); i >= 0; --i) {
            if (mask[i] == '9') {
                lastRequiredDigit = i;
                break;
            }
        }
    }
    auto isFloating = [&](char c) {
        if (c != '$' && c != '+' && c != '-') return false;
        int occurrences = 0;
        for (int i = 0; i < integerEnd; ++i) if (mask[i] == c) ++occurrences;
        return occurrences > 1;
    };
    std::vector<int> integerPositions;
    for (int i = 0; i < integerEnd; ++i) {
        if (isDigitMarker(mask[i]) || (isFloating(mask[i]) && i < lastRequiredDigit)) integerPositions.push_back(i);
    }
    std::vector<int> fractionPositions;
    if (decimalAt >= 0) {
        for (int i = decimalAt + 1; i < length; ++i) if (isDigitMarker(mask[i])) fractionPositions.push_back(i);
    }
    const Decimal decimal = rescaleDecimal(value, scale, false);
    const bool negative = decimal.negative;
    const size_t integerCount = integerPositions.size();
    const std::string absolute = padStart(decimal.magnitude, integerCount + static_cast<size_t>(scale), '0');
    const size_t cut = absolute.size() - static_cast<size_t>(scale);
    const std::string integerDigits = padStart(cut == 0 ? absolute : absolute.substr(0, cut), integerCount, '0');
    const std::string fractionDigits = scale ? absolute.substr(absolute.size() - scale) : "";
    const bool isZero = decimal.magnitude == "0";
    if (blankWhenZero && isZero) return std::string(mask.size(), ' ');

    std::string output = mask;
    bool significant = false;
    for (size_t slot = 0; slot < integerCount; ++slot) {
        const int position = integerPositions[slot];
        const char digit = slot < integerDigits.size() ? integerDigits[slot] : '0';
        const char marker = mask[position];
        if (digit != '0') significant = true;
        output[position] = (marker == '9' || significant) ? digit : (marker == '*' ? '*' : ' ');
    }
    for (size_t index = 0; index < fractionPositions.size(); ++index) {
        const int position = fractionPositions[index];
        const char marker = mask[position];
        const char digit = index < fractionDigits.size() ? fractionDigits[index] : '0';
        output[position] = (marker == 'Z' && digit == '0') ? ' ' : ((marker == '*' && isZero) ? '*' : digit);
    }

    int firstPosition = length;
    {
        int firstDigit = -1;
        for (size_t index = 0; index < integerCount; ++index) {
            if (index >= integerDigits.size() || integerDigits[index] != '0') {
                firstDigit = static_cast<int>(index);
                break;
            }
        }
        if (firstDigit >= 0) firstPosition = integerPositions[firstDigit];
        else if (integerCount > 0) firstPosition = integerPositions.back();
    }
    std::vector<int> currencies;
    std::vector<int> signs;
    const bool maskHasStar = mask.find('*') != std::string::npos;
    const char separator = decimalComma ? '.' : ',';
    for (int position = 0; position < length; ++position) {
        if (mask[position] == '$') currencies.push_back(position);
        if (mask[position] == '+' || mask[position] == '-') signs.push_back(position);
        if (mask[position] == separator) {
            bool anySignificant = false;
            for (int index : integerPositions) {
                if (index < position && output[index] >= '1' && output[index] <= '9') anySignificant = true;
            }
            if (!anySignificant) output[position] = ' ';
        }
        if (position == decimalAt && isZero && !maskHasStar) output[position] = ' ';
    }
    for (int position = 0; position < length; ++position) {
        if (mask[position] == 'B') output[position] = ' ';
    }
    for (int pass = 0; pass < 2; ++pass) {
        const std::vector<int>& positions = pass == 0 ? currencies : signs;
        std::vector<int> floating;
        for (int position : positions) if (position < firstPosition) floating.push_back(position);
        if (!floating.empty()) {
            for (int position : floating) output[position] = ' ';
            output[floating.back()] = pass == 0 ? '$' : (negative ? '-' : ' ');
        }
    }
    for (const char* marker : {"CR", "DB"}) {
        const size_t position = mask.rfind(marker);
        if (position != std::string::npos) {
            output[position] = negative ? marker[0] : ' ';
            output[position + 1] = negative ? marker[1] : ' ';
        }
    }
    for (int position : signs) {
        if (position >= firstPosition) {
            output[position] = mask[position] == '+' ? (negative ? '-' : '+') : (negative ? '-' : ' ');
        }
    }
    return output;
}

int decimalDigitCount(const Decimal& value) {
    return std::max(static_cast<int>(value.magnitude.size()), value.scale + 1);
}

// ---------------------------------------------------------------------------------------
// JSON

const Json* Json::get(const std::string& key) const {
    if (type != Object) return nullptr;
    const Json* found = nullptr;
    for (const auto& member : members) {
        if (member.first == key) found = &member.second;  // last duplicate wins, as in JSON.parse
    }
    return found;
}

namespace {
struct JsonParser {
    explicit JsonParser(const std::string& source) : text(source) {}
    const std::string& text;
    size_t pos = 0;
    int depth = 0;

    void skip() {
        while (pos < text.size() && (text[pos] == ' ' || text[pos] == '\t' || text[pos] == '\n' || text[pos] == '\r')) ++pos;
    }

    static int hexValue(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return 10 + c - 'a';
        if (c >= 'A' && c <= 'F') return 10 + c - 'A';
        return -1;
    }

    bool readHex4(uint32_t& out) {
        if (pos + 4 > text.size()) return false;
        out = 0;
        for (int k = 0; k < 4; ++k) {
            const int digit = hexValue(text[pos + k]);
            if (digit < 0) return false;
            out = (out << 4) | static_cast<uint32_t>(digit);
        }
        pos += 4;
        return true;
    }

    bool parseString(std::string& out) {
        if (pos >= text.size() || text[pos] != '"') return false;
        ++pos;
        out.clear();
        while (pos < text.size()) {
            const unsigned char c = static_cast<unsigned char>(text[pos++]);
            if (c == '"') return true;
            if (c < 0x20) return false;
            if (c != '\\') {
                out.push_back(static_cast<char>(c));
                continue;
            }
            if (pos >= text.size()) return false;
            const char escape = text[pos++];
            switch (escape) {
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/': out.push_back('/'); break;
                case 'b': out.push_back('\b'); break;
                case 'f': out.push_back('\f'); break;
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case 't': out.push_back('\t'); break;
                case 'u': {
                    uint32_t unit = 0;
                    if (!readHex4(unit)) return false;
                    uint32_t codePoint = unit;
                    if (unit >= 0xD800 && unit <= 0xDBFF && pos + 6 <= text.size()
                        && text[pos] == '\\' && text[pos + 1] == 'u') {
                        const size_t saved = pos;
                        pos += 2;
                        uint32_t low = 0;
                        if (readHex4(low) && low >= 0xDC00 && low <= 0xDFFF) {
                            codePoint = 0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00);
                        } else {
                            pos = saved;
                        }
                    }
                    out.push_back(codePoint <= 0xFF ? static_cast<char>(codePoint) : '?');
                    break;
                }
                default: return false;
            }
        }
        return false;
    }

    bool parseNumber(double& out) {
        const size_t start = pos;
        if (pos < text.size() && text[pos] == '-') ++pos;
        if (pos >= text.size()) return false;
        if (text[pos] == '0') {
            ++pos;
        } else if (text[pos] >= '1' && text[pos] <= '9') {
            while (pos < text.size() && std::isdigit(static_cast<unsigned char>(text[pos]))) ++pos;
        } else {
            return false;
        }
        if (pos < text.size() && text[pos] == '.') {
            ++pos;
            const size_t digits = pos;
            while (pos < text.size() && std::isdigit(static_cast<unsigned char>(text[pos]))) ++pos;
            if (pos == digits) return false;
        }
        if (pos < text.size() && (text[pos] == 'e' || text[pos] == 'E')) {
            ++pos;
            if (pos < text.size() && (text[pos] == '+' || text[pos] == '-')) ++pos;
            const size_t digits = pos;
            while (pos < text.size() && std::isdigit(static_cast<unsigned char>(text[pos]))) ++pos;
            if (pos == digits) return false;
        }
        out = std::strtod(text.substr(start, pos - start).c_str(), nullptr);
        return true;
    }

    bool parseValue(Json& out) {
        if (++depth > 64) return false;
        skip();
        if (pos >= text.size()) return false;
        const char c = text[pos];
        bool ok = true;
        if (c == '{') {
            out.type = Json::Object;
            ++pos;
            skip();
            if (pos < text.size() && text[pos] == '}') {
                ++pos;
            } else {
                while (true) {
                    skip();
                    std::string key;
                    if (!parseString(key)) { ok = false; break; }
                    skip();
                    if (pos >= text.size() || text[pos] != ':') { ok = false; break; }
                    ++pos;
                    Json member;
                    if (!parseValue(member)) { ok = false; break; }
                    out.members.emplace_back(std::move(key), std::move(member));
                    skip();
                    if (pos < text.size() && text[pos] == ',') { ++pos; continue; }
                    if (pos < text.size() && text[pos] == '}') { ++pos; break; }
                    ok = false;
                    break;
                }
            }
        } else if (c == '[') {
            out.type = Json::Array;
            ++pos;
            skip();
            if (pos < text.size() && text[pos] == ']') {
                ++pos;
            } else {
                while (true) {
                    Json item;
                    if (!parseValue(item)) { ok = false; break; }
                    out.items.push_back(std::move(item));
                    skip();
                    if (pos < text.size() && text[pos] == ',') { ++pos; continue; }
                    if (pos < text.size() && text[pos] == ']') { ++pos; break; }
                    ok = false;
                    break;
                }
            }
        } else if (c == '"') {
            out.type = Json::String;
            ok = parseString(out.text);
        } else if (text.compare(pos, 4, "true") == 0) {
            out.type = Json::Bool;
            out.boolean = true;
            pos += 4;
        } else if (text.compare(pos, 5, "false") == 0) {
            out.type = Json::Bool;
            pos += 5;
        } else if (text.compare(pos, 4, "null") == 0) {
            out.type = Json::Null;
            pos += 4;
        } else {
            out.type = Json::Number;
            ok = parseNumber(out.number);
        }
        --depth;
        return ok;
    }
};
}  // namespace

bool parseJson(const std::string& latin1, Json& out) {
    JsonParser parser{latin1};
    out = Json();
    if (!parser.parseValue(out)) return false;
    parser.skip();
    return parser.pos == latin1.size();
}

std::string jsonQuote(const std::string& latin1) {
    std::string out;
    out.reserve(latin1.size() + 2);
    out.push_back('"');
    for (unsigned char c : latin1) {
        switch (c) {
            case '"': out.append("\\\""); break;
            case '\\': out.append("\\\\"); break;
            case '\b': out.append("\\b"); break;
            case '\f': out.append("\\f"); break;
            case '\n': out.append("\\n"); break;
            case '\r': out.append("\\r"); break;
            case '\t': out.append("\\t"); break;
            default:
                if (c < 0x20) {
                    char buffer[8];
                    std::snprintf(buffer, sizeof(buffer), "\\u%04x", c);
                    out.append(buffer);
                } else {
                    out.push_back(static_cast<char>(c));
                }
        }
    }
    out.push_back('"');
    return out;
}

}  // namespace detail
}  // namespace cobolvm
