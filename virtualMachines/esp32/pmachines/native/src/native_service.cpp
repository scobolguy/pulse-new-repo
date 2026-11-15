#include "native_service.hpp"
#include "../../arduino/src/byte_buffer.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <cctype>
#include <cmath>
#include <cstring>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <istream>
#include <limits>
#include <map>
#include <optional>
#include <ostream>
#include <sstream>
#include <set>
#include <stdexcept>
#include <regex>
#include <chrono>
#include <ctime>
#include <variant>
#include <vector>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <fcntl.h>
#include <io.h>
#include <sys/stat.h>
#include <windows.h>
#else
#include <fcntl.h>
#include <netdb.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace pulse::native {
namespace {

struct JsonValue {
    using Array = std::vector<JsonValue>;
    using Object = std::map<std::string, JsonValue>;
    std::variant<std::nullptr_t, bool, double, std::string, Array, Object> value;
};

class JsonParser {
public:
    explicit JsonParser(const std::string& input) : input_(input) {}

    JsonValue parse() {
        auto value = parseValue();
        whitespace();
        if (position_ != input_.size()) fail("Unexpected trailing JSON data");
        return value;
    }

private:
    const std::string& input_;
    size_t position_ = 0;

    [[noreturn]] void fail(const char* message) const {
        throw std::runtime_error(std::string(message) + " at JSON offset " + std::to_string(position_));
    }

    void whitespace() {
        while (position_ < input_.size() &&
               (input_[position_] == ' ' || input_[position_] == '\t' ||
                input_[position_] == '\r' || input_[position_] == '\n')) ++position_;
    }

    bool consume(char expected) {
        whitespace();
        if (position_ < input_.size() && input_[position_] == expected) {
            ++position_;
            return true;
        }
        return false;
    }

    static void appendUtf8(std::string& result, uint32_t codePoint) {
        if (codePoint <= 0x7f) result.push_back(static_cast<char>(codePoint));
        else if (codePoint <= 0x7ff) {
            result.push_back(static_cast<char>(0xc0 | (codePoint >> 6)));
            result.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
        } else if (codePoint <= 0xffff) {
            result.push_back(static_cast<char>(0xe0 | (codePoint >> 12)));
            result.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3f)));
            result.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
        } else if (codePoint <= 0x10ffff) {
            result.push_back(static_cast<char>(0xf0 | (codePoint >> 18)));
            result.push_back(static_cast<char>(0x80 | ((codePoint >> 12) & 0x3f)));
            result.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3f)));
            result.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
        } else {
            throw std::runtime_error("Invalid Unicode code point");
        }
    }

    uint32_t hex4() {
        if (position_ + 4 > input_.size()) fail("Incomplete Unicode escape");
        uint32_t value = 0;
        for (int i = 0; i < 4; ++i) {
            const char c = input_[position_++];
            value <<= 4;
            if (c >= '0' && c <= '9') value |= static_cast<uint32_t>(c - '0');
            else if (c >= 'a' && c <= 'f') value |= static_cast<uint32_t>(c - 'a' + 10);
            else if (c >= 'A' && c <= 'F') value |= static_cast<uint32_t>(c - 'A' + 10);
            else fail("Invalid Unicode escape");
        }
        return value;
    }

    std::string parseString() {
        if (!consume('"')) fail("Expected JSON string");
        std::string result;
        while (position_ < input_.size()) {
            const unsigned char c = static_cast<unsigned char>(input_[position_++]);
            if (c == '"') return result;
            if (c < 0x20) fail("Control character in JSON string");
            if (c != '\\') {
                result.push_back(static_cast<char>(c));
                continue;
            }
            if (position_ >= input_.size()) fail("Incomplete JSON escape");
            const char escape = input_[position_++];
            switch (escape) {
                case '"': result.push_back('"'); break;
                case '\\': result.push_back('\\'); break;
                case '/': result.push_back('/'); break;
                case 'b': result.push_back('\b'); break;
                case 'f': result.push_back('\f'); break;
                case 'n': result.push_back('\n'); break;
                case 'r': result.push_back('\r'); break;
                case 't': result.push_back('\t'); break;
                case 'u': {
                    uint32_t codePoint = hex4();
                    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
                        if (position_ + 2 > input_.size() || input_[position_] != '\\' || input_[position_ + 1] != 'u') {
                            fail("Missing low surrogate");
                        }
                        position_ += 2;
                        const uint32_t low = hex4();
                        if (low < 0xdc00 || low > 0xdfff) fail("Invalid low surrogate");
                        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
                    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
                        fail("Unexpected low surrogate");
                    }
                    appendUtf8(result, codePoint);
                    break;
                }
                default: fail("Invalid JSON escape");
            }
        }
        fail("Unterminated JSON string");
    }

    JsonValue parseValue() {
        whitespace();
        if (position_ >= input_.size()) fail("Expected JSON value");
        const char c = input_[position_];
        if (c == '"') return JsonValue{parseString()};
        if (c == '{') {
            ++position_;
            JsonValue::Object object;
            if (consume('}')) return JsonValue{std::move(object)};
            do {
                whitespace();
                if (position_ >= input_.size() || input_[position_] != '"') fail("Expected object key");
                auto key = parseString();
                if (!consume(':')) fail("Expected colon");
                if (!object.emplace(std::move(key), parseValue()).second) fail("Duplicate object key");
            } while (consume(','));
            if (!consume('}')) fail("Expected closing brace");
            return JsonValue{std::move(object)};
        }
        if (c == '[') {
            ++position_;
            JsonValue::Array array;
            if (consume(']')) return JsonValue{std::move(array)};
            do { array.push_back(parseValue()); } while (consume(','));
            if (!consume(']')) fail("Expected closing bracket");
            return JsonValue{std::move(array)};
        }
        if (input_.compare(position_, 4, "true") == 0) {
            position_ += 4;
            return JsonValue{true};
        }
        if (input_.compare(position_, 5, "false") == 0) {
            position_ += 5;
            return JsonValue{false};
        }
        if (input_.compare(position_, 4, "null") == 0) {
            position_ += 4;
            return JsonValue{nullptr};
        }
        const char* start = input_.c_str() + position_;
        char* end = nullptr;
        const double number = std::strtod(start, &end);
        if (end == start || !std::isfinite(number)) fail("Invalid JSON number");
        position_ += static_cast<size_t>(end - start);
        return JsonValue{number};
    }
};

const JsonValue& property(const JsonValue::Object& object, const char* key) {
    const auto found = object.find(key);
    if (found == object.end()) throw std::runtime_error(std::string("Program map is missing ") + key);
    return found->second;
}

const JsonValue::Object& asObject(const JsonValue& value, const char* name) {
    const auto* object = std::get_if<JsonValue::Object>(&value.value);
    if (!object) throw std::runtime_error(std::string("Expected object: ") + name);
    return *object;
}

const std::string& asString(const JsonValue& value, const char* name) {
    const auto* string = std::get_if<std::string>(&value.value);
    if (!string) throw std::runtime_error(std::string("Expected string: ") + name);
    return *string;
}

int asInteger(const JsonValue& value, const char* name) {
    const auto* number = std::get_if<double>(&value.value);
    if (!number || std::floor(*number) != *number) throw std::runtime_error(std::string("Expected integer: ") + name);
    return static_cast<int>(*number);
}

bool containsString(const JsonValue& value, const std::string& expected) {
    const auto* array = std::get_if<JsonValue::Array>(&value.value);
    if (!array) throw std::runtime_error("Expected string array in program map");
    return std::any_of(array->begin(), array->end(), [&](const JsonValue& item) {
        const auto* string = std::get_if<std::string>(&item.value);
        if (!string) throw std::runtime_error("Expected string array item in program map");
        return *string == expected;
    });
}

struct Instruction {
    std::string op;
    std::string operand;
    size_t target = static_cast<size_t>(-1);
    int argumentCount = 0;
    size_t sourceLine = 0;
    std::string sourceText;
};

struct Program {
    std::vector<Instruction> instructions;
    std::map<std::string, size_t> labels;
};

std::string trim(const std::string& value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return {};
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

std::string decodeQuoted(const std::string& value) {
    if (value.size() < 2 || value.front() != '"' || value.back() != '"') {
        throw std::runtime_error("Expected quoted p-code operand");
    }
    std::string result;
    for (size_t i = 1; i + 1 < value.size(); ++i) {
        char c = value[i];
        if (c != '\\') {
            result.push_back(c);
            continue;
        }
        if (++i + 1 >= value.size()) throw std::runtime_error("Invalid p-code escape");
        switch (value[i]) {
            case '"': result.push_back('"'); break;
            case '\\': result.push_back('\\'); break;
            case 'n': result.push_back('\n'); break;
            case 'r': result.push_back('\r'); break;
            case 't': result.push_back('\t'); break;
            default: throw std::runtime_error("Unsupported p-code escape");
        }
    }
    return result;
}

std::string firstToken(const std::string& text) {
    const auto end = text.find_first_of(" \t");
    return text.substr(0, end);
}

std::string remainder(const std::string& text) {
    const auto start = text.find_first_of(" \t");
    return start == std::string::npos ? std::string{} : trim(text.substr(start + 1));
}

Program parseProgram(const std::string& text) {
    Program program;
    std::istringstream lines(text);
    std::string line;
    size_t sourceLine = 0;
    while (std::getline(lines, line)) {
        ++sourceLine;
        line = trim(line);
        if (line.empty() || line[0] == '#') continue;
        if (line.back() == ':') {
            const auto label = trim(line.substr(0, line.size() - 1));
            if (label.empty() || !program.labels.emplace(label, program.instructions.size()).second) {
                throw std::runtime_error("Invalid or duplicate p-code label");
            }
            continue;
        }
        Instruction instruction;
        instruction.op = firstToken(line);
        instruction.operand = remainder(line);
        instruction.sourceLine = sourceLine;
        instruction.sourceText = line;
        static const std::vector<std::string> supported = {
            "ADD", "AND", "CALL", "CALL_EXT", "CONCAT", "EQ", "GE", "GT", "HALT",
            "JMP", "JZ", "LE", "LOAD", "LOAD_NAME", "LT", "MAP_RETURN", "MUL", "NEQ",
            "NOP", "NOT", "OR", "PUSH_INT", "PUSH_STR", "RET", "STORE", "STORE_NAME",
            "STREQ", "STRNEQ", "SUB"
        };
        if (std::find(supported.begin(), supported.end(), instruction.op) == supported.end()) {
            throw std::runtime_error("Native service host does not support opcode " + instruction.op);
        }
        if (instruction.op == "PUSH_STR") (void)decodeQuoted(instruction.operand);
        if (instruction.op == "CALL" || instruction.op == "CALL_EXT" ||
            instruction.op == "JMP" || instruction.op == "JZ") {
            std::istringstream operands(instruction.operand);
            std::string label;
            if (!(operands >> label)) throw std::runtime_error("Missing p-code operand for " + instruction.op);
            if (instruction.op == "CALL" || instruction.op == "CALL_EXT") {
                if (!(operands >> instruction.argumentCount) || instruction.argumentCount < 0
                    || instruction.argumentCount > 8) {
                    throw std::runtime_error("Invalid argument count for " + instruction.op);
                }
            }
            instruction.operand = label;
        }
        if (instruction.op == "CALL_EXT") {
            static const std::vector<std::string> bindings = {
                "host.event_body", "host.event_method", "host.event_path", "host.event_peer",
                "host.event_port", "host.http_status", "host.json_kind", "host.json_to_text",
                "host.json_array_count", "host.json_array_get", "host.json_array_append",
                "host.json_array_set", "host.json_array_remove", "host.json_value", "host.json_text",
                "host.json_integer", "host.json_has", "host.json_remove", "host.json_set",
                "host.json_embed", "host.json_merge", "host.json_format", "host.json_object",
                "host.json_append", "host.text_trim", "host.string_lower", "host.string_upper",
                "host.string_index", "host.json_path_text", "host.json_path_integer",
                "host.json_parse_value", "host.json_node_kind", "host.json_node_member",
                "host.json_node_count", "host.json_node_item", "host.json_node_key",
                "host.json_node_object_count", "host.json_node_value", "host.text_index",
                "host.string_slice", "host.string_replace", "host.text_split",
                "host.text_split_lines", "host.text_split_whitespace", "host.number_parse_integer",
                "host.raise_error", "host.text_hash", "host.text_hash_utf8", "host.number_compare",
                "host.string_compare", "host.date_iso", "host.date_parse", "host.date_now",
                "host.fs_read_text", "host.fs_read_text_auto", "host.fs_write_text",
                "host.fs_exists", "host.fs_resolve_relative",
                "host.bytes_from_text", "host.bytes_text", "host.bytes_length", "host.bytes_get", "host.bytes_join"
            };
            if (std::find(bindings.begin(), bindings.end(), instruction.operand) == bindings.end()) {
                throw std::runtime_error("Native service host does not support binding " + instruction.operand);
            }
        }
        program.instructions.push_back(std::move(instruction));
    }
    for (auto& instruction : program.instructions) {
        if (instruction.op != "CALL" && instruction.op != "JMP" && instruction.op != "JZ") continue;
        const auto target = program.labels.find(instruction.operand);
        if (target == program.labels.end()) throw std::runtime_error("Unresolved p-code label " + instruction.operand);
        instruction.target = target->second;
    }
    if (program.instructions.empty()) throw std::runtime_error("P-code program is empty");
    return program;
}

struct PValue {
    std::variant<int64_t, std::string> value = int64_t{0};
};

std::string jsonQuote(const std::string& value) {
    std::ostringstream out;
    out << '"';
    for (const unsigned char c : value) {
        switch (c) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b"; break;
            case '\f': out << "\\f"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (c < 0x20) {
                    static const char hex[] = "0123456789abcdef";
                    out << "\\u00" << hex[c >> 4] << hex[c & 0x0f];
                } else out << static_cast<char>(c);
        }
    }
    out << '"';
    return out.str();
}

std::string serializeJson(const JsonValue& value) {
    if (std::holds_alternative<std::nullptr_t>(value.value)) return "null";
    if (const auto* boolean = std::get_if<bool>(&value.value)) return *boolean ? "true" : "false";
    if (const auto* number = std::get_if<double>(&value.value)) {
        std::ostringstream out;
        out << std::setprecision(17) << *number;
        return out.str();
    }
    if (const auto* text = std::get_if<std::string>(&value.value)) return jsonQuote(*text);
    if (const auto* array = std::get_if<JsonValue::Array>(&value.value)) {
        std::string result = "[";
        for (size_t index = 0; index < array->size(); ++index) {
            if (index) result += ',';
            result += serializeJson((*array)[index]);
        }
        return result + "]";
    }
    const auto& object = std::get<JsonValue::Object>(value.value);
    std::string result = "{";
    bool first = true;
    for (const auto& [key, member] : object) {
        if (!first) result += ',';
        first = false;
        result += jsonQuote(key) + ":" + serializeJson(member);
    }
    return result + "}";
}

JsonValue parseJson(const std::string& text) {
    return JsonParser(text).parse();
}

const JsonValue& objectMember(const JsonValue::Object& object, const std::string& key) {
    const auto found = object.find(key);
    if (found == object.end()) throw std::runtime_error("Missing JSON field: " + key);
    return found->second;
}

JsonValue::Object& requireObject(JsonValue& value) {
    auto* object = std::get_if<JsonValue::Object>(&value.value);
    if (!object) throw std::runtime_error("Expected a JSON object");
    return *object;
}

const JsonValue::Object& requireObject(const JsonValue& value) {
    const auto* object = std::get_if<JsonValue::Object>(&value.value);
    if (!object) throw std::runtime_error("Expected a JSON object");
    return *object;
}

JsonValue::Array& requireArray(JsonValue& value) {
    auto* array = std::get_if<JsonValue::Array>(&value.value);
    if (!array) throw std::runtime_error("Expected a JSON array");
    return *array;
}

const JsonValue::Array& requireArray(const JsonValue& value) {
    const auto* array = std::get_if<JsonValue::Array>(&value.value);
    if (!array) throw std::runtime_error("Expected a JSON array");
    return *array;
}

std::string jsonKind(const JsonValue& value) {
    if (std::holds_alternative<std::nullptr_t>(value.value)) return "null";
    if (std::holds_alternative<bool>(value.value)) return "boolean";
    if (std::holds_alternative<double>(value.value)) return "number";
    if (std::holds_alternative<std::string>(value.value)) return "string";
    if (std::holds_alternative<JsonValue::Array>(value.value)) return "array";
    return "object";
}

std::string jsonText(const JsonValue& value) {
    if (const auto* text = std::get_if<std::string>(&value.value)) return *text;
    if (std::holds_alternative<std::nullptr_t>(value.value)) return "null";
    if (const auto* boolean = std::get_if<bool>(&value.value)) return *boolean ? "true" : "false";
    if (const auto* number = std::get_if<double>(&value.value)) {
        std::ostringstream out;
        out << std::setprecision(17) << *number;
        return out.str();
    }
    if (std::holds_alternative<JsonValue::Array>(value.value)) return "[object Array]";
    return "[object Object]";
}

uint32_t rotateRight(uint32_t value, unsigned int count) {
    return (value >> count) | (value << (32 - count));
}

std::string sha256(const std::string& input) {
    static constexpr std::array<uint32_t, 64> constants = {
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    };
    std::array<uint32_t, 8> state = {
        0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
        0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    };
    std::string bytes = input;
    const uint64_t bitLength = static_cast<uint64_t>(bytes.size()) * 8;
    bytes.push_back(static_cast<char>(0x80));
    while (bytes.size() % 64 != 56) bytes.push_back('\0');
    for (int shift = 56; shift >= 0; shift -= 8) bytes.push_back(static_cast<char>(bitLength >> shift));
    for (size_t offset = 0; offset < bytes.size(); offset += 64) {
        std::array<uint32_t, 64> words{};
        for (size_t index = 0; index < 16; ++index) {
            const auto base = offset + index * 4;
            words[index] = (static_cast<uint32_t>(static_cast<unsigned char>(bytes[base])) << 24) |
                (static_cast<uint32_t>(static_cast<unsigned char>(bytes[base + 1])) << 16) |
                (static_cast<uint32_t>(static_cast<unsigned char>(bytes[base + 2])) << 8) |
                static_cast<uint32_t>(static_cast<unsigned char>(bytes[base + 3]));
        }
        for (size_t index = 16; index < words.size(); ++index) {
            const uint32_t s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >> 3);
            const uint32_t s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >> 10);
            words[index] = words[index - 16] + s0 + words[index - 7] + s1;
        }
        auto [a, b, c, d, e, f, g, h] = state;
        for (size_t index = 0; index < words.size(); ++index) {
            const uint32_t s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const uint32_t choice = (e & f) ^ (~e & g);
            const uint32_t first = h + s1 + choice + constants[index] + words[index];
            const uint32_t s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
            const uint32_t second = s0 + majority;
            h = g; g = f; f = e; e = d + first;
            d = c; c = b; b = a; a = first + second;
        }
        state[0] += a; state[1] += b; state[2] += c; state[3] += d;
        state[4] += e; state[5] += f; state[6] += g; state[7] += h;
    }
    std::ostringstream result;
    result << std::hex << std::setfill('0');
    for (const auto word : state) result << std::setw(8) << word;
    return result.str();
}

std::string utf16le(const std::string& text) {
    std::string result;
    for (size_t index = 0; index < text.size();) {
        const auto first = static_cast<unsigned char>(text[index++]);
        uint32_t codePoint = first;
        unsigned int continuation = 0;
        if (first >= 0xf0) { codePoint = first & 0x07; continuation = 3; }
        else if (first >= 0xe0) { codePoint = first & 0x0f; continuation = 2; }
        else if (first >= 0xc2) { codePoint = first & 0x1f; continuation = 1; }
        else if (first >= 0x80) throw std::runtime_error("Invalid UTF-8 text");
        if (index + continuation > text.size()) throw std::runtime_error("Invalid UTF-8 text");
        for (unsigned int part = 0; part < continuation; ++part) {
            const auto byte = static_cast<unsigned char>(text[index++]);
            if ((byte & 0xc0) != 0x80) throw std::runtime_error("Invalid UTF-8 text");
            codePoint = (codePoint << 6) | (byte & 0x3f);
        }
        if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
            throw std::runtime_error("Invalid UTF-8 text");
        }
        if (codePoint <= 0xffff) {
            result.push_back(static_cast<char>(codePoint));
            result.push_back(static_cast<char>(codePoint >> 8));
        } else {
            codePoint -= 0x10000;
            const uint16_t high = static_cast<uint16_t>(0xd800 + (codePoint >> 10));
            const uint16_t low = static_cast<uint16_t>(0xdc00 + (codePoint & 0x3ff));
            result.push_back(static_cast<char>(high));
            result.push_back(static_cast<char>(high >> 8));
            result.push_back(static_cast<char>(low));
            result.push_back(static_cast<char>(low >> 8));
        }
    }
    return result;
}

std::optional<int64_t> dateMillis(const JsonValue& value) {
    if (const auto* number = std::get_if<double>(&value.value)) {
        if (!std::isfinite(*number) || std::abs(*number) > 8640000000000000.0) return std::nullopt;
        return static_cast<int64_t>(std::trunc(*number));
    }
    const auto* text = std::get_if<std::string>(&value.value);
    if (!text) return std::nullopt;
    static const std::regex pattern(
        R"(^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[Tt ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?(Z|z|[+-][0-9]{2}:[0-9]{2})?)?$)");
    std::smatch match;
    if (!std::regex_match(*text, match, pattern)) return std::nullopt;
    std::tm valueTm{};
    valueTm.tm_year = std::stoi(match[1].str()) - 1900;
    valueTm.tm_mon = std::stoi(match[2].str()) - 1;
    valueTm.tm_mday = std::stoi(match[3].str());
    valueTm.tm_hour = match[4].matched ? std::stoi(match[4].str()) : 0;
    valueTm.tm_min = match[5].matched ? std::stoi(match[5].str()) : 0;
    valueTm.tm_sec = match[6].matched ? std::stoi(match[6].str()) : 0;
    if (valueTm.tm_mon < 0 || valueTm.tm_mon > 11 || valueTm.tm_mday < 1 || valueTm.tm_mday > 31 ||
        valueTm.tm_hour > 24 || valueTm.tm_min > 59 || valueTm.tm_sec > 59 ||
        (valueTm.tm_hour == 24 && (valueTm.tm_min != 0 || valueTm.tm_sec != 0))) return std::nullopt;
    int milliseconds = 0;
    if (match[7].matched) {
        std::string fraction = match[7].str();
        fraction.resize(3, '0');
        milliseconds = std::stoi(fraction.substr(0, 3));
    }
    const int expectedYear = valueTm.tm_year;
    const int expectedMonth = valueTm.tm_mon;
    const int expectedDay = valueTm.tm_mday;
    const int expectedHour = valueTm.tm_hour;
    const int expectedMinute = valueTm.tm_min;
    const int expectedSecond = valueTm.tm_sec;
#ifdef _WIN32
    const std::time_t seconds = _mkgmtime(&valueTm);
#else
    const std::time_t seconds = timegm(&valueTm);
#endif
    if (seconds == static_cast<std::time_t>(-1)) return std::nullopt;
    if (valueTm.tm_year != expectedYear || valueTm.tm_mon != expectedMonth ||
        valueTm.tm_mday != expectedDay || valueTm.tm_hour != expectedHour ||
        valueTm.tm_min != expectedMinute || valueTm.tm_sec != expectedSecond) return std::nullopt;
    int offsetMinutes = 0;
    if (match[8].matched && match[8].str() != "Z" && match[8].str() != "z") {
        const auto zone = match[8].str();
        const int hours = std::stoi(zone.substr(1, 2));
        const int minutes = std::stoi(zone.substr(4, 2));
        if (hours > 23 || minutes > 59) return std::nullopt;
        offsetMinutes = (hours * 60 + minutes) * (zone[0] == '+' ? 1 : -1);
    }
    return static_cast<int64_t>(seconds) * 1000 + milliseconds - static_cast<int64_t>(offsetMinutes) * 60000;
}

std::string isoDate(int64_t milliseconds) {
    int64_t seconds = milliseconds / 1000;
    int millis = static_cast<int>(milliseconds % 1000);
    if (millis < 0) { millis += 1000; --seconds; }
    const auto timestamp = static_cast<std::time_t>(seconds);
    std::tm value{};
#ifdef _WIN32
    if (gmtime_s(&value, &timestamp) != 0) throw std::runtime_error("Date is outside supported range");
#else
    if (!gmtime_r(&timestamp, &value)) throw std::runtime_error("Date is outside supported range");
#endif
    char base[32]{};
    if (std::strftime(base, sizeof(base), "%Y-%m-%dT%H:%M:%S", &value) == 0) {
        throw std::runtime_error("Date is outside supported range");
    }
    std::ostringstream out;
    out << base << '.' << std::setw(3) << std::setfill('0') << millis << 'Z';
    return out.str();
}

const std::string& requireText(const PValue& value, const char* label) {
    const auto* text = std::get_if<std::string>(&value.value);
    if (!text) throw std::runtime_error(std::string("Expected string for ") + label);
    return *text;
}

int64_t requireInteger(const PValue& value, const char* label) {
    if (const auto* integer = std::get_if<int64_t>(&value.value)) return *integer;
    throw std::runtime_error(std::string("Expected integer for ") + label);
}

int64_t wrapInt32(int64_t value) {
    const auto bits = static_cast<uint32_t>(static_cast<uint64_t>(value));
    return bits <= static_cast<uint32_t>(std::numeric_limits<int32_t>::max())
        ? static_cast<int64_t>(bits)
        : static_cast<int64_t>(bits) - (int64_t{1} << 32);
}

bool isMissingPathError(const std::error_code& error) {
    return error == std::errc::no_such_file_or_directory || error == std::errc::not_a_directory;
}

std::vector<std::string> storagePathParts(const std::string& relative) {
    if (relative.empty() || relative.size() > 4096 || relative.find(':') != std::string::npos ||
        relative.front() == '/' || relative.front() == '\\' ||
        std::any_of(relative.begin(), relative.end(), [](unsigned char character) { return character < 32; })) {
        throw HttpError(400, "Invalid storage path");
    }
    std::vector<std::string> parts;
    size_t start = 0;
    while (start <= relative.size()) {
        const auto end = relative.find_first_of("/\\", start);
        const auto part = relative.substr(start, end == std::string::npos ? std::string::npos : end - start);
        const auto dot = part.find('.');
        std::string deviceName = part.substr(0, dot);
        while (!deviceName.empty() && deviceName.back() == ' ') deviceName.pop_back();
        std::transform(deviceName.begin(), deviceName.end(), deviceName.begin(), [](unsigned char value) {
            return static_cast<char>(std::tolower(value));
        });
        const bool serialPrefix = deviceName.compare(0, 3, "com") == 0 ||
            deviceName.compare(0, 3, "lpt") == 0;
        const std::string serialNumber = deviceName.size() > 3 ? deviceName.substr(3) : std::string{};
        const bool reservedSerial = serialPrefix &&
            ((serialNumber.size() == 1 && serialNumber[0] >= '1' && serialNumber[0] <= '9') ||
             serialNumber == "\xc2\xb9" || serialNumber == "\xc2\xb2" || serialNumber == "\xc2\xb3");
        const bool reservedDevice = deviceName == "con" || deviceName == "prn" || deviceName == "aux" ||
            deviceName == "nul" || deviceName == "conin$" || deviceName == "conout$" || reservedSerial;
        if (part.empty() || part == "." || part == ".." || part.back() == '.' || part.back() == ' ' ||
            reservedDevice || part.find_first_of("<>\"|?*") != std::string::npos) {
            throw HttpError(400, "Invalid storage path");
        }
        parts.push_back(part);
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return parts;
}

struct ResolvedStoragePath {
    std::filesystem::path path;
    bool exists = false;
    bool regularFile = false;
    bool directory = false;
};

const StorageRootGrant& storageGrant(
    const std::map<std::string, StorageRootGrant>& roots,
    const std::string& alias,
    bool write
) {
    const auto grant = roots.find(alias);
    if (grant == roots.end() || (write && grant->second.readOnly)) {
        throw HttpError(403, "Storage access denied: " + alias);
    }
    return grant->second;
}

ResolvedStoragePath resolveStoragePath(
    const std::map<std::string, StorageRootGrant>& roots,
    const std::string& alias,
    const std::string& relative,
    bool write,
    bool allowMissing
) {
    const auto& grant = storageGrant(roots, alias, write);
    const auto parts = storagePathParts(relative);
    auto target = std::filesystem::path(grant.path);
    std::error_code error;
    auto status = std::filesystem::symlink_status(target, error);
    if (error || std::filesystem::is_symlink(status) || !std::filesystem::is_directory(status)) {
        throw HttpError(503, "Storage root unavailable: " + alias);
    }
    for (size_t index = 0; index < parts.size(); ++index) {
        if (!std::filesystem::is_directory(status)) throw HttpError(400, "Storage parent is not a directory");
        target /= std::filesystem::u8path(parts[index]);
        status = std::filesystem::symlink_status(target, error);
        if (error || status.type() == std::filesystem::file_type::not_found) {
            if (isMissingPathError(error) || !error) {
                if (allowMissing && index + 1 == parts.size()) return {target, false, false, false};
                throw HttpError(404, "Storage file not found");
            }
            throw HttpError(error == std::errc::permission_denied ? 403 : 500, "Storage path resolution failed");
        }
        if (std::filesystem::is_symlink(status)) throw HttpError(403, "Storage links are not allowed");
        const bool isFile = std::filesystem::is_regular_file(status);
        const bool isDirectory = std::filesystem::is_directory(status);
        if (!isFile && !isDirectory) throw HttpError(403, "Unsupported storage entry");
        if (isFile) {
            const auto links = std::filesystem::hard_link_count(target, error);
            if (!error && links > 1) throw HttpError(403, "Storage hard links are not allowed");
            error.clear();
            if (index + 1 < parts.size()) throw HttpError(400, "Storage parent is not a directory");
        }
        const auto canonical = std::filesystem::canonical(target, error);
        if (error) throw HttpError(500, "Storage path resolution failed");
        const auto relativeToRoot = canonical.lexically_relative(std::filesystem::path(grant.path));
        if (relativeToRoot.empty() || relativeToRoot.is_absolute() || *relativeToRoot.begin() == "..") {
            throw HttpError(403, "Storage path escapes root");
        }
        if (index + 1 == parts.size()) return {target, true, isFile, isDirectory};
    }
    throw HttpError(400, "Invalid storage path");
}

void validateUtf8(const std::string& text) {
    for (size_t index = 0; index < text.size();) {
        const auto first = static_cast<unsigned char>(text[index++]);
        if (first < 0x80) continue;
        uint32_t codePoint = 0;
        unsigned int continuation = 0;
        if (first >= 0xc2 && first <= 0xdf) { codePoint = first & 0x1f; continuation = 1; }
        else if (first >= 0xe0 && first <= 0xef) { codePoint = first & 0x0f; continuation = 2; }
        else if (first >= 0xf0 && first <= 0xf4) { codePoint = first & 0x07; continuation = 3; }
        else throw HttpError(500, "Storage text is not valid UTF-8");
        if (index + continuation > text.size()) throw HttpError(500, "Storage text is not valid UTF-8");
        for (unsigned int part = 0; part < continuation; ++part) {
            const auto byte = static_cast<unsigned char>(text[index++]);
            if ((byte & 0xc0) != 0x80) throw HttpError(500, "Storage text is not valid UTF-8");
            codePoint = (codePoint << 6) | (byte & 0x3f);
        }
        if ((continuation == 2 && codePoint < 0x800) || (continuation == 3 && codePoint < 0x10000) ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
            throw HttpError(500, "Storage text is not valid UTF-8");
        }
    }
}

void appendUtf8(std::string& output, uint32_t codePoint) {
    if (codePoint <= 0x7f) output.push_back(static_cast<char>(codePoint));
    else if (codePoint <= 0x7ff) {
        output.push_back(static_cast<char>(0xc0 | (codePoint >> 6)));
        output.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
    } else if (codePoint <= 0xffff) {
        output.push_back(static_cast<char>(0xe0 | (codePoint >> 12)));
        output.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3f)));
        output.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
    } else {
        output.push_back(static_cast<char>(0xf0 | (codePoint >> 18)));
        output.push_back(static_cast<char>(0x80 | ((codePoint >> 12) & 0x3f)));
        output.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3f)));
        output.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
    }
}

std::string decodeStorageText(std::string content, bool autoEncoding) {
    if (!autoEncoding) {
        validateUtf8(content);
        return content;
    }
    size_t offset = 0;
    bool littleEndian = true;
    if (content.size() >= 2 && static_cast<unsigned char>(content[0]) == 0xff &&
        static_cast<unsigned char>(content[1]) == 0xfe) offset = 2;
    else if (content.size() >= 2 && static_cast<unsigned char>(content[0]) == 0xfe &&
             static_cast<unsigned char>(content[1]) == 0xff) {
        offset = 2;
        littleEndian = false;
    } else {
        const size_t sampleSize = std::min<size_t>(content.size(), 512);
        const auto zeros = static_cast<size_t>(std::count(content.begin(), content.begin() + sampleSize, '\0'));
        if (!sampleSize || zeros <= sampleSize / 5) {
            validateUtf8(content);
            return content;
        }
    }
    if ((content.size() - offset) % 2 != 0) throw HttpError(500, "Invalid UTF-16 storage text");
    std::string result;
    for (size_t index = offset; index < content.size(); index += 2) {
        const auto first = static_cast<unsigned char>(content[index]);
        const auto second = static_cast<unsigned char>(content[index + 1]);
        uint32_t codePoint = littleEndian ? first | (second << 8) : (first << 8) | second;
        if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
            if (index + 3 >= content.size()) throw HttpError(500, "Invalid UTF-16 surrogate pair");
            const auto third = static_cast<unsigned char>(content[index + 2]);
            const auto fourth = static_cast<unsigned char>(content[index + 3]);
            const uint32_t low = littleEndian ? third | (fourth << 8) : (third << 8) | fourth;
            if (low < 0xdc00 || low > 0xdfff) throw HttpError(500, "Invalid UTF-16 surrogate pair");
            codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
            index += 2;
        } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
            throw HttpError(500, "Unexpected UTF-16 low surrogate");
        }
        appendUtf8(result, codePoint);
    }
    return result;
}

std::string readStorageText(
    const std::map<std::string, StorageRootGrant>& roots,
    uint64_t maxFileBytes,
    const std::string& alias,
    const std::string& relative,
    bool autoEncoding
) {
    const auto resolved = resolveStoragePath(roots, alias, relative, false, false);
    if (!resolved.regularFile) throw HttpError(400, "Storage path is not a file");
    std::ifstream file(resolved.path, std::ios::binary);
    if (!file) throw HttpError(500, "Unable to read storage file");
    std::string content(static_cast<size_t>(maxFileBytes) + 1, '\0');
    file.read(content.data(), static_cast<std::streamsize>(content.size()));
    const auto count = file.gcount();
    if (count < 0) throw HttpError(500, "Unable to read storage file");
    content.resize(static_cast<size_t>(count));
    if (content.size() > maxFileBytes) throw HttpError(413, "File capacity exceeded");
    if (file.bad()) throw HttpError(500, "Unable to read storage file");
    return decodeStorageText(std::move(content), autoEncoding);
}

std::string resolveRelativeStoragePath(
    const std::map<std::string, StorageRootGrant>& roots,
    const std::string& alias,
    const std::string& base,
    const std::string& reference
) {
    (void)storageGrant(roots, alias, false);
    const auto baseParts = storagePathParts(base);
    if (reference.empty() || reference.size() > 4096 ||
        reference.find_first_of(":%?#\\") != std::string::npos || reference.front() == '/') {
        throw HttpError(400, "Invalid relative storage reference");
    }
    std::vector<std::string> components(baseParts.begin(), baseParts.end() - 1);
    size_t start = 0;
    while (start <= reference.size()) {
        const auto end = reference.find('/', start);
        const auto part = reference.substr(start, end == std::string::npos ? std::string::npos : end - start);
        if (part.empty()) throw HttpError(400, "Invalid relative storage reference");
        if (part == ".") {
        } else if (part == "..") {
            if (components.empty()) throw HttpError(403, "Storage reference escapes root");
            components.pop_back();
        } else {
            const auto safePart = storagePathParts(part);
            if (safePart.size() != 1) throw HttpError(400, "Invalid relative storage reference");
            components.push_back(part);
        }
        if (end == std::string::npos) break;
        start = end + 1;
    }
    if (components.empty()) throw HttpError(400, "Invalid relative storage reference");
    std::string resolved;
    for (const auto& component : components) {
        if (!resolved.empty()) resolved += '/';
        resolved += component;
    }
    (void)resolveStoragePath(roots, alias, resolved, false, false);
#ifdef _WIN32
    std::transform(resolved.begin(), resolved.end(), resolved.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
#endif
    return resolved;
}

void writeStorageText(
    const std::map<std::string, StorageRootGrant>& roots,
    uint64_t maxFileBytes,
    const std::string& alias,
    const std::string& relative,
    const std::string& content
) {
    validateUtf8(content);
    if (content.size() > maxFileBytes) throw HttpError(413, "File capacity exceeded");
    const auto resolved = resolveStoragePath(roots, alias, relative, true, true);
    if (resolved.exists && !resolved.regularFile) throw HttpError(400, "Storage path is not a file");
    static std::atomic<uint64_t> temporaryId{0};
    std::filesystem::path temporary;
    int descriptor = -1;
    for (int attempt = 0; attempt < 16 && descriptor < 0; ++attempt) {
        temporary = resolved.path.parent_path() /
            (".pulse-native-" + std::to_string(++temporaryId) + ".tmp");
#ifdef _WIN32
        descriptor = _wopen(temporary.c_str(), _O_WRONLY | _O_CREAT | _O_EXCL | _O_BINARY, _S_IREAD | _S_IWRITE);
#else
        descriptor = ::open(temporary.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, S_IRUSR | S_IWUSR);
#endif
        if (descriptor < 0 && errno != EEXIST) throw HttpError(500, "Unable to create temporary storage file");
    }
    if (descriptor < 0) throw HttpError(500, "Unable to allocate temporary storage file");
    bool closed = false;
    try {
        size_t offset = 0;
        while (offset < content.size()) {
#ifdef _WIN32
            const auto written = _write(descriptor, content.data() + offset,
                static_cast<unsigned int>(std::min<size_t>(content.size() - offset, std::numeric_limits<unsigned int>::max())));
#else
            const auto written = ::write(descriptor, content.data() + offset, content.size() - offset);
#endif
            if (written <= 0) throw HttpError(500, "Unable to write storage file");
            offset += static_cast<size_t>(written);
        }
#ifdef _WIN32
        if (_commit(descriptor) != 0) throw HttpError(500, "Unable to flush storage file");
        if (_close(descriptor) != 0) throw HttpError(500, "Unable to close storage file");
#else
        if (::fsync(descriptor) != 0) throw HttpError(500, "Unable to flush storage file");
        if (::close(descriptor) != 0) throw HttpError(500, "Unable to close storage file");
#endif
        closed = true;
        (void)resolveStoragePath(roots, alias, relative, true, true);
#ifdef _WIN32
        if (!MoveFileExW(temporary.c_str(), resolved.path.c_str(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            throw HttpError(500, "Unable to commit storage file");
        }
#else
        std::error_code error;
        std::filesystem::rename(temporary, resolved.path, error);
        if (error) throw HttpError(500, "Unable to commit storage file");
#endif
    } catch (...) {
        if (!closed) {
#ifdef _WIN32
            _close(descriptor);
#else
            ::close(descriptor);
#endif
        }
        std::error_code ignored;
        std::filesystem::remove(temporary, ignored);
        throw;
    }
}

JsonValue pvalueJson(const PValue& value) {
    if (const auto* integer = std::get_if<int64_t>(&value.value)) {
        return JsonValue{static_cast<double>(*integer)};
    }
    return JsonValue{std::get<std::string>(value.value)};
}

std::string serializeVariables(const std::map<std::string, PValue>& variables) {
    std::string result = "{";
    bool first = true;
    for (const auto& [name, value] : variables) {
        if (!first) result += ',';
        first = false;
        result += jsonQuote(name) + ":";
        if (const auto* integer = std::get_if<int64_t>(&value.value)) result += std::to_string(*integer);
        else result += jsonQuote(std::get<std::string>(value.value));
    }
    result += '}';
    return result;
}

std::string serializeFrames(const Program& program, size_t pc, const std::vector<size_t>& returns,
    const std::vector<std::map<std::string, PValue>>& variables) {
    std::string result = "[{\"name\":\"current\",\"pc\":" + std::to_string(pc) +
        ",\"line\":" + std::to_string(program.instructions[pc].sourceLine) +
        ",\"locals\":" + serializeVariables(variables.back()) + "}";
    size_t frameIndex = 1;
    for (auto frame = returns.rbegin(); frame != returns.rend(); ++frame) {
        const size_t address = *frame;
        const size_t safeAddress = std::min(address, program.instructions.size() - 1);
        result += ",{\"name\":\"caller\",\"pc\":" + std::to_string(address) +
            ",\"line\":" + std::to_string(program.instructions[safeAddress].sourceLine) +
            ",\"locals\":" + serializeVariables(variables[variables.size() - 1 - frameIndex]) + "}";
        ++frameIndex;
    }
    result += ']';
    return result;
}

const JsonValue* optionalProperty(const JsonValue::Object& object, const std::string& name) {
    const auto found = object.find(name);
    return found == object.end() ? nullptr : &found->second;
}

std::string optionalString(const JsonValue::Object& object, const std::string& name, std::string fallback) {
    const JsonValue* value = optionalProperty(object, name);
    if (!value) return fallback;
    const auto* string = std::get_if<std::string>(&value->value);
    if (!string) throw std::runtime_error("Expected string debugger field: " + name);
    return *string;
}

std::set<size_t> readBreakpoints(const JsonValue::Object& command) {
    std::set<size_t> result;
    const JsonValue* value = optionalProperty(command, "breakpoints");
    if (!value) return result;
    const auto* array = std::get_if<JsonValue::Array>(&value->value);
    if (!array || array->size() > 4096) throw std::runtime_error("Invalid debugger breakpoint list");
    for (const auto& item : *array) {
        const int line = asInteger(item, "debugger breakpoint line");
        if (line < 1 || line > 1000000) throw std::runtime_error("Invalid debugger breakpoint line");
        result.insert(static_cast<size_t>(line));
    }
    return result;
}

void writeDebugEvent(std::ostream& output, const std::string& event) {
    output << event << '\n';
    output.flush();
    if (!output) throw std::runtime_error("Unable to write debugger event");
}

HttpResponse execute(const Program& program, const HttpRequest& request, uint64_t maxSteps,
    const std::map<std::string, StorageRootGrant>& storageRoots, uint64_t maxFileBytes,
    const JsonValue& programMap, std::istream* debugInput = nullptr,
    std::ostream* debugOutput = nullptr, std::set<size_t> breakpoints = {}) {
    std::vector<PValue> stack;
    std::vector<std::map<std::string, PValue>> variables(1);
    std::vector<size_t> returns;
    struct JsonNode {
        JsonValue value;
        std::map<std::string, int64_t> children;
    };
    std::vector<std::vector<JsonNode>> jsonHandles;
    std::string responseBody;
    int responseStatus = 200;
    size_t pc = 0;
    uint64_t steps = 0;
    auto pop = [&]() {
        if (stack.empty()) throw std::runtime_error("P-code stack underflow");
        auto value = std::move(stack.back());
        stack.pop_back();
        return value;
    };
    auto asInt = [](const PValue& value) {
        if (const auto* integer = std::get_if<int64_t>(&value.value)) return *integer;
        throw std::runtime_error("Expected integer p-code value");
    };
    bool initiallyPaused = debugInput != nullptr;
    bool running = false;
    size_t skipBreakpointAtPc = static_cast<size_t>(-1);
    auto debuggerCommand = [&]() {
        std::string line;
        if (!std::getline(*debugInput, line)) throw std::runtime_error("Debugger control channel closed");
        if (line.size() > 65536) throw std::runtime_error("Debugger command exceeds 65536 bytes");
        const auto parsed = parseJson(line);
        const auto& command = asObject(parsed, "debugger command");
        const std::string name = optionalString(command, "command", "");
        if (name == "breakpoints") {
            breakpoints = readBreakpoints(command);
            writeDebugEvent(*debugOutput, "{\"event\":\"breakpointsSet\"}");
            return std::string{};
        }
        if (name == "terminate") return name;
        if (name == "step") {
            running = false;
            initiallyPaused = true;
            return name;
        }
        if (name == "continue") {
            running = true;
            initiallyPaused = false;
            return name;
        }
        throw std::runtime_error("Unsupported debugger command: " + name);
    };
    while (pc < program.instructions.size()) {
        if (maxSteps && ++steps > maxSteps) throw std::runtime_error("Native p-code instruction budget exceeded");
        if (!maxSteps) ++steps;
        if (stack.size() > 256) throw std::runtime_error("Native p-code operand stack capacity exceeded");
        if (returns.size() > 32) throw std::runtime_error("Native p-code call depth capacity exceeded");
        const auto& instruction = program.instructions[pc];
        if (debugInput && debugOutput) {
            const bool hitBreakpoint = breakpoints.find(instruction.sourceLine) != breakpoints.end()
                && pc != skipBreakpointAtPc;
            if (initiallyPaused || (running && hitBreakpoint)) {
                initiallyPaused = false;
                running = false;
                const auto globals = serializeVariables(variables.front());
                const auto locals = serializeVariables(variables.back());
                writeDebugEvent(*debugOutput,
                    "{\"event\":\"stopped\",\"reason\":\"" + std::string(hitBreakpoint ? "breakpoint" : "entry") +
                    "\",\"pc\":" + std::to_string(pc) +
                    ",\"line\":" + std::to_string(instruction.sourceLine) +
                    ",\"instruction\":" + jsonQuote(instruction.sourceText) +
                    ",\"globals\":" + globals + ",\"locals\":" + locals +
                    ",\"frames\":" + serializeFrames(program, pc, returns, variables) +
                    ",\"callDepth\":" + std::to_string(returns.size()) + "}");
                for (;;) {
                    const std::string action = debuggerCommand();
                    if (action == "terminate") {
                        writeDebugEvent(*debugOutput, "{\"event\":\"terminated\"}");
                        return HttpResponse{499, "{\"error\":\"Debugger terminated execution\"}"};
                    }
                    if (!action.empty()) {
                        skipBreakpointAtPc = pc;
                        break;
                    }
                }
            }
            if (skipBreakpointAtPc == pc) skipBreakpointAtPc = static_cast<size_t>(-1);
        }
        if (instruction.op == "NOP") { ++pc; continue; }
        if (instruction.op == "HALT") break;
        if (instruction.op == "PUSH_STR") {
            stack.push_back(PValue{decodeQuoted(instruction.operand)});
            ++pc;
            continue;
        }
        if (instruction.op == "PUSH_INT") {
            size_t consumed = 0;
            const auto number = std::stoll(instruction.operand, &consumed);
            if (consumed != instruction.operand.size()) throw std::runtime_error("Invalid PUSH_INT operand");
            stack.push_back(PValue{number});
            ++pc;
            continue;
        }
        if (instruction.op == "LOAD" || instruction.op == "LOAD_NAME") {
            const PValue* value = nullptr;
            for (auto frame = variables.rbegin(); frame != variables.rend(); ++frame) {
                const auto found = frame->find(instruction.operand);
                if (found != frame->end()) { value = &found->second; break; }
            }
            if (!value) {
                throw std::runtime_error("Undefined LOAD variable: " + instruction.operand);
            }
            stack.push_back(*value);
            ++pc;
            continue;
        }
        if (instruction.op == "ADD" || instruction.op == "SUB" || instruction.op == "MUL") {
            const auto right = wrapInt32(asInt(pop()));
            const auto left = wrapInt32(asInt(pop()));
            const int64_t value = instruction.op == "ADD" ? left + right
                : instruction.op == "SUB" ? left - right : left * right;
            stack.push_back(PValue{wrapInt32(value)});
            ++pc;
            continue;
        }
        if (instruction.op == "CONCAT") {
            const auto right = pop();
            const auto left = pop();
            const auto* leftText = std::get_if<std::string>(&left.value);
            const auto* rightText = std::get_if<std::string>(&right.value);
            if (!leftText || !rightText) throw std::runtime_error("Expected strings for CONCAT");
            stack.push_back(PValue{*leftText + *rightText});
            ++pc;
            continue;
        }
        if (instruction.op == "EQ" || instruction.op == "NEQ" ||
            instruction.op == "LT" || instruction.op == "LE" ||
            instruction.op == "GT" || instruction.op == "GE") {
            const auto right = pop();
            const auto left = pop();
            if (left.value.index() != right.value.index()) {
                throw std::runtime_error("Cannot compare different native value types");
            }
            int comparison = 0;
            if (const auto* leftText = std::get_if<std::string>(&left.value)) {
                const auto& rightText = std::get<std::string>(right.value);
                comparison = *leftText < rightText ? -1 : *leftText > rightText ? 1 : 0;
            } else {
                const auto leftInt = asInt(left);
                const auto rightInt = asInt(right);
                comparison = leftInt < rightInt ? -1 : leftInt > rightInt ? 1 : 0;
            }
            bool matched = false;
            if (instruction.op == "EQ") matched = comparison == 0;
            else if (instruction.op == "NEQ") matched = comparison != 0;
            else if (instruction.op == "LT") matched = comparison < 0;
            else if (instruction.op == "LE") matched = comparison <= 0;
            else if (instruction.op == "GT") matched = comparison > 0;
            else matched = comparison >= 0;
            stack.push_back(PValue{int64_t{matched ? 1 : 0}});
            ++pc;
            continue;
        }
        if (instruction.op == "STRNEQ") {
            const auto right = pop();
            const auto left = pop();
            const auto* leftText = std::get_if<std::string>(&left.value);
            const auto* rightText = std::get_if<std::string>(&right.value);
            if (!leftText || !rightText) throw std::runtime_error("Expected strings for STRNEQ");
            stack.push_back(PValue{int64_t{*leftText != *rightText ? 1 : 0}});
            ++pc;
            continue;
        }
        if (instruction.op == "AND" || instruction.op == "OR") {
            const auto right = asInt(pop()) != 0;
            const auto left = asInt(pop()) != 0;
            const bool value = instruction.op == "AND" ? left && right : left || right;
            stack.push_back(PValue{int64_t{value ? 1 : 0}});
            ++pc;
            continue;
        }
        if (instruction.op == "NOT") {
            stack.push_back(PValue{int64_t{asInt(pop()) == 0 ? 1 : 0}});
            ++pc;
            continue;
        }
        if (instruction.op == "STREQ") {
            const auto right = pop();
            const auto left = pop();
            if (left.value.index() != right.value.index()) stack.push_back(PValue{int64_t{0}});
            else if (const auto* leftText = std::get_if<std::string>(&left.value)) {
                stack.push_back(PValue{int64_t{*leftText == std::get<std::string>(right.value) ? 1 : 0}});
            } else stack.push_back(PValue{int64_t{asInt(left) == asInt(right) ? 1 : 0}});
            ++pc;
            continue;
        }
        if (instruction.op == "JMP") { pc = instruction.target; continue; }
        if (instruction.op == "JZ") {
            pc = asInt(pop()) == 0 ? instruction.target : pc + 1;
            continue;
        }
        if (instruction.op == "CALL") {
            std::vector<PValue> args(static_cast<size_t>(instruction.argumentCount));
            for (int i = instruction.argumentCount - 1; i >= 0; --i) args[static_cast<size_t>(i)] = pop();
            std::map<std::string, PValue> frame;
            const auto& root = asObject(programMap, "root");
            const auto procedures = root.find("procedures");
            if (procedures != root.end()) {
                const auto& definitions = asObject(procedures->second, "procedures");
                const auto procedure = definitions.find(instruction.operand);
                if (procedure != definitions.end()) {
                    const auto& definition = asObject(procedure->second, "procedure");
                    const auto& params = requireArray(property(definition, "params"));
                    if (params.size() != args.size()) throw std::runtime_error("Native procedure arity mismatch");
                    for (size_t index = 0; index < params.size(); ++index)
                        frame.emplace(std::get<std::string>(params[index].value), std::move(args[index]));
                } else if (!args.empty()) throw std::runtime_error("Missing native procedure signature");
            } else if (!args.empty()) throw std::runtime_error("Missing native procedure signatures");
            returns.push_back(pc + 1);
            variables.push_back(std::move(frame));
            pc = instruction.target;
            continue;
        }
        if (instruction.op == "RET") {
            if (returns.empty()) break;
            pc = returns.back();
            returns.pop_back();
            variables.pop_back();
            continue;
        }
        if (instruction.op == "CALL_EXT") {
            std::vector<PValue> args(static_cast<size_t>(instruction.argumentCount));
            for (int i = instruction.argumentCount - 1; i >= 0; --i) args[static_cast<size_t>(i)] = pop();
            PValue result;
            if (instruction.operand == "host.event_body" && args.empty()) result.value = request.body;
            else if (instruction.operand == "host.event_method" && args.empty()) result.value = request.method;
            else if (instruction.operand == "host.event_path" && args.empty()) result.value = request.path;
            else if (instruction.operand == "host.event_peer" && args.empty()) result.value = request.peer;
            else if (instruction.operand == "host.event_port" && args.empty()) result.value = static_cast<int64_t>(request.peerPort);
            else if (instruction.operand == "host.http_status" && args.size() == 1) {
                const auto status = asInt(args[0]);
                if (status < 200 || status > 599) throw std::runtime_error("Invalid HTTP status");
                responseStatus = static_cast<int>(status);
                result.value = int64_t{0};
            } else if (instruction.operand == "host.bytes_from_text" && args.size() == 1) {
                const auto& text = requireText(args[0], "byte text");
                if (text.size() > 4096) throw std::runtime_error("Byte capacity exceeded");
                static constexpr char digits[] = "0123456789abcdef";
                std::string hex;
                hex.reserve(text.size() * 2);
                for (unsigned char byte : text) { hex.push_back(digits[byte >> 4]); hex.push_back(digits[byte & 15]); }
                result.value = std::move(hex);
            } else if (instruction.operand.rfind("host.bytes_", 0) == 0) {
                auto decode = [](const std::string& hex) {
                    if (hex.size() > 8192 || hex.size() % 2) throw std::runtime_error("Invalid bounded byte hex");
                    auto digit = [](unsigned char value) -> unsigned {
                        if (value >= '0' && value <= '9') return value - '0';
                        if (value >= 'a' && value <= 'f') return value - 'a' + 10;
                        if (value >= 'A' && value <= 'F') return value - 'A' + 10;
                        throw std::runtime_error("Invalid byte hex digit");
                    };
                    std::string bytes;
                    bytes.reserve(hex.size() / 2);
                    for (size_t index = 0; index < hex.size(); index += 2)
                        bytes.push_back(static_cast<char>(digit(hex[index]) * 16 + digit(hex[index + 1])));
                    return bytes;
                };
                if (args.empty()) throw std::runtime_error("Invalid byte binding arity");
                const auto& hex = requireText(args[0], "byte hex");
                const auto bytes = decode(hex);
                if (instruction.operand == "host.bytes_length" && args.size() == 1) result.value = static_cast<int64_t>(bytes.size());
                else if (instruction.operand == "host.bytes_get" && args.size() == 2) {
                    const auto index = requireInteger(args[1], "byte index");
                    if (index < 0 || static_cast<uint64_t>(index) >= bytes.size()) throw std::runtime_error("Byte index out of bounds");
                    result.value = static_cast<int64_t>(static_cast<unsigned char>(bytes[static_cast<size_t>(index)]));
                } else if (instruction.operand == "host.bytes_text" && args.size() == 1) {
                    pmachine::ByteBuffer buffer;
                    int handle = 0;
                    std::string text, error;
                    if (!buffer.load(reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size(), handle, error)
                        || !buffer.text(handle, text, error)) throw std::runtime_error(error);
                    result.value = std::move(text);
                } else if (instruction.operand == "host.bytes_join" && args.size() == 2) {
                    const auto& next = requireText(args[1], "byte hex");
                    (void)decode(next);
                    if (hex.size() + next.size() > 8192) throw std::runtime_error("Byte capacity exceeded");
                    result.value = hex + next;
                } else throw std::runtime_error("Invalid byte binding arity");
            } else if (instruction.operand == "host.json_kind" && args.size() == 1) {
                result.value = jsonKind(parseJson(requireText(args[0], "JSON")));
            } else if (instruction.operand == "host.json_to_text" && args.size() == 1) {
                result.value = jsonText(parseJson(requireText(args[0], "JSON")));
            } else if (instruction.operand == "host.json_array_count" && args.size() == 1) {
                result.value = static_cast<int64_t>(requireArray(parseJson(requireText(args[0], "JSON"))).size());
            } else if (instruction.operand == "host.json_array_get" && args.size() == 2) {
                auto array = requireArray(parseJson(requireText(args[0], "JSON")));
                const auto index = requireInteger(args[1], "JSON array index");
                if (index < 0 || static_cast<uint64_t>(index) >= array.size()) throw std::runtime_error("JSON array index out of bounds");
                result.value = serializeJson(array[static_cast<size_t>(index)]);
            } else if (instruction.operand == "host.json_array_append" && args.size() == 2) {
                auto array = requireArray(parseJson(requireText(args[0], "JSON")));
                array.push_back(parseJson(requireText(args[1], "JSON array item")));
                result.value = serializeJson(JsonValue{std::move(array)});
            } else if (instruction.operand == "host.json_array_set" && args.size() == 3) {
                auto array = requireArray(parseJson(requireText(args[0], "JSON")));
                const auto index = requireInteger(args[1], "JSON array index");
                if (index < 0 || static_cast<uint64_t>(index) >= array.size()) throw std::runtime_error("JSON array index out of bounds");
                array[static_cast<size_t>(index)] = parseJson(requireText(args[2], "JSON array item"));
                result.value = serializeJson(JsonValue{std::move(array)});
            } else if (instruction.operand == "host.json_array_remove" && args.size() == 2) {
                auto array = requireArray(parseJson(requireText(args[0], "JSON")));
                const auto index = requireInteger(args[1], "JSON array index");
                if (index < 0 || static_cast<uint64_t>(index) >= array.size()) throw std::runtime_error("JSON array index out of bounds");
                array.erase(array.begin() + index);
                result.value = serializeJson(JsonValue{std::move(array)});
            } else if (instruction.operand == "host.json_value" && args.size() == 2) {
                const auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                result.value = serializeJson(objectMember(object, requireText(args[1], "JSON key")));
            } else if (instruction.operand == "host.json_text" && args.size() == 2) {
                const auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                const auto& value = objectMember(object, requireText(args[1], "JSON key"));
                if (!std::holds_alternative<std::string>(value.value)) throw std::runtime_error("Expected string field");
                result.value = std::get<std::string>(value.value);
            } else if (instruction.operand == "host.json_integer" && args.size() == 2) {
                const auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                const auto& value = objectMember(object, requireText(args[1], "JSON key"));
                const auto* number = std::get_if<double>(&value.value);
                if (!number || std::floor(*number) != *number || *number < -2147483648.0 || *number > 2147483647.0) {
                    throw std::runtime_error("Expected integer field");
                }
                result.value = static_cast<int64_t>(*number);
            } else if (instruction.operand == "host.json_has" && args.size() == 2) {
                const auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                result.value = static_cast<int64_t>(object.count(requireText(args[1], "JSON key")) ? 1 : 0);
            } else if (instruction.operand == "host.json_remove" && args.size() == 2) {
                auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                object.erase(requireText(args[1], "JSON key"));
                result.value = serializeJson(JsonValue{std::move(object)});
            } else if (instruction.operand == "host.json_set" && args.size() == 3) {
                auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                object[requireText(args[1], "JSON key")] = pvalueJson(args[2]);
                result.value = serializeJson(JsonValue{std::move(object)});
            } else if (instruction.operand == "host.json_embed" && args.size() == 3) {
                auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                object[requireText(args[1], "JSON key")] = parseJson(requireText(args[2], "embedded JSON"));
                result.value = serializeJson(JsonValue{std::move(object)});
            } else if (instruction.operand == "host.json_merge" && args.size() == 2) {
                auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                const auto next = requireObject(parseJson(requireText(args[1], "JSON object")));
                for (const auto& [key, value] : next) object[key] = value;
                result.value = serializeJson(JsonValue{std::move(object)});
            } else if (instruction.operand == "host.json_format" && args.size() == 2) {
                const auto indent = requireInteger(args[1], "JSON indentation");
                if (indent < 0 || indent > 10) throw std::runtime_error("Invalid JSON indentation");
                result.value = serializeJson(parseJson(requireText(args[0], "JSON")));
            } else if (instruction.operand == "host.json_object" && args.size() == 1) {
                result.value = serializeJson(parseJson(requireText(args[0], "JSON object")));
            } else if (instruction.operand == "host.json_append" && args.size() == 3) {
                auto object = requireObject(parseJson(requireText(args[0], "JSON object")));
                const auto& key = requireText(args[1], "JSON key");
                JsonValue::Array values;
                const auto existing = object.find(key);
                if (existing != object.end()) values = requireArray(existing->second);
                const auto item = pvalueJson(args[2]);
                if (std::holds_alternative<JsonValue::Object>(item.value) || std::holds_alternative<JsonValue::Array>(item.value) ||
                    std::holds_alternative<std::nullptr_t>(item.value)) throw std::runtime_error("JSON append requires a scalar");
                values.push_back(item);
                object[key] = JsonValue{std::move(values)};
                result.value = serializeJson(JsonValue{std::move(object)});
            } else if (instruction.operand == "host.json_path_text" && args.size() == 2) {
                const auto root = parseJson(requireText(args[0], "JSON object"));
                const JsonValue* value = &root;
                const auto path = requireText(args[1], "JSON path");
                std::istringstream parts(path);
                std::string key;
                size_t count = 0;
                while (std::getline(parts, key, '.')) {
                    if (key.empty() || ++count > 8) throw std::runtime_error("Invalid JSON path");
                    value = &objectMember(requireObject(*value), key);
                }
                if (!std::holds_alternative<std::string>(value->value)) throw std::runtime_error("Expected string field");
                result.value = std::get<std::string>(value->value);
            } else if (instruction.operand == "host.json_path_integer" && args.size() == 2) {
                const auto root = parseJson(requireText(args[0], "JSON object"));
                const JsonValue* value = &root;
                const auto path = requireText(args[1], "JSON path");
                std::istringstream parts(path);
                std::string key;
                size_t count = 0;
                while (std::getline(parts, key, '.')) {
                    if (key.empty() || ++count > 8) throw std::runtime_error("Invalid JSON path");
                    value = &objectMember(requireObject(*value), key);
                }
                const auto* number = std::get_if<double>(&value->value);
                if (!number || std::floor(*number) != *number || *number < -2147483648.0 || *number > 2147483647.0) {
                    throw std::runtime_error("Expected integer field");
                }
                result.value = static_cast<int64_t>(*number);
            } else if (instruction.operand == "host.json_parse_value" && args.size() == 1) {
                if (jsonHandles.size() >= 8) throw std::runtime_error("JSON value handle capacity exceeded");
                std::vector<JsonNode> nodes;
                nodes.push_back(JsonNode{parseJson(requireText(args[0], "JSON")), {}});
                jsonHandles.push_back(std::move(nodes));
                result.value = static_cast<int64_t>(jsonHandles.size());
            } else if (instruction.operand.rfind("host.json_node_", 0) == 0 && !args.empty()) {
                const auto handle = requireInteger(args[0], "JSON value handle");
                if (handle < 1 || static_cast<uint64_t>(handle) > jsonHandles.size()) {
                    throw std::runtime_error("Invalid JSON value handle");
                }
                auto& nodes = jsonHandles[static_cast<size_t>(handle - 1)];
                const auto nodeIndex = args.size() > 1 ? requireInteger(args[1], "JSON node index") : 0;
                if (nodeIndex < 0 || static_cast<uint64_t>(nodeIndex) >= nodes.size()) {
                    throw std::runtime_error("Invalid JSON value node");
                }
                auto childNode = [&](const std::string& key) -> int64_t {
                    auto& parent = nodes[static_cast<size_t>(nodeIndex)];
                    if (const auto* array = std::get_if<JsonValue::Array>(&parent.value.value)) {
                        size_t position = 0;
                        try { position = static_cast<size_t>(std::stoull(key)); }
                        catch (...) { throw std::runtime_error("Invalid JSON array node index"); }
                        if (position >= array->size() || std::to_string(position) != key) {
                            throw std::runtime_error("JSON value index out of bounds");
                        }
                        const auto found = parent.children.find(key);
                        if (found != parent.children.end()) return found->second;
                        if (nodes.size() >= 100000) throw std::runtime_error("JSON value node capacity exceeded");
                        const auto next = static_cast<int64_t>(nodes.size());
                        nodes.push_back(JsonNode{(*array)[position], {}});
                        nodes[static_cast<size_t>(nodeIndex)].children[key] = next;
                        return next;
                    }
                    const auto* object = std::get_if<JsonValue::Object>(&parent.value.value);
                    if (!object) throw std::runtime_error("Expected JSON object or array node");
                    const auto foundValue = object->find(key);
                    if (foundValue == object->end()) return -1;
                    const auto found = parent.children.find(key);
                    if (found != parent.children.end()) return found->second;
                    if (nodes.size() >= 100000) throw std::runtime_error("JSON value node capacity exceeded");
                    const auto next = static_cast<int64_t>(nodes.size());
                    nodes.push_back(JsonNode{foundValue->second, {}});
                    nodes[static_cast<size_t>(nodeIndex)].children[key] = next;
                    return next;
                };
                const auto& value = nodes[static_cast<size_t>(nodeIndex)].value;
                if (instruction.operand == "host.json_node_kind" && args.size() == 2) {
                    result.value = jsonKind(value);
                } else if (instruction.operand == "host.json_node_member" && args.size() == 3) {
                    result.value = childNode(requireText(args[2], "JSON member name"));
                } else if (instruction.operand == "host.json_node_count" && args.size() == 2) {
                    result.value = static_cast<int64_t>(requireArray(value).size());
                } else if (instruction.operand == "host.json_node_item" && args.size() == 3) {
                    const auto position = requireInteger(args[2], "JSON value index");
                    const auto& array = requireArray(value);
                    if (position < 0 || static_cast<uint64_t>(position) >= array.size()) {
                        throw std::runtime_error("JSON value index out of bounds");
                    }
                    result.value = childNode(std::to_string(position));
                } else if (instruction.operand == "host.json_node_key" && args.size() == 3) {
                    const auto& object = requireObject(value);
                    const auto position = requireInteger(args[2], "JSON object key index");
                    if (position < 0 || static_cast<uint64_t>(position) >= object.size()) {
                        throw std::runtime_error("JSON object key index out of bounds");
                    }
                    auto item = object.begin();
                    std::advance(item, position);
                    result.value = item->first;
                } else if (instruction.operand == "host.json_node_object_count" && args.size() == 2) {
                    result.value = static_cast<int64_t>(requireObject(value).size());
                } else if (instruction.operand == "host.json_node_value" && args.size() == 2) {
                    result.value = serializeJson(value);
                } else throw std::runtime_error("Invalid arguments for native binding " + instruction.operand);
            } else if (instruction.operand == "host.text_trim" && args.size() == 1) {
                result.value = trim(requireText(args[0], "text"));
            } else if (instruction.operand == "host.string_lower" && args.size() == 1) {
                auto text = requireText(args[0], "text");
                std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                result.value = std::move(text);
            } else if (instruction.operand == "host.string_upper" && args.size() == 1) {
                auto text = requireText(args[0], "text");
                std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
                result.value = std::move(text);
            } else if (instruction.operand == "host.string_index" && args.size() == 2) {
                const auto index = requireText(args[0], "text").find(requireText(args[1], "substring"));
                result.value = static_cast<int64_t>(index == std::string::npos ? -1 : index);
            } else if (instruction.operand == "host.text_index" && args.size() == 2) {
                const auto index = requireText(args[0], "text").find(requireText(args[1], "substring"));
                result.value = static_cast<int64_t>(index == std::string::npos ? -1 : index);
            } else if (instruction.operand == "host.string_slice" && args.size() == 3) {
                const auto& text = requireText(args[0], "text");
                const auto start = requireInteger(args[1], "slice start");
                const auto end = requireInteger(args[2], "slice end");
                if (start < 0 || end < start) throw std::runtime_error("Invalid string slice");
                result.value = text.substr(static_cast<size_t>(start), static_cast<size_t>(end - start));
            } else if (instruction.operand == "host.string_replace" && args.size() == 4) {
                const auto& text = requireText(args[0], "text");
                const auto& pattern = requireText(args[1], "pattern");
                const auto& flags = requireText(args[2], "flags");
                const auto& replacement = requireText(args[3], "replacement");
                if (pattern.size() > 256 || flags.find_first_not_of("gi") != std::string::npos ||
                    flags.find('g') != flags.rfind('g') || flags.find('i') != flags.rfind('i')) {
                    throw std::runtime_error("Invalid text replacement pattern or flags");
                }
                try {
                    const auto syntax = std::regex::ECMAScript |
                        (flags.find('i') != std::string::npos ? std::regex::icase : std::regex::ECMAScript);
                    const std::regex expression(pattern, syntax);
                    result.value = flags.find('g') != std::string::npos
                        ? std::regex_replace(text, expression, replacement)
                        : std::regex_replace(text, expression, replacement, std::regex_constants::format_first_only);
                } catch (const std::regex_error&) {
                    throw std::runtime_error("Invalid text replacement pattern");
                }
            } else if (instruction.operand == "host.text_split" && args.size() == 2) {
                const auto& text = requireText(args[0], "text");
                const auto& separator = requireText(args[1], "separator");
                if (separator.empty()) throw std::runtime_error("Expected non-empty text separator");
                JsonValue::Array parts;
                size_t start = 0;
                size_t found = 0;
                while ((found = text.find(separator, start)) != std::string::npos) {
                    parts.push_back(JsonValue{text.substr(start, found - start)});
                    start = found + separator.size();
                }
                parts.push_back(JsonValue{text.substr(start)});
                result.value = serializeJson(JsonValue{std::move(parts)});
            } else if ((instruction.operand == "host.text_split_lines" ||
                        instruction.operand == "host.text_split_whitespace") && args.size() == 1) {
                const auto& text = requireText(args[0], "text");
                JsonValue::Array parts;
                if (instruction.operand == "host.text_split_lines") {
                    size_t start = 0;
                    for (size_t index = 0; index < text.size(); ++index) {
                        if (text[index] == '\n') {
                            const size_t end = index > start && text[index - 1] == '\r' ? index - 1 : index;
                            parts.push_back(JsonValue{text.substr(start, end - start)});
                            start = index + 1;
                        }
                    }
                    parts.push_back(JsonValue{text.substr(start)});
                } else {
                    std::istringstream words(text);
                    std::string word;
                    while (words >> word) parts.push_back(JsonValue{std::move(word)});
                }
                result.value = serializeJson(JsonValue{std::move(parts)});
            } else if (instruction.operand == "host.number_parse_integer" && args.size() == 1) {
                const auto& text = requireText(args[0], "integer text");
                size_t index = 0;
                while (index < text.size() && std::isspace(static_cast<unsigned char>(text[index]))) ++index;
                const size_t start = index;
                if (index < text.size() && (text[index] == '+' || text[index] == '-')) ++index;
                const size_t digits = index;
                while (index < text.size() && std::isdigit(static_cast<unsigned char>(text[index]))) ++index;
                int64_t number = 0;
                if (index > digits) {
                    try { number = std::stoll(text.substr(start, index - start)); }
                    catch (const std::out_of_range&) { throw std::runtime_error("Integer parse overflow"); }
                }
                result.value = number;
            } else if ((instruction.operand == "host.text_hash" ||
                        instruction.operand == "host.text_hash_utf8") && args.size() == 1) {
                const auto& text = requireText(args[0], "text");
                result.value = sha256(instruction.operand == "host.text_hash" ? utf16le(text) : text);
            } else if (instruction.operand == "host.number_compare" && args.size() == 2) {
                auto numeric = [](const PValue& value) {
                    if (const auto* integer = std::get_if<int64_t>(&value.value)) return static_cast<double>(*integer);
                    const auto parsed = parseJson(requireText(value, "numeric JSON value"));
                    const auto* number = std::get_if<double>(&parsed.value);
                    if (!number) throw std::runtime_error("Expected numeric JSON values");
                    return *number;
                };
                const double left = numeric(args[0]);
                const double right = numeric(args[1]);
                result.value = static_cast<int64_t>(left == right ? 0 : left < right ? -1 : 1);
            } else if (instruction.operand == "host.string_compare" && args.size() == 2) {
                const auto& left = requireText(args[0], "text");
                const auto& right = requireText(args[1], "text");
                result.value = static_cast<int64_t>(left == right ? 0 : left < right ? -1 : 1);
            } else if ((instruction.operand == "host.date_iso" || instruction.operand == "host.date_parse") &&
                       args.size() == 1) {
                const auto value = parseJson(requireText(args[0], "serialized date"));
                const auto milliseconds = dateMillis(value);
                if (!milliseconds) result.value = std::string("null");
                else if (instruction.operand == "host.date_iso") result.value = jsonQuote(isoDate(*milliseconds));
                else result.value = std::to_string(*milliseconds);
            } else if (instruction.operand == "host.date_now" && args.empty()) {
                const auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count();
                result.value = std::to_string(now);
            } else if ((instruction.operand == "host.fs_read_text" ||
                        instruction.operand == "host.fs_read_text_auto") && args.size() == 2) {
                result.value = readStorageText(storageRoots, maxFileBytes,
                    requireText(args[0], "storage root"), requireText(args[1], "storage path"),
                    instruction.operand == "host.fs_read_text_auto");
            } else if (instruction.operand == "host.fs_exists" && args.size() == 2) {
                try {
                    const auto resolved = resolveStoragePath(storageRoots, requireText(args[0], "storage root"),
                        requireText(args[1], "storage path"), false, false);
                    result.value = static_cast<int64_t>(resolved.exists ? 1 : 0);
                } catch (const HttpError& error) {
                    if (error.status() == 404) result.value = int64_t{0};
                    else throw;
                }
            } else if (instruction.operand == "host.fs_write_text" && args.size() == 3) {
                writeStorageText(storageRoots, maxFileBytes, requireText(args[0], "storage root"),
                    requireText(args[1], "storage path"), requireText(args[2], "storage content"));
                result.value = int64_t{0};
            } else if (instruction.operand == "host.fs_resolve_relative" && args.size() == 3) {
                result.value = resolveRelativeStoragePath(storageRoots, requireText(args[0], "storage root"),
                    requireText(args[1], "base storage path"), requireText(args[2], "relative storage reference"));
            } else if (instruction.operand == "host.raise_error" && args.size() == 1) {
                throw std::runtime_error("Program failure: " + requireText(args[0], "failure message"));
            } else throw std::runtime_error("Invalid arguments for native binding " + instruction.operand);
            stack.push_back(std::move(result));
            ++pc;
            continue;
        }
        if (instruction.op == "STORE" || instruction.op == "STORE_NAME") {
            variables.back()[instruction.operand] = pop();
            ++pc;
            continue;
        }
        if (instruction.op == "MAP_RETURN") {
            const PValue* value = nullptr;
            for (auto frame = variables.rbegin(); frame != variables.rend(); ++frame) {
                const auto found = frame->find(instruction.operand);
                if (found != frame->end()) { value = &found->second; break; }
            }
            if (!value) throw std::runtime_error("Undefined MAP_RETURN variable: " + instruction.operand);
            if (const auto* string = std::get_if<std::string>(&value->value)) {
                try {
                    (void)JsonParser(*string).parse();
                    responseBody = *string;
                } catch (...) {
                    responseBody = jsonQuote(*string);
                }
            } else responseBody = std::to_string(asInt(*value));
            ++pc;
            continue;
        }
        throw std::runtime_error("Native service host does not support opcode " + instruction.op);
    }
    if (responseBody.empty()) responseBody = "{}";
    if (debugOutput) {
        writeDebugEvent(*debugOutput, "{\"event\":\"terminated\",\"status\":" +
            std::to_string(responseStatus) + ",\"body\":" + jsonQuote(responseBody) + "}");
    }
    return HttpResponse{responseStatus, std::move(responseBody)};
}

void validateMap(const JsonValue& map, std::string& serviceId, const Program& program,
    bool canReadStorage, bool canWriteStorage) {
    const auto& root = asObject(map, "root");
    if (asInteger(property(root, "hostBindingsVersion"), "hostBindingsVersion") != 1) {
        throw std::runtime_error("Unsupported service host bindings version");
    }
    if (!containsString(property(root, "targets"), "native")) {
        throw std::runtime_error("Program map does not advertise the native target");
    }
    const auto& runtimeUnit = asObject(property(root, "runtimeUnit"), "runtimeUnit");
    if (asString(property(runtimeUnit, "kind"), "runtimeUnit.kind") != "service") {
        throw std::runtime_error("Native host accepts service artifacts only");
    }
    serviceId = asString(property(runtimeUnit, "id"), "runtimeUnit.id");
    if (serviceId.empty()) throw std::runtime_error("Program map service ID is empty");
    const auto& requirements = property(root, "requiredHostCapabilities");
    const auto* array = std::get_if<JsonValue::Array>(&requirements.value);
    if (!array) throw std::runtime_error("Invalid requiredHostCapabilities");
    bool needsFilesystemRead = false;
    bool needsFilesystemWrite = false;
    for (const auto& instruction : program.instructions) {
        if (instruction.op != "CALL_EXT") continue;
        if (instruction.operand == "host.fs_read_text" || instruction.operand == "host.fs_read_text_auto" ||
            instruction.operand == "host.fs_exists" || instruction.operand == "host.fs_resolve_relative") {
            needsFilesystemRead = true;
        } else if (instruction.operand == "host.fs_write_text") {
            needsFilesystemWrite = true;
            needsFilesystemRead = true;
        }
    }
    if (needsFilesystemRead && !canReadStorage) {
        throw std::runtime_error("Native host does not provide requested host capability filesystem.read");
    }
    if (needsFilesystemWrite && !canWriteStorage) {
        throw std::runtime_error("Native host does not provide requested host capability filesystem.write");
    }
    for (const auto& item : *array) {
        const auto& capability = asString(item, "requiredHostCapabilities item");
        if (capability == "filesystem.read" && canReadStorage) continue;
        if (capability == "filesystem.write" && canWriteStorage) continue;
        throw std::runtime_error("Native host does not provide requested host capability " + capability);
    }
}

std::string stringProperty(const JsonValue::Object& object, const std::string& key,
    const std::string& fallback = {}) {
    const auto* value = optionalProperty(object, key);
    return value ? asString(*value, key.c_str()) : fallback;
}

int64_t safeInteger(const JsonValue& value, const char* label) {
    const auto* number = std::get_if<double>(&value.value);
    if (!number || std::floor(*number) != *number
        || *number < -9007199254740991.0 || *number > 9007199254740991.0) {
        throw std::runtime_error(std::string("Expected safe integer: ") + label);
    }
    return static_cast<int64_t>(*number);
}

const JsonValue::Array& arrayProperty(const JsonValue::Object& object, const char* key) {
    return requireArray(property(object, key));
}

std::string lowerAscii(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return value;
}

struct HttpUrl {
    std::string host;
    std::string port;
    std::string authority;
    std::string target;
};

HttpUrl parseHttpUrl(const std::string& value) {
    if (value.rfind("http://", 0) != 0 || value.find('#') != std::string::npos) {
        throw std::runtime_error("Native cache resolver requires an absolute HTTP URL");
    }
    const size_t authorityStart = 7;
    const size_t authorityEnd = value.find_first_of("/?", authorityStart);
    const std::string authority = value.substr(authorityStart,
        authorityEnd == std::string::npos ? std::string::npos : authorityEnd - authorityStart);
    if (authority.empty() || authority.find('@') != std::string::npos) {
        throw std::runtime_error("Invalid native cache HTTP URL authority");
    }
    std::string host;
    std::string port = "80";
    if (authority.front() == '[') {
        const auto closing = authority.find(']');
        if (closing == std::string::npos) throw std::runtime_error("Invalid IPv6 cache URL");
        host = authority.substr(1, closing - 1);
        if (closing + 1 < authority.size()) {
            if (authority[closing + 1] != ':') throw std::runtime_error("Invalid cache URL port");
            port = authority.substr(closing + 2);
        }
    } else {
        const auto colon = authority.rfind(':');
        if (colon != std::string::npos && authority.find(':') == colon) {
            host = authority.substr(0, colon);
            port = authority.substr(colon + 1);
        } else host = authority;
    }
    if (host.empty() || port.empty() || !std::all_of(port.begin(), port.end(), [](unsigned char c) {
        return c >= '0' && c <= '9';
    })) throw std::runtime_error("Invalid cache URL host or port");
    const unsigned long portNumber = std::stoul(port);
    if (portNumber == 0 || portNumber > 65535) throw std::runtime_error("Invalid cache URL port");
    std::string target = "/";
    if (authorityEnd != std::string::npos) {
        target = value[authorityEnd] == '?' ? "/" + value.substr(authorityEnd) : value.substr(authorityEnd);
    }
    if (target.empty() || target.front() != '/' || target.find('\r') != std::string::npos
        || target.find('\n') != std::string::npos) throw std::runtime_error("Invalid cache URL path");
    return {host, port, authority, target};
}

#ifdef _WIN32
using CacheSocket = SOCKET;
static constexpr CacheSocket INVALID_CACHE_SOCKET = INVALID_SOCKET;
#else
using CacheSocket = int;
static constexpr CacheSocket INVALID_CACHE_SOCKET = -1;
#endif

void closeCacheSocket(CacheSocket socket) {
    if (socket == INVALID_CACHE_SOCKET) return;
#ifdef _WIN32
    closesocket(socket);
#else
    close(socket);
#endif
}

bool sendCacheRequest(CacheSocket socket, const std::string& request) {
    size_t sent = 0;
    while (sent < request.size()) {
#ifdef _WIN32
        const int result = send(socket, request.data() + sent,
            static_cast<int>(std::min<size_t>(request.size() - sent, std::numeric_limits<int>::max())), 0);
#else
        const auto result = send(socket, request.data() + sent, request.size() - sent, 0);
#endif
        if (result <= 0) return false;
        sent += static_cast<size_t>(result);
    }
    return true;
}

struct HttpGetResult {
    int status;
    std::string body;
};

HttpGetResult httpGet(const std::string& url, size_t maxBodyBytes = 65536) {
    const auto parsedUrl = parseHttpUrl(url);
    addrinfo hints{};
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    addrinfo* addresses = nullptr;
    const int lookup = getaddrinfo(parsedUrl.host.c_str(), parsedUrl.port.c_str(), &hints, &addresses);
    if (lookup != 0) throw std::runtime_error("Unable to resolve cache URL host");
    CacheSocket socket = INVALID_CACHE_SOCKET;
    for (auto* address = addresses; address; address = address->ai_next) {
        socket = ::socket(address->ai_family, address->ai_socktype, address->ai_protocol);
        if (socket == INVALID_CACHE_SOCKET) continue;
#ifdef _WIN32
        const DWORD timeoutMs = 3000;
        setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));
        setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));
#else
        timeval timeout{};
        timeout.tv_sec = 3;
        setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
        setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
#endif
        if (connect(socket, address->ai_addr, static_cast<int>(address->ai_addrlen)) == 0) break;
        closeCacheSocket(socket);
        socket = INVALID_CACHE_SOCKET;
    }
    freeaddrinfo(addresses);
    if (socket == INVALID_CACHE_SOCKET) throw std::runtime_error("Unable to connect to cache URL");
    const std::string request = "GET " + parsedUrl.target + " HTTP/1.1\r\nHost: " +
        parsedUrl.authority + "\r\nAccept: application/json\r\nConnection: close\r\n\r\n";
    if (!sendCacheRequest(socket, request)) {
        closeCacheSocket(socket);
        throw std::runtime_error("Unable to send cache HTTP request");
    }
    std::string response;
    char buffer[4096];
    for (;;) {
#ifdef _WIN32
        const int received = recv(socket, buffer, static_cast<int>(sizeof(buffer)), 0);
#else
        const auto received = recv(socket, buffer, sizeof(buffer), 0);
#endif
        if (received == 0) break;
        if (received < 0) {
            closeCacheSocket(socket);
            throw std::runtime_error("Cache HTTP request timed out or failed");
        }
        response.append(buffer, static_cast<size_t>(received));
        if (response.size() > maxBodyBytes + 32768) {
            closeCacheSocket(socket);
            throw std::runtime_error("Cache HTTP response exceeds its size limit");
        }
    }
    closeCacheSocket(socket);
    const size_t headerEnd = response.find("\r\n\r\n");
    if (headerEnd == std::string::npos) throw std::runtime_error("Invalid cache HTTP response");
    const size_t statusEnd = response.find("\r\n");
    std::istringstream statusLine(response.substr(0, statusEnd));
    std::string protocol;
    int status = 0;
    if (!(statusLine >> protocol >> status) || protocol.rfind("HTTP/1.", 0) != 0) {
        throw std::runtime_error("Invalid cache HTTP status line");
    }
    bool hasLength = false;
    size_t contentLength = 0;
    size_t lineStart = statusEnd == std::string::npos ? headerEnd : statusEnd + 2;
    while (lineStart < headerEnd) {
        const size_t lineEnd = response.find("\r\n", lineStart);
        const std::string line = response.substr(lineStart, lineEnd - lineStart);
        const size_t colon = line.find(':');
        if (colon == std::string::npos) throw std::runtime_error("Invalid cache HTTP header");
        const std::string name = lowerAscii(line.substr(0, colon));
        std::string value = line.substr(colon + 1);
        const size_t first = value.find_first_not_of(" \t");
        value = first == std::string::npos ? "" : value.substr(first);
        if (name == "content-length") {
            size_t consumed = 0;
            contentLength = static_cast<size_t>(std::stoull(value, &consumed));
            if (consumed != value.size() || contentLength > maxBodyBytes)
                throw std::runtime_error("Cache HTTP body exceeds its size limit");
            hasLength = true;
        } else if (name == "transfer-encoding" && lowerAscii(value) != "identity") {
            throw std::runtime_error("Chunked cache HTTP responses are unsupported");
        }
        if (lineEnd == std::string::npos || lineEnd >= headerEnd) break;
        lineStart = lineEnd + 2;
    }
    const size_t bodyStart = headerEnd + 4;
    std::string body = response.substr(bodyStart);
    if ((hasLength && body.size() != contentLength) || body.size() > maxBodyBytes) {
        throw std::runtime_error("Incomplete or oversized cache HTTP body");
    }
    return {status, std::move(body)};
}

std::string urlEncode(const std::string& value) {
    static constexpr char hex[] = "0123456789ABCDEF";
    std::string result;
    for (const unsigned char character : value) {
        if ((character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
            || (character >= '0' && character <= '9') || character == '-' || character == '_'
            || character == '.' || character == '~') result.push_back(static_cast<char>(character));
        else {
            result.push_back('%');
            result.push_back(hex[character >> 4]);
            result.push_back(hex[character & 15]);
        }
    }
    return result;
}

std::map<std::string, std::string> parseQuery(const std::string& value) {
    std::map<std::string, std::string> result;
    size_t start = 0;
    while (start < value.size()) {
        const size_t end = value.find('&', start);
        const std::string item = value.substr(start, end == std::string::npos ? std::string::npos : end - start);
        const size_t equals = item.find('=');
        const std::string key = item.substr(0, equals);
        const std::string content = equals == std::string::npos ? "" : item.substr(equals + 1);
        auto decode = [](const std::string& encoded) {
            std::string decoded;
            for (size_t index = 0; index < encoded.size(); ++index) {
                if (encoded[index] == '+') decoded.push_back(' ');
                else if (encoded[index] == '%') {
                    if (index + 2 >= encoded.size()) throw std::runtime_error("Invalid query escape");
                    auto digit = [](char c) -> int {
                        if (c >= '0' && c <= '9') return c - '0';
                        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
                        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
                        return -1;
                    };
                    const int high = digit(encoded[index + 1]), low = digit(encoded[index + 2]);
                    if (high < 0 || low < 0) throw std::runtime_error("Invalid query escape");
                    decoded.push_back(static_cast<char>((high << 4) | low));
                    index += 2;
                } else decoded.push_back(encoded[index]);
            }
            return decoded;
        };
        const std::string decodedKey = decode(key);
        if (decodedKey.empty() || !result.emplace(decodedKey, decode(content)).second)
            throw std::runtime_error("Invalid or duplicate snapshot query parameter");
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return result;
}

struct CacheMetadata {
    int64_t observationMs = 0;
    int64_t observationSequence = 0;
    int64_t remainingTtlMs = 0;
};

struct CacheRow {
    JsonValue::Object values;
    CacheMetadata metadata;
};

using CacheScope = std::map<std::string, CacheRow>;
using CacheSourceRows = std::map<std::string, std::vector<CacheRow>>;

struct CacheQueryResult {
    JsonValue::Object row;
    CacheMetadata metadata;
};

bool jsonEqual(const JsonValue& left, const JsonValue& right) {
    if (left.value.index() != right.value.index()) return false;
    if (const auto* a = std::get_if<double>(&left.value)) return *a == std::get<double>(right.value);
    if (const auto* a = std::get_if<std::string>(&left.value)) return *a == std::get<std::string>(right.value);
    if (const auto* a = std::get_if<bool>(&left.value)) return *a == std::get<bool>(right.value);
    return serializeJson(left) == serializeJson(right);
}

int compareJson(const JsonValue& left, const JsonValue& right) {
    if (left.value.index() != right.value.index()) throw std::runtime_error("SQL values have different types");
    if (const auto* a = std::get_if<double>(&left.value)) {
        const double b = std::get<double>(right.value);
        return *a < b ? -1 : *a > b ? 1 : 0;
    }
    if (const auto* a = std::get_if<std::string>(&left.value)) {
        const auto& b = std::get<std::string>(right.value);
        return *a < b ? -1 : *a > b ? 1 : 0;
    }
    if (const auto* a = std::get_if<bool>(&left.value)) {
        const bool b = std::get<bool>(right.value);
        return *a == b ? 0 : *a ? 1 : -1;
    }
    throw std::runtime_error("Unsupported SQL comparison value");
}

const JsonValue& rowColumn(const CacheScope& scope, const JsonValue::Object& branch,
    const JsonValue::Object& column) {
    const std::string name = stringProperty(column, "column");
    const std::string qualifier = lowerAscii(stringProperty(column, "qualifier"));
    if (!qualifier.empty()) {
        const auto source = scope.find(qualifier);
        if (source == scope.end()) throw std::runtime_error("Unknown SQL table alias: " + qualifier);
        for (const auto& [field, value] : source->second.values)
            if (lowerAscii(field) == lowerAscii(name)) return value;
        throw std::runtime_error("Unknown SQL column: " + name);
    }
    const auto& tables = arrayProperty(branch, "tables");
    const JsonValue* match = nullptr;
    for (const auto& tableValue : tables) {
        const auto& table = asObject(tableValue, "SQL table");
        const auto source = scope.find(lowerAscii(stringProperty(table, "alias")));
        if (source == scope.end()) continue;
        for (const auto& [field, value] : source->second.values) {
            if (lowerAscii(field) != lowerAscii(name)) continue;
            if (match) throw std::runtime_error("Ambiguous SQL column: " + name);
            match = &value;
        }
    }
    if (!match) throw std::runtime_error("Unknown SQL column: " + name);
    return *match;
}

CacheMetadata mergeCacheMetadata(const CacheMetadata& left, const CacheMetadata& right) {
    return {std::min(left.observationMs, right.observationMs),
        std::max(left.observationSequence, right.observationSequence),
        std::min(left.remainingTtlMs, right.remainingTtlMs)};
}

bool matchesCachePredicate(const JsonValue::Object& predicate, const CacheScope& scope,
    const JsonValue::Object& branch) {
    const auto& leftColumn = asObject(property(predicate, "left"), "SQL WHERE column");
    const auto& literal = asObject(property(predicate, "right"), "SQL WHERE literal");
    const int comparison = compareJson(rowColumn(scope, branch, leftColumn), property(literal, "value"));
    const std::string operation = stringProperty(predicate, "operator");
    if (operation == "=") return comparison == 0;
    if (operation == "!=" || operation == "<>") return comparison != 0;
    if (operation == "<") return comparison < 0;
    if (operation == "<=") return comparison <= 0;
    if (operation == ">") return comparison > 0;
    if (operation == ">=") return comparison >= 0;
    throw std::runtime_error("Unsupported SQL comparison operator");
}

JsonValue::Object projectCacheRow(const JsonValue::Object& branch, const CacheScope& scope) {
    JsonValue::Object result;
    const auto& projections = arrayProperty(branch, "projections");
    const auto& tables = arrayProperty(branch, "tables");
    for (const auto& projectionValue : projections) {
        const auto& projection = asObject(projectionValue, "SQL projection");
        const std::string kind = stringProperty(projection, "kind");
        const bool star = kind == "star" || (optionalProperty(projection, "star")
            && std::get_if<bool>(&optionalProperty(projection, "star")->value)
            && std::get<bool>(optionalProperty(projection, "star")->value));
        if (star) {
            const std::string qualifier = lowerAscii(stringProperty(projection, "qualifier"));
            const auto table = std::find_if(tables.begin(), tables.end(), [&](const JsonValue& value) {
                return lowerAscii(stringProperty(asObject(value, "SQL table"), "alias")) == qualifier;
            });
            const std::string alias = qualifier.empty()
                ? lowerAscii(stringProperty(asObject(tables.front(), "SQL table"), "alias"))
                : lowerAscii(stringProperty(asObject(*table, "SQL table"), "alias"));
            const auto source = scope.find(alias);
            if (source == scope.end()) throw std::runtime_error("Unknown SQL star source");
            result.insert(source->second.values.begin(), source->second.values.end());
            continue;
        }
        const std::string outputName = stringProperty(projection, "alias",
            stringProperty(projection, "column"));
        if (kind == "literal") result[outputName] = property(projection, "value");
        else result[outputName] = rowColumn(scope, branch, projection);
    }
    return result;
}

std::vector<CacheQueryResult> executeNativeCacheQuery(const JsonValue::Object& plan,
    const CacheSourceRows& sources) {
    if (stringProperty(plan, "kind") != "select") throw std::runtime_error("Invalid native cache query plan");
    std::vector<CacheQueryResult> results;
    size_t comparisons = 0;
    for (const auto& branchValue : arrayProperty(plan, "branches")) {
        const auto& branch = asObject(branchValue, "SQL branch");
        const auto& tables = arrayProperty(branch, "tables");
        if (tables.empty()) throw std::runtime_error("SQL branch has no source table");
        const auto& firstTable = asObject(tables.front(), "SQL table");
        const std::string firstName = stringProperty(firstTable, "name");
        const auto firstRows = sources.find(firstName);
        if (firstRows == sources.end()) throw std::runtime_error("SQL source is unavailable: " + firstName);
        const std::string firstAlias = lowerAscii(stringProperty(firstTable, "alias"));
        std::vector<std::pair<CacheScope, CacheMetadata>> rows;
        for (const auto& row : firstRows->second) rows.push_back({{{firstAlias, row}}, row.metadata});
        for (const auto& joinValue : arrayProperty(branch, "joins")) {
            const auto& join = asObject(joinValue, "SQL join");
            const auto& table = asObject(property(join, "table"), "SQL join table");
            const std::string sourceName = stringProperty(table, "name");
            const auto candidates = sources.find(sourceName);
            if (candidates == sources.end()) throw std::runtime_error("SQL source is unavailable: " + sourceName);
            std::vector<std::pair<CacheScope, CacheMetadata>> joined;
            for (const auto& current : rows) for (const auto& candidate : candidates->second) {
                if (++comparisons > 8192) throw std::runtime_error("Cache query join comparison limit exceeded");
                CacheScope scope = current.first;
                scope[lowerAscii(stringProperty(table, "alias"))] = candidate;
                const auto& left = asObject(property(join, "left"), "SQL join column");
                const auto& right = asObject(property(join, "right"), "SQL join column");
                if (!jsonEqual(rowColumn(scope, branch, left), rowColumn(scope, branch, right))) continue;
                joined.push_back({std::move(scope), mergeCacheMetadata(current.second, candidate.metadata)});
                if (joined.size() > 800) throw std::runtime_error("Cache query result row limit exceeded");
            }
            rows = std::move(joined);
        }
        for (const auto& predicateValue : arrayProperty(branch, "where")) {
            const auto& predicate = asObject(predicateValue, "SQL predicate");
            rows.erase(std::remove_if(rows.begin(), rows.end(), [&](const auto& item) {
                return !matchesCachePredicate(predicate, item.first, branch);
            }), rows.end());
        }
        for (const auto& row : rows) {
            results.push_back({projectCacheRow(branch, row.first), row.second});
            if (results.size() > 800) throw std::runtime_error("Cache query result row limit exceeded");
        }
    }
    const auto* orderValue = optionalProperty(plan, "orderBy");
    if (orderValue) {
        const auto& orderBy = requireArray(*orderValue);
        std::stable_sort(results.begin(), results.end(), [&](const auto& left, const auto& right) {
            for (const auto& item : orderBy) {
                const auto& order = asObject(item, "SQL order");
                const std::string field = stringProperty(order, "column");
                const auto leftField = left.row.find(field), rightField = right.row.find(field);
                if (leftField == left.row.end() || rightField == right.row.end())
                    throw std::runtime_error("ORDER BY field is missing from query result");
                const int comparison = compareJson(leftField->second, rightField->second);
                if (comparison) return stringProperty(order, "direction") == "desc"
                    ? comparison > 0 : comparison < 0;
            }
            return false;
        });
    }
    const auto* limit = optionalProperty(plan, "limit");
    if (limit && !std::holds_alternative<std::nullptr_t>(limit->value)) {
        const int64_t count = safeInteger(*limit, "SQL limit");
        if (count < 0) throw std::runtime_error("Invalid SQL LIMIT");
        if (results.size() > static_cast<size_t>(count)) results.resize(static_cast<size_t>(count));
    }
    return results;
}

struct RemoteCacheSnapshot {
    std::vector<CacheRow> rows;
    std::string revision;
    std::string instanceId;
    std::string collectorId;
    std::string bootId;
    std::vector<JsonValue> errors;
    bool complete = true;
};

JsonValue checkedHttpJson(const std::string& url, size_t maxBytes, const char* label) {
    const auto response = httpGet(url, maxBytes);
    if (response.status < 200 || response.status >= 300) {
        throw std::runtime_error(std::string(label) + " returned HTTP " + std::to_string(response.status));
    }
    return parseJson(response.body);
}

RemoteCacheSnapshot fetchRemoteCacheSnapshot(const std::string& aggregatorUrl,
    const std::string& serviceId, const std::string& cacheName) {
    const auto aggregator = parseHttpUrl(aggregatorUrl);
    const std::string resolvePath = "/api/cache-services/" + urlEncode(serviceId) + "/caches/"
        + urlEncode(cacheName) + "/snapshot";
    const auto resolutionValue = checkedHttpJson("http://" + aggregator.authority + resolvePath, 4096,
        "Cache Aggregator resolution");
    const auto& resolution = asObject(resolutionValue, "cache resolution response");
    if (stringProperty(resolution, "serviceId") != serviceId
        || stringProperty(resolution, "cacheName") != cacheName) {
        throw std::runtime_error("Cache Aggregator returned a mismatched source");
    }
    const std::string snapshotUrl = stringProperty(resolution, "snapshotUrl");
    (void)parseHttpUrl(snapshotUrl);
    RemoteCacheSnapshot snapshot;
    snapshot.instanceId = stringProperty(resolution, "instanceId");
    std::set<std::string> seenKeys;
    std::string cursor;
    std::string fence;
    int64_t total = -1;
    int64_t sequence = -1;
    for (int pageNumber = 0; pageNumber < 400; ++pageNumber) {
        std::string pageUrl = snapshotUrl;
        pageUrl += pageUrl.find('?') == std::string::npos ? "?" : "&";
        pageUrl += "limit=2";
        if (!cursor.empty()) pageUrl += "&cursor=" + urlEncode(cursor);
        if (!fence.empty()) pageUrl += "&revision=" + urlEncode(fence);
        const auto pageValue = checkedHttpJson(pageUrl, 4096, "Remote cache snapshot");
        const auto& page = asObject(pageValue, "remote cache page");
        if (safeInteger(property(page, "version"), "snapshot version") != 1)
            throw std::runtime_error("Unsupported remote cache snapshot version");
        const std::string revision = stringProperty(page, "revision");
        const auto pageSequence = safeInteger(property(page, "sequence"), "snapshot sequence");
        const auto sampledAtMs = safeInteger(property(page, "sampledAtMs"), "snapshot sample time");
        const int64_t pageTotal = safeInteger(property(page, "total"), "snapshot total");
        if (revision.empty() || revision.size() > 16
            || !std::all_of(revision.begin(), revision.end(), [](unsigned char c) { return c >= '0' && c <= '9'; })
            || pageTotal < 0 || pageTotal > 800 || pageSequence < 0 || sampledAtMs < 0)
            throw std::runtime_error("Invalid remote cache snapshot envelope");
        const auto collectorId = asString(property(page, "collectorId"), "snapshot collector ID");
        const auto bootId = asString(property(page, "bootId"), "snapshot boot ID");
        if (pageNumber == 0) {
            snapshot.revision = revision;
            snapshot.collectorId = collectorId;
            snapshot.bootId = bootId;
            total = pageTotal;
            sequence = pageSequence;
        } else if (revision != fence || revision != snapshot.revision || pageSequence != sequence
            || pageTotal != total || collectorId != snapshot.collectorId || bootId != snapshot.bootId) {
            throw std::runtime_error("Remote cache source changed during pagination");
        }
        const auto& records = arrayProperty(page, "records");
        if (records.size() > 2) throw std::runtime_error("Remote cache page has too many records");
        for (const auto& recordValue : records) {
            const auto& record = asObject(recordValue, "remote cache record");
            const std::string key = stringProperty(record, "key");
            if (key.empty() || !seenKeys.insert(key).second)
                throw std::runtime_error("Invalid or duplicate remote cache key");
            const auto& device = property(record, "device");
            if (!std::holds_alternative<JsonValue::Object>(device.value))
                throw std::runtime_error("Remote cache device value must be an object");
            const int64_t observationMs = safeInteger(property(record, "observationMs"), "observation time");
            const int64_t observationSequence = safeInteger(property(record, "observationSequence"), "observation sequence");
            const int64_t ttl = safeInteger(property(record, "remainingTTLms"), "remaining TTL");
            if (observationMs < 0 || observationSequence < 0 || ttl < 0)
                throw std::runtime_error("Invalid remote cache observation metadata");
            CacheRow row;
            row.values = {
                {"cache_key", JsonValue{key}},
                {"device_json", JsonValue{serializeJson(device)}},
                {"observation_ms", JsonValue{static_cast<double>(observationMs)}},
                {"observation_sequence", JsonValue{static_cast<double>(observationSequence)}},
                {"remaining_ttl_ms", JsonValue{static_cast<double>(ttl)}}
            };
            row.metadata = {observationMs, observationSequence, ttl};
            snapshot.rows.push_back(std::move(row));
            if (snapshot.rows.size() > 800 || snapshot.rows.size() > static_cast<size_t>(total))
                throw std::runtime_error("Remote cache snapshot exceeds its declared total");
        }
        const auto* errors = optionalProperty(page, "errors");
        if (errors) {
            for (const auto& error : requireArray(*errors)) {
                snapshot.errors.push_back(error);
                snapshot.complete = false;
            }
        }
        const auto* complete = optionalProperty(page, "complete");
        if (complete) {
            const auto* boolean = std::get_if<bool>(&complete->value);
            if (!boolean) throw std::runtime_error("Invalid remote cache completeness flag");
            if (!*boolean) {
                snapshot.complete = false;
                if (snapshot.errors.empty()) snapshot.errors.push_back(JsonValue{"Nested source is incomplete"});
            }
        }
        const std::string nextCursor = stringProperty(page, "nextCursor");
        if (nextCursor.size() > 256) throw std::runtime_error("Invalid remote cache snapshot cursor");
        if (nextCursor.empty()) {
            if (static_cast<int64_t>(snapshot.rows.size()) != total)
                throw std::runtime_error("Remote cache snapshot ended before its declared total");
            return snapshot;
        }
        if (records.empty() || stringProperty(asObject(records.back(), "remote cache record"), "key") != nextCursor)
            throw std::runtime_error("Invalid remote cache snapshot cursor");
        cursor = nextCursor;
        fence = revision;
    }
    throw std::runtime_error("Remote cache snapshot page limit exceeded");
}

std::string cacheRevision(const std::string& value) {
    const std::string digest = sha256(value);
    return std::to_string(std::stoull(digest.substr(0, 13), nullptr, 16));
}

HttpResponse hostedCacheSnapshot(const JsonValue& programMap, const std::string& serviceId,
    const std::string& bootId, const std::string& aggregatorUrl, const std::string& cacheName,
    const std::string& rawQuery) {
    const auto query = parseQuery(rawQuery);
    const std::string cursor = query.count("cursor") ? query.at("cursor") : "";
    const std::string revisionFence = query.count("revision") ? query.at("revision") : "";
    if (cursor.size() > 256 || revisionFence.size() > 16
        || (!revisionFence.empty() && !std::all_of(revisionFence.begin(), revisionFence.end(),
            [](unsigned char c) { return c >= '0' && c <= '9'; }))
        || (!cursor.empty() && revisionFence.empty())) {
        throw HttpError(400, "Invalid cache snapshot cursor or revision");
    }
    const auto& root = asObject(programMap, "program map");
    const auto* declarationsValue = optionalProperty(root, "hostCaches");
    if (!declarationsValue) throw HttpError(404, "Cache is not declared");
    const auto& declarations = requireArray(*declarationsValue);
    const JsonValue::Object* declaration = nullptr;
    for (const auto& value : declarations) {
        const auto& item = asObject(value, "cache declaration");
        if (stringProperty(item, "name") == cacheName) { declaration = &item; break; }
    }
    if (!declaration) throw HttpError(404, "Cache is not declared");
    const auto* virtualValue = optionalProperty(*declaration, "virtual");
    if (!virtualValue || !std::get_if<bool>(&virtualValue->value) || !std::get<bool>(virtualValue->value))
        throw HttpError(503, "Native host does not provide a physical hosted-cache store");
    const auto* planValue = optionalProperty(*declaration, "queryPlan");
    if (!planValue || !std::holds_alternative<JsonValue::Object>(planValue->value))
        throw HttpError(503, "Native virtual caches require a read-only query plan");
    if (aggregatorUrl.empty()) throw HttpError(503, "Native cache Aggregator URL is not configured");
    const auto& plan = asObject(*planValue, "cache query plan");
    const auto& sourceDefinitions = arrayProperty(*declaration, "sourceDefinitions");
    CacheSourceRows sourceRows;
    JsonValue::Array errors;
    std::string stampData;
    bool complete = true;
    for (const auto& sourceValue : sourceDefinitions) {
        const auto& source = asObject(sourceValue, "virtual cache source");
        const std::string alias = stringProperty(source, "alias");
        const std::string sourceService = stringProperty(source, "serviceId");
        const std::string sourceCache = stringProperty(source, "cacheName");
        const auto* localValue = optionalProperty(source, "local");
        try {
            if (localValue && std::get_if<bool>(&localValue->value) && std::get<bool>(localValue->value))
                throw std::runtime_error("Native virtual cache does not support local cache sources");
            const auto snapshot = fetchRemoteCacheSnapshot(aggregatorUrl, sourceService, sourceCache);
            sourceRows[alias] = snapshot.rows;
            stampData += alias + "|" + sourceService + "|" + sourceCache + "|" + snapshot.instanceId
                + "|" + snapshot.revision + "|" + snapshot.collectorId + "|" + snapshot.bootId + ";";
            if (!snapshot.complete) {
                complete = false;
                for (const auto& error : snapshot.errors) errors.push_back(JsonValue{JsonValue::Object{
                    {"alias", JsonValue{alias}}, {"error", error}
                }});
            }
        } catch (const std::exception& error) {
            sourceRows[alias] = {};
            complete = false;
            const std::string message = error.what();
            stampData += alias + "|" + sourceService + "|" + sourceCache + "|error:" + message + ";";
            errors.push_back(JsonValue{JsonValue::Object{
                {"alias", JsonValue{alias}}, {"serviceId", JsonValue{sourceService}},
                {"cacheName", JsonValue{sourceCache}}, {"error", JsonValue{message}}
            }});
        }
    }
    const std::string revision = cacheRevision(cacheName + "|" + stampData);
    if (!revisionFence.empty() && revisionFence != revision)
        throw HttpError(409, "Cache snapshot revision changed");
    const auto queryResults = executeNativeCacheQuery(plan, sourceRows);
    const JsonValue* outputFieldsValue = optionalProperty(*declaration, "viewFields");
    if (!outputFieldsValue) outputFieldsValue = optionalProperty(*declaration, "fields");
    if (!outputFieldsValue) throw HttpError(503, "Cache query output fields are missing");
    const auto& outputFields = requireArray(*outputFieldsValue);
    JsonValue::Array allRecords;
    const auto sampledAtMs = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    for (size_t index = 0; index < queryResults.size(); ++index) {
        const auto& result = queryResults[index];
        if (result.row.size() != outputFields.size()) throw HttpError(503, "Cache query result schema mismatch");
        for (const auto& fieldValue : outputFields) {
            const auto& field = asObject(fieldValue, "cache output field");
            const std::string name = stringProperty(field, "name");
            const std::string type = stringProperty(field, "type");
            const auto value = result.row.find(name);
            if (value == result.row.end()) throw HttpError(503, "Cache query output field is missing");
            const bool valid = type == "string" ? std::holds_alternative<std::string>(value->second.value)
                : type == "integer" ? std::get_if<double>(&value->second.value)
                    && std::floor(std::get<double>(value->second.value)) == std::get<double>(value->second.value)
                : type == "boolean" ? std::holds_alternative<bool>(value->second.value)
                    || (std::get_if<double>(&value->second.value)
                        && (std::get<double>(value->second.value) == 0 || std::get<double>(value->second.value) == 1))
                : false;
            if (!valid) throw HttpError(503, "Cache query result does not match its output schema");
        }
        allRecords.push_back(JsonValue{JsonValue::Object{
            {"key", JsonValue{"q:" + std::to_string(index)}},
            {"device", JsonValue{result.row}},
            {"observationMs", JsonValue{static_cast<double>(result.metadata.observationMs)}},
            {"observationSequence", JsonValue{static_cast<double>(result.metadata.observationSequence)}},
            {"remainingTTLms", JsonValue{static_cast<double>(result.metadata.remainingTtlMs)}}
        }});
    }
    size_t start = 0;
    if (!cursor.empty()) {
        const auto found = std::find_if(allRecords.begin(), allRecords.end(), [&](const JsonValue& value) {
            return stringProperty(asObject(value, "cache result"), "key") == cursor;
        });
        if (found == allRecords.end()) throw HttpError(400, "Invalid cache snapshot cursor");
        start = static_cast<size_t>(std::distance(allRecords.begin(), found)) + 1;
    }
    JsonValue::Array pageRecords;
    for (size_t index = start; index < std::min(start + 2, allRecords.size()); ++index)
        pageRecords.push_back(allRecords[index]);
    const std::string nextCursor = start + pageRecords.size() < allRecords.size() && !pageRecords.empty()
        ? stringProperty(asObject(pageRecords.back(), "cache result"), "key") : "";
    JsonValue::Array records;
    for (const auto& recordValue : pageRecords) {
        const auto& record = asObject(recordValue, "cache result");
        records.push_back(JsonValue{JsonValue::Object{
            {"key", property(record, "key")}, {"device", property(record, "device")},
            {"observationMs", property(record, "observationMs")},
            {"observationSequence", property(record, "observationSequence")},
            {"remainingTTLms", property(record, "remainingTTLms")}
        }});
    }
    const auto sequence = safeInteger(JsonValue{std::strtod(revision.c_str(), nullptr)}, "cache revision");
    JsonValue::Object response{
        {"version", JsonValue{1.0}}, {"revision", JsonValue{revision}},
        {"sequence", JsonValue{static_cast<double>(sequence)}},
        {"sampledAtMs", JsonValue{static_cast<double>(sampledAtMs)}},
        {"total", JsonValue{static_cast<double>(allRecords.size())}},
        {"records", JsonValue{std::move(records)}}, {"nextCursor", JsonValue{nextCursor}},
        {"complete", JsonValue{complete}}, {"errors", JsonValue{std::move(errors)}},
        {"collectorId", JsonValue{serviceId}}, {"bootId", JsonValue{bootId}}
    };
    std::string body = serializeJson(JsonValue{std::move(response)});
    if (body.size() > 2048) throw HttpError(503, "Native cache snapshot page exceeds 2048 bytes");
    return {200, std::move(body)};
}

} // namespace

NativeService::NativeService(std::string pcodeText, std::string programMapJson, uint64_t maxSteps,
    std::map<std::string, StorageRootGrant> storageRoots, uint64_t maxFileBytes, std::string aggregatorUrl)
    : pcodeText_(std::move(pcodeText)),
      programMapJson_(std::move(programMapJson)),
      maxSteps_(maxSteps),
      storageRoots_(std::move(storageRoots)),
      maxFileBytes_(maxFileBytes),
      aggregatorUrl_(std::move(aggregatorUrl)) {
    if (maxFileBytes_ == 0 || maxFileBytes_ > 1000000) {
        throw std::runtime_error("Storage file capacity must be between 1 and 1000000 bytes");
    }
    bool canWriteStorage = false;
    for (auto& [alias, grant] : storageRoots_) {
        if (alias.empty() || alias.size() > 64 || alias.front() < 'a' || alias.front() > 'z' ||
            !std::all_of(alias.begin(), alias.end(), [](unsigned char character) {
                return (character >= 'a' && character <= 'z') ||
                    (character >= '0' && character <= '9') || character == '_' || character == '-';
            })) {
            throw std::runtime_error("Invalid storage root alias");
        }
        const std::filesystem::path root(grant.path);
        if (!root.is_absolute()) throw std::runtime_error("Storage root path must be absolute: " + alias);
        std::error_code error;
        const auto status = std::filesystem::symlink_status(root, error);
        if (error || std::filesystem::is_symlink(status) || !std::filesystem::is_directory(status)) {
            throw std::runtime_error("Storage root must be a real directory: " + alias);
        }
        const auto canonical = std::filesystem::canonical(root, error);
        if (error) throw std::runtime_error("Unable to resolve storage root: " + alias);
        grant.path = canonical.string();
        canWriteStorage = canWriteStorage || !grant.readOnly;
    }
    const auto program = parseProgram(pcodeText_);
    validateMap(JsonParser(programMapJson_).parse(), serviceId_, program, !storageRoots_.empty(), canWriteStorage);
    if (!aggregatorUrl_.empty()) (void)parseHttpUrl(aggregatorUrl_);
    bootId_ = serviceId_ + "-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count());
}

HttpResponse NativeService::dispatch(const HttpRequest& request) const {
    constexpr const char* cachePrefix = "/api/hosted/caches/";
    constexpr const char* cacheSuffix = "/snapshot";
    if (request.method == "GET" && request.path.rfind(cachePrefix, 0) == 0
        && request.path.size() > std::strlen(cachePrefix) + std::strlen(cacheSuffix)
        && request.path.compare(request.path.size() - std::strlen(cacheSuffix),
            std::strlen(cacheSuffix), cacheSuffix) == 0) {
        const std::string cacheName = request.path.substr(std::strlen(cachePrefix),
            request.path.size() - std::strlen(cachePrefix) - std::strlen(cacheSuffix));
        if (!std::regex_match(cacheName, std::regex("[A-Za-z][A-Za-z0-9_-]{0,63}")))
            throw HttpError(400, "Invalid hosted cache name");
        return hostedCacheSnapshot(JsonParser(programMapJson_).parse(), serviceId_, bootId_,
            aggregatorUrl_, cacheName, request.query);
    }
    const auto parsed = parseProgram(pcodeText_);
    return execute(parsed, request, maxSteps_, storageRoots_, maxFileBytes_, JsonParser(programMapJson_).parse());
}

HttpResponse NativeService::debugDispatch(std::istream& input, std::ostream& output) const {
    std::string line;
    if (!std::getline(input, line)) throw std::runtime_error("Missing debugger start command");
    if (line.size() > 65536) throw std::runtime_error("Debugger start command exceeds 65536 bytes");
    const auto parsed = parseJson(line);
    const auto& command = asObject(parsed, "debugger start command");
    if (optionalString(command, "command", "") != "start") {
        throw std::runtime_error("Debugger must start with a start command");
    }
    HttpRequest request;
    request.method = optionalString(command, "method", "GET");
    request.path = optionalString(command, "path", "/");
    request.body = optionalString(command, "body", "");
    request.peer = "127.0.0.1";
    if (request.method.empty() || request.method.size() > 16 ||
        request.path.empty() || request.path.front() != '/' || request.path.size() > 2048 ||
        request.body.size() > 1048576) {
        throw std::runtime_error("Invalid debugger HTTP request");
    }
    const auto program = parseProgram(pcodeText_);
    return execute(program, request, maxSteps_, storageRoots_, maxFileBytes_,
        JsonParser(programMapJson_).parse(), &input, &output, readBreakpoints(command));
}

const std::string& NativeService::serviceId() const {
    return serviceId_;
}

bool NativeService::filesystemReadEnabled() const {
    return !storageRoots_.empty();
}

bool NativeService::filesystemWriteEnabled() const {
    return std::any_of(storageRoots_.begin(), storageRoots_.end(), [](const auto& entry) {
        return !entry.second.readOnly;
    });
}

std::string readFile(const std::string& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) throw std::runtime_error("Unable to open file: " + path);
    std::ostringstream contents;
    contents << input.rdbuf();
    if (!input.good() && !input.eof()) throw std::runtime_error("Unable to read file: " + path);
    return contents.str();
}

} // namespace pulse::native
