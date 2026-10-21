// COBOL P-code parser and interpreter. Semantics follow parsePcode and executeProgramImpl in
// pmachines/javascript/src/runtime.mjs for every instruction the COBOL compiler emits.
#include "cobol_vm_internal.h"

#include <climits>
#include <cmath>
#include <cstring>
#include <new>
#include <unordered_map>

namespace cobolvm {

using namespace detail;

namespace {

enum Op : uint8_t {
    O_NOP, O_HALT, O_CALL_EXT, O_JMP, O_JZ, O_PUSH_INT, O_PUSH_STR, O_PUSH_REF, O_LOAD, O_STORE,
    O_ARR_GET, O_ARR_SET, O_ADD, O_SUB, O_MUL, O_DIV, O_PUSH_REAL, O_PUSH_DEC, O_DEC_CONV,
    O_DEC_QUANT, O_DEC_STR, O_DEC_DISPLAY, O_DEC_EDIT, O_DEC_FITS, O_RDIV, O_EQ, O_NEQ, O_LT, O_LE,
    O_GT, O_GE, O_TRIM, O_UPPER, O_PARSE_INT, O_OR, O_AND, O_NOT, O_CONCAT, O_STREQ, O_STRNEQ,
    O_CALL, O_RET, O_PRINT, O_PRINT_INT, O_PRINT_NL, O_UNSUPPORTED
};

struct MnemonicEntry {
    const char* text;
    Op op;
};

const MnemonicEntry MNEMONICS[] = {
    {"NOP", O_NOP}, {"HALT", O_HALT}, {"CALL_EXT", O_CALL_EXT}, {"JMP", O_JMP}, {"JZ", O_JZ},
    {"PUSH_INT", O_PUSH_INT}, {"PUSH_STR", O_PUSH_STR}, {"PUSH_REF", O_PUSH_REF},
    {"LOAD", O_LOAD}, {"LOAD_NAME", O_LOAD}, {"STORE", O_STORE}, {"STORE_NAME", O_STORE},
    {"ARR_GET", O_ARR_GET}, {"ARR_SET", O_ARR_SET}, {"ADD", O_ADD}, {"SUB", O_SUB}, {"MUL", O_MUL},
    {"DIV", O_DIV}, {"PUSH_REAL", O_PUSH_REAL}, {"PUSH_DEC", O_PUSH_DEC}, {"DEC_CONV", O_DEC_CONV},
    {"DEC_QUANT", O_DEC_QUANT}, {"DEC_STR", O_DEC_STR}, {"DEC_DISPLAY", O_DEC_DISPLAY},
    {"DEC_EDIT", O_DEC_EDIT}, {"DEC_FITS", O_DEC_FITS}, {"RDIV", O_RDIV}, {"EQ", O_EQ}, {"NEQ", O_NEQ},
    {"LT", O_LT}, {"LE", O_LE}, {"GT", O_GT}, {"GE", O_GE}, {"TRIM", O_TRIM}, {"UPPER", O_UPPER},
    {"PARSE_INT", O_PARSE_INT}, {"OR", O_OR}, {"AND", O_AND}, {"NOT", O_NOT}, {"CONCAT", O_CONCAT},
    {"STREQ", O_STREQ}, {"STRNEQ", O_STRNEQ}, {"CALL", O_CALL}, {"RET", O_RET}, {"PRINT", O_PRINT},
    {"PRINT_INT", O_PRINT_INT}, {"PRINT_NL", O_PRINT_NL},
};

Op opFromMnemonic(const std::string& mnemonic) {
    for (const MnemonicEntry& entry : MNEMONICS) {
        if (mnemonic == entry.text) return entry.op;
    }
    return O_UNSUPPORTED;
}

const char* const COBOL_HEADER = "# Auto-generated from ANTLR Cobolish grammar";

// Opcodes the generic native PMachine has no implementation for.
bool isEngineOnlyMnemonic(const std::string& mnemonic) {
    return mnemonic == "PUSH_DEC" || mnemonic == "PUSH_REF" || mnemonic.rfind("DEC_", 0) == 0;
}

}  // namespace

// Compact instruction: operands live in the program pools so a 3000-line program stays small.
struct Instr {
    Op op = O_NOP;
    uint8_t mode = 0;
    int32_t a = 0;
    int32_t b = 0;
    int32_t c = -1;
};

struct Program {
    std::vector<Instr> code;
    std::vector<std::string> strings;   // Latin-1
    std::vector<double> numbers;
    std::vector<Decimal> decimals;
    std::vector<std::string> names;
    std::unordered_map<std::string, int> nameIds;

    int intern(const std::string& name) {
        auto found = nameIds.find(name);
        if (found != nameIds.end()) return found->second;
        const int id = static_cast<int>(names.size());
        names.push_back(name);
        nameIds.emplace(name, id);
        return id;
    }
    int addString(std::string text) {
        strings.push_back(std::move(text));
        return static_cast<int>(strings.size() - 1);
    }
    int addNumber(double value) {
        numbers.push_back(value);
        return static_cast<int>(numbers.size() - 1);
    }
};

namespace {

bool isAsciiSpace(char c) { return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v'; }

std::vector<std::string> splitWhitespace(const std::string& text) {
    std::vector<std::string> parts;
    size_t i = 0;
    while (i < text.size()) {
        while (i < text.size() && isJsWhitespace(static_cast<unsigned char>(text[i]))) ++i;
        const size_t start = i;
        while (i < text.size() && !isJsWhitespace(static_cast<unsigned char>(text[i]))) ++i;
        if (i > start) parts.push_back(text.substr(start, i - start));
    }
    return parts;
}

// Number.parseInt(text, 10) as an int; NaN maps to `fallback`.
int parseIntOr(const std::string& text, int fallback) {
    const double value = jsParseInt(text);
    if (std::isnan(value)) return fallback;
    if (value > INT_MAX) return INT_MAX;
    if (value < INT_MIN) return INT_MIN;
    return static_cast<int>(value);
}

std::string upperAscii(std::string text) {
    for (char& c : text) if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 'a' + 'A');
    return text;
}

// JSON.parse of a complete JSON string literal held in Latin-1.
bool decodeJsonString(const std::string& literal, std::string& out) {
    Json value;
    if (!parseJson(literal, value) || value.type != Json::String) return false;
    out = value.text;
    return true;
}

// parseQuotedOperand: the first double-quoted literal, JSON-decoded; '' when there is none.
bool parseQuotedOperand(const std::string& text, std::string& out, bool& present) {
    present = false;
    const size_t first = text.find('"');
    if (first == std::string::npos) {
        out.clear();
        present = true;
        return true;
    }
    bool escaped = false;
    for (size_t i = first + 1; i < text.size(); ++i) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (text[i] == '\\') {
            escaped = true;
            continue;
        }
        if (text[i] == '"') {
            present = true;
            return decodeJsonString(text.substr(first, i - first + 1), out);
        }
    }
    out.clear();
    return true;
}

}  // namespace

bool isCobolPcode(const std::string& text) {
    size_t start = 0;
    if (text.compare(0, 3, "\xEF\xBB\xBF") == 0) start = 3;
    while (start < text.size() && isAsciiSpace(text[start])) ++start;
    if (text.compare(start, std::strlen(COBOL_HEADER), COBOL_HEADER) == 0) return true;
    size_t lineStart = 0;
    while (lineStart < text.size()) {
        size_t lineEnd = text.find('\n', lineStart);
        if (lineEnd == std::string::npos) lineEnd = text.size();
        size_t i = lineStart;
        while (i < lineEnd && isAsciiSpace(text[i])) ++i;
        size_t j = i;
        while (j < lineEnd && !isAsciiSpace(text[j])) ++j;
        if (j > i && isEngineOnlyMnemonic(text.substr(i, j - i))) return true;
        lineStart = lineEnd + 1;
    }
    return false;
}

CompiledProgram::CompiledProgram() : program(new Program()) {}
CompiledProgram::~CompiledProgram() = default;
CompiledProgram::CompiledProgram(CompiledProgram&&) noexcept = default;
CompiledProgram& CompiledProgram::operator=(CompiledProgram&&) noexcept = default;

size_t CompiledProgram::instructionCount() const { return program ? program->code.size() : 0; }

bool CompiledProgram::parse(const std::string& utf8Text, std::string& error) {
    std::unique_ptr<Program> parsed(new Program());
    try {
        Program& p = *parsed;
        const std::string text = utf8ToLatin1(utf8Text);
        std::unordered_map<std::string, int> labels;
        std::vector<std::pair<size_t, std::string>> unresolved;
        size_t lineStart = 0;
        while (lineStart <= text.size()) {
            size_t lineEnd = text.find('\n', lineStart);
            if (lineEnd == std::string::npos) lineEnd = text.size();
            std::string rawLine = text.substr(lineStart, lineEnd - lineStart);
            if (!rawLine.empty() && rawLine.back() == '\r') rawLine.pop_back();
            lineStart = lineEnd + 1;

            size_t commentIndex = std::string::npos;
            char quote = 0;
            for (size_t index = 0; index < rawLine.size(); ++index) {
                const char character = rawLine[index];
                if (character == '\\' && quote) {
                    ++index;
                    continue;
                }
                if ((character == '"' || character == '\'') && !quote) {
                    quote = character;
                } else if (quote && character == quote) {
                    quote = 0;
                } else if (character == '#' && !quote) {
                    commentIndex = index;
                    break;
                }
            }
            const std::string line = jsTrim(commentIndex == std::string::npos ? rawLine : rawLine.substr(0, commentIndex));
            if (line.empty()) continue;

            if (line.back() == ':') {
                const std::string label = jsTrim(line.substr(0, line.size() - 1));
                if (!label.empty()) labels[label] = static_cast<int>(p.code.size());
                continue;
            }

            const size_t firstSpace = line.find(' ');
            const std::string mnemonic = firstSpace == std::string::npos ? line : line.substr(0, firstSpace);
            const std::string rest = firstSpace == std::string::npos ? std::string() : line.substr(firstSpace + 1);
            Instr instr;
            instr.op = opFromMnemonic(mnemonic);
            switch (instr.op) {
                case O_JMP:
                case O_JZ:
                    instr.a = -1;
                    unresolved.emplace_back(p.code.size(), jsTrim(rest));
                    break;
                case O_PUSH_STR: {
                    std::string literal;
                    bool present = false;
                    if (!parseQuotedOperand(rest, literal, present)) {
                        error = "Invalid PUSH_STR operand: " + latin1ToUtf8(rest);
                        return false;
                    }
                    instr.c = p.addString(present ? literal : std::string());
                    break;
                }
                case O_PUSH_INT: {
                    const double value = jsParseInt(jsTrim(rest));
                    // Number(operand || 0): NaN and -0 push 0.
                    instr.c = p.addNumber(std::isnan(value) || value == 0 ? 0.0 : value);
                    break;
                }
                case O_PUSH_REAL: {
                    const std::string trimmed = jsTrim(rest);
                    double value = std::strtod(trimmed.c_str(), nullptr);
                    if (trimmed.empty()) value = std::nan("");
                    instr.c = p.addNumber(value);
                    break;
                }
                case O_PUSH_DEC: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    const std::string unscaled = parts.empty() ? "0" : parts[0];
                    const int scale = std::max(0, parseIntOr(parts.size() > 1 ? parts[1] : "0", 0));
                    try {
                        p.decimals.push_back(decimalFromUnscaled(unscaled, scale));
                        instr.a = static_cast<int32_t>(p.decimals.size() - 1);
                    } catch (const VmError&) {
                        // BigInt() throws when the instruction executes, not when it is parsed.
                        instr.a = -1;
                        instr.c = p.addString(unscaled);
                    }
                    break;
                }
                case O_DEC_QUANT: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    instr.a = parseIntOr(parts.empty() ? "0" : parts[0], 0);
                    instr.mode = parts.size() > 1 && upperAscii(parts[1]) == "ROUNDED" ? 1 : 0;
                    break;
                }
                case O_DEC_DISPLAY: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    instr.a = parseIntOr(parts.empty() ? "0" : parts[0], 0);
                    instr.b = parseIntOr(parts.size() > 1 ? parts[1] : "0", 0);
                    const std::string signMode = parts.size() > 2 ? upperAscii(parts[2]) : std::string();
                    instr.mode = signMode == "LEADING_SEPARATE" ? 1 : signMode == "TRAILING_SEPARATE" ? 2 : 0;
                    break;
                }
                case O_DEC_EDIT: {
                    // ^("(?:\\.|[^"])*")\s+([01])\s+([01])$
                    const std::string trimmed = jsTrim(rest);
                    bool valid = !trimmed.empty() && trimmed[0] == '"';
                    size_t i = 1;
                    while (valid && i < trimmed.size() && trimmed[i] != '"') {
                        if (trimmed[i] == '\\') {
                            if (i + 1 >= trimmed.size()) valid = false;
                            i += 2;
                        } else {
                            ++i;
                        }
                    }
                    if (valid && i >= trimmed.size()) valid = false;
                    std::string mask;
                    size_t j = i + 1;
                    auto flag = [&](bool& outFlag) {
                        const size_t spaceStart = j;
                        while (j < trimmed.size() && isJsWhitespace(static_cast<unsigned char>(trimmed[j]))) ++j;
                        if (j == spaceStart || j >= trimmed.size() || (trimmed[j] != '0' && trimmed[j] != '1')) return false;
                        outFlag = trimmed[j] == '1';
                        ++j;
                        return true;
                    };
                    bool decimalComma = false;
                    bool blankWhenZero = false;
                    if (valid) valid = decodeJsonString(trimmed.substr(0, i + 1), mask);
                    if (valid) valid = flag(decimalComma) && flag(blankWhenZero) && j == trimmed.size();
                    if (!valid) {
                        error = "Invalid DEC_EDIT operand: " + latin1ToUtf8(rest);
                        return false;
                    }
                    instr.c = p.addString(mask);
                    instr.mode = static_cast<uint8_t>((decimalComma ? 1 : 0) | (blankWhenZero ? 2 : 0));
                    break;
                }
                case O_DEC_FITS:
                    instr.a = parseIntOr(jsTrim(rest), 0);
                    break;
                case O_ARR_GET:
                case O_ARR_SET: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    const std::string base = parts.empty() ? std::string() : parts[0];
                    instr.c = p.addString(base);
                    instr.a = parseIntOr(parts.size() > 1 ? parts[1] : "0", INT_MAX);
                    instr.mode = base.find("{}") != std::string::npos ? 1 : 0;
                    break;
                }
                case O_LOAD:
                case O_STORE: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    instr.a = p.intern(parts.empty() ? std::string() : parts[0]);
                    break;
                }
                case O_PUSH_REF: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    const std::string operand = parts.empty() ? std::string() : parts[0];
                    // ^(.+)@(\d+):(\d+)$
                    const size_t at = operand.rfind('@');
                    bool slice = false;
                    if (at != std::string::npos && at > 0) {
                        const size_t colon = operand.find(':', at + 1);
                        const std::string offset = colon == std::string::npos ? "" : operand.substr(at + 1, colon - at - 1);
                        const std::string length = colon == std::string::npos ? "" : operand.substr(colon + 1);
                        slice = !offset.empty() && !length.empty()
                            && offset.find_first_not_of("0123456789") == std::string::npos
                            && length.find_first_not_of("0123456789") == std::string::npos;
                        if (slice) {
                            instr.b = parseIntOr(offset, INT_MAX);
                            instr.c = parseIntOr(length, INT_MAX);
                        }
                    }
                    instr.mode = slice ? 1 : 0;
                    instr.a = p.intern(slice ? operand.substr(0, at) : operand);
                    break;
                }
                case O_CALL:
                case O_CALL_EXT: {
                    const std::vector<std::string> parts = splitWhitespace(jsTrim(rest));
                    std::string label = parts.empty() ? std::string() : parts[0];
                    const int argc = parseIntOr(parts.size() > 1 ? parts[1] : "0", 0);
                    instr.b = argc;
                    if (instr.op == O_CALL) {
                        instr.a = -1;
                        instr.c = p.addString(label);
                        unresolved.emplace_back(p.code.size(), label);
                    } else {
                        std::string name = lowerLatin1(label);
                        instr.a = findBinding(name);
                        instr.c = p.addString(std::move(name));
                    }
                    break;
                }
                case O_UNSUPPORTED:
                    instr.c = p.addString(mnemonic);
                    break;
                default:
                    break;
            }
            p.code.push_back(instr);
        }
        for (const auto& jump : unresolved) {
            const auto target = labels.find(jump.second);
            p.code[jump.first].a = target == labels.end() ? -1 : target->second;
        }
    } catch (const VmError& failure) {
        error = failure.what();
        return false;
    } catch (const std::bad_alloc&) {
        error = "Not enough memory to load COBOL P-code";
        return false;
    }
    program = std::move(parsed);
    return true;
}

namespace {

enum Kind : uint8_t { K_UNDEF, K_NUM, K_STR, K_DEC, K_REAL, K_REF };

struct Value {
    Kind kind = K_NUM;
    bool negative = false;  // K_DEC sign
    int32_t scale = 0;      // K_DEC scale
    double number = 0;      // K_NUM, K_REAL
    int32_t frame = 0;      // K_REF owner frame (0 = global)
    int32_t name = 0;       // K_REF target
    int32_t offset = -1;    // K_REF slice offset, -1 for a whole-variable reference
    int32_t length = 0;
    uint32_t serial = 0;    // K_REF owner frame identity
    std::string text;       // K_STR bytes, K_DEC magnitude
};

Value numValue(double number) {
    Value v;
    v.number = number;
    return v;
}

Value strValue(std::string text) {
    Value v;
    v.kind = K_STR;
    v.text = std::move(text);
    return v;
}

Value decValue(Decimal decimal) {
    Value v;
    v.kind = K_DEC;
    v.negative = decimal.negative;
    v.scale = decimal.scale;
    v.text = std::move(decimal.magnitude);
    return v;
}

Value realValue(double number) {
    Value v;
    v.kind = K_REAL;
    const float rounded = static_cast<float>(std::isnan(number) ? 0.0 : number);
    v.number = rounded;
    return v;
}

Decimal decimalOf(const Value& v) {
    Decimal d;
    d.negative = v.negative;
    d.scale = v.scale;
    d.magnitude = v.text;
    return d;
}

bool isBoxed(const Value& v) { return v.kind == K_STR || v.kind == K_DEC || v.kind == K_REAL; }

// Number(value || 0)
double numLoose(const Value& v) {
    switch (v.kind) {
        case K_UNDEF: return 0;
        case K_NUM: return std::isnan(v.number) || v.number == 0 ? 0.0 : v.number;
        case K_STR: return v.text.empty() ? 0.0 : jsStringToNumber(v.text);
        default: return std::nan("");
    }
}

// Number(value)
double numStrict(const Value& v) {
    switch (v.kind) {
        case K_NUM: return v.number;
        case K_STR: return jsStringToNumber(v.text);
        default: return std::nan("");
    }
}

double numberOf(const Value& v) {
    if (v.kind == K_REAL) return v.number;
    if (v.kind == K_DEC) return decimalToNumber(decimalOf(v));
    return numLoose(v);
}

// String(value ?? '')
std::string jsString(const Value& v) {
    switch (v.kind) {
        case K_UNDEF: return std::string();
        case K_NUM: return jsNumberToString(v.number);
        case K_STR: return v.text;
        default: return "[object Object]";
    }
}

std::string displayText(const Value& v) {
    if (v.kind == K_REAL) return formatRealE6(static_cast<float>(v.number));
    if (v.kind == K_DEC) return formatDecimal(decimalOf(v));
    return jsString(v);
}

// asStringValue: JSON.stringify for objects (BigInt and cyclic values give '').
std::string asStringValue(const Value& v) {
    switch (v.kind) {
        case K_STR: return v.text;
        case K_NUM: return jsNumberToString(v.number);
        case K_REAL: return "{\"v\":" + jsNumberToString(v.number) + "}";
        default: return std::string();
    }
}

std::string jsToFixed6(double value) {
    if (std::fabs(value) >= 1e21) return jsNumberToString(value);
    char buffer[400];
    std::snprintf(buffer, sizeof buffer, "%.6f", value);
    std::string out = buffer;
    if (out == "-0.000000") out = "0.000000";
    return out;
}

Decimal toDecimal(const Value& v) {
    if (v.kind == K_DEC) return decimalOf(v);
    if (v.kind == K_STR) return decimalFromString(v.text);
    if (v.kind == K_REAL) return decimalFromString(jsToFixed6(v.number));
    return decimalFromInteger(numberOf(v));
}

double toInt32(double value) {
    if (!std::isfinite(value)) return 0;
    double wrapped = std::fmod(std::trunc(value), 4294967296.0);
    if (wrapped < 0) wrapped += 4294967296.0;
    return static_cast<double>(static_cast<int32_t>(static_cast<uint32_t>(wrapped)));
}

class Machine {
public:
    Machine(const Program& program, const RunOptions& options, RunResult& result)
        : program(program), options(options), result(result) {}

    void run();

private:
    struct Frame {
        uint32_t serial = 0;
        int returnPc = 0;
        std::vector<std::pair<int, Value>> vars;
    };

    const Program& program;
    const RunOptions& options;
    RunResult& result;
    std::vector<Value> stack;
    std::vector<Value> globals;
    std::vector<uint8_t> globalPresent;
    std::vector<Frame> frames;
    uint32_t nextSerial = 1;
    std::vector<std::string> dynamicNames;
    std::unordered_map<std::string, int> dynamicIds;
    std::string currentLine;
    struct Signature {
        std::vector<int> params;
        std::vector<int> locals;
    };
    std::unordered_map<int, Signature> signatures;  // keyed by CALL label string index

    const Signature& signatureFor(int labelIndex) {
        auto cached = signatures.find(labelIndex);
        if (cached != signatures.end()) return cached->second;
        Signature signature;
        if (options.procedures) {
            const auto found = options.procedures->find(latin1ToUtf8(program.strings[labelIndex]));
            if (found != options.procedures->end()) {
                for (const std::string& param : found->second.params) signature.params.push_back(nameId(utf8ToLatin1(param)));
                for (const std::string& local : found->second.locals) signature.locals.push_back(nameId(utf8ToLatin1(local)));
            }
        }
        return signatures.emplace(labelIndex, std::move(signature)).first->second;
    }

    int nameId(const std::string& name) {
        auto found = program.nameIds.find(name);
        if (found != program.nameIds.end()) return found->second;
        auto dynamic = dynamicIds.find(name);
        if (dynamic != dynamicIds.end()) return dynamic->second;
        const int id = static_cast<int>(program.names.size() + dynamicNames.size());
        dynamicNames.push_back(name);
        dynamicIds.emplace(name, id);
        return id;
    }

    const std::string& nameText(int id) const {
        return id < static_cast<int>(program.names.size()) ? program.names[id] : dynamicNames[id - program.names.size()];
    }

    Value pop() {
        if (stack.empty()) {
            Value undefinedValue;
            undefinedValue.kind = K_UNDEF;
            return undefinedValue;
        }
        Value top = std::move(stack.back());
        stack.pop_back();
        return top;
    }

    void push(Value value) { stack.push_back(std::move(value)); }

    Value* slotIn(int frameIndex, int name) {
        if (frameIndex == 0) {
            if (name < static_cast<int>(globalPresent.size()) && globalPresent[name]) return &globals[name];
            return nullptr;
        }
        for (auto& entry : frames[frameIndex - 1].vars) {
            if (entry.first == name) return &entry.second;
        }
        return nullptr;
    }

    Value* findVar(int frameIndex, int name, int& owner) {
        for (int index = frameIndex; index >= 0; --index) {
            if (Value* slot = slotIn(index, name)) {
                owner = index;
                return slot;
            }
        }
        return nullptr;
    }

    void checkReference(const Value& ref) const {
        if (ref.frame > 0 && (ref.frame > static_cast<int>(frames.size()) || frames[ref.frame - 1].serial != ref.serial)) {
            fail("P-code reference outlived its frame: " + latin1ToUtf8(nameText(ref.name)));
        }
    }

    Value resolveVar(int frameIndex, int name, int depth = 0) {
        if (depth > 256) fail("P-code reference chain is too deep");
        int owner = 0;
        Value* slot = findVar(frameIndex, name, owner);
        if (!slot) return numValue(0);
        if (slot->kind != K_REF) return *slot;
        const Value ref = *slot;
        checkReference(ref);
        Value resolved = resolveVar(ref.frame, ref.name, depth + 1);
        if (ref.offset < 0) return resolved;
        std::string text = jsString(resolved);
        const size_t end = static_cast<size_t>(ref.offset) + static_cast<size_t>(ref.length);
        if (text.size() < end) text.append(end - text.size(), ' ');
        return strValue(text.substr(static_cast<size_t>(ref.offset), static_cast<size_t>(ref.length)));
    }

    void setGlobal(int name, Value value) {
        if (name >= static_cast<int>(globals.size())) {
            globals.resize(name + 1);
            globalPresent.resize(name + 1, 0);
        }
        globals[name] = std::move(value);
        globalPresent[name] = 1;
    }

    void assignVar(int frameIndex, int name, Value value, int depth = 0) {
        if (depth > 256) fail("P-code reference chain is too deep");
        int owner = 0;
        Value* slot = findVar(frameIndex, name, owner);
        if (slot && slot->kind == K_REF) {
            const Value ref = *slot;
            checkReference(ref);
            if (ref.offset >= 0) {
                std::string base = jsString(resolveVar(ref.frame, ref.name, depth + 1));
                const size_t offset = static_cast<size_t>(ref.offset);
                const size_t length = static_cast<size_t>(ref.length);
                if (base.size() < offset + length) base.append(offset + length - base.size(), ' ');
                std::string replacement = jsString(value);
                if (replacement.size() < length) replacement.append(length - replacement.size(), ' ');
                replacement.resize(length);
                base.replace(offset, length, replacement);
                assignVar(ref.frame, ref.name, strValue(std::move(base)), depth + 1);
                return;
            }
            assignVar(ref.frame, ref.name, std::move(value), depth + 1);
            return;
        }
        if (slot) {
            *slot = std::move(value);
            return;
        }
        if (frameIndex == 0) {
            setGlobal(name, std::move(value));
        } else {
            frames[frameIndex - 1].vars.emplace_back(name, std::move(value));
        }
    }

    int currentFrame() const { return static_cast<int>(frames.size()); }

    void emitLine(const std::string& latin1) {
        const std::string line = latin1ToUtf8(latin1);
        if (options.onLine) options.onLine(line);
        else result.lines.push_back(line);
    }

    std::string arrayName(const Instr& instr, double index) const {
        const std::string& base = program.strings[instr.c];
        const std::string indexText = jsNumberToString(index);
        if (instr.mode) {
            std::string name = base;
            name.replace(name.find("{}"), 2, indexText);
            return name;
        }
        return base + "_" + indexText;
    }

    double arrayIndex(const Instr& instr, const Value& raw) const {
        const double index = numStrict(raw);
        if (std::isnan(index) || std::trunc(index) != index || index < 0 || index >= instr.a) {
            fail("index out of range: " + latin1ToUtf8(program.strings[instr.c]) + "[" + jsNumberToString(index) + "]");
        }
        return index;
    }

    void callExternal(const Instr& instr);
    void arithmetic(Op op);
    void compare(Op op);
    void exportGlobals();
};

void Machine::callExternal(const Instr& instr) {
    const std::string& name = program.strings[instr.c];
    const std::string printable = latin1ToUtf8(name);
    if (instr.a < 0 || instr.b != bindingSpec(instr.a).arity) fail("Invalid host binding call: " + printable);
    const BindingSpec& spec = bindingSpec(instr.a);
    const bool delegated = isDelegatedBinding(instr.a);
    if (delegated && !options.hostFallback) fail("Host binding unavailable: " + printable);
    const size_t argc = static_cast<size_t>(instr.b);
    if (stack.size() < argc) fail("Host binding stack underflow: " + printable);
    std::vector<Value> args(std::make_move_iterator(stack.end() - argc), std::make_move_iterator(stack.end()));
    stack.resize(stack.size() - argc);

    static const char* const KIND_NAMES[] = {"string", "integer", "number"};
    std::vector<BindingValue> values(argc);
    for (size_t index = 0; index < argc; ++index) {
        const Value& value = args[index];
        const ArgKind kind = spec.args[index];
        bool valid = false;
        if (kind == ArgKind::String) {
            valid = value.kind == K_STR;
            values[index].isString = true;
            values[index].text = value.text;
        } else if (kind == ArgKind::Integer) {
            valid = value.kind == K_NUM && isSafeInteger(value.number);
            values[index].number = value.number;
        } else {
            values[index].number = numberOf(value);
            valid = std::isfinite(values[index].number);
        }
        if (!valid) {
            fail("Invalid host argument " + std::to_string(index + 1) + " for " + printable + ": expected "
                 + KIND_NAMES[static_cast<int>(kind)]);
        }
    }

    BindingValue out;
    if (delegated) {
        std::vector<HostArg> hostArgs(argc);
        for (size_t index = 0; index < argc; ++index) {
            hostArgs[index].isString = values[index].isString;
            hostArgs[index].number = values[index].number;
            if (values[index].isString) hostArgs[index].text = latin1ToUtf8(values[index].text);
        }
        HostArg hostResult;
        std::string hostError;
        if (!options.hostFallback(name, hostArgs, hostResult, hostError)) {
            fail(hostError.empty() ? "Host binding failed: " + printable : hostError);
        }
        out.isString = hostResult.isString;
        out.number = hostResult.number;
        if (hostResult.isString) out.text = utf8ToLatin1(hostResult.text);
    } else {
        BindingContext context{options.random};
        out = callBinding(instr.a, values, context);
    }

    switch (spec.result) {
        case ResultKind::String:
            if (!out.isString) fail("Invalid host result for " + printable + ": expected string");
            push(strValue(std::move(out.text)));
            break;
        case ResultKind::Number:
            if (out.isString || !std::isfinite(out.number)) fail("Invalid host result for " + printable + ": expected finite number");
            push(realValue(out.number));
            break;
        case ResultKind::Decimal:
            if (out.isString || !std::isfinite(out.number)) fail("Invalid host result for " + printable + ": expected finite number");
            push(decValue(decimalFromNumberText(jsNumberToString(out.number))));
            break;
        default:
            if (out.isString || !isSafeInteger(out.number)) fail("Invalid host result for " + printable + ": expected integer");
            push(numValue(out.number == 0 ? 0.0 : out.number));
            break;
    }
}

void Machine::arithmetic(Op op) {
    const Value rawB = pop();
    const Value rawA = pop();
    // Decimal outranks real: exactness wins over float contagion.
    if (rawA.kind == K_DEC || rawB.kind == K_DEC) {
        const char symbol = op == O_ADD ? '+' : op == O_SUB ? '-' : op == O_MUL ? '*' : '/';
        push(decValue(decimalArithmetic(symbol, toDecimal(rawA), toDecimal(rawB))));
        return;
    }
    if (rawA.kind == K_REAL || rawB.kind == K_REAL) {
        const double a = numberOf(rawA);
        const double b = numberOf(rawB);
        double out = 0;
        if (op == O_ADD) out = a + b;
        if (op == O_SUB) out = a - b;
        if (op == O_MUL) out = a * b;
        if (op == O_DIV) out = b == 0 ? 0 : a / b;
        push(realValue(out));
        return;
    }
    const double b = numLoose(rawB);
    const double a = numLoose(rawA);
    double out = 0;
    if (op == O_ADD) out = toInt32(a + b);
    if (op == O_SUB) out = toInt32(a - b);
    if (op == O_MUL) {
        const uint32_t product = static_cast<uint32_t>(static_cast<int32_t>(toInt32(a)))
            * static_cast<uint32_t>(static_cast<int32_t>(toInt32(b)));
        out = static_cast<double>(static_cast<int32_t>(product));
    }
    if (op == O_DIV) out = b == 0 ? 0 : toInt32(std::trunc(a / b));
    push(numValue(out == 0 ? 0.0 : out));
}

void Machine::compare(Op op) {
    const Value rawB = pop();
    const Value rawA = pop();
    bool truth = false;
    if (rawA.kind == K_DEC || rawB.kind == K_DEC || (rawA.kind == K_STR && rawB.kind == K_STR)) {
        const int order = (rawA.kind == K_STR && rawB.kind == K_STR && rawA.kind != K_DEC && rawB.kind != K_DEC)
            ? rawA.text.compare(rawB.text)
            : compareDecimals(toDecimal(rawA), toDecimal(rawB));
        switch (op) {
            case O_EQ: truth = order == 0; break;
            case O_NEQ: truth = order != 0; break;
            case O_LT: truth = order < 0; break;
            case O_LE: truth = order <= 0; break;
            case O_GT: truth = order > 0; break;
            default: truth = order >= 0; break;
        }
    } else {
        const double a = numberOf(rawA);
        const double b = numberOf(rawB);
        switch (op) {
            case O_EQ: truth = a == b; break;
            case O_NEQ: truth = a != b; break;
            case O_LT: truth = a < b; break;
            case O_LE: truth = a <= b; break;
            case O_GT: truth = a > b; break;
            default: truth = a >= b; break;
        }
    }
    push(numValue(truth ? 1 : 0));
}

void Machine::exportGlobals() {
    for (size_t name = 0; name < globals.size(); ++name) {
        if (!globalPresent[name]) continue;
        const Value& value = globals[name];
        GlobalOut out;
        switch (value.kind) {
            case K_STR:
                out.kind = GlobalOut::String;
                out.text = latin1ToUtf8(value.text);
                break;
            case K_DEC:
                out.kind = GlobalOut::String;
                out.text = formatDecimal(decimalOf(value));
                break;
            case K_REAL:
                out.kind = GlobalOut::Real;
                out.number = value.number;
                break;
            case K_NUM:
                out.number = value.number;
                break;
            default:
                out.number = std::nan("");
                break;
        }
        result.globals.emplace_back(latin1ToUtf8(nameText(static_cast<int>(name))), std::move(out));
    }
}

void Machine::run() {
    const std::vector<Instr>& code = program.code;
    const int count = static_cast<int>(code.size());
    globals.assign(program.names.size(), Value());
    globalPresent.assign(program.names.size(), 0);
    if (options.globals) {
        for (const std::string& name : *options.globals) setGlobal(nameId(utf8ToLatin1(name)), numValue(0));
    }
    if (options.hasSourceMessage) setGlobal(nameId("src"), strValue(utf8ToLatin1(options.sourceMessage)));

    int pc = 0;
    size_t steps = 0;
    while (pc >= 0 && pc < count) {
        ++steps;
        if (options.maxSteps && steps > options.maxSteps) {
            result.stepLimitHit = true;
            break;
        }
        if (options.maxStack && stack.size() > options.maxStack) fail("PMachine operand stack capacity exceeded");
        if (options.maxCallDepth && frames.size() > options.maxCallDepth) fail("PMachine call depth capacity exceeded");
        if (options.onYield && options.yieldInterval && steps % options.yieldInterval == 0) options.onYield();

        const Instr& instr = code[pc];
        switch (instr.op) {
            case O_NOP:
                break;
            case O_HALT:
                pc = count;
                continue;
            case O_CALL_EXT:
                callExternal(instr);
                break;
            case O_JMP:
                pc = instr.a >= 0 ? instr.a : count;
                continue;
            case O_JZ:
                pc = numLoose(pop()) == 0 ? (instr.a >= 0 ? instr.a : count) : pc + 1;
                continue;
            case O_PUSH_INT:
                push(numValue(program.numbers[instr.c]));
                break;
            case O_PUSH_STR:
                push(strValue(program.strings[instr.c]));
                break;
            case O_PUSH_REF: {
                int owner = 0;
                if (!findVar(currentFrame(), instr.a, owner)) {
                    fail("P-code reference target not found: " + latin1ToUtf8(nameText(instr.a)));
                }
                Value ref;
                ref.kind = K_REF;
                ref.frame = owner;
                ref.serial = owner > 0 ? frames[owner - 1].serial : 0;
                ref.name = instr.a;
                ref.offset = instr.mode ? instr.b : -1;
                ref.length = instr.mode ? instr.c : 0;
                push(std::move(ref));
                break;
            }
            case O_LOAD: {
                Value value = resolveVar(currentFrame(), instr.a);
                push(isBoxed(value) ? std::move(value) : numValue(numLoose(value)));
                break;
            }
            case O_STORE: {
                Value top = pop();
                assignVar(currentFrame(), instr.a, isBoxed(top) ? std::move(top) : numValue(numLoose(top)));
                break;
            }
            case O_ARR_GET: {
                const double index = arrayIndex(instr, pop());
                Value value = resolveVar(currentFrame(), nameId(arrayName(instr, index)));
                push(isBoxed(value) ? std::move(value) : numValue(numLoose(value)));
                break;
            }
            case O_ARR_SET: {
                Value top = pop();
                const double index = arrayIndex(instr, pop());
                assignVar(currentFrame(), nameId(arrayName(instr, index)),
                          isBoxed(top) ? std::move(top) : numValue(numLoose(top)));
                break;
            }
            case O_ADD:
            case O_SUB:
            case O_MUL:
            case O_DIV:
                arithmetic(instr.op);
                break;
            case O_PUSH_REAL:
                push(realValue(program.numbers[instr.c]));
                break;
            case O_PUSH_DEC:
                if (instr.a < 0) fail("Cannot convert " + latin1ToUtf8(program.strings[instr.c]) + " to a BigInt");
                push(decValue(program.decimals[instr.a]));
                break;
            case O_DEC_CONV:
                push(decValue(toDecimal(pop())));
                break;
            case O_DEC_QUANT:
                push(decValue(rescaleDecimal(toDecimal(pop()), instr.a, instr.mode != 0)));
                break;
            case O_DEC_STR:
                push(strValue(formatDecimal(toDecimal(pop()))));
                break;
            case O_DEC_DISPLAY:
                push(strValue(formatCobolDisplay(toDecimal(pop()), instr.a, instr.b, instr.mode)));
                break;
            case O_DEC_EDIT:
                push(strValue(formatCobolEdited(toDecimal(pop()), program.strings[instr.c],
                                                (instr.mode & 1) != 0, (instr.mode & 2) != 0)));
                break;
            case O_DEC_FITS: {
                const Decimal value = toDecimal(pop());
                push(numValue(instr.a > 0 && decimalDigitCount(value) <= instr.a ? 1 : 0));
                break;
            }
            case O_RDIV: {
                const double divisor = numberOf(pop());
                const double dividend = numberOf(pop());
                push(realValue(divisor == 0 ? 0 : dividend / divisor));
                break;
            }
            case O_EQ:
            case O_NEQ:
            case O_LT:
            case O_LE:
            case O_GT:
            case O_GE:
                compare(instr.op);
                break;
            case O_TRIM:
                push(strValue(jsTrim(jsString(pop()))));
                break;
            case O_UPPER:
                push(strValue(upperLatin1(asStringValue(pop()))));
                break;
            case O_PARSE_INT: {
                const double parsed = jsParseInt(jsTrim(jsString(pop())));
                push(numValue(std::isnan(parsed) || parsed == 0 ? 0.0 : parsed));
                break;
            }
            case O_OR: {
                const double b = numLoose(pop());
                const double a = numLoose(pop());
                push(numValue(a != 0 || b != 0 ? 1 : 0));
                break;
            }
            case O_AND: {
                const double b = numLoose(pop());
                const double a = numLoose(pop());
                push(numValue(a != 0 && b != 0 ? 1 : 0));
                break;
            }
            case O_NOT:
                push(numValue(numLoose(pop()) == 0 ? 1 : 0));
                break;
            case O_CONCAT: {
                const Value b = pop();
                const Value a = pop();
                push(strValue(displayText(a) + displayText(b)));
                break;
            }
            case O_STREQ:
            case O_STRNEQ: {
                const std::string b = jsString(pop());
                const std::string a = jsString(pop());
                const bool equal = a == b;
                push(numValue((instr.op == O_STREQ) == equal ? 1 : 0));
                break;
            }
            case O_CALL: {
                if (instr.a < 0) fail("P-code procedure not found: " + latin1ToUtf8(program.strings[instr.c]));
                const Signature& signature = signatureFor(instr.c);
                const size_t argc = static_cast<size_t>(std::max(0, instr.b));
                std::vector<Value> args(argc);
                for (size_t i = argc; i > 0; --i) {
                    Value raw = pop();
                    args[i - 1] = isBoxed(raw) || raw.kind == K_REF ? std::move(raw) : numValue(numLoose(raw));
                }
                Frame frame;
                frame.serial = nextSerial++;
                frame.returnPc = pc + 1;
                for (size_t i = 0; i < signature.params.size(); ++i) {
                    Value value;
                    if (i < args.size()) value = args[i];
                    const int name = signature.params[i];
                    bool replaced = false;
                    for (auto& entry : frame.vars) {
                        if (entry.first == name) {
                            entry.second = value;
                            replaced = true;
                        }
                    }
                    if (!replaced) frame.vars.emplace_back(name, std::move(value));
                }
                for (const int name : signature.locals) {
                    bool present = false;
                    for (const auto& entry : frame.vars) present = present || entry.first == name;
                    if (!present) frame.vars.emplace_back(name, numValue(0));
                }
                frames.push_back(std::move(frame));
                pc = instr.a;
                continue;
            }
            case O_RET:
                if (frames.empty()) {
                    pc = count;
                    continue;
                }
                pc = frames.back().returnPc;
                frames.pop_back();
                continue;
            case O_PRINT:
                currentLine += displayText(pop());
                break;
            case O_PRINT_INT:
                currentLine += jsNumberToString(numLoose(pop()));
                break;
            case O_PRINT_NL:
                emitLine(currentLine);
                currentLine.clear();
                break;
            default:
                fail("Unsupported COBOL P-code instruction: " + latin1ToUtf8(program.strings[instr.c]));
        }
        ++pc;
    }
    if (!currentLine.empty()) emitLine(currentLine);
    result.steps = steps;
    if (options.collectGlobals) exportGlobals();
}

}  // namespace

RunResult CompiledProgram::run(const RunOptions& options) const {
    RunResult result;
    if (!program) {
        result.hasError = true;
        result.error = "COBOL P-code is not loaded";
        return result;
    }
    try {
        Machine machine(*program, options, result);
        machine.run();
    } catch (const VmError& failure) {
        result.hasError = true;
        result.error = failure.what();
    } catch (const std::bad_alloc&) {
        result.hasError = true;
        result.error = "COBOL program ran out of memory";
    }
    return result;
}

RunResult runText(const std::string& pcodeText, const RunOptions& options) {
    CompiledProgram compiled;
    std::string error;
    if (!compiled.parse(pcodeText, error)) {
        RunResult result;
        result.hasError = true;
        result.error = error;
        return result;
    }
    return compiled.run(options);
}

}  // namespace cobolvm
