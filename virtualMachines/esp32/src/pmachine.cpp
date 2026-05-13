

#include <sstream>
#include <algorithm>
#include <cctype>
#include <ArduinoJson.h>
#include "pmachine.h"
#include "StringPool.h"

namespace pmachine {


PMachine::PMachine() {
    init_handler_table();
}
// Handler implementations for core opcodes
namespace {
    std::string trimCopy(const std::string& in) {
        size_t first = in.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) return "";
        size_t last = in.find_last_not_of(" \t\r\n");
        return in.substr(first, last - first + 1);
    }

    std::string toUpperCopy(const std::string& s) {
        std::string out = s;
        std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) {
            return static_cast<char>(std::toupper(c));
        });
        return out;
    }

    std::string jsonEscape(const std::string& s) {
        std::string out;
        out.reserve(s.size() + 8);
        for (char c : s) {
            if (c == '\\') out += "\\\\";
            else if (c == '"') out += "\\\"";
            else if (c == '\n') out += "\\n";
            else if (c == '\r') out += "\\r";
            else if (c == '\t') out += "\\t";
            else out += c;
        }
        return out;
    }

    std::string unquote(const std::string& text) {
        const std::string t = trimCopy(text);
        if (t.size() < 2) return t;
        const char q = t.front();
        if ((q == '"' || q == '\'') && t.back() == q) {
            return t.substr(1, t.size() - 2);
        }
        return t;
    }

    int findTopLevelComma(const std::string& text) {
        int depth = 0;
        char quote = '\0';
        for (size_t i = 0; i < text.size(); ++i) {
            const char ch = text[i];
            if (quote != '\0') {
                if (ch == '\\') {
                    ++i;
                    continue;
                }
                if (ch == quote) quote = '\0';
                continue;
            }
            if (ch == '"' || ch == '\'') {
                quote = ch;
                continue;
            }
            if (ch == '(') {
                ++depth;
                continue;
            }
            if (ch == ')') {
                --depth;
                continue;
            }
            if (ch == ',' && depth == 0) return static_cast<int>(i);
        }
        return -1;
    }

    std::string getJsonPathValueAsString(JsonVariantConst root, const std::string& dotPath) {
        JsonVariantConst cursor = root;
        size_t start = 0;
        while (start <= dotPath.size()) {
            size_t dot = dotPath.find('.', start);
            const std::string key = trimCopy(dot == std::string::npos ? dotPath.substr(start) : dotPath.substr(start, dot - start));
            if (key.empty()) {
                if (dot == std::string::npos) break;
                start = dot + 1;
                continue;
            }
            if (!cursor.is<JsonObjectConst>()) return "";
            JsonObjectConst obj = cursor.as<JsonObjectConst>();
            if (!obj[key.c_str()]) return "";
            cursor = obj[key.c_str()];
            if (dot == std::string::npos) break;
            start = dot + 1;
        }

        if (cursor.is<const char*>()) return std::string(cursor.as<const char*>());
        if (cursor.is<bool>()) return cursor.as<bool>() ? "true" : "false";
        if (cursor.is<long>()) return std::to_string(cursor.as<long>());
        if (cursor.is<double>()) {
            char buf[48] = {0};
            snprintf(buf, sizeof(buf), "%.6f", cursor.as<double>());
            return std::string(buf);
        }
        if (cursor.is<JsonArrayConst>() || cursor.is<JsonObjectConst>()) {
            std::string out;
            serializeJson(cursor, out);
            return out;
        }
        return "";
    }

    void setJsonPathValue(JsonDocument& doc, const std::string& dotPath, const std::string& value) {
        if (!doc.is<JsonObject>()) doc.to<JsonObject>();
        JsonObject root = doc.as<JsonObject>();
        JsonObject current = root;

        size_t start = 0;
        while (start <= dotPath.size()) {
            size_t dot = dotPath.find('.', start);
            std::string key = trimCopy(dot == std::string::npos ? dotPath.substr(start) : dotPath.substr(start, dot - start));
            if (key.empty()) {
                if (dot == std::string::npos) break;
                start = dot + 1;
                continue;
            }

            if (dot == std::string::npos) {
                current[key.c_str()] = value.c_str();
                break;
            }

            if (!current[key.c_str()].is<JsonObject>()) {
                current[key.c_str()] = JsonObject();
            }
            current = current[key.c_str()].as<JsonObject>();
            start = dot + 1;
        }
    }

    std::string normalizeMtAmount(const std::string& raw) {
        std::string s = trimCopy(raw);
        s.erase(std::remove(s.begin(), s.end(), ' '), s.end());
        std::replace(s.begin(), s.end(), ',', '.');
        return s;
    }

    std::string applyConversionRule(const std::string& conversionRule, const std::string& srcValue) {
        const std::string rule = toUpperCopy(trimCopy(conversionRule));
        if (rule.empty()) return srcValue;

        if (rule.find("UPPER(SRC)") != std::string::npos) return toUpperCopy(srcValue);
        if (rule.find("TRIM(SRC)") != std::string::npos) return trimCopy(srcValue);
        if (rule.find("MTAMOUNTTODECIMAL(SRC)") != std::string::npos) return normalizeMtAmount(srcValue);
        if (rule.find("OUTPUT := SRC") != std::string::npos) return srcValue;
        return srcValue;
    }

    // MT103 FIN text detection and parsing

    bool isMT103FinText(const std::string& text) {
        // Detect :TAG: at start of any line, or FIN block delimiters
        if (text.rfind("{1:", 0) == 0 || text.rfind("{2:", 0) == 0 || text.rfind("{4:", 0) == 0) return true;
        for (size_t i = 0; i < text.size(); i += 1) {
            if (text[i] != ':') continue;
            if (i == 0 || text[i - 1] == '\n' || text[i - 1] == '\r') {
                // Check if followed by 1-3 alnum chars then ':'
                size_t j = i + 1;
                size_t count = 0;
                while (j < text.size() && (isalnum((unsigned char)text[j])) && count < 4) {
                    j += 1;
                    count += 1;
                }
                if (count >= 1 && count <= 3 && j < text.size() && text[j] == ':') return true;
            }
        }
        return false;
    }

    void parseMT103FinText(const std::string& text, JsonDocument& result) {
        result.to<JsonObject>();
        JsonObject block4 = result["block4"].to<JsonObject>();

        // Extract block 4 content if wrapped in FIN block delimiters
        std::string block4Text = text;
        const size_t b4Start = text.find("{4:");
        if (b4Start != std::string::npos) {
            const size_t b4End = text.find("-}", b4Start);
            block4Text = (b4End != std::string::npos)
                ? text.substr(b4Start + 3, b4End - b4Start - 3)
                : text.substr(b4Start + 3);
        }

        // Parse tag:value pairs, tags start at line beginning with :XX:
        std::string currentTag;
        std::string currentValue;

        auto flushField = [&]() {
            if (currentTag.empty()) return;
            const std::string val = trimCopy(currentValue);
            if (currentTag == "32A" && val.size() >= 10) {
                // YYMMDD + 3-char currency + amount
                JsonObject f32a = block4["32A"].to<JsonObject>();
                f32a["raw"] = val;
                f32a["date"] = val.substr(0, 6);
                f32a["currency"] = val.substr(6, 3);
                f32a["amount"] = val.size() > 9 ? trimCopy(val.substr(9)) : "";
            } else {
                block4[currentTag.c_str()] = val;
            }
            currentTag.clear();
            currentValue.clear();
        };

        std::istringstream ss(block4Text);
        std::string line;
        while (std::getline(ss, line)) {
            // Strip trailing CR
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.size() >= 3 && line[0] == ':') {
                // Find closing ':' for tag
                const size_t tagEnd = line.find(':', 1);
                if (tagEnd != std::string::npos && tagEnd >= 2 && tagEnd <= 4) {
                    flushField();
                    currentTag = line.substr(1, tagEnd - 1);
                    currentValue = line.substr(tagEnd + 1);
                    continue;
                }
            }
            if (!currentTag.empty()) {
                currentValue += '\n';
                currentValue += line;
            }
        }
        flushField();
    }

    bool runMappingById(const PMachine& vm, const std::string& mappingId, const std::string& sourcePayload, std::string& mappedPayload, std::string& error) {
        const MappingDef* mapping = vm.getMappingById(mappingId);
        if (mapping == nullptr) {
            error = std::string("Mapping not found: ") + mappingId;
            return false;
        }

        JsonDocument sourceDoc;
        DeserializationError srcErr = deserializeJson(sourceDoc, sourcePayload.c_str());
        if (srcErr) {
            sourceDoc.clear();
            JsonObject srcObj = sourceDoc.to<JsonObject>();
            srcObj["src"] = sourcePayload.c_str();
        }

        JsonDocument targetDoc;
        targetDoc.to<JsonObject>();
        for (const auto& item : mapping->items) {
            const std::string srcValue = getJsonPathValueAsString(sourceDoc.as<JsonVariantConst>(), item.sourcePath);
            const std::string outValue = applyConversionRule(item.conversionRule, srcValue);
            setJsonPathValue(targetDoc, item.targetPath, outValue);
        }

        mappedPayload.clear();
        serializeJson(targetDoc, mappedPayload);
        return true;
    }

    bool evaluateTransformExpr(const PMachine& vm, const std::string& exprText, const std::string& srcMessage, int depth, std::string& outValue, std::string& error) {
        if (depth > 8) {
            error = "Transform nesting too deep";
            return false;
        }

        const std::string expr = trimCopy(exprText);
        if (expr.empty()) {
            outValue = srcMessage;
            return true;
        }

        const std::string upperExpr = toUpperCopy(expr);
        if (upperExpr == "SRC") {
            outValue = srcMessage;
            return true;
        }

        if ((expr.front() == '"' && expr.back() == '"') || (expr.front() == '\'' && expr.back() == '\'')) {
            outValue = unquote(expr);
            return true;
        }

        if (upperExpr.rfind("MAP", 0) != 0) {
            outValue = srcMessage;
            return true;
        }

        const size_t openIdx = expr.find('(');
        const size_t closeIdx = expr.rfind(')');
        if (openIdx == std::string::npos || closeIdx == std::string::npos || closeIdx <= openIdx) {
            error = "Invalid MAP expression";
            return false;
        }

        const std::string inside = trimCopy(expr.substr(openIdx + 1, closeIdx - openIdx - 1));
        const int commaIdx = findTopLevelComma(inside);
        if (commaIdx < 0) {
            error = "MAP requires two arguments";
            return false;
        }

        const std::string mapIdToken = trimCopy(inside.substr(0, static_cast<size_t>(commaIdx)));
        const std::string payloadExpr = trimCopy(inside.substr(static_cast<size_t>(commaIdx + 1)));
        const std::string mappingId = unquote(mapIdToken);
        if (mappingId == mapIdToken) {
            error = "MAP id must be a quoted string";
            return false;
        }

        std::string payload;
        if (!evaluateTransformExpr(vm, payloadExpr, srcMessage, depth + 1, payload, error)) {
            return false;
        }

        return runMappingById(vm, mappingId, payload, outValue, error);
    }

    bool evaluateWhenRuleText(const std::string& whenRule, const std::string& message) {
        const std::string whenUpper = toUpperCopy(whenRule);
        const std::string msgUpper = toUpperCopy(message);

        if (whenUpper.find("OUTPUT := 1") != std::string::npos) return true;
        if (whenUpper.find("OUTPUT := 0") != std::string::npos) return false;

        if (whenUpper.find("MT103") != std::string::npos) {
            return msgUpper.rfind("MT103", 0) == 0;
        }
        if (whenUpper.find("MT202") != std::string::npos) {
            return msgUpper.rfind("MT202", 0) == 0;
        }

        return true;
    }

    std::string applyTransformRuleText(const PMachine& vm, const std::string& transformRule, const std::string& message) {
        const std::string rule = trimCopy(transformRule);
        if (rule.empty()) return message;

        const std::string upperRule = toUpperCopy(rule);
        const size_t assignIdx = upperRule.find("OUTPUT :=");
        if (assignIdx == std::string::npos) {
            return message;
        }

        std::string rhs = trimCopy(rule.substr(assignIdx + 9));
        const size_t semicolonIdx = rhs.find(';');
        if (semicolonIdx != std::string::npos) {
            rhs = trimCopy(rhs.substr(0, semicolonIdx));
        }

        std::string outValue;
        std::string error;
        if (!evaluateTransformExpr(vm, rhs, message, 0, outValue, error)) {
            PMTRACE({
                Serial.print("[ROUTE_TRANSFORM] Error: ");
                Serial.println(error.c_str());
            });
            return message;
        }

        return outValue;
    }

    void handle_LIT(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        stack[sp++] = instr.value;
        ++pc;
    }
    void handle_OPR(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        switch (instr.value) {
            case 0: // RET
                sp = bp;
                pc = stack[sp + 2]; // return address
                bp = stack[sp + 1]; // dynamic link
                break;
            case 1: // NEG
                stack[sp-1] = -stack[sp-1];
                ++pc;
                break;
            case 2: // ADD
                --sp; stack[sp-1] += stack[sp]; ++pc;
                break;
            case 3: // SUB
                --sp; stack[sp-1] -= stack[sp]; ++pc;
                break;
            case 4: // MUL
                --sp; stack[sp-1] *= stack[sp]; ++pc;
                break;
            case 5: // DIV
                --sp; stack[sp-1] /= stack[sp]; ++pc;
                break;
            default:
                ++pc;
                break;
        }
    }
    void handle_LOD(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[sp++] = stack[base(instr.level, bp) + instr.address];
        ++pc;
    }
    void handle_STO(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[base(instr.level, bp) + instr.address] = stack[--sp];
        ++pc;
    }
    void handle_CAL(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        stack[sp] = 0; // static link (filled below)
        stack[sp+1] = bp; // dynamic link
        stack[sp+2] = pc + 1; // return address
        // static link
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[sp] = base(instr.level, bp);
        bp = sp;
        pc = instr.address;
    }
    void handle_INT(PMachine&, const PInstruction& instr, int* /*stack*/, int& sp, int& /*bp*/, int& pc) {
        sp += instr.value;
        ++pc;
    }
    void handle_JMP(PMachine&, const PInstruction& instr, int* /*stack*/, int& /*sp*/, int& /*bp*/, int& pc) {
        pc = instr.address;
    }
    void handle_JZ(PMachine&, const PInstruction& instr, int* stack, int& sp, int& /*bp*/, int& pc) {
        if (stack[--sp] == 0) pc = instr.address; else ++pc;
    }
    void handle_HALT(PMachine&, const PInstruction&, int*, int&, int&, int&) {
        // No-op: run() will exit after handler returns
    }
    void handle_NOP(PMachine&, const PInstruction&, int*, int&, int&, int&) {
        // No operation
    }
}

void PMachine::init_handler_table() {
    handler_table[OP_LIT] = handle_LIT;
    handler_table[OP_OPR] = handle_OPR;
    handler_table[OP_LOD] = handle_LOD;
    handler_table[OP_STO] = handle_STO;
    handler_table[OP_CAL] = handle_CAL;
    handler_table[OP_INT] = handle_INT;
    handler_table[OP_JMP] = handle_JMP;
    handler_table[OP_JZ] = handle_JZ;
    handler_table[OP_HALT] = handle_HALT;
    handler_table[OP_NOP] = handle_NOP;
}

void PMachine::register_extension(uint8_t opcode, HandlerFunc func) {
    handler_table[opcode] = func;
}
void PMachine::setRoutingContext(const std::string& inputQueue, const std::string& message) {
    currentInputQueue = inputQueue;
    currentMessage = message;
}
const std::vector<RouteDelivery>& PMachine::getRoutingDeliveries() const {
    return routingDeliveries;
}
void PMachine::clearRoutingDeliveries() {
    routingDeliveries.clear();
}
void PMachine::setMappings(const std::vector<MappingDef>& defs) {
    mappingDefs.clear();
    for (const auto& def : defs) {
        if (def.id.empty()) continue;
        mappingDefs[def.id] = def;
    }
}
void PMachine::clearMappings() {
    mappingDefs.clear();
}
const MappingDef* PMachine::getMappingById(const std::string& mappingId) const {
    auto it = mappingDefs.find(mappingId);
    if (it == mappingDefs.end()) return nullptr;
    return &(it->second);
}
int PMachine::openFile(const String&, const String&) { return -1; }
bool PMachine::closeFile(int) { return false; }
bool PMachine::readLine(int, String&) { return false; }
bool PMachine::writeLine(int, const String&) { return false; }
const PCodeMap& PMachine::getPCodeMap() const { static PCodeMap m; return m; }
const MemoryMap& PMachine::getMemoryMap() const { static MemoryMap m; return m; }
const std::vector<std::string> PMachine::getStringPool() const { static std::vector<std::string> v; return v; }
std::map<std::string, int> PMachine::getEnumTypes() const { return {}; }
Status PMachine::getStatus() const { return Status{}; }
bool PMachine::loadProgram(const std::vector<uint8_t>&, const std::string&, size_t) { return false; }
void PMachine::singleStep() {}
void PMachine::setBreakpoint(uint16_t) {}
void PMachine::clearBreakpoint(uint16_t) {}
void PMachine::clearAllBreakpoints() {}

// Standalone loader function (inside pmachine namespace, fully qualified types)
std::vector<pmachine::PInstruction> loadTextPCode(const std::string& text) {
    std::vector<pmachine::PInstruction> instructions;
    std::map<std::string, size_t> labelToIndex;
    std::vector<std::pair<size_t, std::string>> unresolvedJumps;
    std::istringstream iss(text);
    std::string line;
    while (std::getline(iss, line)) {
        // Remove comments and trim
        auto comment = line.find('#');
        if (comment != std::string::npos) line = line.substr(0, comment);
        size_t first = line.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) continue;
        size_t last = line.find_last_not_of(" \t\r\n");
        line = line.substr(first, last - first + 1);
        if (line.empty()) continue;

        // Check for label: prefix
        std::string label, rest = line;
        size_t colon = line.find(':');
        if (colon != std::string::npos && colon > 0 && isalpha(line[0])) {
            label = line.substr(0, colon);
            rest = line.substr(colon + 1);
            // Remove leading whitespace after colon
            size_t first2 = rest.find_first_not_of(" \t");
            if (first2 != std::string::npos) rest = rest.substr(first2);
            else rest = "";
        }
        if (!label.empty()) {
            labelToIndex[label] = instructions.size();
        }
        if (rest.empty()) continue;

        std::istringstream lss(rest);
        std::string mnemonic;
        lss >> mnemonic;
        uint8_t opcode = pmachine::opcodeFromMnemonic(mnemonic);
        pmachine::PInstruction instr;
        instr.opcode = opcode;
        instr.type = pmachine::OperandType::NONE;
        instr.intOperand = 0;
        instr.strOperand = "";
        instr.label = "";

        if (opcode == pmachine::OP_PUSH_STR) {
            std::string rest2;
            std::getline(lss, rest2);
            size_t q1 = rest2.find('"');
            size_t q2 = rest2.find('"', q1 + 1);
            if (q1 != std::string::npos && q2 != std::string::npos && q2 > q1) {
                instr.strOperand = rest2.substr(q1 + 1, q2 - q1 - 1);
                instr.type = pmachine::OperandType::STRING;
            }
        } else if (opcode == pmachine::OP_PUSH_INT) {
            int value;
            lss >> value;
            instr.intOperand = value;
            instr.type = pmachine::OperandType::INT;
        } else if (opcode == pmachine::OP_PUSH_ENUM) {
            std::string enumType, enumValue;
            lss >> enumType >> enumValue;
            instr.enumType = enumType;
            instr.strOperand = enumValue;
            instr.type = pmachine::OperandType::INT;
        } else if (opcode == pmachine::OP_ROUTE_MATCH_QUEUE || opcode == pmachine::OP_ROUTE_EVAL_WHEN ||
                   opcode == pmachine::OP_ROUTE_TRANSFORM || opcode == pmachine::OP_ROUTE_EMIT) {
            std::string rest2;
            std::getline(lss, rest2);
            size_t q1 = rest2.find('"');
            size_t q2 = rest2.find('"', q1 + 1);
            if (q1 != std::string::npos && q2 != std::string::npos && q2 > q1) {
                instr.strOperand = rest2.substr(q1 + 1, q2 - q1 - 1);
                instr.type = pmachine::OperandType::STRING;
            }
        } else if (opcode == pmachine::OP_JMP || opcode == pmachine::OP_JZ) {
            std::string targetLabel;
            lss >> targetLabel;
            instr.label = targetLabel;
            unresolvedJumps.push_back({instructions.size(), targetLabel});
        } else if (opcode == pmachine::OP_ADD || opcode == pmachine::OP_SUB || opcode == pmachine::OP_MUL || opcode == pmachine::OP_DIV) {
            instr.type = pmachine::OperandType::NONE;
        } else if (opcode == pmachine::OP_PRINT_INT || opcode == pmachine::OP_PRINT_ENUM) {
            instr.type = pmachine::OperandType::NONE;
        }
        instructions.push_back(instr);
    }
    // Resolve jump targets
    for (auto& pair : unresolvedJumps) {
        size_t idx = pair.first;
        const std::string& lbl = pair.second;
        auto it = labelToIndex.find(lbl);
        if (it != labelToIndex.end()) {
            instructions[idx].intOperand = static_cast<int>(it->second);
        } else {
            // Unresolved label, set to -1
            instructions[idx].intOperand = -1;
        }
    }
    return instructions;
}

void PMachine::run(const std::vector<PInstruction>& instructions) {
    static const int STACK_SIZE = 1024;
    int stack[STACK_SIZE] = {0};
    std::vector<std::string> strStack;
    int sp = 0;
    int bp = 0;
    int pc = 0;
    PMTRACE(Serial.println("[DEBUG] Executing pinstructions:"));
    while (pc < (int)instructions.size()) {
        const auto& instr = instructions[pc];
        PMTRACE({
            Serial.print("[STEP] ");
            Serial.print(pc);
            Serial.print(": opcode=0x");
            Serial.print(instr.opcode, HEX);
            Serial.print(", level=");
            Serial.print(instr.level);
            Serial.print(", address=");
            Serial.print(instr.address);
            Serial.print(", value=");
            Serial.print(instr.value);
            Serial.print(", label=");
            Serial.print(instr.label.c_str());
            Serial.print(" | stack: [");
            for (int j = 0; j < sp; ++j) {
                Serial.print(stack[j]);
                if (j + 1 < sp) Serial.print(", ");
            }
            Serial.println("]");
        });

        if (instr.opcode == OP_PUSH_STR) {
            strStack.push_back(instr.strOperand);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PUSH_INT) {
            if (sp < STACK_SIZE) {
                stack[sp++] = instr.intOperand;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ADD || instr.opcode == OP_SUB || instr.opcode == OP_MUL || instr.opcode == OP_DIV) {
            if (sp >= 2) {
                int rhs = stack[--sp];
                int lhs = stack[sp - 1];
                if (instr.opcode == OP_ADD) stack[sp - 1] = lhs + rhs;
                if (instr.opcode == OP_SUB) stack[sp - 1] = lhs - rhs;
                if (instr.opcode == OP_MUL) stack[sp - 1] = lhs * rhs;
                if (instr.opcode == OP_DIV) stack[sp - 1] = (rhs == 0 ? 0 : lhs / rhs);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PRINT_INT) {
            if (sp > 0) {
                int v = stack[--sp];
                PMTRACE({ Serial.print("[PRINT_INT] "); Serial.println(v); });
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PRINT_ENUM) {
            if (sp > 0) {
                int v = stack[--sp];
                PMTRACE({ Serial.print("[PRINT_ENUM] "); Serial.println(v); });
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ROUTE_MATCH_QUEUE) {
            const std::string queueName = instr.strOperand;
            stack[sp++] = (queueName == currentInputQueue) ? 1 : 0;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ROUTE_EVAL_WHEN) {
            stack[sp++] = evaluateWhenRuleText(instr.strOperand, currentMessage) ? 1 : 0;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ROUTE_TRANSFORM) {
            currentMessage = applyTransformRuleText(*this, instr.strOperand, currentMessage);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ROUTE_EMIT) {
            RouteDelivery d;
            d.queueName = instr.strOperand;
            d.message = currentMessage;
            routingDeliveries.push_back(d);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PARSE_FIN_TEXT) {
            JsonDocument parsed;
            parseMT103FinText(currentMessage, parsed);
            std::string asJson;
            serializeJson(parsed, asJson);
            currentMessage = asJson;
            ++pc;
            continue;
        }

        HandlerFunc handler = handler_table[instr.opcode];
        if (handler) {
            handler(*this, instr, stack, sp, bp, pc);
            if (instr.opcode == OP_HALT) {
                PMTRACE(Serial.println("[HALT]"));
                return;
            }
        } else {
            // Unknown opcode: skip
            ++pc;
        }
    }
    PMTRACE(Serial.println("[DEBUG] Execution finished."));
}
}
