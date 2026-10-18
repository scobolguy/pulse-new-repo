// Built-in host bindings for COBOL P-code: text, intrinsic math, dates and ISAM files.
// Behaviour follows desktop-text-bindings.mjs, desktop-intrinsic-bindings.mjs and
// libraries/isam/pcode-isam.mjs.
#include "cobol_vm_internal.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <ctime>

namespace cobolvm {
namespace detail {

namespace {

using A = ArgKind;
using R = ResultKind;

enum BindingId {
    B_STRING_LOWER, B_STRING_UPPER, B_STRING_LENGTH, B_STRING_COMPARE, B_STRING_INDEX, B_STRING_SLICE,
    B_COBOL_CHAR, B_COBOL_ORD, B_DATE_CURRENT, B_DATE_ACCEPT,
    B_ACOS, B_ASIN, B_ATAN, B_COS, B_SIN, B_TAN, B_LOG, B_LOG10, B_SQRT, B_FACTORIAL, B_FLOOR, B_TRUNC,
    B_MOD, B_REM,
    B_MEAN, B_MEDIAN, B_MIDRANGE, B_RANGE, B_SUM, B_VARIANCE, B_STANDARD_DEVIATION,
    B_NUMVAL, B_NUMVAL_C, B_PRESENT_VALUE, B_NUMVAL_C_CURRENCY, B_ORD_MAX, B_ORD_MIN,
    B_INTEGER_OF_DATE, B_DATE_OF_INTEGER, B_INTEGER_OF_DAY, B_DAY_OF_INTEGER,
    B_ANNUITY, B_RANDOM, B_RANDOM_SEEDED,
    B_ISAM_OPEN, B_ISAM_READ, B_ISAM_READ_ALT, B_ISAM_READ_NEXT, B_ISAM_CURRENT_KEY, B_ISAM_COUNT,
    B_ISAM_START, B_ISAM_WRITE, B_ISAM_REWRITE, B_ISAM_DELETE, B_ISAM_STATUS, B_ISAM_CLOSE, B_ISAM_CLOSE_LOCK,
    B_COUNT
};

const BindingSpec BINDINGS[B_COUNT] = {
    {"host.string_lower", 1, {A::String}, R::String},
    {"host.string_upper", 1, {A::String}, R::String},
    {"host.string_length", 1, {A::String}, R::Integer},
    {"host.string_compare", 2, {A::String, A::String}, R::Integer},
    {"host.string_index", 2, {A::String, A::String}, R::Integer},
    {"host.string_slice", 3, {A::String, A::Integer, A::Integer}, R::String},
    {"host.cobol_char", 1, {A::Number}, R::String},
    {"host.cobol_ord", 1, {A::String}, R::Integer},
    {"host.date_current", 0, {}, R::String},
    {"host.date_accept", 1, {A::String}, R::String},
    {"host.math_acos", 1, {A::Number}, R::Decimal},
    {"host.math_asin", 1, {A::Number}, R::Decimal},
    {"host.math_atan", 1, {A::Number}, R::Decimal},
    {"host.math_cos", 1, {A::Number}, R::Decimal},
    {"host.math_sin", 1, {A::Number}, R::Decimal},
    {"host.math_tan", 1, {A::Number}, R::Decimal},
    {"host.math_log", 1, {A::Number}, R::Decimal},
    {"host.math_log10", 1, {A::Number}, R::Decimal},
    {"host.math_sqrt", 1, {A::Number}, R::Decimal},
    {"host.math_factorial", 1, {A::Number}, R::Decimal},
    {"host.math_floor", 1, {A::Number}, R::Decimal},
    {"host.math_trunc", 1, {A::Number}, R::Decimal},
    {"host.math_mod", 2, {A::Number, A::Number}, R::Decimal},
    {"host.math_rem", 2, {A::Number, A::Number}, R::Decimal},
    {"host.math_mean", 1, {A::String}, R::Decimal},
    {"host.math_median", 1, {A::String}, R::Decimal},
    {"host.math_midrange", 1, {A::String}, R::Decimal},
    {"host.math_range", 1, {A::String}, R::Decimal},
    {"host.math_sum", 1, {A::String}, R::Decimal},
    {"host.math_variance", 1, {A::String}, R::Decimal},
    {"host.math_standard_deviation", 1, {A::String}, R::Decimal},
    {"host.math_numval", 1, {A::String}, R::Decimal},
    {"host.math_numval_c", 1, {A::String}, R::Decimal},
    {"host.math_present_value", 1, {A::String}, R::Decimal},
    {"host.math_numval_c_currency", 2, {A::String, A::String}, R::Decimal},
    {"host.math_ord_max", 1, {A::String}, R::Integer},
    {"host.math_ord_min", 1, {A::String}, R::Integer},
    {"host.math_integer_of_date", 1, {A::Number}, R::Integer},
    {"host.math_date_of_integer", 1, {A::Number}, R::Integer},
    {"host.math_integer_of_day", 1, {A::Number}, R::Integer},
    {"host.math_day_of_integer", 1, {A::Number}, R::Integer},
    {"host.math_annuity", 2, {A::Number, A::Number}, R::Decimal},
    {"host.math_random", 0, {}, R::Decimal},
    {"host.math_random_seeded", 1, {A::Number}, R::Decimal},
    {"host.isam_open", 4, {A::String, A::String, A::String, A::String}, R::Integer},
    {"host.isam_read", 2, {A::Integer, A::String}, R::String},
    {"host.isam_read_alt", 3, {A::Integer, A::String, A::String}, R::String},
    {"host.isam_read_next", 1, {A::Integer}, R::String},
    {"host.isam_current_key", 1, {A::Integer}, R::String},
    {"host.isam_count", 1, {A::Integer}, R::Integer},
    {"host.isam_start", 3, {A::Integer, A::String, A::String}, R::Integer},
    {"host.isam_write", 3, {A::Integer, A::String, A::String}, R::Integer},
    {"host.isam_rewrite", 3, {A::Integer, A::String, A::String}, R::Integer},
    {"host.isam_delete", 2, {A::Integer, A::String}, R::Integer},
    {"host.isam_status", 1, {A::Integer}, R::String},
    {"host.isam_close", 1, {A::Integer}, R::Integer},
    {"host.isam_close_lock", 1, {A::Integer}, R::Integer},
};

BindingValue numberResult(double value) {
    BindingValue out;
    out.number = value;
    return out;
}

BindingValue textResult(std::string value) {
    BindingValue out;
    out.isString = true;
    out.text = std::move(value);
    return out;
}

double finiteResult(const std::string& name, double value) {
    if (!std::isfinite(value)) fail(name + " produced a non-finite result");
    return value;
}

std::vector<double> numericValues(const std::string& serialized, const std::string& name) {
    Json values;
    if (!parseJson(serialized, values)) fail(name + " expects a serialized numeric list: invalid JSON");
    bool valid = values.type == Json::Array && !values.items.empty();
    std::vector<double> out;
    if (valid) {
        for (const Json& item : values.items) {
            if (item.type != Json::Number || !std::isfinite(item.number)) {
                valid = false;
                break;
            }
            out.push_back(item.number);
        }
    }
    if (!valid) fail(name + " expects a non-empty list of finite numbers");
    return out;
}

bool endsWith(const std::string& text, const char* suffix) {
    const size_t length = std::char_traits<char>::length(suffix);
    return text.size() >= length && text.compare(text.size() - length, length, suffix) == 0;
}

bool isDigit(char c) { return c >= '0' && c <= '9'; }

bool validCommaGrouping(const std::string& integerPart) {
    // ^\d{1,3}(?:,\d{3})+$
    const size_t firstComma = integerPart.find(',');
    if (firstComma == std::string::npos || firstComma < 1 || firstComma > 3) return false;
    for (size_t i = 0; i < firstComma; ++i) if (!isDigit(integerPart[i])) return false;
    size_t at = firstComma;
    while (at < integerPart.size()) {
        if (integerPart[at] != ',' || at + 4 > integerPart.size()) return false;
        for (size_t i = at + 1; i < at + 4; ++i) if (!isDigit(integerPart[i])) return false;
        at += 4;
    }
    return true;
}

bool validPlainNumber(const std::string& value) {
    // ^(?:\d+(?:\.\d*)?|\.\d+)$
    size_t at = 0;
    while (at < value.size() && isDigit(value[at])) ++at;
    const bool leadingDigits = at > 0;
    if (at < value.size() && value[at] == '.') {
        ++at;
        const size_t fractionStart = at;
        while (at < value.size() && isDigit(value[at])) ++at;
        if (!leadingDigits && at == fractionStart) return false;
    } else if (!leadingDigits) {
        return false;
    }
    return at == value.size();
}

double parseCobolNumber(const std::string& rawValue, bool currency, const std::string* currencySign) {
    std::string value = upperLatin1(jsTrim(rawValue));
    bool negative = false;
    if (currency && (endsWith(value, "CR") || endsWith(value, "DB"))) {
        negative = true;
        value.resize(value.size() - 2);
    }
    value.erase(std::remove_if(value.begin(), value.end(), [](char c) {
        return isJsWhitespace(static_cast<unsigned char>(c));
    }), value.end());
    if (currency && !currencySign) {
        value.erase(std::remove_if(value.begin(), value.end(), [](char c) {
            const unsigned char u = static_cast<unsigned char>(c);
            return u == '$' || u == 0xA3 || u == 0xA5;
        }), value.end());
    } else if (currency) {
        if (currencySign->size() != 1) fail("NUMVAL-C currency sign must be one character");
        const char sign = (*currencySign)[0];
        if (std::count(value.begin(), value.end(), sign) > 1) {
            fail("NUMVAL-C input contains the currency sign more than once");
        }
        value.erase(std::remove(value.begin(), value.end(), sign), value.end());
    }
    int signCount = 0;
    if (!value.empty() && (value[0] == '+' || value[0] == '-')) {
        negative = value[0] == '-';
        ++signCount;
        value.erase(0, 1);
    }
    if (!value.empty() && (value.back() == '+' || value.back() == '-')) {
        if (signCount) fail("NUMVAL input cannot have both leading and trailing signs");
        negative = value.back() == '-';
        value.pop_back();
    }
    if (!currency && value.find(',') != std::string::npos) fail("NUMVAL does not accept grouping commas");
    if (currency && value.find(',') != std::string::npos) {
        const std::string integerPart = value.substr(0, value.find('.'));
        if (!validCommaGrouping(integerPart)) fail("NUMVAL-C input has invalid comma grouping");
        value.erase(std::remove(value.begin(), value.end(), ','), value.end());
    }
    if (!validPlainNumber(value)) fail("NUMVAL input is not a valid numeric value");
    const double number = jsStringToNumber(value);
    if (!std::isfinite(number)) fail("NUMVAL input is outside the supported numeric range");
    return negative ? -number : number;
}

int64_t daysFromCivil(int64_t year, int month, int day) {
    year -= month <= 2;
    const int64_t era = (year >= 0 ? year : year - 399) / 400;
    const int64_t yearOfEra = year - era * 400;
    const int64_t dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
    const int64_t dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
    return era * 146097 + dayOfEra - 719468;
}

void civilFromDays(int64_t days, int64_t& year, int& month, int& day) {
    days += 719468;
    const int64_t era = (days >= 0 ? days : days - 146096) / 146097;
    const int64_t dayOfEra = days - era * 146097;
    const int64_t yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365;
    const int64_t dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100);
    const int64_t shifted = (5 * dayOfYear + 2) / 153;
    day = static_cast<int>(dayOfYear - (153 * shifted + 2) / 5 + 1);
    month = static_cast<int>(shifted < 10 ? shifted + 3 : shifted - 9);
    year = yearOfEra + era * 400 + (month <= 2);
}

int daysInMonth(int64_t year, int month) {
    static const int lengths[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    const bool leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    return month == 2 && leap ? 29 : lengths[month - 1];
}

const int64_t COBOL_EPOCH_DAYS = daysFromCivil(1601, 1, 1);

int64_t makeDate(double year, double month, double day, const std::string& label) {
    if (!isSafeInteger(year) || year < 1601 || year > 9999 || !isSafeInteger(month) || month < 1 || month > 12
        || !isSafeInteger(day) || day < 1 || day > 31) {
        fail(label + " is outside the supported COBOL date range");
    }
    if (day > daysInMonth(static_cast<int64_t>(year), static_cast<int>(month))) {
        fail(label + " is not a valid calendar date");
    }
    return daysFromCivil(static_cast<int64_t>(year), static_cast<int>(month), static_cast<int>(day));
}

double integerOfDate(double value) {
    if (!isSafeInteger(value)) fail("INTEGER-OF-DATE expects YYYYMMDD");
    const double year = std::floor(value / 10000);
    const double month = std::floor(std::fmod(value, 10000) / 100);
    const double day = std::fmod(value, 100);
    return static_cast<double>(makeDate(year, month, day, "INTEGER-OF-DATE") - COBOL_EPOCH_DAYS + 1);
}

bool ordinalDate(double ordinal, int64_t& year, int& month, int& day) {
    if (ordinal > 4e12) return false;
    civilFromDays(COBOL_EPOCH_DAYS + static_cast<int64_t>(ordinal) - 1, year, month, day);
    return year <= 9999;
}

double dateOfInteger(double ordinal) {
    if (!isSafeInteger(ordinal) || ordinal < 1) fail("DATE-OF-INTEGER expects an integer of at least 1");
    int64_t year;
    int month, day;
    if (!ordinalDate(ordinal, year, month, day)) fail("DATE-OF-INTEGER is outside the supported date range");
    return static_cast<double>(year * 10000 + month * 100 + day);
}

double integerOfDay(double value) {
    if (!isSafeInteger(value)) fail("INTEGER-OF-DAY expects YYYYDDD");
    const double year = std::floor(value / 1000);
    const double day = std::fmod(value, 1000);
    const int64_t first = makeDate(year, 1, 1, "INTEGER-OF-DAY");
    const int64_t yearLength = daysFromCivil(static_cast<int64_t>(year) + 1, 1, 1) - first;
    if (day < 1 || day > static_cast<double>(yearLength)) fail("INTEGER-OF-DAY has an invalid day-of-year");
    return static_cast<double>(first + static_cast<int64_t>(day) - 1 - COBOL_EPOCH_DAYS + 1);
}

double dayOfInteger(double ordinal) {
    if (!isSafeInteger(ordinal) || ordinal < 1) fail("DAY-OF-INTEGER expects an integer of at least 1");
    int64_t year;
    int month, day;
    if (!ordinalDate(ordinal, year, month, day)) fail("DAY-OF-INTEGER is outside the supported date range");
    const int64_t dayOfYear = daysFromCivil(year, month, day) - daysFromCivil(year, 1, 1) + 1;
    return static_cast<double>(year * 1000 + dayOfYear);
}

struct LocalNow {
    std::tm parts{};
    int milliseconds = 0;
    long offsetMinutes = 0;
};

LocalNow localNow() {
    LocalNow now;
    const auto clock = std::chrono::system_clock::now();
    const std::time_t seconds = std::chrono::system_clock::to_time_t(clock);
    now.milliseconds = static_cast<int>(std::chrono::duration_cast<std::chrono::milliseconds>(
        clock.time_since_epoch()).count() % 1000);
    if (now.milliseconds < 0) now.milliseconds += 1000;
    const std::tm* local = std::localtime(&seconds);
    if (local) now.parts = *local;
    const std::tm* utc = std::gmtime(&seconds);
    if (utc) {
        std::tm asLocal = *utc;
        asLocal.tm_isdst = now.parts.tm_isdst;
        const std::time_t shifted = std::mktime(&asLocal);
        if (shifted != static_cast<std::time_t>(-1)) {
            now.offsetMinutes = static_cast<long>(std::difftime(seconds, shifted) / 60);
        }
    }
    return now;
}

std::string pad(long value, int width) {
    char buffer[24];
    std::snprintf(buffer, sizeof buffer, "%0*ld", width, value);
    return buffer;
}

std::string currentCobolDate() {
    const LocalNow now = localNow();
    const long absolute = now.offsetMinutes < 0 ? -now.offsetMinutes : now.offsetMinutes;
    return pad(now.parts.tm_year + 1900L, 4) + pad(now.parts.tm_mon + 1, 2) + pad(now.parts.tm_mday, 2)
        + pad(now.parts.tm_hour, 2) + pad(now.parts.tm_min, 2) + pad(now.parts.tm_sec, 2)
        + pad(now.milliseconds / 10, 2) + (now.offsetMinutes < 0 ? "-" : "+")
        + pad(absolute / 60, 2) + pad(absolute % 60, 2);
}

std::string acceptedDateValue(const std::string& kind) {
    const LocalNow now = localNow();
    const std::string year = pad(now.parts.tm_year + 1900L, 4);
    const std::string shortYear = year.substr(year.size() - 2);
    if (kind == "DATE") return shortYear + pad(now.parts.tm_mon + 1, 2) + pad(now.parts.tm_mday, 2);
    if (kind == "DAY") return shortYear + pad(now.parts.tm_yday + 1, 3);
    if (kind == "TIME") {
        return pad(now.parts.tm_hour, 2) + pad(now.parts.tm_min, 2) + pad(now.parts.tm_sec, 2)
            + pad(now.milliseconds / 10, 2);
    }
    if (kind == "DAY-OF-WEEK") return pad(now.parts.tm_wday + 1, 1);
    fail("Unsupported ACCEPT FROM source " + kind);
}

double seededRandom(double seed) {
    const std::string text = jsNumberToString(seed);
    uint32_t state = 2166136261u;
    for (unsigned char c : text) state = (state ^ c) * 16777619u;
    state = state * 1664525u + 1013904223u;
    return state / 4294967296.0;
}

double unaryMath(int id, double value) {
    switch (id) {
        case B_ACOS: return std::acos(value);
        case B_ASIN: return std::asin(value);
        case B_ATAN: return std::atan(value);
        case B_COS: return std::cos(value);
        case B_SIN: return std::sin(value);
        case B_TAN: return std::tan(value);
        case B_LOG: return std::log(value);
        case B_LOG10: return std::log10(value);
        case B_SQRT: return std::sqrt(value);
        case B_FLOOR: return std::floor(value);
        default: return std::trunc(value);
    }
}

double summary(int id, const std::vector<double>& values) {
    std::vector<double> sorted = values;
    std::sort(sorted.begin(), sorted.end());
    double sum = 0;
    for (double value : values) sum += value;
    const double mean = sum / values.size();
    double variance = 0;
    for (double value : values) variance += (value - mean) * (value - mean);
    variance /= values.size();
    const size_t count = values.size();
    switch (id) {
        case B_MEAN: return mean;
        case B_MEDIAN: return count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
        case B_MIDRANGE: return (sorted.front() + sorted.back()) / 2;
        case B_RANGE: return sorted.back() - sorted.front();
        case B_SUM: return sum;
        case B_VARIANCE: return variance;
        default: return std::sqrt(variance);
    }
}

double ordinalOfExtreme(const std::vector<double>& values, bool maximum) {
    double extreme = values[0];
    for (double value : values) {
        if (maximum ? value > extreme : value < extreme) extreme = value;
    }
    for (size_t i = 0; i < values.size(); ++i) {
        if (values[i] == extreme) return static_cast<double>(i + 1);
    }
    return 0;
}

int handleOf(const BindingValue& value) { return static_cast<int>(value.number); }

}  // namespace

int findBinding(const std::string& lowerName) {
    for (int id = 0; id < B_COUNT; ++id) {
        if (lowerName == BINDINGS[id].name) return id;
    }
    return -1;
}

const BindingSpec& bindingSpec(int id) { return BINDINGS[id]; }

BindingValue callBinding(int id, const std::vector<BindingValue>& args, BindingContext& context) {
    const std::string name = BINDINGS[id].name;
    auto text = [&](size_t index) -> const std::string& { return args[index].text; };
    auto number = [&](size_t index) { return args[index].number; };
    switch (id) {
        case B_STRING_LOWER: return textResult(lowerLatin1(text(0)));
        case B_STRING_UPPER: return textResult(upperLatin1(text(0)));
        case B_STRING_LENGTH: return numberResult(static_cast<double>(text(0).size()));
        case B_STRING_COMPARE: return numberResult(collateCompare(text(0), text(1)));
        case B_STRING_INDEX: {
            const size_t at = text(0).find(text(1));
            return numberResult(at == std::string::npos ? -1.0 : static_cast<double>(at));
        }
        case B_STRING_SLICE: {
            const double start = number(1);
            const double end = number(2);
            if (start < 0 || end < start) fail("Invalid string slice");
            const double length = static_cast<double>(text(0).size());
            const size_t from = static_cast<size_t>(std::min(start, length));
            const size_t to = static_cast<size_t>(std::min(end, length));
            return textResult(text(0).substr(from, to - from));
        }
        case B_COBOL_CHAR: {
            const double codePoint = number(0);
            if (!isSafeInteger(codePoint) || codePoint < 1 || codePoint > 0x110000) {
                fail("CHAR expects an integer ordinal from 1 through 1114112");
            }
            const double ordinal = codePoint - 1;
            return textResult(std::string(1, ordinal > 0xFF ? '?' : static_cast<char>(static_cast<int>(ordinal))));
        }
        case B_COBOL_ORD:
            if (text(0).empty()) fail("ORD expects non-empty text");
            return numberResult(static_cast<unsigned char>(text(0)[0]) + 1.0);
        case B_DATE_CURRENT: return textResult(currentCobolDate());
        case B_DATE_ACCEPT: return textResult(acceptedDateValue(text(0)));
        case B_ACOS: case B_ASIN: case B_ATAN: case B_COS: case B_SIN: case B_TAN:
        case B_LOG: case B_LOG10: case B_SQRT: case B_FLOOR: case B_TRUNC:
            return numberResult(finiteResult(name, unaryMath(id, number(0))));
        case B_FACTORIAL: {
            const double value = number(0);
            if (!isSafeInteger(value) || value < 0 || value > 170) {
                fail("host.math_factorial expects an integer from 0 through 170");
            }
            double result = 1;
            for (int factor = 2; factor <= static_cast<int>(value); ++factor) result *= factor;
            return numberResult(finiteResult(name, result));
        }
        case B_MOD: case B_REM: {
            const double dividend = number(0);
            const double divisor = number(1);
            if (divisor == 0) fail(name + " divisor must not be zero");
            const double remainder = std::fmod(dividend, divisor);
            return numberResult(finiteResult(name, id == B_MOD ? std::fmod(remainder + divisor, divisor) : remainder));
        }
        case B_MEAN: case B_MEDIAN: case B_MIDRANGE: case B_RANGE: case B_SUM: case B_VARIANCE:
        case B_STANDARD_DEVIATION:
            return numberResult(finiteResult(name, summary(id, numericValues(text(0), name))));
        case B_ORD_MAX: return numberResult(ordinalOfExtreme(numericValues(text(0), name), true));
        case B_ORD_MIN: return numberResult(ordinalOfExtreme(numericValues(text(0), name), false));
        case B_NUMVAL: return numberResult(parseCobolNumber(text(0), false, nullptr));
        case B_NUMVAL_C: return numberResult(parseCobolNumber(text(0), true, nullptr));
        case B_NUMVAL_C_CURRENCY: return numberResult(parseCobolNumber(text(0), true, &args[1].text));
        case B_INTEGER_OF_DATE: return numberResult(integerOfDate(number(0)));
        case B_DATE_OF_INTEGER: return numberResult(dateOfInteger(number(0)));
        case B_INTEGER_OF_DAY: return numberResult(integerOfDay(number(0)));
        case B_DAY_OF_INTEGER: return numberResult(dayOfInteger(number(0)));
        case B_ANNUITY: {
            const double rate = number(0);
            const double periods = number(1);
            if (periods <= 0) fail("ANNUITY expects a positive number of periods");
            const double result = rate == 0 ? 1 / periods : rate / (1 - std::pow(1 + rate, -periods));
            return numberResult(finiteResult(name, result));
        }
        case B_PRESENT_VALUE: {
            const std::vector<double> values = numericValues(text(0), name);
            const double discountRate = values.back();
            if (values.size() < 2 || 1 + discountRate <= 0) {
                fail("PRESENT-VALUE requires at least one payment and a discount rate greater than -1");
            }
            double total = 0;
            for (size_t index = 0; index + 1 < values.size(); ++index) {
                total += values[index] / std::pow(1 + discountRate, static_cast<double>(index + 1));
            }
            finiteResult(name, total);
            char buffer[40];
            std::snprintf(buffer, sizeof buffer, "%.14e", total);
            return numberResult(std::strtod(buffer, nullptr));
        }
        case B_RANDOM: return numberResult(context.random ? context.random() : std::rand() / (RAND_MAX + 1.0));
        case B_RANDOM_SEEDED: return numberResult(seededRandom(number(0)));
        case B_ISAM_OPEN: return numberResult(context.isam.open(text(0), text(1), text(2), text(3)));
        case B_ISAM_READ: return textResult(context.isam.read(handleOf(args[0]), text(1)));
        case B_ISAM_READ_ALT: return textResult(context.isam.readAlternate(handleOf(args[0]), text(1), text(2)));
        case B_ISAM_READ_NEXT: return textResult(context.isam.readNext(handleOf(args[0])));
        case B_ISAM_CURRENT_KEY: return textResult(context.isam.currentKey(handleOf(args[0])));
        case B_ISAM_COUNT: return numberResult(context.isam.count(handleOf(args[0])));
        case B_ISAM_START: return numberResult(context.isam.start(handleOf(args[0]), text(1), text(2)));
        case B_ISAM_WRITE: return numberResult(context.isam.write(handleOf(args[0]), text(1), text(2)));
        case B_ISAM_REWRITE: return numberResult(context.isam.rewrite(handleOf(args[0]), text(1), text(2)));
        case B_ISAM_DELETE: return numberResult(context.isam.remove(handleOf(args[0]), text(1)));
        case B_ISAM_STATUS: return textResult(context.isam.status(handleOf(args[0])));
        case B_ISAM_CLOSE: return numberResult(context.isam.close(handleOf(args[0]), false));
        case B_ISAM_CLOSE_LOCK: return numberResult(context.isam.close(handleOf(args[0]), true));
        default: fail("Invalid host binding call: " + name);
    }
}

}  // namespace detail
}  // namespace cobolvm
