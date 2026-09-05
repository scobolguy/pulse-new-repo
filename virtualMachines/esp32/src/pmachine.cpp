

#include <sstream>
#include <algorithm>
#include <cctype>
#include <set>
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

    std::string normalizeDslEscapes(const std::string& in) {
        std::string out;
        out.reserve(in.size());
        for (size_t i = 0; i < in.size(); ++i) {
            const char c = in[i];
            if (c == '\\' && i + 1 < in.size()) {
                const char n = in[i + 1];
                if (n == '"' || n == '\'' || n == '\\') {
                    out.push_back(n);
                    ++i;
                    continue;
                }
            }
            out.push_back(c);
        }
        return out;
    }

    struct MemoryPressureSnapshot {
        uint32_t freeHeapBytes = 0;
        uint32_t stackHighWaterBytes = 0;
        uint32_t stackHeapGapBytes = 0;
        bool stackHeapCollisionRisk = false;
        std::string memoryPressureLevel = "unknown";
    };

    MemoryPressureSnapshot captureMemoryPressureSnapshot(size_t stackDepth = 0, size_t stackCapacity = 0) {
        MemoryPressureSnapshot snapshot;
#if defined(ESP32)
        snapshot.freeHeapBytes = static_cast<uint32_t>(ESP.getFreeHeap());
        const uint32_t highWaterWords = static_cast<uint32_t>(uxTaskGetStackHighWaterMark(nullptr));
        snapshot.stackHighWaterBytes = highWaterWords * static_cast<uint32_t>(sizeof(uint32_t));
        snapshot.stackHeapGapBytes = (snapshot.freeHeapBytes > snapshot.stackHighWaterBytes)
            ? (snapshot.freeHeapBytes - snapshot.stackHighWaterBytes)
            : 0;
#else
        (void)stackDepth;
        (void)stackCapacity;
#endif
        const bool stackNearLimit = stackCapacity > 0 && stackDepth + 8 >= stackCapacity;
        const bool heapTight = snapshot.freeHeapBytes > 0 && snapshot.freeHeapBytes < 32768;
        const bool gapCritical = snapshot.stackHeapGapBytes > 0 && snapshot.stackHeapGapBytes < 8192;
        const bool gapWarning = snapshot.stackHeapGapBytes > 0 && snapshot.stackHeapGapBytes < 16384;

        snapshot.stackHeapCollisionRisk = stackNearLimit || heapTight || gapCritical;
        if (snapshot.stackHeapCollisionRisk) {
            snapshot.memoryPressureLevel = "critical";
        } else if (gapWarning) {
            snapshot.memoryPressureLevel = "warning";
        } else {
            snapshot.memoryPressureLevel = "ok";
        }
        return snapshot;
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
        const std::string t = normalizeDslEscapes(trimCopy(text));
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

    std::vector<std::string> splitOperands(const std::string& text) {
        std::vector<std::string> operands;
        size_t start = 0;
        int depth = 0;
        char quote = '\0';
        for (size_t i = 0; i <= text.size(); ++i) {
            const char ch = i < text.size() ? text[i] : ',';
            if (quote != '\0') {
                if (ch == '\\') {
                    ++i;
                } else if (ch == quote) {
                    quote = '\0';
                }
                continue;
            }
            if (ch == '"' || ch == '\'') {
                quote = ch;
            } else if (ch == '(') {
                ++depth;
            } else if (ch == ')') {
                --depth;
            } else if (ch == ',' && depth == 0) {
                operands.push_back(trimCopy(text.substr(start, i - start)));
                start = i + 1;
            }
        }
        if (operands.size() == 1 && operands.front().empty()) operands.clear();
        return operands;
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
            // isNull() rather than truthiness, so 0/false/"" resolve instead of reading as absent.
            if (obj[key.c_str()].isNull()) return "";
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

            // to<JsonObject>() binds a new child; assigning a bare JsonObject() stores null.
            if (!current[key.c_str()].is<JsonObject>()) {
                current[key.c_str()].to<JsonObject>();
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

    std::map<std::string, std::string> gFlowState;

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
        const std::string normalizedWhen = normalizeDslEscapes(whenRule);
        const std::string whenUpper = toUpperCopy(normalizedWhen);
        const std::string msgUpper = toUpperCopy(message);

        if (whenUpper.find("OUTPUT := 1") != std::string::npos) return true;
        if (whenUpper.find("OUTPUT := 0") != std::string::npos && whenUpper.find("THEN OUTPUT := 1") == std::string::npos) return false;

        const std::string fn = "STARTSWITH(UPPER(SRC),";
        const size_t fnIdx = whenUpper.find(fn);
        if (fnIdx != std::string::npos) {
            const size_t firstQuote = normalizedWhen.find('"');
            const size_t secondQuote = (firstQuote == std::string::npos) ? std::string::npos : normalizedWhen.find('"', firstQuote + 1);
            if (firstQuote != std::string::npos && secondQuote != std::string::npos && secondQuote > firstQuote) {
                const std::string prefix = normalizedWhen.substr(firstQuote + 1, secondQuote - firstQuote - 1);
                return msgUpper.rfind(toUpperCopy(prefix), 0) == 0;
            }
        }

        const auto evaluateFieldRule = [&](const char* prefix, bool contains) -> int {
            const std::string upperPrefix(prefix);
            if (whenUpper.rfind(upperPrefix, 0) != 0) return -1;
            const size_t open = normalizedWhen.find('(');
            const size_t close = normalizedWhen.rfind(')');
            if (open == std::string::npos || close == std::string::npos || close <= open) return 0;

            const std::string args = normalizedWhen.substr(open + 1, close - open - 1);
            const int comma = findTopLevelComma(args);
            if (comma < 0) return 0;

            std::string field = unquote(args.substr(0, static_cast<size_t>(comma)));
            std::string expected = unquote(args.substr(static_cast<size_t>(comma) + 1));
            field = trimCopy(field);
            expected = trimCopy(expected);
            if (field.empty()) return 0;

            std::string actual;
            const std::string statePrefix = "state.";
            if (field.rfind(statePrefix, 0) == 0) {
                const std::string stateKey = field.substr(statePrefix.size());
                auto it = gFlowState.find(stateKey);
                if (it != gFlowState.end()) actual = it->second;
            } else {
                JsonDocument parsed;
                DeserializationError err = deserializeJson(parsed, message.c_str());
                if (!err) {
                    actual = getJsonPathValueAsString(parsed.as<JsonVariantConst>(), field);
                    if (actual.empty() && field.rfind("message.", 0) == 0) {
                        actual = getJsonPathValueAsString(parsed.as<JsonVariantConst>(), field.substr(8));
                    }
                }
            }

            if (contains) {
                return toUpperCopy(actual).find(toUpperCopy(expected)) != std::string::npos ? 1 : 0;
            }
            return actual == expected ? 1 : 0;
        };

        int fieldEquals = evaluateFieldRule("FIELD_EQUALS(", false);
        if (fieldEquals >= 0) return fieldEquals == 1;

        int fieldContains = evaluateFieldRule("FIELD_CONTAINS(", true);
        if (fieldContains >= 0) return fieldContains == 1;

        if (whenUpper.find("MT103") != std::string::npos) {
            return msgUpper.rfind("MT103", 0) == 0;
        }
        if (whenUpper.find("MT202") != std::string::npos) {
            return msgUpper.rfind("MT202", 0) == 0;
        }

        return true;
    }

    bool parseOrchestrationSpawnOperand(const std::string& operand, pmachine::OrchestrationSpawnRequest& outReq, std::string& outError) {
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, operand.c_str());
        if (err) {
            outError = std::string("invalid ORCH_SPAWN payload: ") + err.c_str();
            return false;
        }

        JsonObject obj = doc.as<JsonObject>();
        outReq.subflowId = std::string(obj["subflowId"] | "");
        outReq.nodeId = std::string(obj["nodeId"] | "");
        outReq.payloadRef = std::string(obj["payloadRef"] | "");
        outReq.timeoutMs = static_cast<uint32_t>(obj["timeoutMs"] | 0);
        outReq.handleRef = std::string(obj["handleRef"] | "");

        if (outReq.subflowId.empty()) {
            outError = "ORCH_SPAWN missing subflowId";
            return false;
        }
        return true;
    }

    bool parseOrchestrationWaitOperand(const std::string& operand, uint32_t& outTimeoutMs, std::string& outReason, std::string& outError) {
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, operand.c_str());
        if (err) {
            outError = std::string("invalid ORCH_WAIT_ALL payload: ") + err.c_str();
            return false;
        }

        JsonObject obj = doc.as<JsonObject>();
        outTimeoutMs = static_cast<uint32_t>(obj["timeoutMs"] | 0);
        outReason = std::string(obj["reason"] | "");
        return true;
    }

    std::string applyTransformRuleText(const PMachine& vm, const std::string& transformRule, const std::string& message) {
        const std::string rule = trimCopy(normalizeDslEscapes(transformRule));
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

    void handle_LIT(PMachine& vm, const PInstruction& instr, Value* stack, int& sp, int& bp, int& pc) {
        stack[sp++] = instr.value;
        ++pc;
    }
    void handle_OPR(PMachine& vm, const PInstruction& instr, Value* stack, int& sp, int& bp, int& pc) {
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
                --sp; stack[sp-1] = static_cast<int>(stack[sp-1]) + static_cast<int>(stack[sp]); ++pc;
                break;
            case 3: // SUB
                --sp; stack[sp-1] = static_cast<int>(stack[sp-1]) - static_cast<int>(stack[sp]); ++pc;
                break;
            case 4: // MUL
                --sp; stack[sp-1] = static_cast<int>(stack[sp-1]) * static_cast<int>(stack[sp]); ++pc;
                break;
            case 5: // DIV
                --sp; stack[sp-1] = static_cast<int>(stack[sp]) == 0 ? 0 : static_cast<int>(stack[sp-1]) / static_cast<int>(stack[sp]); ++pc;
                break;
            default:
                ++pc;
                break;
        }
    }
    void handle_LOD(PMachine& vm, const PInstruction& instr, Value* stack, int& sp, int& bp, int& pc) {
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[sp++] = stack[base(instr.level, bp) + instr.address];
        ++pc;
    }
    void handle_STO(PMachine& vm, const PInstruction& instr, Value* stack, int& sp, int& bp, int& pc) {
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[base(instr.level, bp) + instr.address] = stack[--sp];
        ++pc;
    }
    void handle_CAL(PMachine& vm, const PInstruction& instr, Value* stack, int& sp, int& bp, int& pc) {
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
    void handle_INT(PMachine&, const PInstruction& instr, Value* /*stack*/, int& sp, int& /*bp*/, int& pc) {
        sp += instr.value;
        ++pc;
    }
    void handle_JMP(PMachine&, const PInstruction& instr, Value* /*stack*/, int& /*sp*/, int& /*bp*/, int& pc) {
        const int target = (instr.intOperand >= 0) ? instr.intOperand : instr.address;
        pc = target;
    }
    void handle_JZ(PMachine&, const PInstruction& instr, Value* stack, int& sp, int& /*bp*/, int& pc) {
        const int target = (instr.intOperand >= 0) ? instr.intOperand : instr.address;
        if (stack[--sp] == 0) pc = target; else ++pc;
    }
    void handle_HALT(PMachine&, const PInstruction&, Value*, int&, int&, int&) {
        // No-op: run() will exit after handler returns
    }
    void handle_NOP(PMachine&, const PInstruction&, Value*, int&, int&, int& pc) {
        ++pc;
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
    // Pre-populate 'src' as a string-valued named variable so it's accessible in programs
    setNamedStringVariable("src", message);
}

void PMachine::setNamedStringVariable(const std::string& name, const std::string& value) {
    namedStringVariables[name] = value;
}

std::string PMachine::getNamedStringVariable(const std::string& name) const {
    auto it = namedStringVariables.find(name);
    return (it != namedStringVariables.end()) ? it->second : "";
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
        loadResidentDomain("mapper-artifacts", def.id, def.items.size() * sizeof(MappingItem), false);
    }
}
void PMachine::clearMappings() {
    for (const auto& it : mappingDefs) {
        unloadResidentDomain("mapper-artifacts", it.first);
    }
    mappingDefs.clear();
}
void PMachine::setProcedureSignatures(const std::map<std::string, std::vector<std::string>>& signatures) {
    procedureParamsByLabel.clear();
    for (const auto& entry : signatures) {
        const std::string rawLabel = trimCopy(entry.first);
        if (rawLabel.empty()) continue;

        procedureParamsByLabel[rawLabel] = entry.second;

        const bool hasProcPrefix = rawLabel.rfind("PROC_", 0) == 0;
        if (hasProcPrefix && rawLabel.size() > 5) {
            procedureParamsByLabel[rawLabel.substr(5)] = entry.second;
        } else if (!hasProcPrefix) {
            procedureParamsByLabel[std::string("PROC_") + rawLabel] = entry.second;
        }
    }
}
void PMachine::clearProcedureSignatures() {
    procedureParamsByLabel.clear();
}
void PMachine::setOrchestrationWaitHook(OrchestrationWaitHook hook, void* context) {
    orchestrationWaitHook = hook;
    orchestrationHookContext = context;
}
void PMachine::setThunkResolverHook(ThunkResolveHook hook, void* context) {
    thunkResolveHook = hook;
    thunkResolverContext = context;
}
void PMachine::setServiceCallHook(ServiceCallHook hook, void* context) {
    serviceCallHook = hook;
    serviceCallContext = context;
}
void PMachine::setTextOutputHook(TextOutputHook hook, void* context) {
    textOutputHook = hook;
    textOutputContext = context;
}
void PMachine::setThunkBinding(const std::string& symbol, int targetPc) {
    const std::string key = trimCopy(symbol);
    if (key.empty()) return;
    thunkBindings[key] = targetPc;
}
bool PMachine::clearThunkBinding(const std::string& symbol) {
    const std::string key = trimCopy(symbol);
    if (key.empty()) return false;
    auto it = thunkBindings.find(key);
    if (it == thunkBindings.end()) return false;
    thunkBindings.erase(it);
    return true;
}
void PMachine::clearAllThunkBindings() {
    thunkBindings.clear();
}
std::map<std::string, int> PMachine::getThunkBindings() const {
    return thunkBindings;
}
std::string PMachine::getImageMemoryMapJson() const {
    JsonDocument doc;
    doc["backingFile"] = backingFile;
    doc["runtimeUnitId"] = runtimeUnit.id;
    doc["runtimeUnitResident"] = runtimeUnit.resident;
    doc["numPages"] = numPages;
    doc["pageSizeBytes"] = static_cast<uint32_t>(pagingConfig.pageSizeBytes);
    doc["maxFrames"] = static_cast<uint32_t>(pagingConfig.maxFrames);
    doc["programImageBytes"] = static_cast<uint32_t>(programImage.size());

    JsonObject pagingStatsObj = doc["pagingStats"].to<JsonObject>();
    pagingStatsObj["pageFaults"] = pagingStats.pageFaults;
    pagingStatsObj["evictions"] = pagingStats.evictions;
    pagingStatsObj["ffsReads"] = pagingStats.ffsReads;
    pagingStatsObj["cacheHits"] = pagingStats.cacheHits;

    JsonArray mapArray = doc["memoryMap"].to<JsonArray>();
    for (const auto& entry : memoryMap) {
        JsonObject item = mapArray.add<JsonObject>();
        item["vpage"] = entry.first;
        item["frame"] = entry.second;
    }

    JsonArray pageTableArray = doc["pageTable"].to<JsonArray>();
    for (size_t i = 0; i < pageTable.size(); ++i) {
        JsonObject item = pageTableArray.add<JsonObject>();
        item["vpage"] = static_cast<uint32_t>(i);
        item["present"] = pageTable[i].present;
        item["frameIndex"] = pageTable[i].frameIndex;
    }

    JsonArray framesArray = doc["frames"].to<JsonArray>();
    for (size_t i = 0; i < frames.size(); ++i) {
        JsonObject item = framesArray.add<JsonObject>();
        item["frameIndex"] = static_cast<uint32_t>(i);
        item["used"] = frames[i].used;
        item["pinned"] = frames[i].pinned;
        item["vpage"] = frames[i].vpage;
        item["lastAccessTick"] = frames[i].lastAccessTick;
    }

    JsonObject thunkObj = doc["thunks"].to<JsonObject>();
    for (const auto& it : thunkBindings) {
        thunkObj[it.first.c_str()] = it.second;
    }

    std::string out;
    serializeJson(doc, out);
    return out;
}
const MappingDef* PMachine::getMappingById(const std::string& mappingId) const {
    auto it = mappingDefs.find(mappingId);
    if (it == mappingDefs.end()) return nullptr;
    return &(it->second);
}
int PMachine::openFile(const String& logicalName, const String& mode) {
    return ffs == nullptr ? -1 : ffs->openFile(logicalName, mode);
}
bool PMachine::closeFile(int handle) {
    return ffs != nullptr && ffs->closeFile(handle);
}
bool PMachine::readLine(int handle, String& outLine) {
    return ffs != nullptr && ffs->readLine(handle, outLine);
}
bool PMachine::writeLine(int handle, const String& line) {
    return ffs != nullptr && ffs->writeLine(handle, line);
}
const PCodeMap& PMachine::getPCodeMap() const { return pcodeMap; }
const MemoryMap& PMachine::getMemoryMap() const { return memoryMap; }
const std::vector<std::string> PMachine::getStringPool() const {
    std::vector<std::string> out;
    for (const auto& a : residentAssets) {
        if (a.domain == ResidentDomain::StringPool && a.resident) out.push_back(a.id);
    }
    return out;
}
std::map<std::string, int> PMachine::getEnumTypes() const { return enumTypes; }

static RuntimeUnitKind parseRuntimeUnitKind(const std::string& kindText) {
    const std::string k = toUpperCopy(trimCopy(kindText));
    if (k == "PROGRAM") return RuntimeUnitKind::Program;
    if (k == "DAEMON") return RuntimeUnitKind::Daemon;
    return RuntimeUnitKind::Service;
}

static ResidentDomain parseResidentDomain(const std::string& domainText) {
    const std::string d = toUpperCopy(trimCopy(domainText));
    if (d == "STRINGPOOL" || d == "STRING_POOL") return ResidentDomain::StringPool;
    if (d == "GLOBALENUMERATEDTYPES" || d == "GLOBAL_ENUMERATED_TYPES") return ResidentDomain::GlobalEnumeratedTypes;
    if (d == "GLOBALTYPES" || d == "GLOBAL_TYPES") return ResidentDomain::GlobalTypes;
    if (d == "MAPPERARTIFACTS" || d == "MAPPER_ARTIFACTS") return ResidentDomain::MapperArtifacts;
    return ResidentDomain::ProgramImage;
}

Status PMachine::getStatus() const {
    Status s;
    s.numPages = numPages;
    s.backingFile = backingFile;
    s.maxSpace = maxSpace;
    const MemoryPressureSnapshot pressure = captureMemoryPressureSnapshot();
    s.freeHeapBytes = pressure.freeHeapBytes;
    s.stackHighWaterBytes = pressure.stackHighWaterBytes;
    s.stackHeapGapBytes = pressure.stackHeapGapBytes;
    s.stackHeapCollisionRisk = pressure.stackHeapCollisionRisk;
    s.memoryPressureLevel = pressure.memoryPressureLevel;
    s.dynamicLibs = dynamicLibs;
    s.running = running;
    s.pc = pc;
    s.breakpoints = breakpoints;
    s.runtimeUnit = runtimeUnit;
    s.pagingConfig = pagingConfig;
    s.pagingStats = pagingStats;
    s.residentAssets = residentAssets;
    s.memoryMap = memoryMap;
    s.thunkBindings = thunkBindings;
    return s;
}

void PMachine::setMemoryConfig(size_t pageSizeBytes, size_t maxFrames) {
    if (pageSizeBytes > 0) pagingConfig.pageSizeBytes = pageSizeBytes;
    if (maxFrames > 0) pagingConfig.maxFrames = maxFrames;
}

PagingConfig PMachine::getPagingConfig() const {
    return pagingConfig;
}

PagingStats PMachine::getPagingStats() const {
    return pagingStats;
}

void PMachine::setRuntimeUnit(const std::string& kind, const std::string& id, uint32_t refreshMs) {
    runtimeUnit.kind = parseRuntimeUnitKind(kind);
    runtimeUnit.id = trimCopy(id);
    runtimeUnit.refreshMs = (runtimeUnit.kind == RuntimeUnitKind::Daemon)
        ? (refreshMs > 0 ? refreshMs : 1000)
        : 0;
}

const RuntimeUnitDescriptor& PMachine::getRuntimeUnit() const {
    return runtimeUnit;
}

bool PMachine::loadResidentDomain(const std::string& domain, const std::string& id, size_t bytes, bool pin) {
    const ResidentDomain parsedDomain = parseResidentDomain(domain);
    const std::string trimmedId = trimCopy(id);
    if (trimmedId.empty()) return false;

    const uint32_t nowMs = millis();
    for (auto& asset : residentAssets) {
        if (asset.domain == parsedDomain && asset.id == trimmedId) {
            asset.resident = true;
            asset.bytes = bytes > 0 ? bytes : asset.bytes;
            asset.lastUsedAtMs = nowMs;
            if (pin) asset.pinCount = static_cast<uint16_t>(asset.pinCount + 1);
            return true;
        }
    }

    ResidentAssetRecord rec;
    rec.domain = parsedDomain;
    rec.id = trimmedId;
    rec.bytes = bytes;
    rec.pinCount = pin ? 1 : 0;
    rec.loadedAtMs = nowMs;
    rec.lastUsedAtMs = nowMs;
    rec.resident = true;
    residentAssets.push_back(rec);

    if (parsedDomain == ResidentDomain::GlobalEnumeratedTypes) {
        enumTypes[trimmedId] = static_cast<int>(enumTypes.size());
    }

    return true;
}

bool PMachine::unloadResidentDomain(const std::string& domain, const std::string& id) {
    const ResidentDomain parsedDomain = parseResidentDomain(domain);
    const std::string trimmedId = trimCopy(id);
    for (auto& asset : residentAssets) {
        if (asset.domain != parsedDomain || asset.id != trimmedId) continue;
        if (asset.pinCount > 0) {
            asset.pinCount = static_cast<uint16_t>(asset.pinCount - 1);
        }
        if (asset.pinCount == 0) {
            asset.resident = false;
        }
        if (parsedDomain == ResidentDomain::GlobalEnumeratedTypes && !asset.resident) {
            enumTypes.erase(trimmedId);
        }
        return true;
    }
    return false;
}

std::vector<ResidentAssetRecord> PMachine::getResidentAssets() const {
    std::vector<ResidentAssetRecord> out;
    for (const auto& asset : residentAssets) {
        if (asset.resident) out.push_back(asset);
    }
    return out;
}

void PMachine::touchResidentAsset(const std::string& domain, const std::string& id) {
    const ResidentDomain parsedDomain = parseResidentDomain(domain);
    const std::string trimmedId = trimCopy(id);
    const uint32_t nowMs = millis();
    for (auto& asset : residentAssets) {
        if (asset.domain == parsedDomain && asset.id == trimmedId && asset.resident) {
            asset.lastUsedAtMs = nowMs;
            return;
        }
    }
}

bool PMachine::loadUnit(const std::string& kind, const std::string& id, uint32_t refreshMs) {
    setRuntimeUnit(kind, id, refreshMs);
    runtimeUnit.loadedAtMs = millis();
    runtimeUnit.lastRefreshAtMs = runtimeUnit.loadedAtMs;
    runtimeUnit.resident = true;
    return loadResidentDomain("program-image", runtimeUnit.id, maxSpace, false);
}

bool PMachine::unloadUnit() {
    if (runtimeUnit.resident) {
        unloadResidentDomain("program-image", runtimeUnit.id);
    }
    runtimeUnit.resident = false;
    pcodeMap.clear();
    memoryMap.clear();
    decltype(programImage)().swap(programImage);
    decltype(pageTable)().swap(pageTable);
    decltype(frames)().swap(frames);
    namedStringVariables.clear();
    namedRealVariables.clear();
    namedEnumVariables.clear();
    clearProcedureSignatures();
    std::string().swap(currentInputQueue);
    std::string().swap(currentMessage);
    std::string().swap(backingFile);
    numPages = 0;
    maxSpace = 0;
    lruTick = 0;
    return true;
}

void PMachine::tickDaemonRefresh(uint32_t nowMs) {
    if (runtimeUnit.kind != RuntimeUnitKind::Daemon || !runtimeUnit.resident || runtimeUnit.refreshMs == 0) return;
    if (nowMs == 0) nowMs = millis();
    if ((nowMs - runtimeUnit.lastRefreshAtMs) >= runtimeUnit.refreshMs) {
        runtimeUnit.lastRefreshAtMs = nowMs;
    }
}

bool PMachine::loadProgram(std::vector<uint8_t> pcode, const std::string& file, size_t maxBytes) {
    pcodeMap.clear();
    memoryMap.clear();
    programImage = std::move(pcode);
    pageTable.clear();
    frames.clear();
    lruTick = 0;

    backingFile = file;
    maxSpace = maxBytes;

    if (pagingConfig.pageSizeBytes == 0) pagingConfig.pageSizeBytes = 1024;
    if (pagingConfig.maxFrames == 0) pagingConfig.maxFrames = 24;

    const size_t pageSize = pagingConfig.pageSizeBytes;
    numPages = static_cast<int>((programImage.size() + pageSize - 1) / pageSize);
    pageTable.resize(static_cast<size_t>(numPages));

    // Keep a bounded debug view of the image to avoid heap exhaustion from
    // one map node per byte on constrained devices.
#if defined(ESP32)
    constexpr size_t kMaxPcodeMapEntries = 64;
#else
    constexpr size_t kMaxPcodeMapEntries = 512;
#endif
    const size_t pcodeMapCount = std::min(programImage.size(), kMaxPcodeMapEntries);
    for (size_t i = 0; i < pcodeMapCount; ++i) {
        pcodeMap[static_cast<uint16_t>(i)] = programImage[i];
    }

    const size_t residentPages = std::min(static_cast<size_t>(numPages), pagingConfig.maxFrames);
    frames.resize(residentPages);
    for (size_t vp = 0; vp < static_cast<size_t>(numPages); ++vp) {
        if (vp < residentPages) {
            memoryMap[static_cast<uint16_t>(vp)] = static_cast<uint32_t>(vp);
            pageTable[vp].present = true;
            pageTable[vp].frameIndex = static_cast<uint16_t>(vp);
            frames[vp].used = true;
            frames[vp].pinned = false;
            frames[vp].vpage = static_cast<uint16_t>(vp);
            frames[vp].lastAccessTick = ++lruTick;
        } else {
            memoryMap[static_cast<uint16_t>(vp)] = 0xFFFFFFFFu;
            pageTable[vp].present = false;
            pageTable[vp].frameIndex = 0;
        }
    }

    pagingStats.pageFaults = 0;
    pagingStats.evictions = 0;
    pagingStats.ffsReads = 0;
    pagingStats.cacheHits = residentPages;

    loadResidentDomain("program-image", backingFile, pcode.size(), false);
    return true;
}

int PMachine::findLruVictimFrame() const {
    int victim = -1;
    uint32_t oldestTick = 0;
    for (size_t i = 0; i < frames.size(); ++i) {
        const auto& frame = frames[i];
        if (!frame.used || frame.pinned) continue;
        if (victim < 0 || frame.lastAccessTick < oldestTick) {
            victim = static_cast<int>(i);
            oldestTick = frame.lastAccessTick;
        }
    }
    return victim;
}

int PMachine::ensurePageResident(uint16_t vpage) {
    if (vpage >= pageTable.size()) return -1;
    if (pageTable[vpage].present) {
        const uint16_t frameIdx = pageTable[vpage].frameIndex;
        if (frameIdx < frames.size()) {
            frames[frameIdx].lastAccessTick = ++lruTick;
            pagingStats.cacheHits += 1;
            return static_cast<int>(frameIdx);
        }
        pageTable[vpage].present = false;
    }

    pagingStats.pageFaults += 1;
    pagingStats.ffsReads += 1;

    int frameIdx = -1;
    if (frames.size() < pagingConfig.maxFrames) {
        frameIdx = static_cast<int>(frames.size());
        frames.push_back(PageFrame{});
    } else {
        frameIdx = findLruVictimFrame();
        if (frameIdx < 0) return -1;
        const uint16_t evictedVpage = frames[frameIdx].vpage;
        if (evictedVpage < pageTable.size()) {
            pageTable[evictedVpage].present = false;
            pageTable[evictedVpage].frameIndex = 0;
            memoryMap[evictedVpage] = 0xFFFFFFFFu;
        }
        pagingStats.evictions += 1;
    }

    pageTable[vpage].present = true;
    pageTable[vpage].frameIndex = static_cast<uint16_t>(frameIdx);
    memoryMap[vpage] = static_cast<uint32_t>(frameIdx);
    frames[frameIdx].used = true;
    frames[frameIdx].vpage = vpage;
    frames[frameIdx].lastAccessTick = ++lruTick;
    return frameIdx;
}

bool PMachine::readPCodeByte(uint32_t virtualAddress, uint8_t& outByte) {
    if (virtualAddress >= programImage.size()) return false;
    if (pagingConfig.pageSizeBytes == 0) return false;
    const uint16_t vpage = static_cast<uint16_t>(virtualAddress / pagingConfig.pageSizeBytes);
    if (ensurePageResident(vpage) < 0) return false;
    outByte = programImage[virtualAddress];
    return true;
}

void PMachine::singleStep() {}
void PMachine::setBreakpoint(uint16_t) {}
void PMachine::clearBreakpoint(uint16_t) {}
void PMachine::clearAllBreakpoints() {}

// Extracts the first double-quoted literal, honouring \" and \\ escapes like the JS parser.
static bool extractQuotedLiteral(const std::string& text, std::string& out) {
    const size_t open = text.find('"');
    if (open == std::string::npos) return false;

    out.clear();
    for (size_t i = open + 1; i < text.size(); ++i) {
        const char c = text[i];
        if (c == '\\' && (i + 1) < text.size()) {
            const char next = text[i + 1];
            if (next == '"' || next == '\\') {
                out.push_back(next);
                ++i;
                continue;
            }
        }
        if (c == '"') return true;
        out.push_back(c);
    }
    return false;
}

// Standalone loader function (inside pmachine namespace, fully qualified types)
std::vector<pmachine::PInstruction> loadTextPCode(const std::string& text) {
    std::vector<pmachine::PInstruction> instructions;
    std::map<std::string, size_t> labelToIndex;
    std::vector<std::pair<size_t, std::string>> unresolvedJumps;
    const size_t estimatedLineCount = 1 + static_cast<size_t>(
        std::count(text.begin(), text.end(), '\n')
    );
    instructions.reserve(estimatedLineCount);
    unresolvedJumps.reserve(std::min(estimatedLineCount, static_cast<size_t>(64)));
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
        const size_t firstWhitespace = line.find_first_of(" \t");
        const bool hasLabelToken = colon != std::string::npos
            && colon > 0
            && (firstWhitespace == std::string::npos || colon < firstWhitespace)
            && isalpha(static_cast<unsigned char>(line[0]))
            && std::all_of(
                line.begin(),
                line.begin() + colon,
                [](unsigned char value) { return isalnum(value) || value == '_'; }
            );
        if (hasLabelToken) {
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
            std::string literal;
            if (extractQuotedLiteral(rest2, literal)) {
                instr.strOperand = literal;
                instr.type = pmachine::OperandType::STRING;
            }
        } else if (opcode == pmachine::OP_PUSH_INT) {
            int value;
            lss >> value;
            instr.intOperand = value;
            instr.type = pmachine::OperandType::INT;
        } else if (opcode == pmachine::OP_PUSH_REAL) {
            std::string rest2;
            std::getline(lss, rest2);
            instr.strOperand = trimCopy(rest2);
            instr.type = pmachine::OperandType::STRING;
        } else if (opcode == pmachine::OP_PUSH_ENUM) {
            std::string enumType, enumValue;
            lss >> enumType >> enumValue;
            instr.enumType = enumType;
            instr.strOperand = enumValue;
            instr.type = pmachine::OperandType::INT;
        } else if (opcode == pmachine::OP_ROUTE_MATCH_QUEUE || opcode == pmachine::OP_ROUTE_EVAL_WHEN ||
               opcode == pmachine::OP_ROUTE_TRANSFORM || opcode == pmachine::OP_ROUTE_EMIT ||
                   opcode == pmachine::OP_ROUTE_SET_STATE || opcode == pmachine::OP_ORCH_SPAWN ||
                   opcode == pmachine::OP_ORCH_WAIT_ALL || opcode == pmachine::OP_ORCH_FAIL_TXN ||
                   opcode == pmachine::OP_ORCH_RETURN_SUCCESS) {
            std::string rest2;
            std::getline(lss, rest2);
            std::string literal;
            if (extractQuotedLiteral(rest2, literal)) {
                instr.strOperand = literal;
                instr.type = pmachine::OperandType::STRING;
            }
        } else if (opcode == pmachine::OP_JMP || opcode == pmachine::OP_JZ) {
            std::string targetLabel;
            lss >> targetLabel;
            instr.label = targetLabel;
            unresolvedJumps.push_back({instructions.size(), targetLabel});
        } else if (opcode == pmachine::OP_LOAD_NAME || opcode == pmachine::OP_STORE_NAME ||
                   opcode == pmachine::OP_MAP_RETURN) {
            std::string name;
            lss >> name;
            instr.strOperand = name;
            instr.type = pmachine::OperandType::STRING;
        } else if ((opcode >= pmachine::OP_FORK && opcode <= pmachine::OP_ROUTE_FILE) ||
                   opcode == pmachine::OP_MAP ||
                   opcode == pmachine::OP_REC_NEW || opcode == pmachine::OP_REC_SET ||
                   opcode == pmachine::OP_REC_GET ||
                   (opcode >= pmachine::OP_SET_NEW && opcode <= pmachine::OP_SET_DIFF)) {
            std::string operands;
            std::getline(lss, operands);
            instr.strOperand = trimCopy(operands);
            instr.type = pmachine::OperandType::STRING;
        } else if (opcode == pmachine::OP_CALL_LABEL) {
            std::string targetLabel;
            int argc = 0;
            lss >> targetLabel >> argc;
            instr.label = targetLabel;
            instr.value = argc;
            instr.type = pmachine::OperandType::INT;
            unresolvedJumps.push_back({instructions.size(), targetLabel});
        } else if (opcode == pmachine::OP_CALL_EXT) {
            std::string rest2;
            std::getline(lss, rest2);
            size_t q1 = rest2.find('"');
            size_t q2 = rest2.find('"', q1 + 1);
            if (q1 != std::string::npos && q2 != std::string::npos && q2 > q1) {
                instr.strOperand = rest2.substr(q1 + 1, q2 - q1 - 1);
                std::string tail = trimCopy(rest2.substr(q2 + 1));
                if (!tail.empty()) {
                    std::istringstream tailStream(tail);
                    int argc = 0;
                    tailStream >> argc;
                    instr.value = argc;
                }
                instr.type = pmachine::OperandType::STRING;
            }
        } else if (opcode == pmachine::OP_ADD || opcode == pmachine::OP_SUB || opcode == pmachine::OP_MUL || opcode == pmachine::OP_DIV) {
            instr.type = pmachine::OperandType::NONE;
        } else if (opcode == pmachine::OP_EQ || opcode == pmachine::OP_NEQ || opcode == pmachine::OP_LT ||
               opcode == pmachine::OP_LE || opcode == pmachine::OP_GT || opcode == pmachine::OP_GE ||
               opcode == pmachine::OP_OR || opcode == pmachine::OP_AND || opcode == pmachine::OP_NOT ||
               opcode == pmachine::OP_STREQ || opcode == pmachine::OP_STRNEQ ||
               opcode == pmachine::OP_PRINT || opcode == pmachine::OP_PRINT_NL || opcode == pmachine::OP_RET ||
               opcode == pmachine::OP_ROUTE_SET_MESSAGE) {
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
    static const size_t MAX_RUN_STEPS = 200000;
    static const int STACK_SIZE = 512;
    static const size_t MAX_NAME_FRAME_DEPTH = 128;
    static const size_t INITIAL_NAME_FRAME_CAPACITY = 8;
    Value stack[STACK_SIZE];
    // Backing store for StringRef values; freed wholesale when the run ends.
    std::vector<std::string> stringPool;
    using NameBinding = std::pair<std::string, int>;
    using NameFrame = std::vector<NameBinding>;
    std::vector<NameFrame> nameFrames;
    nameFrames.reserve(INITIAL_NAME_FRAME_CAPACITY);
    nameFrames.emplace_back();
    struct NameCallFrame {
        int returnPc = 0;
        size_t envDepth = 1;
    };
    std::vector<NameCallFrame> nameCallStack;
    nameCallStack.reserve(INITIAL_NAME_FRAME_CAPACITY);
    std::string currentOutputLine;
    std::vector<std::string>& outputLines = lastRunTextOutput;
    // Reclaim the previous run's result capacity here; the results themselves must
    // outlive run() so callers can read them.
    decltype(lastRunTextOutput)().swap(lastRunTextOutput);
    auto emitOutputLine = [&](const std::string& line) {
        if (textOutputHook) {
            textOutputHook(line, textOutputContext);
        } else {
            outputLines.push_back(line);
        }
    };
    std::vector<OrchestrationSpawnRequest> pendingOrchTasks;
    bool lastOrchWaitSuccess = false;
    struct IntCollection {
        size_t capacity = 0;
        std::vector<int> items;
    };
    struct FileSession {
        int ffsHandle = -1;
        size_t cursor = 0;
        std::vector<std::string> rows;
    };
    std::map<std::string, IntCollection> queues;
    std::map<std::string, IntCollection> stacks;
    std::map<std::string, IntCollection> priorityQueues;
    std::map<std::string, std::map<std::string, Value>> records;
    // Pascal sets: ordered, duplicate-free ordinal members.
    std::map<std::string, std::set<int>> sets;
    std::map<int, bool> tasks;
    std::map<int, FileSession> files;
    int nextTaskId = 1;
    int nextFileHandle = 1;
    int nextSchemaHandle = 1;
    int nextMapHandle = 1;
    
    // Declare variables before lambdas that use them
    int sp = 0;
    int bp = 0;
    int pc = 0;

    auto stringAt = [&](const Value& value) -> std::string {
        if (value.kind == ValueKind::StringRef) {
            return value.handle < stringPool.size() ? stringPool[value.handle] : std::string();
        }
        if (value.kind == ValueKind::EnumRef) {
            return getEnumValueName(value.handle, value.i);
        }
        if (value.kind == ValueKind::Real) {
            // Pascal-style scientific form; 7 significant digits matches float precision.
            char buf[32] = {0};
            snprintf(buf, sizeof(buf), "%.6E", static_cast<double>(value.r));
            return std::string(buf);
        }
        return std::to_string(value.i);
    };

    auto pushString = [&](const std::string& text) {
        if (sp >= STACK_SIZE) {
            gFlowState["__runtime_error"] = "stack overflow";
            return;
        }
        stringPool.push_back(text);
        stack[sp++] = Value::makeString(static_cast<uint16_t>(stringPool.size() - 1));
    };

    // depth 1 is the top of stack, 2 the value beneath it.
    auto isStringAtDepth = [&](int depth) -> bool {
        return sp >= depth && stack[sp - depth].isString();
    };

    auto popString = [&]() -> std::string {
        if (sp <= 0) return std::string();
        return stringAt(stack[--sp]);
    };

    auto jsonQuote = [&](const std::string& text) -> std::string {
        std::string out = "\"";
        for (char c : text) {
            if (c == '"' || c == '\\') { out += '\\'; out += c; }
            else if (c == '\n') out += "\\n";
            else if (c == '\r') out += "\\r";
            else if (c == '\t') out += "\\t";
            else out += c;
        }
        out += '"';
        return out;
    };

    auto valueToJson = [&](const Value& value) -> std::string {
        if (value.kind == ValueKind::StringRef || value.kind == ValueKind::EnumRef) {
            return jsonQuote(stringAt(value));
        }
        if (value.kind == ValueKind::Real) {
            char buf[32] = {0};
            snprintf(buf, sizeof(buf), "%.6E", static_cast<double>(value.r));
            return std::string(buf);
        }
        return std::to_string(value.i);
    };

    auto resolveName = [&](const std::string& key) -> int {
        for (auto it = nameFrames.rbegin(); it != nameFrames.rend(); ++it) {
            for (auto binding = it->rbegin(); binding != it->rend(); ++binding) {
                if (binding->first == key) return binding->second;
            }
        }
        return 0;
    };

    auto assignName = [&](const std::string& key, int value) {
        for (auto it = nameFrames.rbegin(); it != nameFrames.rend(); ++it) {
            for (auto binding = it->rbegin(); binding != it->rend(); ++binding) {
                if (binding->first == key) {
                    binding->second = value;
                    return;
                }
            }
        }
        if (nameFrames.empty()) nameFrames.emplace_back();
        nameFrames.back().emplace_back(key, value);
    };

    auto resolveIntToken = [&](const std::string& token) -> int {
        const std::string value = trimCopy(token);
        if (value.empty()) return sp > 0 ? static_cast<int>(stack[--sp]) : 0;
        char* end = nullptr;
        const long parsed = strtol(value.c_str(), &end, 10);
        if (end != value.c_str() && end != nullptr && *end == '\0') return static_cast<int>(parsed);
        return resolveName(value);
    };

    auto assignIntTarget = [&](const std::string& target, int value) {
        const std::string name = trimCopy(target);
        if (name.empty() || name == "$PUSH") {
            if (sp < STACK_SIZE) stack[sp++] = value;
        } else {
            assignName(name, value);
        }
    };

    std::string lastCallError;
    auto invokeCallFrame = [&](int targetPc, const std::string& lookupLabel, int argc) -> bool {
        lastCallError.clear();
        if (targetPc < 0 || targetPc >= static_cast<int>(instructions.size())) {
            lastCallError = "invalid call target";
            return false;
        }
        // Prevent runaway recursion from exhausting heap on ESP32.
        if (nameFrames.size() >= MAX_NAME_FRAME_DEPTH) {
            lastCallError = "max call depth exceeded";
            return false;
        }

        std::vector<int> args;
        args.reserve(static_cast<size_t>(argc > 0 ? argc : 0));
        for (int i = 0; i < argc && sp > 0; ++i) {
            args.push_back(stack[--sp]);
        }
        std::reverse(args.begin(), args.end());

        NameFrame frameVars;
        frameVars.reserve(static_cast<size_t>(argc > 0 ? argc : 0));
        auto sigIt = procedureParamsByLabel.find(lookupLabel);
        if (sigIt == procedureParamsByLabel.end()) {
            const std::string targetLabel = instructions[targetPc].label;
            if (!targetLabel.empty()) {
                sigIt = procedureParamsByLabel.find(targetLabel);
            }
            if (sigIt == procedureParamsByLabel.end() && !lookupLabel.empty()) {
                if (lookupLabel.rfind("PROC_", 0) == 0) {
                    sigIt = procedureParamsByLabel.find(lookupLabel.substr(5));
                } else {
                    sigIt = procedureParamsByLabel.find(std::string("PROC_") + lookupLabel);
                }
            }
            if (sigIt == procedureParamsByLabel.end() && !targetLabel.empty()) {
                if (targetLabel.rfind("PROC_", 0) == 0) {
                    sigIt = procedureParamsByLabel.find(targetLabel.substr(5));
                } else {
                    sigIt = procedureParamsByLabel.find(std::string("PROC_") + targetLabel);
                }
            }
        }
        if (sigIt != procedureParamsByLabel.end()) {
            const std::vector<std::string>& names = sigIt->second;
            for (size_t i = 0; i < names.size(); ++i) {
                const int value = (i < args.size()) ? args[i] : 0;
                frameVars.emplace_back(names[i], value);
            }
        } else {
            // Canonical fallback for common recursive procedure shape.
            if (args.size() >= 4) {
                frameVars.emplace_back("n", args[0]);
                frameVars.emplace_back("fromPeg", args[1]);
                frameVars.emplace_back("toPeg", args[2]);
                frameVars.emplace_back("auxPeg", args[3]);
            } else {
                // Keep generic fallback bindings bounded to avoid unbounded per-frame allocations.
                constexpr size_t MAX_FALLBACK_PARAMS = 8;
                for (size_t i = 0; i < args.size() && i < MAX_FALLBACK_PARAMS; ++i) {
                    frameVars.emplace_back(std::string("p") + std::to_string(i), args[i]);
                }
            }
        }

        NameCallFrame frame;
        frame.returnPc = pc + 1;
        frame.envDepth = nameFrames.size();
        nameCallStack.push_back(frame);
        nameFrames.emplace_back(std::move(frameVars));
        pc = targetPc;
        return true;
    };

    size_t steps = 0;
    gFlowState.clear();
    lastRunStepLimitHit = false;
    lastRunStepCount = 0;
    running = true;
    PMTRACE(Serial.println("[DEBUG] Executing pinstructions:"));
    while (pc < (int)instructions.size()) {
        tickDaemonRefresh();
        ++steps;
        if (steps > MAX_RUN_STEPS) {
            lastRunStepLimitHit = true;
            break;
        }
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
            pushString(instr.strOperand);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PUSH_INT) {
            if (sp >= STACK_SIZE) {
                gFlowState["__runtime_error"] = "stack overflow";
                gFlowState["__memory_pressure"] = captureMemoryPressureSnapshot(static_cast<size_t>(sp), STACK_SIZE).memoryPressureLevel;
                break;
            }
            stack[sp++] = instr.intOperand;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PUSH_ENUM) {
            if (sp >= STACK_SIZE) {
                gFlowState["__runtime_error"] = "stack overflow";
                break;
            }
            const uint16_t typeIndex = getEnumTypeIndex(instr.enumType);
            const int ordinal = getEnumOrdinal(typeIndex, instr.strOperand);
            if (typeIndex == 0xFFFF || ordinal < 0) {
                gFlowState["__enum_error"] = std::string("Unknown enum value: ") + instr.enumType + "." + instr.strOperand;
                stack[sp++] = -1;
            } else {
                stack[sp++] = Value::makeEnum(typeIndex, ordinal);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PUSH_REAL) {
            if (sp >= STACK_SIZE) {
                gFlowState["__runtime_error"] = "stack overflow";
                break;
            }
            stack[sp++] = Value::makeReal(strtof(instr.strOperand.c_str(), nullptr));
            ++pc;
            continue;
        }
        if (instr.opcode == OP_RDIV) {
            if (sp >= 2) {
                const Value rhs = stack[--sp];
                const Value lhs = stack[sp - 1];
                const float divisor = rhs.asReal();
                stack[sp - 1] = Value::makeReal(divisor == 0.0f ? 0.0f : lhs.asReal() / divisor);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ADD || instr.opcode == OP_SUB || instr.opcode == OP_MUL || instr.opcode == OP_DIV) {
            if (sp >= 2) {
                const Value rhsValue = stack[--sp];
                const Value lhsValue = stack[sp - 1];
                // Either operand being real promotes the whole expression, Pascal-style.
                if (rhsValue.isReal() || lhsValue.isReal()) {
                    const float lhs = lhsValue.asReal();
                    const float rhs = rhsValue.asReal();
                    float out = 0.0f;
                    if (instr.opcode == OP_ADD) out = lhs + rhs;
                    if (instr.opcode == OP_SUB) out = lhs - rhs;
                    if (instr.opcode == OP_MUL) out = lhs * rhs;
                    if (instr.opcode == OP_DIV) out = (rhs == 0.0f) ? 0.0f : static_cast<float>(static_cast<int32_t>(lhs / rhs));
                    stack[sp - 1] = Value::makeReal(out);
                } else {
                    const int rhs = rhsValue;
                    const int lhs = lhsValue;
                    if (instr.opcode == OP_ADD) stack[sp - 1] = lhs + rhs;
                    if (instr.opcode == OP_SUB) stack[sp - 1] = lhs - rhs;
                    if (instr.opcode == OP_MUL) stack[sp - 1] = lhs * rhs;
                    if (instr.opcode == OP_DIV) stack[sp - 1] = (rhs == 0 ? 0 : lhs / rhs);
                }
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_EQ || instr.opcode == OP_NEQ || instr.opcode == OP_LT || instr.opcode == OP_LE || instr.opcode == OP_GT || instr.opcode == OP_GE) {
            // Two pending strings compare lexicographically; otherwise fall back to integers.
            if (isStringAtDepth(1) && isStringAtDepth(2)) {
                const std::string rhs = popString();
                const std::string lhs = popString();
                const int cmp = lhs.compare(rhs);
                int truth = 0;
                if (instr.opcode == OP_EQ) truth = (cmp == 0) ? 1 : 0;
                if (instr.opcode == OP_NEQ) truth = (cmp != 0) ? 1 : 0;
                if (instr.opcode == OP_LT) truth = (cmp < 0) ? 1 : 0;
                if (instr.opcode == OP_LE) truth = (cmp <= 0) ? 1 : 0;
                if (instr.opcode == OP_GT) truth = (cmp > 0) ? 1 : 0;
                if (instr.opcode == OP_GE) truth = (cmp >= 0) ? 1 : 0;
                if (sp < STACK_SIZE) stack[sp++] = truth;
                ++pc;
                continue;
            }
            if (sp >= 2) {
                const Value rhsValue = stack[--sp];
                const Value lhsValue = stack[sp - 1];
                const bool asReal = rhsValue.isReal() || lhsValue.isReal();
                const float rhs = asReal ? rhsValue.asReal() : static_cast<float>(static_cast<int>(rhsValue));
                const float lhs = asReal ? lhsValue.asReal() : static_cast<float>(static_cast<int>(lhsValue));
                int truth = 0;
                if (instr.opcode == OP_EQ) truth = (lhs == rhs) ? 1 : 0;
                if (instr.opcode == OP_NEQ) truth = (lhs != rhs) ? 1 : 0;
                if (instr.opcode == OP_LT) truth = (lhs < rhs) ? 1 : 0;
                if (instr.opcode == OP_LE) truth = (lhs <= rhs) ? 1 : 0;
                if (instr.opcode == OP_GT) truth = (lhs > rhs) ? 1 : 0;
                if (instr.opcode == OP_GE) truth = (lhs >= rhs) ? 1 : 0;
                stack[sp - 1] = truth;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_TRIM) {
            if (isStringAtDepth(1)) {
                const std::string str = popString();
                pushString(trimCopy(str));
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PARSE_INT) {
            if (isStringAtDepth(1)) {
                const std::string str = popString();
                // Try to parse as integer
                char* endptr = nullptr;
                long value = strtol(trimCopy(str).c_str(), &endptr, 10);
                int result = (endptr != nullptr && *endptr == '\0') ? (int)value : 0;
                if (sp >= STACK_SIZE) {
                    gFlowState["__runtime_error"] = "stack overflow";
                    gFlowState["__memory_pressure"] = captureMemoryPressureSnapshot(static_cast<size_t>(sp), STACK_SIZE).memoryPressureLevel;
                    break;
                }
                stack[sp++] = result;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_OR) {
            if (sp >= 2) {
                int rhs = stack[--sp];
                int lhs = stack[sp - 1];
                stack[sp - 1] = (lhs != 0 || rhs != 0) ? 1 : 0;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_AND) {
            if (sp >= 2) {
                int rhs = stack[--sp];
                int lhs = stack[sp - 1];
                stack[sp - 1] = (lhs != 0 && rhs != 0) ? 1 : 0;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_NOT) {
            if (sp >= 1) {
                stack[sp - 1] = (stack[sp - 1] == 0) ? 1 : 0;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_STREQ || instr.opcode == OP_STRNEQ) {
            if (isStringAtDepth(1) && isStringAtDepth(2)) {
                const std::string rhs = popString();
                const std::string lhs = popString();
                int eq = (lhs == rhs) ? 1 : 0;
                if (sp >= STACK_SIZE) break;
                stack[sp++] = (instr.opcode == OP_STREQ) ? eq : (1 - eq);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_LOAD_NAME) {
            const std::string varName = instr.strOperand;
            // Dispatch on binding presence, not value emptiness, so "" stays a string.
            auto strBinding = namedStringVariables.find(varName);
            if (strBinding != namedStringVariables.end()) {
                pushString(strBinding->second);
            } else if (namedRealVariables.count(varName) > 0) {
                if (sp >= STACK_SIZE) {
                    gFlowState["__runtime_error"] = "stack overflow";
                    break;
                }
                stack[sp++] = Value::makeReal(namedRealVariables[varName]);
            } else if (namedEnumVariables.count(varName) > 0) {
                if (sp >= STACK_SIZE) {
                    gFlowState["__runtime_error"] = "stack overflow";
                    break;
                }
                stack[sp++] = namedEnumVariables[varName];
            } else if (varName == "src") {
                pushString(currentMessage);
            } else {
                // Push integer-valued variable onto integer stack
                if (sp >= STACK_SIZE) {
                    gFlowState["__runtime_error"] = "stack overflow";
                    gFlowState["__memory_pressure"] = captureMemoryPressureSnapshot(static_cast<size_t>(sp), STACK_SIZE).memoryPressureLevel;
                    break;
                }
                stack[sp++] = resolveName(varName);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_STORE_NAME) {
            // String stack wins, matching OP_PRINT precedence, so TRIM/FILE_READ results survive STORE.
            if (isStringAtDepth(1)) {
                namedStringVariables[instr.strOperand] = popString();
                namedRealVariables.erase(instr.strOperand);
            } else if (sp > 0 && stack[sp - 1].isReal()) {
                namedRealVariables[instr.strOperand] = stack[--sp].asReal();
                namedStringVariables.erase(instr.strOperand);
                namedEnumVariables.erase(instr.strOperand);
            } else if (sp > 0 && stack[sp - 1].isEnum()) {
                namedEnumVariables[instr.strOperand] = stack[--sp];
                namedStringVariables.erase(instr.strOperand);
                namedRealVariables.erase(instr.strOperand);
            } else if (sp > 0) {
                int value = stack[--sp];
                namedStringVariables.erase(instr.strOperand);
                assignName(instr.strOperand, value);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_CALL_LABEL) {
            if (!invokeCallFrame(instr.intOperand, instr.label, instr.value)) {
                gFlowState["__thunk_error"] = lastCallError.empty() ? "invalid local call target" : lastCallError;
                break;
            }
            continue;
        }
        if (instr.opcode == OP_CALL_EXT) {
            const std::string symbol = trimCopy(instr.strOperand);
            if (symbol.empty()) {
                gFlowState["__thunk_error"] = "empty external symbol";
                break;
            }

            int targetPc = -1;
            auto cached = thunkBindings.find(symbol);
            if (cached != thunkBindings.end()) {
                targetPc = cached->second;
            } else {
                std::string resolveError;
                bool resolved = false;
                if (thunkResolveHook != nullptr) {
                    resolved = thunkResolveHook(symbol, targetPc, resolveError, thunkResolverContext);
                } else {
                    resolveError = "thunk resolver not configured";
                }

                if (!resolved || targetPc < 0 || targetPc >= static_cast<int>(instructions.size())) {
                    gFlowState["__thunk_error"] = resolveError.empty()
                        ? std::string("failed to resolve external symbol: ") + symbol
                        : resolveError;
                    break;
                }
                thunkBindings[symbol] = targetPc;
            }

            if (!invokeCallFrame(targetPc, symbol, instr.value)) {
                if (lastCallError.empty()) {
                    gFlowState["__thunk_error"] = std::string("invalid resolved thunk target for symbol: ") + symbol;
                } else {
                    gFlowState["__thunk_error"] = std::string("call failed for symbol ") + symbol + ": " + lastCallError;
                }
                break;
            }
            continue;
        }
        if (instr.opcode == OP_RET) {
            if (nameCallStack.empty()) {
                break;
            }
            NameCallFrame frame = nameCallStack.back();
            nameCallStack.pop_back();
            while (nameFrames.size() > frame.envDepth) {
                nameFrames.pop_back();
            }
            pc = frame.returnPc;
            continue;
        }
        if (instr.opcode == OP_PRINT) {
            if (sp > 0) {
                // stringAt formats each kind, so reals print in Pascal scientific form.
                currentOutputLine += stringAt(stack[--sp]);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PRINT_NL) {
            emitOutputLine(currentOutputLine);
            currentOutputLine.clear();
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PRINT_INT) {
            if (sp > 0) {
                int v = stack[--sp];
                currentOutputLine += std::to_string(v);
                PMTRACE({ Serial.print("[PRINT_INT] "); Serial.println(v); });
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_PRINT_ENUM) {
            if (sp > 0) {
                currentOutputLine += stringAt(stack[--sp]);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ORD) {
            if (sp > 0) {
                const Value top = stack[--sp];
                stack[sp++] = top.isEnum() ? top.i : static_cast<int>(top);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_REC_NEW) {
            records[trimCopy(instr.strOperand)].clear();
            ++pc;
            continue;
        }
        if (instr.opcode == OP_REC_SET) {
            const auto args = splitOperands(instr.strOperand);
            if (args.size() >= 2 && sp > 0) {
                records[trimCopy(args[0])][unquote(args[1])] = stack[--sp];
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_REC_GET) {
            const auto args = splitOperands(instr.strOperand);
            Value out;
            if (args.size() >= 2) {
                auto record = records.find(trimCopy(args[0]));
                if (record != records.end()) {
                    auto field = record->second.find(unquote(args[1]));
                    if (field != record->second.end()) out = field->second;
                }
            }
            if (sp < STACK_SIZE) stack[sp++] = out;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_SET_NEW) {
            sets[trimCopy(instr.strOperand)].clear();
            ++pc;
            continue;
        }
        if (instr.opcode == OP_SET_ADD) {
            const auto args = splitOperands(instr.strOperand);
            if (!args.empty()) {
                const int member = args.size() >= 2 ? resolveIntToken(args[1]) : (sp > 0 ? static_cast<int>(stack[--sp]) : 0);
                sets[trimCopy(args[0])].insert(member);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_SET_IN) {
            const auto args = splitOperands(instr.strOperand);
            int present = 0;
            if (!args.empty()) {
                const int member = args.size() >= 2 ? resolveIntToken(args[1]) : (sp > 0 ? static_cast<int>(stack[--sp]) : 0);
                auto found = sets.find(trimCopy(args[0]));
                present = (found != sets.end() && found->second.count(member) > 0) ? 1 : 0;
            }
            if (sp < STACK_SIZE) stack[sp++] = present;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_SET_UNION || instr.opcode == OP_SET_INTERSECT || instr.opcode == OP_SET_DIFF) {
            const auto args = splitOperands(instr.strOperand);
            if (args.size() >= 3) {
                const std::set<int>& lhs = sets[trimCopy(args[0])];
                const std::set<int>& rhs = sets[trimCopy(args[1])];
                std::set<int> out;
                if (instr.opcode == OP_SET_UNION) {
                    out = lhs;
                    out.insert(rhs.begin(), rhs.end());
                } else if (instr.opcode == OP_SET_INTERSECT) {
                    for (int member : lhs) if (rhs.count(member) > 0) out.insert(member);
                } else {
                    for (int member : lhs) if (rhs.count(member) == 0) out.insert(member);
                }
                sets[trimCopy(args[2])] = out;
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
        if (instr.opcode == OP_ROUTE_SET_STATE) {
            const std::string payload = instr.strOperand;
            const size_t eq = payload.find('=');
            if (eq != std::string::npos) {
                std::string key = trimCopy(payload.substr(0, eq));
                std::string value = trimCopy(payload.substr(eq + 1));
                if (!key.empty()) {
                    gFlowState[key] = value;
                }
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ROUTE_SET_MESSAGE) {
            if (isStringAtDepth(1)) {
                currentMessage = popString();
            } else if (sp > 0) {
                int v = stack[--sp];
                currentMessage = std::to_string(v);
            } else {
                currentMessage.clear();
            }
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
        if (instr.opcode == OP_FORK || instr.opcode == OP_FORK_SUBFLOW) {
            const int taskId = nextTaskId++;
            tasks[taskId] = true;
            if (sp < STACK_SIZE) stack[sp++] = taskId;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_JOIN_ALL) {
            bool allDone = true;
            for (const auto& task : tasks) allDone = allDone && task.second;
            if (sp < STACK_SIZE) stack[sp++] = allDone ? 1 : 0;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_JOIN || instr.opcode == OP_SYNC) {
            const auto args = splitOperands(instr.strOperand);
            const int taskId = resolveIntToken(args.empty() ? "" : args[0]);
            auto task = tasks.find(taskId);
            if (sp < STACK_SIZE) stack[sp++] = (task != tasks.end() && task->second) ? 1 : 0;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_BQ_NEW_STATIC || instr.opcode == OP_BQ_NEW_DYNAMIC ||
            instr.opcode == OP_STK_NEW_STATIC || instr.opcode == OP_STK_NEW_DYNAMIC ||
            instr.opcode == OP_PQ_NEW_STATIC || instr.opcode == OP_PQ_NEW_DYNAMIC) {
            const auto args = splitOperands(instr.strOperand);
            const std::string key = args.empty() ? "" : unquote(args[0]);
            const size_t capacity = (instr.opcode == OP_BQ_NEW_STATIC || instr.opcode == OP_STK_NEW_STATIC ||
                                     instr.opcode == OP_PQ_NEW_STATIC) && args.size() > 1
                ? static_cast<size_t>(std::max(0, resolveIntToken(args[1]))) : 0;
            IntCollection collection;
            collection.capacity = capacity;
            if (instr.opcode == OP_BQ_NEW_STATIC || instr.opcode == OP_BQ_NEW_DYNAMIC) queues[key] = collection;
            if (instr.opcode == OP_STK_NEW_STATIC || instr.opcode == OP_STK_NEW_DYNAMIC) stacks[key] = collection;
            if (instr.opcode == OP_PQ_NEW_STATIC || instr.opcode == OP_PQ_NEW_DYNAMIC) priorityQueues[key] = collection;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_BQ_ENQ || instr.opcode == OP_STK_PUSH || instr.opcode == OP_PQ_ENQ) {
            const auto args = splitOperands(instr.strOperand);
            const std::string key = args.empty() ? "" : unquote(args[0]);
            const int value = resolveIntToken(args.size() > 1 ? args[1] : "");
            IntCollection* collection = instr.opcode == OP_BQ_ENQ ? &queues[key]
                : (instr.opcode == OP_STK_PUSH ? &stacks[key] : &priorityQueues[key]);
            const char* errorKey = instr.opcode == OP_BQ_ENQ ? "__queue_overflow"
                : (instr.opcode == OP_STK_PUSH ? "__stack_overflow" : "__pqueue_overflow");
            if (collection->capacity > 0 && collection->items.size() >= collection->capacity) {
                gFlowState[errorKey] = key;
            } else {
                collection->items.push_back(value);
                if (instr.opcode == OP_PQ_ENQ) {
                    std::sort(collection->items.begin(), collection->items.end(), std::greater<int>());
                }
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_BQ_DEQ || instr.opcode == OP_BQ_PEEK ||
            instr.opcode == OP_STK_POP || instr.opcode == OP_STK_PEEK ||
            instr.opcode == OP_PQ_DEQ || instr.opcode == OP_PQ_PEEK) {
            const auto args = splitOperands(instr.strOperand);
            const std::string key = args.empty() ? "" : unquote(args[0]);
            IntCollection* collection = (instr.opcode == OP_BQ_DEQ || instr.opcode == OP_BQ_PEEK) ? &queues[key]
                : ((instr.opcode == OP_STK_POP || instr.opcode == OP_STK_PEEK) ? &stacks[key] : &priorityQueues[key]);
            const bool isStack = instr.opcode == OP_STK_POP || instr.opcode == OP_STK_PEEK;
            const bool remove = instr.opcode == OP_BQ_DEQ || instr.opcode == OP_STK_POP || instr.opcode == OP_PQ_DEQ;
            int value = 0;
            if (collection->items.empty()) {
                const char* errorKey = isStack ? "__stack_underflow"
                    : ((instr.opcode == OP_BQ_DEQ || instr.opcode == OP_BQ_PEEK) ? "__queue_underflow" : "__pqueue_underflow");
                gFlowState[errorKey] = (isStack ? "stack:" : ((instr.opcode == OP_BQ_DEQ || instr.opcode == OP_BQ_PEEK) ? "queue:" : "pqueue:")) + key;
            } else {
                const size_t index = isStack ? collection->items.size() - 1 : 0;
                value = collection->items[index];
                if (remove) collection->items.erase(collection->items.begin() + static_cast<long>(index));
            }
            assignIntTarget(args.size() > 1 ? args[1] : "", value);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_FILE_OPEN) {
            const auto args = splitOperands(instr.strOperand);
            const std::string fileId = unquote(args.empty() ? "file.dat" : args[0]);
            const std::string mode = unquote(args.size() > 1 ? args[1] : "read");
            FileSession session;
            session.ffsHandle = openFile(String(fileId.c_str()), String(mode.c_str()));
            const int handle = nextFileHandle++;
            files[handle] = session;
            if (sp < STACK_SIZE) stack[sp++] = handle;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_FILE_WRITE) {
            const auto args = splitOperands(instr.strOperand);
            const int handle = resolveIntToken(args.empty() ? "" : args[0]);
            auto file = files.find(handle);
            if (file != files.end()) {
                std::string value;
                if (args.size() > 1 && args[1].size() >= 2 && (args[1].front() == '"' || args[1].front() == '\'')) {
                    value = unquote(args[1]);
                } else {
                    value = std::to_string(resolveIntToken(args.size() > 1 ? args[1] : ""));
                }
                file->second.rows.push_back(value);
                if (file->second.ffsHandle >= 0) writeLine(file->second.ffsHandle, String(value.c_str()));
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_FILE_READ) {
            const auto args = splitOperands(instr.strOperand);
            const int handle = resolveIntToken(args.empty() ? "" : args[0]);
            std::string value;
            auto file = files.find(handle);
            if (file != files.end()) {
                if (file->second.cursor < file->second.rows.size()) {
                    value = file->second.rows[file->second.cursor++];
                } else if (file->second.ffsHandle >= 0) {
                    String line;
                    if (readLine(file->second.ffsHandle, line)) value = line.c_str();
                }
            }
            const std::string target = args.size() > 1 ? trimCopy(args[1]) : "$PUSH";
            if (target == "$PUSH") pushString(value);
            else namedStringVariables[target] = value;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_FILE_CLOSE) {
            const auto args = splitOperands(instr.strOperand);
            const int handle = resolveIntToken(args.empty() ? "" : args[0]);
            auto file = files.find(handle);
            if (file != files.end()) {
                if (file->second.ffsHandle >= 0) closeFile(file->second.ffsHandle);
                files.erase(file);
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_MAP) {
            const auto args = splitOperands(instr.strOperand);
            const std::string payload = args.empty() || toUpperCopy(args[0]) == "SRC"
                ? currentMessage : getNamedStringVariable(trimCopy(args[0]));
            const std::string mapId = unquote(args.size() > 1 ? args[1] : "");
            std::string mapped;
            std::string error;
            if (!runMappingById(*this, mapId, payload, mapped, error)) {
                gFlowState["__map_error"] = error;
                mapped = payload;
            }
            currentMessage = mapped;
            if (args.size() > 2) namedStringVariables[trimCopy(args[2])] = mapped;
            else pushString(mapped);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_MAP_RETURN) {
            gFlowState["__response"] = getNamedStringVariable(trimCopy(instr.strOperand));
            ++pc;
            continue;
        }
        if (instr.opcode == OP_DL_LOAD_SCHEMA || instr.opcode == OP_DL_LOAD_MAP) {
            const auto args = splitOperands(instr.strOperand);
            const std::string name = unquote(args.empty() ? "default" : args[0]);
            const bool isSchema = instr.opcode == OP_DL_LOAD_SCHEMA;
            loadResidentDomain(isSchema ? "global-types" : "mapper-artifacts", name, 0, false);
            if (sp < STACK_SIZE) stack[sp++] = isSchema ? nextSchemaHandle++ : nextMapHandle++;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_SRV_CALL) {
            const auto args = splitOperands(instr.strOperand);
            const std::string serviceId = unquote(args.empty() ? "" : args[0]);
            const std::string endpoint = unquote(args.size() > 1 ? args[1] : "");
            const std::string payload = args.size() <= 2 || toUpperCopy(args[2]) == "SRC"
                ? currentMessage : getNamedStringVariable(trimCopy(args[2]));
            std::string response = payload;
            std::string error;
            bool success = true;
            if (serviceCallHook != nullptr) {
                success = serviceCallHook(serviceId, endpoint, payload, response, error, serviceCallContext);
            }
            currentMessage = response;
            gFlowState["__last_service_call.serviceId"] = serviceId;
            gFlowState["__last_service_call.endpoint"] = endpoint;
            gFlowState["__last_service_call.success"] = success ? "true" : "false";
            gFlowState["__last_service_call.error"] = error;
            if (sp < STACK_SIZE) stack[sp++] = success ? 1 : 0;
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ROUTE_SERVICE || instr.opcode == OP_ROUTE_QUEUE || instr.opcode == OP_ROUTE_FILE) {
            const auto args = splitOperands(instr.strOperand);
            gFlowState["__placement.kind"] = instr.opcode == OP_ROUTE_SERVICE ? "service"
                : (instr.opcode == OP_ROUTE_QUEUE ? "queue" : "file");
            gFlowState["__placement.id"] = unquote(args.empty() ? instr.strOperand : args[0]);
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ORCH_SPAWN) {
            OrchestrationSpawnRequest req;
            std::string parseError;
            if (parseOrchestrationSpawnOperand(instr.strOperand, req, parseError)) {
                pendingOrchTasks.push_back(req);
            } else {
                gFlowState["__orch_error"] = parseError;
                lastOrchWaitSuccess = false;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ORCH_WAIT_ALL) {
            uint32_t waitTimeoutMs = 0;
            std::string waitReason;
            std::string waitParseError;
            if (!parseOrchestrationWaitOperand(instr.strOperand, waitTimeoutMs, waitReason, waitParseError)) {
                lastOrchWaitSuccess = false;
                stack[sp++] = 0;
                gFlowState["__orch_error"] = waitParseError;
                ++pc;
                continue;
            }

            std::vector<OrchestrationTaskResult> waitResults;
            std::string waitError;
            bool waitTransportOk = false;
            if (orchestrationWaitHook != nullptr) {
                waitTransportOk = orchestrationWaitHook(
                    pendingOrchTasks,
                    waitTimeoutMs,
                    waitResults,
                    waitError,
                    orchestrationHookContext
                );
            } else {
                waitError = "native orchestration transport not configured";
            }

            bool allSubflowsSucceeded = waitTransportOk;
            if (waitTransportOk) {
                for (const auto& result : waitResults) {
                    if (!result.success) {
                        allSubflowsSucceeded = false;
                        break;
                    }
                }
            }

            lastOrchWaitSuccess = waitTransportOk && allSubflowsSucceeded;
            stack[sp++] = lastOrchWaitSuccess ? 1 : 0;
            gFlowState["__orch_wait_reason"] = waitReason;
            gFlowState["__orch_task_count"] = std::to_string(static_cast<int>(pendingOrchTasks.size()));
            gFlowState["__orch_result_count"] = std::to_string(static_cast<int>(waitResults.size()));

            if (!waitTransportOk) {
                gFlowState["__orch_error"] = waitError.empty() ? std::string("native orchestration wait failed") : waitError;
            } else if (!allSubflowsSucceeded) {
                gFlowState["__orch_error"] = "one or more orchestration subflows failed";
            } else {
                gFlowState.erase("__orch_error");
            }

            pendingOrchTasks.clear();
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ORCH_FAIL_TXN) {
            if (!lastOrchWaitSuccess) {
                gFlowState["__orch_error"] = instr.strOperand.empty()
                    ? std::string("orchestration failed")
                    : instr.strOperand;
                break;
            }
            ++pc;
            continue;
        }
        if (instr.opcode == OP_ORCH_RETURN_SUCCESS) {
            // Placeholder until native orchestration transport + payload merge is implemented.
            ++pc;
            continue;
        }

        HandlerFunc handler = handler_table[instr.opcode];
        if (handler) {
            handler(*this, instr, stack, sp, bp, pc);
            if (instr.opcode == OP_HALT) {
                PMTRACE(Serial.println("[HALT]"));
                break;
            }
        } else {
            gFlowState["__runtime_error"] = std::string("unsupported opcode 0x") + std::to_string(instr.opcode);
            break;
        }
    }
    if (!currentOutputLine.empty()) {
        emitOutputLine(currentOutputLine);
    }
    lastRunGlobals.clear();
    if (!nameFrames.empty()) {
        for (const auto& binding : nameFrames.front()) {
            GlobalValue value;
            value.intValue = binding.second;
            lastRunGlobals[binding.first] = value;
        }
    }
    for (const auto& entry : namedStringVariables) {
        GlobalValue value;
        value.isString = true;
        value.strValue = entry.second;
        lastRunGlobals[entry.first] = value;
    }
    for (const auto& entry : namedRealVariables) {
        GlobalValue value;
        value.isReal = true;
        value.realValue = entry.second;
        lastRunGlobals[entry.first] = value;
    }
    for (const auto& entry : namedEnumVariables) {
        GlobalValue value;
        value.isEnum = true;
        value.intValue = entry.second.i;
        value.strValue = getEnumValueName(entry.second.handle, entry.second.i);
        lastRunGlobals[entry.first] = value;
    }
    for (const auto& record : records) {
        std::string json = "{";
        bool first = true;
        for (const auto& field : record.second) {
            if (!first) json += ",";
            json += jsonQuote(field.first) + ":" + valueToJson(field.second);
            first = false;
        }
        json += "}";
        GlobalValue value;
        value.isJson = true;
        value.strValue = json;
        lastRunGlobals[record.first] = value;
    }
    for (const auto& setEntry : sets) {
        std::string json = "[";
        bool firstMember = true;
        for (int member : setEntry.second) {
            if (!firstMember) json += ",";
            json += std::to_string(member);
            firstMember = false;
        }
        json += "]";
        GlobalValue value;
        value.isJson = true;
        value.strValue = json;
        lastRunGlobals[setEntry.first] = value;
    }
    lastRunStepCount = steps;
    running = false;
    if (runtimeUnit.kind == RuntimeUnitKind::Program) {
        unloadUnit();
    }
    PMTRACE(Serial.println("[DEBUG] Execution finished."));
}

bool PMachine::didLastRunHitStepLimit() const {
    return lastRunStepLimitHit;
}

size_t PMachine::getLastRunStepCount() const {
    return lastRunStepCount;
}

const std::vector<std::string>& PMachine::getLastRunTextOutput() const {
    return lastRunTextOutput;
}

std::map<std::string, std::string> PMachine::getFlowStateSnapshot() const {
    return gFlowState;
}

std::map<std::string, GlobalValue> PMachine::getGlobalsSnapshot() const {
    return lastRunGlobals;
}

uint16_t PMachine::registerEnumType(const std::string& typeName, const std::vector<std::string>& values) {
    for (size_t i = 0; i < enumTypeNames.size(); ++i) {
        if (enumTypeNames[i] == typeName) {
            enumTypeValues[i] = values;
            return static_cast<uint16_t>(i);
        }
    }
    enumTypeNames.push_back(typeName);
    enumTypeValues.push_back(values);
    return static_cast<uint16_t>(enumTypeNames.size() - 1);
}

uint16_t PMachine::getEnumTypeIndex(const std::string& typeName) const {
    for (size_t i = 0; i < enumTypeNames.size(); ++i) {
        if (enumTypeNames[i] == typeName) return static_cast<uint16_t>(i);
    }
    return 0xFFFF;
}

int PMachine::getEnumOrdinal(uint16_t typeIndex, const std::string& valueName) const {
    if (typeIndex >= enumTypeValues.size()) return -1;
    const auto& values = enumTypeValues[typeIndex];
    for (size_t i = 0; i < values.size(); ++i) {
        if (values[i] == valueName) return static_cast<int>(i);
    }
    return -1;
}

std::string PMachine::getEnumValueName(uint16_t typeIndex, int ordinal) const {
    if (typeIndex >= enumTypeValues.size()) return std::string();
    const auto& values = enumTypeValues[typeIndex];
    if (ordinal < 0 || static_cast<size_t>(ordinal) >= values.size()) return std::string();
    return values[ordinal];
}

void PMachine::clearEnumTypes() {
    enumTypeNames.clear();
    enumTypeValues.clear();
}
}
