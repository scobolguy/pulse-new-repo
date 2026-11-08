#pragma once
#include "../swift/native_messages.h"
#include "../../pmachines/arduino/src/pmachine.h"
#include "../../pmachines/arduino/src/scalar_runtime.h"

namespace pulse::messages::native {
using pulse::swift::native::trimCopy;
using pulse::swift::native::toUpperCopy;

inline std::string normalizeDslEscapes(const std::string& in) {
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

inline std::string unquote(const std::string& text) {
    const std::string t = normalizeDslEscapes(trimCopy(text));
    if (t.size() < 2) return t;
    const char q = t.front();
    if ((q == '"' || q == '\'') && t.back() == q) {
        return t.substr(1, t.size() - 2);
    }
    return t;
}

inline int findTopLevelComma(const std::string& text) {
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

inline std::string getJsonPathValueAsString(JsonVariantConst root, const std::string& dotPath) {
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

inline void setJsonPathValue(JsonDocument& doc, const std::string& dotPath, const std::string& value) {
    const std::string effectivePath = dotPath;
    if (!doc.is<JsonObject>()) doc.to<JsonObject>();
    JsonObject root = doc.as<JsonObject>();
    JsonObject current = root;

    size_t start = 0;
    while (start <= effectivePath.size()) {
        size_t dot = effectivePath.find('.', start);
        std::string key = trimCopy(dot == std::string::npos ? effectivePath.substr(start) : effectivePath.substr(start, dot - start));
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

inline std::string applyConversionRule(const std::string& conversionRule, const std::string& srcValue) {
    const std::string rule = toUpperCopy(trimCopy(conversionRule));
    if (rule.empty()) return srcValue;

    if (rule.find("UPPER(SRC)") != std::string::npos) return toUpperCopy(srcValue);
    if (rule.find("TRIM(SRC)") != std::string::npos) return trimCopy(srcValue);
    if (rule.find("MTAMOUNTTODECIMAL(SRC)") != std::string::npos) return pulse::swift::native::normalizeMtAmount(srcValue);
    if (rule.find("OUTPUT := SRC") != std::string::npos) return srcValue;
    return srcValue;
}

inline std::string execCompiledMappingOps(const std::vector<std::string>& ops, const std::string& srcValue) {
    std::vector<std::string> st;
    for (const auto& rawOp : ops) {
        const std::string op = toUpperCopy(trimCopy(rawOp));
        if (op.empty()) continue;
        if (op == "SRC") { st.push_back(srcValue); continue; }
        auto popOr = [&]() { std::string a = st.empty() ? std::string() : st.back(); if (!st.empty()) st.pop_back(); return a; };
        if (op == "TRIM") { st.push_back(trimCopy(popOr())); continue; }
        if (op == "UPPER") { st.push_back(toUpperCopy(popOr())); continue; }
        if (op == "YYMMDD_TO_ISO") { st.push_back(pulse::swift::native::mapOpYymmddToIso(popOr())); continue; }
        if (op == "MT_AMOUNT_TO_DECIMAL") { st.push_back(pulse::swift::native::normalizeMtAmount(popOr())); continue; }
        if (op == "MT_PARTY_NAME") { st.push_back(pulse::swift::native::mapOpMtPartyName(popOr())); continue; }
        if (op == "MT_CHARGE_TO_ISO") { st.push_back(pulse::swift::native::mapOpMtChargeToIso(popOr())); continue; }
        if (op.rfind("PUSH_STR ", 0) == 0) { st.push_back(unquote(rawOp.substr(9))); continue; }
        if (op.rfind("PUSH_INT ", 0) == 0) { st.push_back(rawOp.substr(9)); continue; }
        // DUP / OUTPUT / RET are structural no-ops here.
    }
    return st.empty() ? srcValue : st.back();
}

inline bool runMappingById(const pmachine::PMachine& vm, const std::string& mappingId, const std::string& sourcePayload, std::string& mappedPayload, std::string& error) {
    const pmachine::MappingDef* mapping = vm.getMappingById(mappingId);
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
        // Prefer compiled opcodes; fall back to the legacy string rule only
        // when no ops were compiled for this item.
        const std::string outValue = (!item.ops.empty())
            ? execCompiledMappingOps(item.ops, srcValue)
            : applyConversionRule(item.conversionRule, srcValue);
        setJsonPathValue(targetDoc, item.targetPath, outValue);
    }

    mappedPayload.clear();
    serializeJson(targetDoc, mappedPayload);
    return true;
}

inline bool evaluateTransformExpr(const pmachine::PMachine& vm, const std::string& exprText, const std::string& srcMessage, int depth, std::string& outValue, std::string& error) {
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

inline std::string applyTransformRuleText(const pmachine::PMachine& vm, const std::string& transformRule, const std::string& message) {
    const std::string rule = trimCopy(normalizeDslEscapes(transformRule));
    if (rule.empty()) return message;

    const std::string upperRule = toUpperCopy(rule);
    const size_t assignIdx = upperRule.find("OUTPUT :=");

    // Compiled ROUTE_MAP_RUN passes a bare mapper id (no "OUTPUT :=", no
    // call syntax). Dispatch straight into the compiled mapper.
    if (assignIdx == std::string::npos && rule.find('(') == std::string::npos && rule.find(' ') == std::string::npos) {
        std::string mapped;
        std::string mapErr;
        if (runMappingById(vm, unquote(rule), message, mapped, mapErr)) {
            return mapped;
        }
        pmachine::rtl::detail::fail(mapErr);
    }

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
        pmachine::rtl::detail::fail(error);
    }

    return outValue;
}
}
