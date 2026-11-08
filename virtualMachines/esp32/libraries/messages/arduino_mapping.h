#pragma once
#include "../swift/arduino_messages.h"
#include <map>

namespace pulse::messages::arduino {
using pulse::swift::arduino::trimCopy;
using pulse::swift::arduino::toUpperCopy;

inline String normalizeDslEscapes(const String& in) {
    String s = in;
    s.replace("\\\"", "\"");
    s.replace("\\'", "'");
    return s;
}

inline bool startsWithUpper(const String& text, const String& prefix) {
    String t = toUpperCopy(text);
    String p = toUpperCopy(prefix);
    return t.startsWith(p);
}

inline int findTopLevelComma(const String& text) {
    int depth = 0;
    char quote = '\0';
    for (int i = 0; i < (int)text.length(); ++i) {
        char ch = text[i];
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
        if (ch == ',' && depth == 0) return i;
    }
    return -1;
}

inline String unquote(const String& text) {
    String s = normalizeDslEscapes(trimCopy(text));
    if (s.length() < 2) return s;
    char q = s[0];
    if ((q == '"' || q == '\'') && s[s.length() - 1] == q) {
        return s.substring(1, s.length() - 1);
    }
    return s;
}

inline String getJsonPathValueAsString(JsonVariantConst root, const String& dotPath) {
    JsonVariantConst cursor = root;
    int start = 0;
    while (start <= (int)dotPath.length()) {
        int dot = dotPath.indexOf('.', start);
        String key = (dot >= 0) ? dotPath.substring(start, dot) : dotPath.substring(start);
        key = trimCopy(key);
        if (key.length() == 0) {
            if (dot < 0) break;
            start = dot + 1;
            continue;
        }
        if (!cursor.is<JsonObjectConst>()) return "";
        JsonObjectConst obj = cursor.as<JsonObjectConst>();
        if (!obj[key]) return "";
        cursor = obj[key];
        if (dot < 0) break;
        start = dot + 1;
    }

    if (cursor.is<const char*>()) return String(cursor.as<const char*>());
    if (cursor.is<bool>()) return cursor.as<bool>() ? "true" : "false";
    if (cursor.is<long>()) return String(cursor.as<long>());
    if (cursor.is<double>()) return String(cursor.as<double>(), 6);
    if (cursor.is<JsonArrayConst>() || cursor.is<JsonObjectConst>()) {
        String out;
        serializeJson(cursor, out);
        return out;
    }
    return "";
}

inline void setJsonPathValue(JsonDocument& doc, const String& dotPath, const String& value) {
    if (!doc.is<JsonObject>()) doc.to<JsonObject>();
    JsonObject root = doc.as<JsonObject>();

    int start = 0;
    JsonObject current = root;
    while (start <= (int)dotPath.length()) {
        int dot = dotPath.indexOf('.', start);
        String key = (dot >= 0) ? dotPath.substring(start, dot) : dotPath.substring(start);
        key = trimCopy(key);
        if (key.length() == 0) {
            if (dot < 0) break;
            start = dot + 1;
            continue;
        }

        if (dot < 0) {
            current[key] = value;
            break;
        }

        if (!current[key].is<JsonObject>()) {
            current[key].to<JsonObject>();
        }
        current = current[key].as<JsonObject>();
        start = dot + 1;
    }
}

inline String applyConversionRule(const String& conversionRule, const String& srcValue) {
    String rule = toUpperCopy(trimCopy(conversionRule));
    if (rule.length() == 0) return srcValue;

    if (rule.indexOf("UPPER(SRC)") >= 0) return toUpperCopy(srcValue);
    if (rule.indexOf("TRIM(SRC)") >= 0) return trimCopy(srcValue);
    if (rule.indexOf("MTAMOUNTTODECIMAL(SRC)") >= 0) return pulse::swift::arduino::normalizeMtAmount(srcValue);
    if (rule.indexOf("YYMMDDTOISO(SRC)") >= 0) return pulse::swift::arduino::yymmddToIsoDate(srcValue);
    if (rule.indexOf("MTPARTYNAME(SRC)") >= 0) return pulse::swift::arduino::mtPartyName(srcValue);
    if (rule.indexOf("MTCHARGEBEARERTOISO(SRC)") >= 0) return pulse::swift::arduino::normalizeChargeBearer(srcValue);
    if (rule.indexOf("OUTPUT := SRC") >= 0) return srcValue;

    return srcValue;
}

inline String execCompiledRule(const JsonArrayConst& ops, const String& srcValue) {
    std::vector<String> st;
    for (JsonVariantConst v : ops) {
        String op = toUpperCopy(trimCopy(String(v | "")));
        if (op.length() == 0) continue;
        if (op == "SRC") { st.push_back(srcValue); continue; }
        if (op == "TRIM") { String a = st.empty() ? String("") : st.back(); if (!st.empty()) st.pop_back(); st.push_back(trimCopy(a)); continue; }
        if (op == "UPPER") { String a = st.empty() ? String("") : st.back(); if (!st.empty()) st.pop_back(); st.push_back(toUpperCopy(a)); continue; }
        if (op == "YYMMDD_TO_ISO") { String a = st.empty() ? String("") : st.back(); if (!st.empty()) st.pop_back(); st.push_back(pulse::swift::arduino::yymmddToIsoDate(a)); continue; }
        if (op == "MT_AMOUNT_TO_DECIMAL") { String a = st.empty() ? String("") : st.back(); if (!st.empty()) st.pop_back(); st.push_back(pulse::swift::arduino::normalizeMtAmount(a)); continue; }
        if (op == "MT_PARTY_NAME") { String a = st.empty() ? String("") : st.back(); if (!st.empty()) st.pop_back(); st.push_back(pulse::swift::arduino::mtPartyName(a)); continue; }
        if (op == "MT_CHARGE_TO_ISO") { String a = st.empty() ? String("") : st.back(); if (!st.empty()) st.pop_back(); st.push_back(pulse::swift::arduino::normalizeChargeBearer(a)); continue; }
        if (op.startsWith("PUSH_STR ")) { st.push_back(unquote(String(v | "").substring(9))); continue; }
        if (op.startsWith("PUSH_INT ")) { st.push_back(String(v | "").substring(9)); continue; }
        // DUP / OUTPUT / RET are structural no-ops here.
    }
    return st.empty() ? srcValue : st.back();
}

inline bool runMappingById(
    const String& mappingId,
    const String& sourcePayload,
    JsonArrayConst mappings,
    String& mappedPayload,
    String& error,
    const std::map<String, JsonObjectConst>* mappingsById = nullptr
) {
    JsonObjectConst selected;
    if (mappingsById != nullptr) {
        auto found = mappingsById->find(mappingId);
        if (found != mappingsById->end()) selected = found->second;
    } else {
        for (JsonObjectConst m : mappings) {
            const char* id = m["id"] | "";
            if (String(id) == mappingId) {
                selected = m;
                break;
            }
        }
    }

    if (selected.isNull()) {
        error = "Mapping not found: " + mappingId;
        return false;
    }

    JsonDocument sourceDoc;
    DeserializationError srcErr = deserializeJson(sourceDoc, sourcePayload);
    if (srcErr) {
        String raw = trimCopy(sourcePayload);
        if (startsWithUpper(raw, "MT103") || raw.indexOf(":20:") >= 0) {
            pulse::swift::arduino::parseMt103FinText(raw, sourceDoc);
        } else {
            sourceDoc.clear();
            JsonObject srcObj = sourceDoc.to<JsonObject>();
            srcObj["src"] = sourcePayload;
        }
    }

    JsonDocument targetDoc;
    targetDoc.to<JsonObject>();
    JsonArrayConst items = selected["items"].as<JsonArrayConst>();
    for (JsonObjectConst item : items) {
        String sourcePath = item["sourcePath"] | "";
        String targetPath = item["targetPath"] | "";
        String srcValue = getJsonPathValueAsString(sourceDoc.as<JsonVariantConst>(), sourcePath);
        // Prefer compiled opcodes; fall back to the legacy string rule only when
        // no ops were compiled for this item.
        JsonArrayConst ops = item["ops"].as<JsonArrayConst>();
        String outValue = (!ops.isNull() && ops.size() > 0)
            ? execCompiledRule(ops, srcValue)
            : applyConversionRule(String(item["conversionRule"] | ""), srcValue);
        setJsonPathValue(targetDoc, targetPath, outValue);
    }

    mappedPayload = "";
    serializeJson(targetDoc, mappedPayload);
    return true;
}

inline bool evaluateTransformExpr(
    const String& exprText,
    const String& srcMessage,
    JsonArrayConst mappings,
    int depth,
    String& outValue,
    String& error,
    const std::map<String, JsonObjectConst>* mappingsById = nullptr
) {
    if (depth > 4) {
        error = "Transform nesting too deep";
        return false;
    }

    String expr = trimCopy(exprText);
    if (expr.length() == 0) {
        outValue = srcMessage;
        return true;
    }

    String upperExpr = toUpperCopy(expr);
    if (upperExpr == "SRC") {
        outValue = srcMessage;
        return true;
    }

    if ((expr[0] == '"' && expr[expr.length() - 1] == '"') || (expr[0] == '\'' && expr[expr.length() - 1] == '\'')) {
        outValue = unquote(expr);
        return true;
    }

    if (!upperExpr.startsWith("MAP")) {
        outValue = srcMessage;
        return true;
    }

    int openIdx = expr.indexOf('(');
    int closeIdx = expr.lastIndexOf(')');
    if (openIdx < 0 || closeIdx <= openIdx) {
        error = "Invalid MAP expression";
        return false;
    }

    String inside = trimCopy(expr.substring(openIdx + 1, closeIdx));
    int commaIdx = findTopLevelComma(inside);
    if (commaIdx < 0) {
        error = "MAP requires two arguments";
        return false;
    }

    String mapIdToken = trimCopy(inside.substring(0, commaIdx));
    String payloadExpr = trimCopy(inside.substring(commaIdx + 1));
    String mappingId = unquote(mapIdToken);
    if (mappingId == mapIdToken) {
        error = "MAP id must be a quoted string";
        return false;
    }

    String payload;
    if (!evaluateTransformExpr(payloadExpr, srcMessage, mappings, depth + 1, payload, error, mappingsById)) {
        return false;
    }

    return runMappingById(mappingId, payload, mappings, outValue, error, mappingsById);
}

inline String applyTransformRule(
    const String& transformRule,
    const String& srcMessage,
    JsonArrayConst mappings,
    bool& transformApplied,
    String& transformError,
    const std::map<String, JsonObjectConst>* mappingsById = nullptr
) {
    String rule = trimCopy(normalizeDslEscapes(transformRule));
    transformApplied = false;
    transformError = "";

    if (rule.length() == 0) {
        transformApplied = true;
        return srcMessage;
    }

    String upperRule = toUpperCopy(rule);
    int assignIdx = upperRule.indexOf("OUTPUT :=");

    // Compiled ROUTE_MAP_RUN passes a bare mapper id (no "OUTPUT :=", no call
    // syntax). Dispatch straight into the compiled mapper.
    if (assignIdx < 0 && rule.indexOf('(') < 0 && rule.indexOf(' ') < 0) {
        String mapped;
        String mapErr;
        if (runMappingById(unquote(rule), srcMessage, mappings, mapped, mapErr, mappingsById)) {
            transformApplied = true;
            return mapped;
        }
        transformError = mapErr;
        return srcMessage;
    }

    if (assignIdx < 0) {
        transformApplied = true;
        return srcMessage;
    }

    String rhs = trimCopy(rule.substring(assignIdx + 9));
    int semicolon = rhs.indexOf(';');
    if (semicolon >= 0) rhs = trimCopy(rhs.substring(0, semicolon));

    String out;
    if (!evaluateTransformExpr(rhs, srcMessage, mappings, 0, out, transformError, mappingsById)) {
        return srcMessage;
    }

    transformApplied = true;
    return out;
}

inline bool maybeShapeIsoToXml(const String& dataTypeId, const String& routedMessage, bool isIso, String& shapedOut, String& warningOut) {
    shapedOut = routedMessage;
    warningOut = "";

    if (!isIso) {
        return false;
    }

    String trimmed = trimCopy(routedMessage);
    if (!trimmed.startsWith("{")) {
        warningOut = "iso output is not JSON object; left unchanged";
        return false;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, trimmed);
    if (err || !doc.is<JsonObject>()) {
        warningOut = "iso output JSON parse failed; left unchanged";
        return false;
    }

    JsonObject root = doc.as<JsonObject>();
    if (!root["Document"].is<JsonObject>()) {
        warningOut = "iso output missing Document object; left unchanged";
        return false;
    }

    JsonObject document = root["Document"].as<JsonObject>();
    pulse::swift::arduino::ensureIsoNamespaces(dataTypeId, document);

    JsonObjectConst rootConst = root;
    shapedOut = pulse::swift::arduino::jsonObjectToXmlDocument(rootConst);
    return true;
}
}
