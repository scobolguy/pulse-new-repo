#include "fortran_format.h"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>

namespace pmachine {
namespace {
    constexpr size_t EDIT_LIMIT = 4096;
    constexpr size_t RECORD_COUNT_LIMIT = 1024;
    bool fail(std::string& error, const std::string& detail) {
        error = "FORTRAN runtime error: " + detail;
        return false;
    }
    bool dataEdit(const std::string& kind) {
        return kind == "I" || kind == "F" || kind == "E" || kind == "D" || kind == "G" || kind == "L" || kind == "A";
    }
    std::string fit(std::string text, int width) {
        if (width < 0) return text;
        if (text.size() > static_cast<size_t>(width)) {
            const size_t start = !text.empty() && (text[0] == '-' || text[0] == '+') ? 1 : 0;
            if (text.compare(start, 2, "0.") == 0 && text.size() - 1 <= static_cast<size_t>(width)) text.erase(start, 1);
        }
        return text.size() > static_cast<size_t>(width) ? std::string(width, '*')
            : std::string(static_cast<size_t>(width) - text.size(), ' ') + text;
    }
    std::string decimal(double value, int digits, char kind) {
        // printf uses ties-to-even; the JS RTL uses ties away from zero.
        if (value != 0 && std::isfinite(value)) {
            const int magnitude = static_cast<int>(std::floor(std::log10(std::abs(value))));
            const int places = kind == 'e' ? digits - magnitude : kind == 'g' ? digits - magnitude - 1 : digits;
            bool halfway = false;
            if (places >= 0) {
                int exponent = 0;
                uint64_t mantissa = static_cast<uint64_t>(std::ldexp(std::frexp(std::abs(value), &exponent), 53));
                exponent -= 53;
                while (mantissa && !(mantissa & 1)) { mantissa >>= 1; ++exponent; }
                halfway = exponent + places == -1;
            } else if (places >= -22) {
                const double quantum = std::pow(10.0, -places);
                halfway = std::fmod(std::abs(value), quantum) == quantum / 2;
            }
            if (halfway) value = std::nextafter(value, std::copysign(std::numeric_limits<double>::infinity(), value));
        }
        const char* pattern = kind == 'e' ? "%.*e" : kind == 'g' ? "%.*g" : "%.*f";
        const int size = std::snprintf(nullptr, 0, pattern, digits, value);
        if (size < 0 || size > static_cast<int>(FORTRAN_RECORD_LIMIT)) return "";
        std::vector<char> buffer(static_cast<size_t>(size) + 1);
        std::snprintf(buffer.data(), buffer.size(), pattern, digits, value);
        return std::string(buffer.data(), static_cast<size_t>(size));
    }

    class Parser {
    public:
        Parser(const std::string& source, std::string& error) : source(source), error(error) {}
        bool parse(FortranFormatProgram& result) {
            if (source.size() > FORTRAN_RECORD_LIMIT) return bad("FORMAT text capacity exceeded");
            spaces();
            if (!take('(')) return bad("Run-time FORMAT must begin with '('");
            result = {};
            return list(result.edits, 0, &result.reversion);
        }
    private:
        const std::string& source;
        std::string& error;
        size_t cursor = 0;
        void spaces() { while (cursor < source.size() && std::isspace(static_cast<unsigned char>(source[cursor]))) ++cursor; }
        char peek() { spaces(); return cursor < source.size() ? static_cast<char>(std::toupper(static_cast<unsigned char>(source[cursor]))) : '\0'; }
        bool take(char c) { if (peek() != c) return false; ++cursor; return true; }
        bool bad(const std::string& detail) { return fail(error, "Invalid FORMAT: " + detail); }
        bool number(int& out, bool required) {
            out = 0;
            bool found = false;
            while (peek() >= '0' && peek() <= '9') {
                found = true;
                out = out * 10 + (source[cursor++] - '0');
                if (out > static_cast<int>(FORTRAN_RECORD_LIMIT)) return bad("numeric field capacity exceeded");
            }
            return found || !required ? true : bad("expected an unsigned integer");
        }
        bool append(std::vector<FortranFormatEdit>& out, const std::vector<FortranFormatEdit>& values, int count) {
            if (count < 1 || values.size() > EDIT_LIMIT || static_cast<size_t>(count) > EDIT_LIMIT
                || values.size() * static_cast<size_t>(count) > EDIT_LIMIT - out.size())
                return bad("expanded descriptor capacity exceeded");
            for (int i = 0; i < count; ++i) out.insert(out.end(), values.begin(), values.end());
            return true;
        }
        bool list(std::vector<FortranFormatEdit>& out, int depth, size_t* reversion) {
            if (depth >= 16) return bad("group nesting capacity exceeded");
            for (;;) {
                if (take(')')) return depth == 0 || !out.empty() ? true : bad("empty repeated group");
                if (take(',')) {
                    if (out.empty() || peek() == ',' || peek() == ')' || !peek()) return bad("misplaced comma");
                }
                if (!peek()) return bad("unbalanced parentheses");
                const bool signedNumber = peek() == '+' || peek() == '-';
                int sign = 1;
                if (signedNumber) { if (peek() == '-') sign = -1; ++cursor; }
                const bool hasNumber = peek() >= '0' && peek() <= '9';
                int repeat = 1;
                if (hasNumber && !number(repeat, true)) return false;
                const char kind = peek();
                if (signedNumber && kind != 'P') return bad("a signed prefix requires P");
                if (kind == '(') {
                    if (!repeat) return bad("zero repeat count");
                    ++cursor;
                    std::vector<FortranFormatEdit> group;
                    if (!list(group, depth + 1, nullptr)) return false;
                    if (reversion) *reversion = out.size();
                    if (!append(out, group, repeat)) return false;
                    continue;
                }
                FortranFormatEdit entry;
                if (kind == '\'' || kind == '"') {
                    if (hasNumber) return bad("a literal cannot have a repeat prefix");
                    const char quote = source[cursor++];
                    bool closed = false;
                    while (cursor < source.size()) {
                        const char c = source[cursor++];
                        if (c == quote) {
                            if (cursor < source.size() && source[cursor] == quote) ++cursor;
                            else { closed = true; break; }
                        }
                        entry.literal += c;
                    }
                    if (!closed) return bad("unterminated character literal");
                    entry.kind = "lit";
                } else if (kind == 'H' && hasNumber) {
                    ++cursor;
                    if (!repeat || static_cast<size_t>(repeat) > source.size() - cursor) return bad("H edit runs past the end of FORMAT");
                    entry.kind = "lit";
                    entry.literal = source.substr(cursor, static_cast<size_t>(repeat));
                    cursor += static_cast<size_t>(repeat);
                    repeat = 1;
                } else {
                    if (!kind) return bad("missing descriptor");
                    ++cursor;
                    entry.kind.assign(1, kind);
                    if (kind == 'P') { entry.amount = sign * (hasNumber ? repeat : 0); repeat = 1; if (!hasNumber) return bad("P requires a scale"); }
                    else if (kind == 'X') { if (!repeat) return bad("zero spacing"); entry.amount = repeat; repeat = 1; }
                    else if (kind == 'T') {
                        if (hasNumber) return bad("T cannot have a repeat prefix");
                        if (peek() == 'L' || peek() == 'R') { entry.kind += peek(); ++cursor; }
                        if (!number(entry.amount, true) || !entry.amount) return bad("invalid tab position");
                    } else if (kind == 'S' || kind == 'B') {
                        if (hasNumber) return bad("mode cannot have a repeat prefix");
                        if (kind == 'S' && (peek() == 'S' || peek() == 'P')) { entry.kind += peek(); ++cursor; }
                        else if (kind == 'B' && (peek() == 'N' || peek() == 'Z')) { entry.kind += peek(); ++cursor; }
                        else if (kind == 'B') return bad("unknown blank mode");
                    } else if (dataEdit(entry.kind)) {
                        if (!repeat) return bad("zero repeat count");
                        if (kind != 'A' || (peek() >= '0' && peek() <= '9')) {
                            if (!number(entry.width, true) || !entry.width) return bad("invalid field width");
                        }
                        if (kind == 'F' || kind == 'E' || kind == 'D' || kind == 'G' || (kind == 'I' && peek() == '.')) {
                            if (!take('.') || !number(entry.digits, true)) return bad("expected precision");
                            if (kind == 'I' && entry.digits > entry.width) return bad("Iw.m requires m <= w");
                        }
                        if ((kind == 'E' || kind == 'G') && take('E')) {
                            if (!number(entry.exponent, true) || !entry.exponent) return bad("invalid exponent width");
                        }
                    } else if (kind != '/' && kind != ':') return bad("unknown edit descriptor");
                    if (kind == ':' && hasNumber) return bad("colon cannot have a repeat prefix");
                }
                if (!append(out, {entry}, repeat)) return false;
            }
        }
    };

    bool fixed(double value, int width, int digits, int scale, bool plus, std::string& out, std::string& error) {
        if (width < 0 || digits < 0) return fail(error, "Invalid fixed field width or precision");
        const double x = value * std::pow(10.0, scale);
        if (!std::isfinite(x)) return fail(error, "Non-finite formatted REAL");
        std::string body = decimal(std::abs(x), digits, 'f');
        if (body.empty()) return fail(error, "Numeric field capacity exceeded");
        if (digits == 0) body += '.';
        out = fit((x < 0 ? "-" : plus ? "+" : "") + body, width);
        return true;
    }
    bool exponential(double x, const FortranFormatEdit& entry, int scale, bool plus, std::string& out, std::string& error) {
        const int digits = entry.digits;
        if (!(scale > -digits && scale < digits + 2)) return fail(error, "Scale factor is out of range for exponential edit");
        const int wanted = scale <= 0 ? digits + scale : digits + 1;
        std::string significant;
        int exponent = 0;
        if (x == 0) significant.assign(static_cast<size_t>(wanted), '0');
        else {
            const std::string scientific = decimal(std::abs(x), wanted - 1, 'e');
            const auto e = scientific.find('e');
            if (e == std::string::npos) return fail(error, "Non-finite formatted REAL");
            significant = scientific.substr(0, e);
            significant.erase(std::remove(significant.begin(), significant.end(), '.'), significant.end());
            exponent = std::atoi(scientific.c_str() + e + 1) + 1 - scale;
        }
        const std::string body = scale <= 0 ? "0." + std::string(static_cast<size_t>(-scale), '0') + significant
            : significant.substr(0, static_cast<size_t>(scale)) + "." + significant.substr(static_cast<size_t>(scale));
        const std::string magnitude = std::to_string(std::abs(exponent));
        std::string suffix;
        const char letter = entry.kind == "D" ? 'D' : 'E';
        if (entry.exponent) {
            if (magnitude.size() > static_cast<size_t>(entry.exponent)) { out.assign(entry.width, '*'); return true; }
            suffix = std::string(1, letter) + (exponent < 0 ? "-" : "+")
                + std::string(static_cast<size_t>(entry.exponent) - magnitude.size(), '0') + magnitude;
        } else if (std::abs(exponent) <= 99) suffix = std::string(1, letter) + (exponent < 0 ? "-" : "+")
            + std::string(2 - magnitude.size(), '0') + magnitude;
        else if (std::abs(exponent) <= 999) suffix = (exponent < 0 ? "-" : "+") + magnitude;
        else { out.assign(entry.width, '*'); return true; }
        out = fit((x < 0 ? "-" : plus ? "+" : "") + body + suffix, entry.width);
        return true;
    }
    bool editItem(const FortranFormatEdit& edit, const FortranFormatItem& item, int scale, bool plus,
                  std::string& out, std::string& error) {
        const std::string& kind = edit.kind;
        const double value = item.value.value.asReal();
        if ((kind == "A" && item.tag != 'C') || (kind == "L" && item.tag != 'L') || (kind == "I" && item.tag != 'I')
            || ((kind == "F" || kind == "E" || kind == "D" || kind == "G") && item.tag != 'R' && item.tag != 'D'))
            return fail(error, "FORMAT descriptor " + kind + " is incompatible with output item");
        if (kind == "A") {
            out = edit.width < 0 ? item.value.text : item.value.text.size() > static_cast<size_t>(edit.width)
                ? item.value.text.substr(0, static_cast<size_t>(edit.width)) : fit(item.value.text, edit.width);
        } else if (kind == "L") out = std::string(static_cast<size_t>(edit.width - 1), ' ') + (value ? "T" : "F");
        else if (kind == "I") {
            std::string digits = std::to_string(static_cast<int64_t>(std::abs(value)));
            if (edit.digits == 0 && value == 0) { out.assign(edit.width, ' '); return true; }
            if (edit.digits > static_cast<int>(digits.size())) digits.insert(0, static_cast<size_t>(edit.digits) - digits.size(), '0');
            out = fit((value < 0 ? "-" : plus ? "+" : "") + digits, edit.width);
        } else if (kind == "F") return fixed(value, edit.width, edit.digits, scale, plus, out, error);
        else if (kind == "G" && std::abs(value) >= 0.1 && std::abs(value) < std::pow(10.0, edit.digits)) {
            int k = 0;
            while (k <= edit.digits && !(std::abs(value) < std::pow(10.0, k))) ++k;
            const int blanks = edit.exponent ? edit.exponent + 2 : 4;
            if (!fixed(value, edit.width - blanks, edit.digits - k, 0, plus, out, error)) return false;
            out.append(static_cast<size_t>(blanks), ' ');
        } else return exponential(value, edit, scale, plus, out, error);
        return true;
    }
    std::string listReal(double value, bool wide) {
        const double x = wide ? value : std::strtod(decimal(value, 7, 'g').c_str(), nullptr);
        if (x == 0) return "0.";
        const int magnitude = static_cast<int>(std::floor(std::log10(std::abs(x))));
        std::string shortest;
        for (int precision = 1; precision <= 17; ++precision) {
            shortest = decimal(std::abs(x), precision, 'g');
            if (std::strtod(shortest.c_str(), nullptr) == std::abs(x)) break;
        }
        const auto e = shortest.find('e');
        std::string digits = shortest.substr(0, e);
        const auto dot = digits.find('.');
        int point = dot == std::string::npos ? static_cast<int>(digits.size()) : static_cast<int>(dot);
        if (dot != std::string::npos) digits.erase(dot, 1);
        if (e != std::string::npos) point += std::atoi(shortest.c_str() + e + 1);
        while (digits.size() > 1 && digits[0] == '0') { digits.erase(0, 1); --point; }
        while (digits.size() > 1 && digits.back() == '0') digits.pop_back();
        const std::string sign = x < 0 ? "-" : "";
        if (magnitude >= -1 && magnitude < (wide ? 16 : 7)) {
            if (point <= 0) return sign + "." + std::string(static_cast<size_t>(-point), '0') + digits;
            if (point >= static_cast<int>(digits.size())) return sign + digits + std::string(static_cast<size_t>(point) - digits.size(), '0') + ".";
            return sign + digits.substr(0, static_cast<size_t>(point)) + "." + digits.substr(static_cast<size_t>(point));
        }
        const std::string mantissa = sign + digits.substr(0, 1) + (digits.size() > 1 ? "." + digits.substr(1) : "");
        const int exponent = point - 1;
        const std::string power = std::to_string(std::abs(exponent));
        return mantissa + "E" + (exponent < 0 ? "-" : "+") + std::string(power.size() < 2 ? 2 - power.size() : 0, '0') + power;
    }
    bool validItem(const FortranFormatItem& item, std::string& error) {
        const auto numeric = [](const FortranScalar& value) {
            return !value.isString() && (value.value.isReal() || value.value.kind == ValueKind::Integer
                || value.value.kind == ValueKind::Boolean) && std::isfinite(value.value.asReal());
        };
        if (item.tag == 'C') return item.value.isString() && item.value.text.size() <= FORTRAN_RECORD_LIMIT
            ? true : fail(error, "Invalid CHARACTER output item");
        if (std::string("IRDLZ").find(item.tag) == std::string::npos || !numeric(item.value)
            || (item.tag == 'Z' && !numeric(item.imaginary))) return fail(error, "Invalid numeric output item");
        if (item.tag == 'I' && (item.value.value.asReal() < -2147483648.0 || item.value.value.asReal() > 2147483647.0
            || item.value.value.asReal() != std::trunc(item.value.value.asReal()))) return fail(error, "Invalid INTEGER output item");
        return true;
    }
    bool encodeUnformatted(const std::vector<FortranFormatItem>& items, std::string& record, std::string& error) {
        record.clear();
        const char* hex = "0123456789ABCDEF";
        for (const auto& item : items) {
            std::string field(1, item.tag);
            field += ':';
            if (item.tag == 'C') for (unsigned char c : item.value.text) { field += hex[c >> 4]; field += hex[c & 15]; }
            else {
                field += decimal(item.value.value.asReal(), 17, 'g');
                if (item.tag == 'Z') field += ',' + decimal(item.imaginary.value.asReal(), 17, 'g');
            }
            field += ';';
            if (field.size() > FORTRAN_RECORD_LIMIT - record.size()) return fail(error, "Unformatted record capacity exceeded");
            record += field;
        }
        return true;
    }
    bool decodeUnformatted(const std::string& record, std::vector<FortranFormatItem>& items, std::string& error) {
        items.clear();
        size_t start = 0;
        while (start < record.size()) {
            const auto end = record.find(';', start);
            if (end == std::string::npos || end < start + 2 || record[start + 1] != ':' || items.size() >= FORTRAN_ITEM_LIMIT)
                return fail(error, "Invalid unformatted record");
            FortranFormatItem item;
            item.tag = record[start];
            const std::string field = record.substr(start + 2, end - start - 2);
            if (item.tag == 'C') {
                if (field.size() % 2) return fail(error, "Invalid unformatted CHARACTER");
                std::string text;
                const auto nibble = [](char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1; };
                for (size_t index = 0; index < field.size(); index += 2) {
                    const int high = nibble(field[index]), low = nibble(field[index + 1]);
                    if (high < 0 || low < 0) return fail(error, "Invalid unformatted CHARACTER");
                    text += static_cast<char>((high << 4) | low);
                }
                item.value = FortranScalar(text);
            } else {
                const auto number = [&](const std::string& text, FortranScalar& value) {
                    if (text.empty()) return fail(error, "Invalid unformatted number");
                    char* tail = nullptr;
                    const double x = std::strtod(text.c_str(), &tail);
                    if (!tail || *tail || !std::isfinite(x)) return fail(error, "Invalid unformatted number");
                    if (item.tag == 'I' || item.tag == 'L') {
                        if (x != std::trunc(x) || x < -2147483648.0 || x > 2147483647.0) return fail(error, "Invalid unformatted INTEGER");
                        value = FortranScalar(Value(static_cast<int>(x)));
                    } else value = FortranScalar(item.tag == 'D' ? Value::makeDouble(x) : Value::makeReal(x));
                    return true;
                };
                const auto comma = field.find(',');
                if (item.tag == 'Z') {
                    if (comma == std::string::npos || !number(field.substr(0, comma), item.value)
                        || !number(field.substr(comma + 1), item.imaginary)) return fail(error, "Invalid unformatted COMPLEX");
                } else if (!number(field, item.value)) return false;
            }
            if (!validItem(item, error)) return false;
            items.push_back(std::move(item));
            start = end + 1;
        }
        return true;
    }
}

bool parseFortranFormat(const std::string& text, FortranFormatProgram& program, std::string& error) {
    error.clear();
    FortranFormatProgram candidate;
    if (!Parser(text, error).parse(candidate)) { program = {}; return false; }
    program = std::move(candidate);
    return true;
}

bool renderFortranFormat(const std::string& format, const std::vector<FortranFormatItem>& items,
                        std::vector<std::string>& records, std::string& error) {
    records.clear();
    error.clear();
    if (items.size() > FORTRAN_ITEM_LIMIT) return fail(error, "Output item capacity exceeded");
    for (const auto& item : items) if (!validItem(item, error)) return false;
    std::vector<std::string> pending;
    std::string record;
    size_t position = 0, total = 0;
    const auto finish = [&]() {
        if (pending.size() >= RECORD_COUNT_LIMIT || record.size() > FORTRAN_TRANSFER_LIMIT - total)
            return fail(error, "Formatted transfer capacity exceeded");
        total += record.size();
        pending.push_back(record);
        record.clear();
        position = 0;
        return true;
    };
    const auto put = [&](const std::string& text) {
        if (position > FORTRAN_RECORD_LIMIT || text.size() > FORTRAN_RECORD_LIMIT - position)
            return fail(error, "Formatted record capacity exceeded");
        if (!text.empty()) {
            if (record.size() < position + text.size()) record.resize(position + text.size(), ' ');
            record.replace(position, text.size(), text);
            position += text.size();
        }
        return true;
    };
    if (format == "*") {
        record = " ";
        for (size_t index = 0; index < items.size(); ++index) {
            const auto& item = items[index];
            std::string text = index && !(item.tag == 'C' && items[index - 1].tag == 'C') ? " " : "";
            const double x = item.value.value.asReal();
            if (item.tag == 'C') text += item.value.text;
            else if (item.tag == 'L') text += x ? "T" : "F";
            else if (item.tag == 'I') text += std::to_string(static_cast<int32_t>(x));
            else if (item.tag == 'Z') text += "(" + listReal(x, false) + "," + listReal(item.imaginary.value.asReal(), false) + ")";
            else text += listReal(x, item.tag == 'D');
            for (char c : text) {
                if (record.size() == 79) { if (!finish()) return false; record = " "; }
                record += c;
            }
        }
        if (!finish()) return false;
        records = std::move(pending);
        return true;
    }
    FortranFormatProgram program;
    if (!parseFortranFormat(format, program, error)) return false;
    std::vector<FortranFormatItem> flat;
    for (const auto& item : items) {
        if (item.tag == 'Z') {
            flat.push_back({'R', item.value, {}});
            flat.push_back({'R', item.imaginary, {}});
        } else flat.push_back(item);
    }
    size_t next = 0, start = 0;
    int scale = 0;
    bool plus = false;
    for (;;) {
        bool consumed = false, done = false;
        for (size_t index = start; index < program.edits.size(); ++index) {
            const auto& entry = program.edits[index];
            if (dataEdit(entry.kind)) {
                if (next == flat.size()) { done = true; break; }
                std::string field;
                if (!editItem(entry, flat[next++], scale, plus, field, error) || !put(field)) return false;
                consumed = true;
            } else if (entry.kind == ":" && next == flat.size()) { done = true; break; }
            else if (entry.kind == "/") { if (!finish()) return false; }
            else if (entry.kind == "lit") { if (!put(entry.literal)) return false; }
            else if (entry.kind == "X" || entry.kind == "TR") {
                if (static_cast<size_t>(entry.amount) > FORTRAN_RECORD_LIMIT - position) return fail(error, "Tab exceeds record capacity");
                position += static_cast<size_t>(entry.amount);
            } else if (entry.kind == "TL") position = position > static_cast<size_t>(entry.amount) ? position - entry.amount : 0;
            else if (entry.kind == "T") position = static_cast<size_t>(entry.amount - 1);
            else if (entry.kind == "P") scale = entry.amount;
            else if (entry.kind == "SP") plus = true;
            else if (entry.kind == "S" || entry.kind == "SS") plus = false;
        }
        if (!finish()) return false;
        if (done || next == flat.size()) break;
        if (!consumed && start == program.reversion) return fail(error, "FORMAT has no data descriptor for remaining output");
        start = program.reversion;
    }
    records = std::move(pending);
    return true;
}

bool FortranFormatReader::supply(std::string& error) {
    if (!source) { eof = true; return fail(error, "End of file"); }
    std::string row;
    const int status = source(row, error);
    if (status) { eof = status < 0; return false; }
    size_t bytes = row.size();
    for (const auto& previous : records) bytes += previous.size();
    if (row.size() > FORTRAN_RECORD_LIMIT || records.size() >= RECORD_COUNT_LIMIT || bytes > FORTRAN_TRANSFER_LIMIT)
        return fail(error, "Input transfer capacity exceeded");
    records.push_back(std::move(row));
    return true;
}

bool FortranFormatReader::advance(std::string& error) {
    ++record;
    position = 0;
    if (record >= records.size()) return supply(error);
    return true;
}

bool FortranFormatReader::begin(const std::string& format, const std::vector<std::string>& input, bool zeros,
                               std::string& error, RecordSource nextRecord) {
    source = std::move(nextRecord);
    records.clear();
    record = position = edit = 0;
    scale = 0;
    blankZero = zeros;
    eof = false;
    list = format == "*";
    nullValue = terminated = false;
    repeats = 0;
    repeated.clear();
    error.clear();
    if (!list && !parseFortranFormat(format, program, error)) return false;
    size_t total = 0;
    if (input.size() > RECORD_COUNT_LIMIT) return fail(error, "Input record capacity exceeded");
    for (const auto& row : input) {
        if (row.size() > FORTRAN_RECORD_LIMIT || row.size() > FORTRAN_TRANSFER_LIMIT - total)
            return fail(error, "Input transfer capacity exceeded");
        total += row.size();
    }
    records = input;
    if (records.empty()) return supply(error);
    return true;
}

bool FortranFormatReader::token(std::string& text, std::string& error) {
    nullValue = false;
    if (repeats) { --repeats; text = repeated; nullValue = text.empty(); return true; }
    if (terminated) { text.clear(); nullValue = true; return true; }
    for (;;) {
        while (position < records[record].size() && std::isspace(static_cast<unsigned char>(records[record][position]))) ++position;
        if (position < records[record].size()) break;
        if (!advance(error)) return false;
    }
    const auto& row = records[record];
    if (row[position] == '/') { terminated = nullValue = true; text.clear(); return true; }
    if (row[position] == ',') { ++position; nullValue = true; text.clear(); return true; }
    text.clear();
    char quote = 0;
    int depth = 0;
    for (;;) {
        if (position == records[record].size()) {
            if (!quote && !depth) break;
            if (!advance(error)) return false;
            continue;
        }
        const char c = records[record][position];
        if (!quote && !depth && (std::isspace(static_cast<unsigned char>(c)) || c == ',' || c == '/')) break;
        text += c;
        ++position;
        if (quote) {
            if (c == quote) {
                if (position < records[record].size() && records[record][position] == quote) { text += quote; ++position; }
                else quote = 0;
            }
        } else if (c == '\'' || c == '"') quote = c;
        else if (c == '(') ++depth;
        else if (c == ')') --depth;
        if (text.size() > FORTRAN_RECORD_LIMIT || depth < 0) return fail(error, "Invalid list-directed value");
    }
    while (position < records[record].size() && std::isspace(static_cast<unsigned char>(records[record][position]))) ++position;
    if (position < records[record].size() && records[record][position] == ',') ++position;
    const auto star = text.find('*');
    if (star != std::string::npos && star > 0 && text.find_first_not_of("0123456789") == star) {
        const unsigned long count = std::strtoul(text.c_str(), nullptr, 10);
        if (count < 1 || count > 100000) return fail(error, "Invalid list-directed repetition");
        text = text.substr(star + 1);
        repeated = text;
        repeats = static_cast<size_t>(count - 1);
    }
    nullValue = text.empty();
    return true;
}

bool FortranFormatReader::readComplex(FortranScalar& real, FortranScalar& imaginary, std::string& error) {
    std::string field;
    if (!token(field, error)) return false;
    if (nullValue) { real = imaginary = FortranScalar(Value::makeReal(0)); return true; }
    if (field.size() < 5 || field.front() != '(' || field.back() != ')') return fail(error, "Invalid COMPLEX input");
    const auto comma = field.find(',');
    if (comma == std::string::npos) return fail(error, "Invalid COMPLEX input");
    FortranFormatReader part;
    if (!part.begin("*", {field.substr(1, comma - 1)}, false, error) || !part.read('R', 0, real, error)) return false;
    if (!part.begin("*", {field.substr(comma + 1, field.size() - comma - 2)}, false, error)
        || !part.read('R', 0, imaginary, error)) return false;
    return true;
}

bool FortranFormatReader::read(char tag, size_t length, FortranScalar& result, std::string& error) {
    error.clear();
    if (length > FORTRAN_RECORD_LIMIT) return fail(error, "CHARACTER input capacity exceeded");
    if (record >= records.size()) { eof = true; return fail(error, "End of file"); }
    bool reverted = false;
    FortranFormatEdit entry;
    std::string field;
    nullValue = false;
    if (list) {
        if (!token(field, error)) return false;
        if (nullValue) { result = FortranScalar(Value(0)); return true; }
        entry.kind = tag == 'I' ? "I" : tag == 'C' ? "A" : tag == 'L' ? "L" : "F";
        entry.digits = 0;
    } else for (;;) {
        if (edit == program.edits.size()) {
            if (reverted) return fail(error, "Input FORMAT has no data descriptor");
            edit = program.reversion;
            if (!advance(error)) return false;
            reverted = true;
            continue;
        }
        entry = program.edits[edit++];
        if (dataEdit(entry.kind)) break;
        if (entry.kind == "/") { if (!advance(error)) return false; }
        else if (entry.kind == "lit") return fail(error, "Character literal is not allowed in an input FORMAT");
        else if (entry.kind == "X" || entry.kind == "TR") {
            if (static_cast<size_t>(entry.amount) > FORTRAN_RECORD_LIMIT - position) return fail(error, "Tab exceeds record capacity");
            position += static_cast<size_t>(entry.amount);
        } else if (entry.kind == "T") position = static_cast<size_t>(entry.amount - 1);
        else if (entry.kind == "TL") position = position > static_cast<size_t>(entry.amount) ? position - entry.amount : 0;
        else if (entry.kind == "P") scale = entry.amount;
        else if (entry.kind == "BN") blankZero = false;
        else if (entry.kind == "BZ") blankZero = true;
    }
    if (!list) {
        const size_t width = entry.width < 0 ? length : static_cast<size_t>(entry.width);
        if (width > FORTRAN_RECORD_LIMIT - position) return fail(error, "Input field exceeds record capacity");
        field = position < records[record].size() ? records[record].substr(position, width) : "";
        field.resize(width, ' ');
        position += width;
    }
    if (tag == 'C') {
        if (entry.kind != "A") return fail(error, "CHARACTER input requires an A descriptor");
        if (list && !field.empty() && (field.front() == '\'' || field.front() == '"')) {
            const char quote = field.front();
            if (field.size() < 2 || field.back() != quote) return fail(error, "Unterminated CHARACTER input");
            field = field.substr(1, field.size() - 2);
            for (size_t index = 0; index + 1 < field.size(); ++index)
                if (field[index] == quote && field[index + 1] == quote) field.erase(index, 1);
        }
        if (!list && field.size() > length) field = field.substr(field.size() - length);
        field.resize(length, ' ');
        result = FortranScalar(field);
        return true;
    }
    if (tag == 'L') {
        if (entry.kind != "L") return fail(error, "LOGICAL input requires an L descriptor");
        const auto start = field.find_first_not_of(' ');
        size_t index = start == std::string::npos ? field.size() : start;
        if (index < field.size() && field[index] == '.') ++index;
        if (index == field.size() || (std::toupper(static_cast<unsigned char>(field[index])) != 'T'
            && std::toupper(static_cast<unsigned char>(field[index])) != 'F')) return fail(error, "Invalid LOGICAL input");
        result = FortranScalar(Value(std::toupper(static_cast<unsigned char>(field[index])) == 'T' ? 1 : 0));
        return true;
    }
    if ((tag == 'I' && entry.kind != "I") || ((tag == 'R' || tag == 'D') && entry.kind != "F"
        && entry.kind != "E" && entry.kind != "D" && entry.kind != "G") || (tag != 'I' && tag != 'R' && tag != 'D'))
        return fail(error, "Input descriptor is incompatible with value type");
    const auto first = field.find_first_not_of(' '), last = field.find_last_not_of(' ');
    std::string number = first == std::string::npos ? "" : field.substr(first, last - first + 1);
    if (blankZero) std::replace(number.begin(), number.end(), ' ', '0');
    else number.erase(std::remove(number.begin(), number.end(), ' '), number.end());
    for (char& c : number) if (c == 'd' || c == 'D') c = 'E';
    if (number.find_first_of("eE") == std::string::npos) {
        const auto sign = number.find_first_of("+-", 1);
        if (sign != std::string::npos) number.insert(sign, "E");
    }
    const auto exponent = number.find_first_of("eE");
    const std::string mantissa = number.substr(0, exponent);
    bool hasDigit = false, dot = false;
    size_t index = !mantissa.empty() && (mantissa[0] == '-' || mantissa[0] == '+') ? 1 : 0;
    for (; index < mantissa.size(); ++index) {
        const char c = mantissa[index];
        if (c >= '0' && c <= '9') hasDigit = true;
        else if (c == '.' && !dot) dot = true;
        else return fail(error, "Invalid numeric input");
    }
    if (exponent != std::string::npos) {
        size_t digit = exponent + 1;
        if (digit < number.size() && (number[digit] == '+' || number[digit] == '-')) ++digit;
        if (digit == number.size()) return fail(error, "Invalid numeric exponent");
        for (; digit < number.size(); ++digit) if (number[digit] < '0' || number[digit] > '9') return fail(error, "Invalid numeric exponent");
    }
    double value = 0;
    if (hasDigit) {
        char* end = nullptr;
        value = std::strtod(number.c_str(), &end);
        if (!end || *end) return fail(error, "Invalid numeric input");
    }
    if (tag != 'I') {
        if (!dot) value *= std::pow(10.0, -entry.digits);
        if (!list && exponent == std::string::npos) value *= std::pow(10.0, -scale);
    }
    if (!std::isfinite(value)) return fail(error, "Numeric input out of range");
    if (tag == 'I') {
        if (value != std::trunc(value) || value < -2147483648.0 || value > 2147483647.0) return fail(error, "INTEGER input out of range");
        result = FortranScalar(Value(static_cast<int>(value)));
    } else result = FortranScalar(tag == 'D' ? Value::makeDouble(value) : Value::makeReal(value));
    return true;
}

bool FortranFormatRuntime::execute(const std::string& symbol, const std::vector<FortranScalar>& args,
                                  std::vector<FortranScalar>& results, std::vector<std::string>& emitted, std::string& error) {
    results.clear();
    emitted.clear();
    error.clear();
    const std::string op = symbol.compare(0, 8, "fortran.") == 0 ? symbol.substr(8) : "";
    const int arity = op == "begin" || op == "iobegin" || op == "write" || op == "iostatus"
        || op == "readbegin" || op == "readend" || op == "readpresent" || op == "open" || op == "close"
        || op == "rewind" || op == "backspace" || op == "endfile" || op == "inquire" ? 0
        : op == "print" || op == "format" || op == "internalrecord" || op == "outputunit" || op == "inquiry" ? 1
        : op == "item" || op == "complexitem" || op == "iocontrol" || op == "readvalue" ? 2 : -1;
    if (arity < 0) return executeFortranNumeric(symbol, args, results, error);
    if (args.size() != static_cast<size_t>(arity)) return fail(error, "Invalid argument count for " + symbol);
    const auto push = [&](Value value) { results.emplace_back(value); return true; };
    const auto text = [&](const std::string& value) { results.emplace_back(value); return true; };
    const auto control = [&](const std::string& key) -> const FortranScalar* {
        const auto found = controls.find(key);
        return found == controls.end() ? nullptr : &found->second;
    };
    const auto number = [&](const std::string& key, int fallback) {
        const auto value = control(key);
        return value && !value->isString() ? static_cast<int>(value->value) : fallback;
    };
    const auto ioError = [&](int status) {
        ioStatus = status;
        if (control("IOSTAT") || (status < 0 ? control("END") : control("ERR"))) { error.clear(); return true; }
        return false;
    };
    const auto emptyRead = [&]() {
        if (args[0].text == "Z") { push(Value::makeReal(0)); return push(Value::makeReal(0)); }
        if (args[0].text == "C") return text(std::string(static_cast<size_t>(args[1].value), ' '));
        return push(args[0].text == "D" ? Value::makeDouble(0) : args[0].text == "R" ? Value::makeReal(0) : Value(0));
    };
    if (op == "iobegin") {
        controls.clear();
        ioStatus = 0;
        reading = collecting = false;
        inputUnit = nullptr;
        inputItems.clear();
        inputItem = 0;
        nullRead = unformattedRead = false;
        items.clear();
        itemBytes = 0;
        outputRecords.clear();
        return true;
    }
    if (op == "iocontrol") {
        if (!args[0].isString() || args[0].text.size() > 32 || controls.size() >= 16
            || (args[1].isString() && args[1].text.size() > FORTRAN_TRANSFER_LIMIT))
            return fail(error, "Invalid I/O control or capacity exceeded");
        if (!args[1].isString() && (args[1].value.isReal() || args[1].value.kind != ValueKind::Integer))
            return fail(error, "I/O control requires an INTEGER or CHARACTER value");
        size_t bytes = args[0].text.size() + args[1].text.size();
        if (bytes > FORTRAN_TRANSFER_LIMIT) return fail(error, "I/O control capacity exceeded");
        for (const auto& entry : controls) if (entry.first != args[0].text) {
            const size_t length = entry.second.managedString && strings ? strings->size(entry.second.value.handle) : entry.second.text.size();
            if (entry.first.size() + length > FORTRAN_TRANSFER_LIMIT - bytes)
                return fail(error, "I/O control capacity exceeded");
            bytes += entry.first.size() + length;
        }
        FortranScalar retained = args[1];
        retained.managedString = false;
        if (args[0].text == "FMT" && strings && retained.isString()) {
            if (retained.text.size() > FORTRAN_RECORD_LIMIT) return fail(error, "FORMAT text capacity exceeded");
            const uint16_t handle = args[1].managedString ? retained.value.handle
                : strings->store(retained.text.data(), retained.text.size());
            if (handle == ManagedHeap<256>::INVALID || !strings->valid(handle))
                return fail(error, strings->error() ? strings->error() : "Invalid managed FORMAT handle");
            retained.value = Value::makeString(handle);
            retained.managedString = true;
            std::string().swap(retained.text);
        }
        controls[args[0].text] = std::move(retained);
        return true;
    }
    if (op == "iostatus") return push(Value(ioStatus));
    if (op == "open" || op == "close" || op == "rewind" || op == "backspace" || op == "endfile" || op == "inquire") {
        if (ioStatus) return true;
        return files.auxiliary(op, controls, error) || ioError(1);
    }
    if (op == "inquiry") {
        if (!args[0].isString()) return fail(error, "Invalid INQUIRE property");
        const auto found = files.inquiry().find(args[0].text);
        if (found == files.inquiry().end()) return fail(error, "Unknown INQUIRE property");
        results.push_back(found->second);
        return true;
    }
    if (op == "readpresent") return push(Value(reading && !nullRead && ioStatus == 0 ? 1 : 0));
    if (op == "readvalue") {
        if (!args[0].isString() || args[0].text.size() != 1 || std::string("IRDLCZ").find(args[0].text[0]) == std::string::npos
            || args[1].isString() || args[1].value.kind != ValueKind::Integer
            || args[1].value.i < 0 || args[1].value.i > static_cast<int>(FORTRAN_RECORD_LIMIT))
            return fail(error, "Invalid READ type or CHARACTER length");
        if (ioStatus) return emptyRead();
        if (!reading) return fail(error, "READ value outside a READ statement");
        nullRead = false;
        if (unformattedRead) {
            if (inputItem >= inputItems.size() || inputItems[inputItem].tag != args[0].text[0]) {
                fail(error, "Unformatted record type mismatch or record is too short");
                if (!ioError(1)) return false;
                return emptyRead();
            }
            const auto& item = inputItems[inputItem++];
            if (item.tag == 'C') {
                std::string value = item.value.text;
                value.resize(static_cast<size_t>(args[1].value.i), ' ');
                return text(value);
            }
            results.push_back(item.value);
            if (item.tag == 'Z') results.push_back(item.imaginary);
            return true;
        }
        const bool complex = args[0].text == "Z";
        const char tag = complex ? 'R' : args[0].text[0];
        std::vector<FortranScalar> values;
        if (complex && reader.listDirected()) {
            FortranScalar real, imaginary;
            if (!reader.readComplex(real, imaginary, error)) {
                if (inputUnit) inputUnit->cursor = inputStart + reader.consumed();
                if (!ioError(reader.status())) return false;
                return emptyRead();
            }
            values = {real, imaginary};
            nullRead = !reader.present();
            if (inputUnit) inputUnit->cursor = inputStart + reader.consumed();
        } else
        for (int index = 0; index < (complex ? 2 : 1); ++index) {
            FortranScalar value;
            if (!reader.read(tag, static_cast<size_t>(args[1].value.i), value, error)) {
                if (inputUnit) inputUnit->cursor = inputStart + reader.consumed();
                if (!ioError(reader.status())) return false;
                return emptyRead();
            }
            nullRead = !reader.present();
            if (inputUnit) inputUnit->cursor = inputStart + reader.consumed();
            values.push_back(std::move(value));
        }
        results = std::move(values);
        return true;
    }
    if (op == "readend") { reading = false; inputUnit = nullptr; return true; }
    if (op == "internalrecord") {
        if (args[0].isString() || args[0].value.kind != ValueKind::Integer || args[0].value.i < 0)
            return fail(error, "Invalid internal record index");
        const auto index = static_cast<size_t>(args[0].value.i);
        return text(index < outputRecords.size() ? outputRecords[index] : "");
    }
    if (op == "begin") { items.clear(); itemBytes = 0; collecting = true; return true; }
    if (op == "item" || op == "complexitem") {
        if (!collecting) return fail(error, "Output item outside a WRITE statement");
        FortranFormatItem item;
        item.value = args[0];
        if (op == "complexitem") { item.tag = 'Z'; item.imaginary = args[1]; }
        else {
            if (!args[1].isString() || args[1].text.size() != 1) return fail(error, "Invalid output item tag");
            item.tag = args[1].text[0];
        }
        if (!validItem(item, error)) return false;
        if (items.size() >= FORTRAN_ITEM_LIMIT || item.value.text.size() > FORTRAN_TRANSFER_LIMIT - itemBytes)
            return fail(error, "Output item capacity exceeded");
        itemBytes += item.value.text.size();
        items.push_back(std::move(item));
        return true;
    }
    if (op == "outputunit") {
        if (args[0].isString() || args[0].value.kind != ValueKind::Integer || args[0].value.i != 6)
            return fail(error, "External output requires preconnected unit 6");
        return true;
    }
    const auto formatText = [&](const FortranScalar& format, std::string& text) {
        if (!format.isString()) return fail(error, "FORMAT requires a CHARACTER value");
        if (!format.managedString) { text = format.text; return true; }
        if (!strings) return fail(error, "Managed FORMAT heap is unavailable");
        const char* data = strings->data(format.value.handle);
        if (!data) return fail(error, strings->error() ? strings->error() : "Invalid managed FORMAT handle");
        text.assign(data, strings->size(format.value.handle));
        return true;
    };
    if (op == "readbegin") {
        if (ioStatus) return true;
        const auto internal = control("INTERNAL"), format = control("FMT");
        std::vector<std::string> rows;
        FortranFormatReader::RecordSource source;
        bool blankZero = false;
        if (internal) {
            if (!internal->isString()) { fail(error, "Internal file requires CHARACTER"); return ioError(1); }
            size_t start = 0;
            while (start < internal->text.size()) {
                const auto newline = internal->text.find('\n', start);
                rows.push_back(internal->text.substr(start, newline == std::string::npos ? newline : newline - start));
                if (rows.size() > RECORD_COUNT_LIMIT) { fail(error, "Input record capacity exceeded"); return ioError(1); }
                if (newline == std::string::npos) break;
                start = newline + 1;
            }
        } else {
            inputUnit = files.connect(controls, true, error);
            if (!inputUnit) return ioError(1);
            if (inputUnit->formatted != (format != nullptr)) { fail(error, "READ FORM does not match format"); return ioError(1); }
            inputStart = inputUnit->cursor;
            if (inputUnit->preconnected && inputUnit->name == "fort.5") {
                size_t next = inputStart;
                source = [this, next](std::string& row, std::string& failure) mutable {
                    const int status = files.inputRecord(*inputUnit, next, row, failure);
                    if (!status) ++next;
                    return status;
                };
            } else {
            if (inputStart >= inputUnit->rows.size() || inputStart >= inputUnit->end) {
                fail(error, "End of file"); return ioError(-1);
            }
            if (!inputUnit->formatted) {
                unformattedRead = true;
                inputItem = 0;
                if (!decodeUnformatted(inputUnit->rows[inputUnit->cursor++], inputItems, error)) return ioError(1);
                reading = true;
                return true;
            }
            const size_t end = inputUnit->direct ? inputStart + 1 : std::min(inputUnit->rows.size(), inputUnit->end);
            rows.assign(inputUnit->rows.begin() + inputStart, inputUnit->rows.begin() + end);
            }
            blankZero = inputUnit->blankZero;
        }
        std::string specification;
        if (!format) { fail(error, "Internal formatted READ requires FMT"); return ioError(1); }
        if (!formatText(*format, specification)) return ioError(1);
        if (!reader.begin(specification, rows, blankZero, error, std::move(source))) return ioError(reader.status());
        if (inputUnit) inputUnit->cursor = inputStart + reader.consumed();
        reading = true;
        return true;
    }
    const bool write = op == "write";
    if (write && ioStatus) return true;
    const auto format = write ? control("FMT") : &args[0];
    if ((!format && !write) || (format && !format->isString())) {
        fail(error, "Formatted output requires a CHARACTER format");
        return write ? ioError(1) : false;
    }
    std::vector<std::string> rows;
    std::string specification;
    bool rendered;
    if (format) {
        if (!formatText(*format, specification)) return write ? ioError(1) : false;
        rendered = renderFortranFormat(specification, items, rows, error);
    } else {
        std::string record;
        rendered = encodeUnformatted(items, record, error);
        if (rendered) rows.push_back(std::move(record));
    }
    items.clear();
    itemBytes = 0;
    collecting = false;
    if (!rendered) return write ? ioError(1) : false;
    if (op == "format") {
        if (rows.size() > 1) return fail(error, "Internal file overflow");
        return text(rows.empty() ? "" : rows[0]);
    }
    if (write && control("INTERNAL")) {
        if (!format) { fail(error, "Internal WRITE requires a format"); return ioError(1); }
        const int recl = number("RECL", 0), count = number("RECORDS", 1);
        if (recl < 0 || recl > static_cast<int>(FORTRAN_RECORD_LIMIT) || count < 1 || rows.size() > static_cast<size_t>(count)) {
            fail(error, "Internal file overflow or invalid record capacity");
            return ioError(1);
        }
        for (const auto& row : rows) if (row.size() > static_cast<size_t>(recl)) {
            fail(error, "Output record exceeds RECL");
            return ioError(1);
        }
        outputRecords = std::move(rows);
        return true;
    }
    if (write && number("UNIT", -1) != 6) {
        auto* file = files.connect(controls, true, error);
        if (!file) return ioError(1);
        if (file->formatted != (format != nullptr)) { fail(error, "WRITE FORM does not match format"); return ioError(1); }
        return files.write(*file, rows, error) || ioError(1);
    }
    if (!format) { fail(error, "Console WRITE requires a format"); return write ? ioError(1) : false; }
    emitted = std::move(rows);
    return true;
}
}
