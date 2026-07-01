
#include <Arduino.h>
#include "pmachine_routes.h"
#include <ArduinoJson.h>
#include <FS.h>
#include <LittleFS.h>
#include "profile_config.h"
#include <map>
#include <deque>
#include <vector>
#if defined(ESP32)
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#endif

namespace {

struct EdgeIngressConfig {
    size_t workerCount = 2;
    size_t queueLength = 64;
    size_t resultLimit = 64;
    size_t workerStackBytes = 12288;
    uint32_t workerPriority = 1;
    uint8_t preferredCore = 255;
};

EdgeIngressConfig gEdgeIngressConfig;
bool gEdgeIngressConfigLoaded = false;

size_t clampSizeT(size_t value, size_t minValue, size_t maxValue) {
    if (value < minValue) return minValue;
    if (value > maxValue) return maxValue;
    return value;
}

EdgeIngressConfig loadEdgeIngressConfig() {
    EdgeIngressConfig config;
    File f = LittleFS.open("/ffs/.EdgeIngressConfig.json", "r");
    if (!f) {
        return config;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        Serial.print("[edge_ingress_async] config parse failed: ");
        Serial.println(err.c_str());
        return config;
    }

    config.workerCount = clampSizeT(doc["workerCount"] | config.workerCount, 1, PROFILE_MAX_CONCURRENT_TASKS);
    config.queueLength = clampSizeT(doc["queueLength"] | config.queueLength, 1, 256);
    config.resultLimit = clampSizeT(doc["resultLimit"] | config.resultLimit, 1, 256);
    config.workerStackBytes = clampSizeT(doc["workerStackBytes"] | config.workerStackBytes, 8192, 16384);
    config.workerPriority = clampSizeT(doc["workerPriority"] | config.workerPriority, 1, 5);
    int preferredCore = doc["preferredCore"] | -1;
    config.preferredCore = (preferredCore >= 0 && preferredCore <= 1) ? static_cast<uint8_t>(preferredCore) : 255;
    return config;
}

bool saveEdgeIngressConfig(const EdgeIngressConfig& config) {
    JsonDocument doc;
    doc["workerCount"] = static_cast<unsigned long>(config.workerCount);
    doc["queueLength"] = static_cast<unsigned long>(config.queueLength);
    doc["resultLimit"] = static_cast<unsigned long>(config.resultLimit);
    doc["workerStackBytes"] = static_cast<unsigned long>(config.workerStackBytes);
    doc["workerPriority"] = static_cast<unsigned long>(config.workerPriority);
    doc["preferredCore"] = (config.preferredCore <= 1) ? static_cast<int>(config.preferredCore) : -1;

    File f = LittleFS.open("/ffs/.EdgeIngressConfig.json", "w");
    if (!f) return false;
    size_t written = serializeJson(doc, f);
    f.close();
    return written > 0;
}

size_t resolveIngressMessageLimit() {
    const size_t profileLimit = PROFILE_MAX_MESSAGE_BYTES;
    return profileLimit > 0 ? profileLimit : 16384;
}

void loadEdgeIngressConfigOnce() {
    if (gEdgeIngressConfigLoaded) return;
    gEdgeIngressConfig = loadEdgeIngressConfig();
    gEdgeIngressConfigLoaded = true;
    Serial.print("[edge_ingress_async] config workerCount=");
    Serial.print((unsigned long)gEdgeIngressConfig.workerCount);
    Serial.print(" queueLength=");
    Serial.print((unsigned long)gEdgeIngressConfig.queueLength);
    Serial.print(" resultLimit=");
    Serial.print((unsigned long)gEdgeIngressConfig.resultLimit);
    Serial.print(" stackBytes=");
    Serial.println((unsigned long)gEdgeIngressConfig.workerStackBytes);
}

} // namespace

namespace {

String trimCopy(const String& in) {
    String s = in;
    s.trim();
    return s;
}

String toUpperCopy(const String& in) {
    String s = in;
    s.toUpperCase();
    return s;
}

bool getRequestParam(AsyncWebServerRequest* request, const char* name, String& outValue) {
    if (request->hasParam(name, true)) {
        outValue = request->getParam(name, true)->value();
        return true;
    }
    if (request->hasParam(name)) {
        outValue = request->getParam(name)->value();
        return true;
    }
    return false;
}

bool startsWithUpper(const String& text, const String& prefix) {
    String t = toUpperCopy(text);
    String p = toUpperCopy(prefix);
    return t.startsWith(p);
}

int findTopLevelComma(const String& text) {
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

String unquote(const String& text) {
    String s = trimCopy(text);
    if (s.length() < 2) return s;
    char q = s[0];
    if ((q == '"' || q == '\'') && s[s.length() - 1] == q) {
        return s.substring(1, s.length() - 1);
    }
    return s;
}

String getJsonPathValueAsString(JsonVariantConst root, const String& dotPath) {
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

void setJsonPathValue(JsonDocument& doc, const String& dotPath, const String& value) {
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
            current[key] = JsonObject();
        }
        current = current[key].as<JsonObject>();
        start = dot + 1;
    }
}

String normalizeMtAmount(const String& raw) {
    String s = trimCopy(raw);
    s.replace(" ", "");
    s.replace(",", ".");
    return s;
}

String applyConversionRule(const String& conversionRule, const String& srcValue) {
    String rule = toUpperCopy(trimCopy(conversionRule));
    if (rule.length() == 0) return srcValue;

    if (rule.indexOf("UPPER(SRC)") >= 0) return toUpperCopy(srcValue);
    if (rule.indexOf("TRIM(SRC)") >= 0) return trimCopy(srcValue);
    if (rule.indexOf("MTAMOUNTTODECIMAL(SRC)") >= 0) return normalizeMtAmount(srcValue);
    if (rule.indexOf("OUTPUT := SRC") >= 0) return srcValue;

    return srcValue;
}

struct ProgramMapMetadata {
    String runtimeKind = "service";
    String runtimeId = "aggregator-router-service";
    uint32_t runtimeRefreshMs = 0;
    bool hasCodeLibrarianRole = false;
    bool hasLibraryBindings = false;
    JsonDocument raw;
};

struct PMachineExecutionPolicy {
    bool hasPagingConfig = false;
    size_t pageSizeBytes = 0;
    size_t maxFrames = 0;

    bool hasRuntimeOverride = false;
    String runtimeKind;
    String runtimeId;
    uint32_t runtimeRefreshMs = 0;

    bool hasResidentLoad = false;
    String residentDomain;
    String residentId;
    size_t residentBytes = 0;
    bool residentPin = false;
};

bool parseBooleanText(const String& raw, bool defaultValue = false) {
    String text = toUpperCopy(trimCopy(raw));
    if (text.length() == 0) return defaultValue;
    if (text == "1" || text == "TRUE" || text == "YES" || text == "ON") return true;
    if (text == "0" || text == "FALSE" || text == "NO" || text == "OFF") return false;
    return defaultValue;
}

void parseExecutionPolicy(AsyncWebServerRequest* request, PMachineExecutionPolicy& policy) {
    String value;

    String pageSizeText;
    String maxFramesText;
    bool hasPageSize = getRequestParam(request, "pageSizeBytes", pageSizeText);
    bool hasMaxFrames = getRequestParam(request, "maxFrames", maxFramesText);
    if (hasPageSize || hasMaxFrames) {
        policy.hasPagingConfig = true;
        policy.pageSizeBytes = hasPageSize ? static_cast<size_t>(pageSizeText.toInt()) : 1024;
        policy.maxFrames = hasMaxFrames ? static_cast<size_t>(maxFramesText.toInt()) : 24;
        if (policy.pageSizeBytes == 0) policy.pageSizeBytes = 1024;
        if (policy.maxFrames == 0) policy.maxFrames = 24;
    }

    String runtimeKind;
    String runtimeId;
    bool hasRuntimeKind = getRequestParam(request, "runtimeKind", runtimeKind);
    bool hasRuntimeId = getRequestParam(request, "runtimeId", runtimeId);
    if (hasRuntimeKind || hasRuntimeId) {
        policy.hasRuntimeOverride = true;
        policy.runtimeKind = hasRuntimeKind ? trimCopy(runtimeKind) : "service";
        policy.runtimeId = hasRuntimeId ? trimCopy(runtimeId) : "runtime-unit";
        if (policy.runtimeKind.length() == 0) policy.runtimeKind = "service";
        if (policy.runtimeId.length() == 0) policy.runtimeId = "runtime-unit";
        if (getRequestParam(request, "runtimeRefreshMs", value)) {
            policy.runtimeRefreshMs = static_cast<uint32_t>(value.toInt());
        }
    }

    String residentDomain;
    String residentId;
    bool hasResidentDomain = getRequestParam(request, "residentDomain", residentDomain);
    bool hasResidentId = getRequestParam(request, "residentId", residentId);
    if (hasResidentDomain && hasResidentId) {
        policy.hasResidentLoad = true;
        policy.residentDomain = trimCopy(residentDomain);
        policy.residentId = trimCopy(residentId);
        if (getRequestParam(request, "residentBytes", value)) {
            policy.residentBytes = static_cast<size_t>(value.toInt());
        }
        if (getRequestParam(request, "residentPin", value)) {
            policy.residentPin = parseBooleanText(value, false);
        }
    }
}

void applyRuntimeAndResidencyPolicy(
    pmachine::PMachine& machine,
    const PMachineExecutionPolicy* policy,
    const ProgramMapMetadata* metadata
) {
    String runtimeKind = metadata != nullptr ? metadata->runtimeKind : "service";
    String runtimeId = metadata != nullptr ? metadata->runtimeId : "runtime-unit";
    uint32_t refreshMs = metadata != nullptr ? metadata->runtimeRefreshMs : 0;

    if (policy != nullptr && policy->hasRuntimeOverride) {
        runtimeKind = policy->runtimeKind;
        runtimeId = policy->runtimeId;
        refreshMs = policy->runtimeRefreshMs;
    }

    machine.setRuntimeUnit(
        std::string(runtimeKind.c_str()),
        std::string(runtimeId.c_str()),
        refreshMs
    );

    if (policy != nullptr && policy->hasResidentLoad) {
        machine.loadResidentDomain(
            std::string(policy->residentDomain.c_str()),
            std::string(policy->residentId.c_str()),
            policy->residentBytes,
            policy->residentPin
        );
    }
}

bool jsonArrayContainsCodeLibrarian(JsonVariantConst rolesVariant) {
    if (!rolesVariant.is<JsonArrayConst>()) return false;
    JsonArrayConst roles = rolesVariant.as<JsonArrayConst>();
    for (JsonVariantConst item : roles) {
        if (item.is<const char*>()) {
            String roleName = toUpperCopy(trimCopy(String(item.as<const char*>())));
            if (roleName == "CODE_LIBRARIAN") return true;
            continue;
        }
        if (item.is<JsonObjectConst>()) {
            JsonObjectConst roleObj = item.as<JsonObjectConst>();
            String roleName = toUpperCopy(trimCopy(String(roleObj["role"] | "")));
            if (roleName == "CODE_LIBRARIAN") return true;
        }
    }
    return false;
}

bool jsonArrayHasAnyEntries(JsonVariantConst variant) {
    if (!variant.is<JsonArrayConst>()) return false;
    JsonArrayConst arr = variant.as<JsonArrayConst>();
    return !arr.isNull() && arr.size() > 0;
}

void parseProgramMapMetadata(const JsonDocument& doc, ProgramMapMetadata& metadata) {
    metadata.runtimeKind = "service";
    metadata.runtimeId = "aggregator-router-service";
    metadata.runtimeRefreshMs = 0;
    metadata.hasCodeLibrarianRole = false;
    metadata.hasLibraryBindings = false;

    JsonVariantConst runtime = doc["runtimeUnit"];
    if (runtime.is<JsonObjectConst>()) {
        metadata.runtimeKind = trimCopy(String(runtime["kind"] | metadata.runtimeKind));
        metadata.runtimeId = trimCopy(String(runtime["id"] | metadata.runtimeId));
        metadata.runtimeRefreshMs = static_cast<uint32_t>(runtime["refreshMs"] | 0);
    }

    if (metadata.runtimeId.length() == 0) {
        metadata.runtimeId = trimCopy(String(doc["serviceId"] | "aggregator-router-service"));
        if (metadata.runtimeId.length() == 0) metadata.runtimeId = "aggregator-router-service";
    }

    metadata.hasCodeLibrarianRole = jsonArrayContainsCodeLibrarian(doc["roles"]);
    metadata.hasLibraryBindings = jsonArrayHasAnyEntries(doc["codeLibraries"]) || jsonArrayHasAnyEntries(doc["uses"]);

    metadata.raw.clear();
    JsonObject raw = metadata.raw.to<JsonObject>();
    raw["runtimeKind"] = metadata.runtimeKind;
    raw["runtimeId"] = metadata.runtimeId;
    raw["runtimeRefreshMs"] = metadata.runtimeRefreshMs;
    raw["hasCodeLibrarianRole"] = metadata.hasCodeLibrarianRole;
    raw["hasLibraryBindings"] = metadata.hasLibraryBindings;
    if (doc["roles"].is<JsonArrayConst>()) raw["roles"] = doc["roles"];
    if (doc["codeLibraries"].is<JsonArrayConst>()) raw["codeLibraries"] = doc["codeLibraries"];
    if (doc["uses"].is<JsonArrayConst>()) raw["uses"] = doc["uses"];
    if (doc["interoperability"].is<JsonArrayConst>()) raw["interoperability"] = doc["interoperability"];
}

bool evaluateWhenRule(const String& whenRule, const String& srcMessage) {
    String rule = toUpperCopy(trimCopy(whenRule));
    if (rule.length() == 0) return true;

    if (rule.indexOf("OUTPUT := 1") >= 0) return true;
    if (rule.indexOf("OUTPUT := 0") >= 0 && rule.indexOf("THEN OUTPUT := 1") < 0) return false;

    // Support: IF startswith(upper(src), "MT103") THEN output := 1 ELSE output := 0;
    const String fn = "STARTSWITH(UPPER(SRC),";
    int idx = rule.indexOf(fn);
    if (idx >= 0) {
        int firstQuote = whenRule.indexOf('"');
        int secondQuote = whenRule.indexOf('"', firstQuote + 1);
        if (firstQuote >= 0 && secondQuote > firstQuote) {
            String prefix = whenRule.substring(firstQuote + 1, secondQuote);
            return startsWithUpper(srcMessage, prefix);
        }
    }

    return false;
}

String normalizeIngressMessage(const String& message) {
    String normalized = message;
    normalized.replace("\r\n", "\n");
    normalized.replace("\r", "\n");
    normalized.trim();
    return normalized;
}

String detectIngressMessageType(const String& normalizedMessage) {
    String upper = toUpperCopy(normalizedMessage);
    if (upper.startsWith("MT103") || upper.indexOf("\n:20:") >= 0 || upper.indexOf(":23B:") >= 0) {
        return "MT103";
    }
    if (upper.startsWith("MT202") || upper.indexOf(":21:") >= 0) {
        return "MT202";
    }
    if (upper.indexOf("<DOCUMENT") >= 0 && upper.indexOf("PACS") >= 0) {
        if (upper.indexOf("PACS.008") >= 0 || upper.indexOf("PACS008") >= 0) return "PACS008";
        if (upper.indexOf("PACS.009") >= 0 || upper.indexOf("PACS009") >= 0) return "PACS009";
        return "PACS";
    }
    if (normalizedMessage.startsWith("{") || normalizedMessage.startsWith("[")) {
        return "JSON";
    }
    return "UNKNOWN";
}

String inferIngressQueueFromType(const String& detectedType, const String& providedInputQueue) {
    String provided = trimCopy(providedInputQueue);
    if (provided.length() > 0) return provided;

    String type = toUpperCopy(trimCopy(detectedType));
    if (type == "MT103") return "swift.mt103.inbound";
    if (type == "MT202") return "mt202.inbound";
    if (type == "PACS" || type == "PACS008" || type == "PACS009") return "pacs.inbound";
    if (type == "JSON") return "json.inbound";
    return "edge.unknown.inbound";
}

String xmlEscapeText(const String& value) {
    String out = value;
    out.replace("&", "&amp;");
    out.replace("<", "&lt;");
    out.replace(">", "&gt;");
    out.replace("\"", "&quot;");
    out.replace("'", "&apos;");
    return out;
}

String requestMethodName(const AsyncWebServerRequest* request) {
    if (request == nullptr) return "";
    WebRequestMethodComposite method = request->method();
    if (method == HTTP_GET) return "GET";
    if (method == HTTP_POST) return "POST";
    if (method == HTTP_PUT) return "PUT";
    if (method == HTTP_PATCH) return "PATCH";
    if (method == HTTP_DELETE) return "DELETE";
    if (method == HTTP_OPTIONS) return "OPTIONS";
    if (method == HTTP_HEAD) return "HEAD";
    return String((unsigned int)method);
}

bool ruleAllowsMethod(JsonObjectConst rule, const String& requestMethodUpper) {
    if (!rule["methods"].is<JsonArrayConst>()) {
        return true;
    }

    JsonArrayConst methods = rule["methods"].as<JsonArrayConst>();
    if (methods.isNull() || methods.size() == 0) {
        return true;
    }

    for (JsonVariantConst entry : methods) {
        String allowed = toUpperCopy(trimCopy(String(entry.as<const char*>() ? entry.as<const char*>() : "")));
        if (allowed.length() == 0) continue;
        if (allowed == "*" || allowed == "ANY") return true;
        if (allowed == requestMethodUpper) return true;
    }

    return false;
}

String extractMtFieldLine(const String& message, const String& fieldTag) {
    int idx = message.indexOf(fieldTag);
    if (idx < 0) return "";
    int start = idx + fieldTag.length();
    int end = message.indexOf('\n', start);
    if (end < 0) end = message.length();
    String value = message.substring(start, end);
    value.trim();
    return value;
}

String buildPacsXmlFromMt(const String& normalizedMessage, const String& messageType) {
    String txId = extractMtFieldLine(normalizedMessage, ":20:");
    if (txId.length() == 0) {
        txId = String("TX-") + String((unsigned long)millis());
    }

    String relRef = extractMtFieldLine(normalizedMessage, ":21:");
    if (relRef.length() == 0) relRef = txId;

    String amountField = extractMtFieldLine(normalizedMessage, ":32A:");
    String ccy = "USD";
    String amount = "0";
    if (amountField.length() >= 9) {
        ccy = amountField.substring(6, 9);
        amount = amountField.substring(9);
        ccy.trim();
        amount.trim();
    }
    amount.replace(',', '.');

    const bool isMt202 = (toUpperCopy(messageType) == "MT202");
    const String pacsNs = isMt202
        ? "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.10"
        : "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10";

    String xml;
    xml.reserve(900);
    xml += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    xml += "<Document xmlns=\"" + pacsNs + "\">\n";
    xml += "  <FIToFICstmrCdtTrf>\n";
    xml += "    <GrpHdr>\n";
    xml += "      <MsgId>" + xmlEscapeText(txId) + "</MsgId>\n";
    xml += "    </GrpHdr>\n";
    xml += "    <CdtTrfTxInf>\n";
    xml += "      <PmtId>\n";
    xml += "        <InstrId>" + xmlEscapeText(txId) + "</InstrId>\n";
    xml += "        <EndToEndId>" + xmlEscapeText(isMt202 ? relRef : txId) + "</EndToEndId>\n";
    xml += "        <TxId>" + xmlEscapeText(txId) + "</TxId>\n";
    xml += "      </PmtId>\n";
    xml += "      <IntrBkSttlmAmt Ccy=\"" + xmlEscapeText(ccy) + "\">" + xmlEscapeText(amount) + "</IntrBkSttlmAmt>\n";
    xml += "    </CdtTrfTxInf>\n";
    xml += "  </FIToFICstmrCdtTrf>\n";
    xml += "</Document>";
    return xml;
}

bool deserializeDocFromPath(const String& path, FederatedFileSystem* ffs, JsonDocument& doc) {
    if (ffs != nullptr) {
        std::vector<uint8_t> bytes;
        if (ffs->read(path, bytes) == FFSStatus::OK && !bytes.empty()) {
            DeserializationError ffsErr = deserializeJson(doc, bytes.data(), bytes.size());
            if (!ffsErr) return true;
            doc.clear();
        }
    }

    File f = LittleFS.open(path, "r");
    if (!f) return false;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    return !err;
}

bool readTextFromPath(const String& path, FederatedFileSystem* ffs, String& outText) {
    if (ffs != nullptr) {
        std::vector<uint8_t> bytes;
        if (ffs->read(path, bytes) == FFSStatus::OK && !bytes.empty()) {
            outText.reserve(bytes.size());
            outText = "";
            for (uint8_t b : bytes) {
                outText += static_cast<char>(b);
            }
            return true;
        }
    }

    File f = LittleFS.open(path, "r");
    if (!f) return false;
    outText = f.readString();
    f.close();
    return true;
}

bool loadMappingsArray(const String& mappingsFilePath, FederatedFileSystem* ffs, JsonDocument& doc, JsonArrayConst& mappingsOut) {
    if (!deserializeDocFromPath(mappingsFilePath, ffs, doc)) {
        return false;
    }

    if (doc.is<JsonArray>()) {
        mappingsOut = doc.as<JsonArrayConst>();
        return true;
    }

    if (doc.is<JsonObject>() && doc["dataMappings"].is<JsonArray>()) {
        mappingsOut = doc["dataMappings"].as<JsonArrayConst>();
        return true;
    }

    return false;
}

bool runMappingById(const String& mappingId, const String& sourcePayload, JsonArrayConst mappings, String& mappedPayload, String& error) {
    JsonObjectConst selected;
    for (JsonObjectConst m : mappings) {
        const char* id = m["id"] | "";
        if (String(id) == mappingId) {
            selected = m;
            break;
        }
    }

    if (selected.isNull()) {
        error = "Mapping not found: " + mappingId;
        return false;
    }

    JsonDocument sourceDoc;
    DeserializationError srcErr = deserializeJson(sourceDoc, sourcePayload);
    if (srcErr) {
        sourceDoc.clear();
        JsonObject srcObj = sourceDoc.to<JsonObject>();
        srcObj["src"] = sourcePayload;
    }

    JsonDocument targetDoc;
    targetDoc.to<JsonObject>();
    JsonArrayConst items = selected["items"].as<JsonArrayConst>();
    for (JsonObjectConst item : items) {
        String sourcePath = item["sourcePath"] | "";
        String targetPath = item["targetPath"] | "";
        String conversionRule = item["conversionRule"] | "";
        String srcValue = getJsonPathValueAsString(sourceDoc.as<JsonVariantConst>(), sourcePath);
        String outValue = applyConversionRule(conversionRule, srcValue);
        setJsonPathValue(targetDoc, targetPath, outValue);
    }

    mappedPayload = "";
    serializeJson(targetDoc, mappedPayload);
    return true;
}

bool evaluateTransformExpr(const String& exprText, const String& srcMessage, JsonArrayConst mappings, int depth, String& outValue, String& error) {
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
    if (!evaluateTransformExpr(payloadExpr, srcMessage, mappings, depth + 1, payload, error)) {
        return false;
    }

    return runMappingById(mappingId, payload, mappings, outValue, error);
}

String applyTransformRule(const String& transformRule, const String& srcMessage, JsonArrayConst mappings, bool& transformApplied, String& transformError) {
    String rule = trimCopy(transformRule);
    transformApplied = false;
    transformError = "";

    if (rule.length() == 0) {
        transformApplied = true;
        return srcMessage;
    }

    String upperRule = toUpperCopy(rule);
    int assignIdx = upperRule.indexOf("OUTPUT :=");
    if (assignIdx < 0) {
        transformApplied = true;
        return srcMessage;
    }

    String rhs = trimCopy(rule.substring(assignIdx + 9));
    int semicolon = rhs.indexOf(';');
    if (semicolon >= 0) rhs = trimCopy(rhs.substring(0, semicolon));

    String out;
    if (!evaluateTransformExpr(rhs, srcMessage, mappings, 0, out, transformError)) {
        return srcMessage;
    }

    transformApplied = true;
    return out;
}

bool loadRouterRulesArray(const String& rulesFilePath, FederatedFileSystem* ffs, JsonDocument& doc, JsonArrayConst& rulesOut) {
    if (!deserializeDocFromPath(rulesFilePath, ffs, doc)) {
        return false;
    }

    if (doc.is<JsonArray>()) {
        rulesOut = doc.as<JsonArrayConst>();
        return true;
    }

    if (doc.is<JsonObject>() && doc["routerRules"].is<JsonArray>()) {
        rulesOut = doc["routerRules"].as<JsonArrayConst>();
        return true;
    }

    return false;
}

bool loadProgramMapMappings(
    const String& programMapPath,
    FederatedFileSystem* ffs,
    std::vector<pmachine::MappingDef>& mappingsOut,
    std::map<std::string, std::vector<std::string>>* procedureSignaturesOut,
    String& errorOut,
    ProgramMapMetadata* metadataOut = nullptr
) {
    JsonDocument doc;
    if (!deserializeDocFromPath(programMapPath, ffs, doc)) {
        errorOut = "Unable to load program map file";
        return false;
    }

    if (metadataOut != nullptr) {
        parseProgramMapMetadata(doc, *metadataOut);
        if (metadataOut->hasLibraryBindings && !metadataOut->hasCodeLibrarianRole) {
            errorOut = "Program map policy violation: code libraries require CODE_LIBRARIAN role";
            return false;
        }
    }

    if (procedureSignaturesOut != nullptr) {
        procedureSignaturesOut->clear();
        if (doc.is<JsonObject>() && doc["procedures"].is<JsonObjectConst>()) {
            JsonObjectConst procedures = doc["procedures"].as<JsonObjectConst>();
            for (JsonPairConst pair : procedures) {
                const char* label = pair.key().c_str();
                if (label == nullptr || label[0] == '\0') continue;
                std::vector<std::string> params;
                JsonObjectConst procedure = pair.value().as<JsonObjectConst>();
                JsonArrayConst paramArr = procedure["params"].as<JsonArrayConst>();
                for (JsonVariantConst p : paramArr) {
                    if (p.is<const char*>()) {
                        params.push_back(std::string(p.as<const char*>()));
                    }
                }
                (*procedureSignaturesOut)[std::string(label)] = params;
            }
        }
    }

    mappingsOut.clear();
    JsonArrayConst entries;
    if (doc.is<JsonArray>()) {
        entries = doc.as<JsonArrayConst>();
    } else if (doc.is<JsonObject>() && doc["entries"].is<JsonArray>()) {
        entries = doc["entries"].as<JsonArrayConst>();
    } else {
        // Standard Pascal program maps may not have router/mapping entries.
        return true;
    }

    for (JsonObjectConst entry : entries) {
        String kind = entry["kind"] | "";
        if (kind != "mapper") continue;

        pmachine::MappingDef def;
        def.id = String(entry["id"] | "").c_str();
        def.sourceTypeId = String(entry["sourceTypeId"] | "").c_str();
        def.targetTypeId = String(entry["targetTypeId"] | "").c_str();

        JsonArrayConst items = entry["items"].as<JsonArrayConst>();
        for (JsonObjectConst item : items) {
            pmachine::MappingItem mi;
            mi.sourcePath = String(item["sourcePath"] | "").c_str();
            mi.targetPath = String(item["targetPath"] | "").c_str();
            mi.conversionRule = String(item["conversionRule"] | "").c_str();
            def.items.push_back(mi);
        }

        if (!def.id.empty()) {
            mappingsOut.push_back(def);
        }
    }

    return true;
}

struct EdgeIngressExecutionResult {
    int statusCode = 200;
    String contentType = "application/json";
    String body;
};

struct EdgeIngressExecutionCache {
    String file;
    String programMap;
    size_t maxBytes = 0;
    bool ready = false;
    std::vector<pmachine::PInstruction> instructions;
    std::vector<pmachine::MappingDef> mappingDefs;
    std::map<std::string, std::vector<std::string>> procedureSignatures;
    ProgramMapMetadata metadata;
};

#if !defined(ESP32)
using PMachineMutexHandle = void*;
#else
using PMachineMutexHandle = SemaphoreHandle_t;
#endif

EdgeIngressExecutionResult executeEdgeIngressStage(
    pmachine::PMachine& machine,
    FederatedFileSystem* ffs,
    const String& file,
    const String& programMap,
    const String& inputQueue,
    const String& message,
    size_t maxBytes,
    bool runRouter,
    bool convertMtToXml,
    const PMachineExecutionPolicy* policy,
    PMachineMutexHandle machineMutex,
    EdgeIngressExecutionCache* executionCache = nullptr,
    bool messageAlreadyNormalized = false
) {
    EdgeIngressExecutionResult result;

    String normalized = messageAlreadyNormalized ? message : normalizeIngressMessage(message);
    String messageType = detectIngressMessageType(normalized);
    bool conversionApplied = false;
    String conversionFormat = "original";
    if (convertMtToXml && (messageType == "MT103" || messageType == "MT202")) {
        String originalType = messageType;
        normalized = buildPacsXmlFromMt(normalized, originalType);
        messageType = detectIngressMessageType(normalized);
        conversionApplied = true;
        conversionFormat = (originalType == "MT202") ? "mt202->pacs-xml" : "mt103->pacs-xml";
    }
    String effectiveInputQueue = inferIngressQueueFromType(messageType, inputQueue);

    Serial.print("[edge_ingress_stage] begin inputQueue=");
    Serial.print(effectiveInputQueue);
    Serial.print(" type=");
    Serial.print(messageType);
    Serial.print(" msgLen=");
    Serial.println(normalized.length());

    JsonDocument out;
    out["stage"] = "edge_ingress_stage_v1";
    out["messageType"] = messageType;
    out["inputQueue"] = effectiveInputQueue;
    out["normalizedMessage"] = normalized;
    out["conversionApplied"] = conversionApplied;
    out["conversionFormat"] = conversionFormat;
    out["runRouter"] = runRouter;
    out["publishedCount"] = 0;
    JsonArray deliveries = out["deliveries"].to<JsonArray>();

    if (policy != nullptr && policy->hasPagingConfig) {
        machine.setMemoryConfig(policy->pageSizeBytes, policy->maxFrames);
    }

    if (!runRouter) {
        serializeJson(out, result.body);
        return result;
    }

    const std::vector<pmachine::PInstruction>* instructions = nullptr;
    const std::vector<pmachine::MappingDef>* mappingDefs = nullptr;
    const std::map<std::string, std::vector<std::string>>* procedureSignatures = nullptr;
    std::vector<pmachine::PInstruction> loadedInstructions;
    std::vector<pmachine::MappingDef> loadedMappings;
    std::map<std::string, std::vector<std::string>> loadedProcedureSignatures;
    bool programCacheHit = false;

    if (executionCache != nullptr
        && executionCache->ready
        && executionCache->file == file
        && executionCache->programMap == programMap
        && executionCache->maxBytes == maxBytes) {
        instructions = &executionCache->instructions;
        mappingDefs = &executionCache->mappingDefs;
        procedureSignatures = &executionCache->procedureSignatures;
        programCacheHit = true;
        applyRuntimeAndResidencyPolicy(machine, policy, &executionCache->metadata);
    } else {
        File f = LittleFS.open(file, "r");
        if (!f) {
            result.statusCode = 404;
            result.contentType = "text/plain";
            result.body = "Router pcode file not found or read error";
            return result;
        }
        String text = f.readString();
        f.close();
        if ((size_t)text.length() > maxBytes) {
            result.statusCode = 413;
            result.contentType = "text/plain";
            result.body = "Router pcode file too large";
            return result;
        }

        loadedInstructions = pmachine::loadTextPCode(std::string(text.c_str()));
        String mappingError;
        ProgramMapMetadata metadata;
        if (!loadProgramMapMappings(programMap, ffs, loadedMappings, &loadedProcedureSignatures, mappingError, &metadata)) {
            result.statusCode = 404;
            result.contentType = "text/plain";
            result.body = mappingError;
            return result;
        }

        applyRuntimeAndResidencyPolicy(machine, policy, &metadata);

        if (executionCache != nullptr) {
            executionCache->file = file;
            executionCache->programMap = programMap;
            executionCache->maxBytes = maxBytes;
            executionCache->instructions = loadedInstructions;
            executionCache->mappingDefs = loadedMappings;
            executionCache->procedureSignatures = loadedProcedureSignatures;
            executionCache->metadata = metadata;
            executionCache->ready = true;
            instructions = &executionCache->instructions;
            mappingDefs = &executionCache->mappingDefs;
            procedureSignatures = &executionCache->procedureSignatures;
        } else {
            instructions = &loadedInstructions;
            mappingDefs = &loadedMappings;
            procedureSignatures = &loadedProcedureSignatures;
        }
    }

#if defined(ESP32)
    if (machineMutex != nullptr) {
        if (xSemaphoreTake(machineMutex, pdMS_TO_TICKS(15000)) != pdTRUE) {
            result.statusCode = 503;
            result.contentType = "text/plain";
            result.body = "PMachine busy";
            return result;
        }
    }
#endif

    machine.setMappings(*mappingDefs);
    if (procedureSignatures != nullptr) {
        machine.setProcedureSignatures(*procedureSignatures);
    } else {
        machine.clearProcedureSignatures();
    }
    machine.clearRoutingDeliveries();
    machine.setRoutingContext(std::string(effectiveInputQueue.c_str()), std::string(normalized.c_str()));
    machine.run(*instructions);

    const bool stepLimitHit = machine.didLastRunHitStepLimit();
    const size_t stepCount = machine.getLastRunStepCount();
    out["stepLimitHit"] = stepLimitHit;
    out["stepCount"] = stepCount;
    out["programCacheHit"] = programCacheHit;
    const pmachine::RuntimeUnitDescriptor& currentRuntimeUnit = machine.getRuntimeUnit();
    JsonObject runtime = out["runtimeUnit"].to<JsonObject>();
    runtime["kind"] =
        currentRuntimeUnit.kind == pmachine::RuntimeUnitKind::Program
            ? "program"
            : (currentRuntimeUnit.kind == pmachine::RuntimeUnitKind::Daemon ? "daemon" : "service");
    runtime["id"] = currentRuntimeUnit.id.c_str();
    runtime["refreshMs"] = currentRuntimeUnit.refreshMs;
    if (executionCache != nullptr && executionCache->ready) {
        JsonObject metadata = out["metadata"].to<JsonObject>();
        metadata["hasCodeLibrarianRole"] = executionCache->metadata.hasCodeLibrarianRole;
        metadata["hasLibraryBindings"] = executionCache->metadata.hasLibraryBindings;
        if (executionCache->metadata.raw["interoperability"].is<JsonArrayConst>()) {
            metadata["interoperability"] = executionCache->metadata.raw["interoperability"];
        }
    }

    Serial.print("[edge_ingress_stage] run done stepLimitHit=");
    Serial.print(stepLimitHit ? "true" : "false");
    Serial.print(" stepCount=");
    Serial.println((unsigned long)stepCount);

    const std::vector<pmachine::RouteDelivery>& routed = machine.getRoutingDeliveries();
    for (const auto& d : routed) {
        JsonObject item = deliveries.add<JsonObject>();
        item["queueName"] = d.queueName.c_str();
        item["message"] = d.message.c_str();
    }
    out["publishedCount"] = routed.size();
    JsonArray stdoutLines = out["stdout"].to<JsonArray>();
    for (const auto& line : machine.getLastRunTextOutput()) {
        stdoutLines.add(line.c_str());
    }

#if defined(ESP32)
    if (machineMutex != nullptr) {
        xSemaphoreGive(machineMutex);
    }
#endif

    serializeJson(out, result.body);
    if (stepLimitHit) {
        result.statusCode = 504;
    }
    return result;
}

#if defined(ESP32)
struct EdgeIngressAsyncTask {
    String jobId;
    String file;
    String programMap;
    String inputQueue;
    String message;
    size_t maxBytes;
    bool runRouter;
    bool convertMtToXml;
    PMachineExecutionPolicy policy;
};

struct EdgeIngressAsyncResult {
    String state;
    int statusCode;
    String contentType;
    String body;
    unsigned long updatedAtMs;
};

struct EdgeIngressWorkerContext {
    pmachine::PMachine machine;
    FederatedFileSystem* ffs;
    EdgeIngressExecutionCache executionCache;
};

QueueHandle_t gEdgeIngressAsyncQueue = nullptr;
SemaphoreHandle_t gEdgeIngressAsyncResultsMutex = nullptr;
std::vector<TaskHandle_t> gEdgeIngressWorkerTasks;
std::vector<EdgeIngressWorkerContext> gEdgeIngressWorkerContexts;
std::map<String, EdgeIngressAsyncResult> gEdgeIngressAsyncResults;
std::deque<String> gEdgeIngressAsyncResultOrder;
uint32_t gEdgeIngressJobCounter = 0;

size_t clearEdgeIngressExecutionCaches() {
    size_t cleared = 0;
    for (auto& ctx : gEdgeIngressWorkerContexts) {
        if (ctx.executionCache.ready) {
            cleared += 1;
        }
        ctx.executionCache.ready = false;
        ctx.executionCache.file = "";
        ctx.executionCache.programMap = "";
        ctx.executionCache.maxBytes = 0;
        ctx.executionCache.instructions.clear();
        ctx.executionCache.mappingDefs.clear();
        ctx.executionCache.metadata = ProgramMapMetadata{};
    }
    return cleared;
}

void trimEdgeIngressAsyncResultsLocked() {
    while (gEdgeIngressAsyncResultOrder.size() > gEdgeIngressConfig.resultLimit) {
        const String oldest = gEdgeIngressAsyncResultOrder.front();
        gEdgeIngressAsyncResultOrder.pop_front();
        gEdgeIngressAsyncResults.erase(oldest);
    }
}

void upsertEdgeIngressAsyncResult(const String& jobId, const EdgeIngressAsyncResult& value) {
    if (gEdgeIngressAsyncResultsMutex == nullptr) return;
    if (xSemaphoreTake(gEdgeIngressAsyncResultsMutex, pdMS_TO_TICKS(2000)) != pdTRUE) return;

    if (gEdgeIngressAsyncResults.find(jobId) == gEdgeIngressAsyncResults.end()) {
        gEdgeIngressAsyncResultOrder.push_back(jobId);
    }
    gEdgeIngressAsyncResults[jobId] = value;
    trimEdgeIngressAsyncResultsLocked();

    xSemaphoreGive(gEdgeIngressAsyncResultsMutex);
}

bool readEdgeIngressAsyncResult(const String& jobId, EdgeIngressAsyncResult& outResult) {
    if (gEdgeIngressAsyncResultsMutex == nullptr) return false;
    if (xSemaphoreTake(gEdgeIngressAsyncResultsMutex, pdMS_TO_TICKS(2000)) != pdTRUE) return false;

    auto it = gEdgeIngressAsyncResults.find(jobId);
    if (it == gEdgeIngressAsyncResults.end()) {
        xSemaphoreGive(gEdgeIngressAsyncResultsMutex);
        return false;
    }

    outResult = it->second;
    xSemaphoreGive(gEdgeIngressAsyncResultsMutex);
    return true;
}

String makeEdgeIngressJobId() {
    gEdgeIngressJobCounter += 1;
    return String("edge-") + String((unsigned long)millis()) + String("-") + String((unsigned long)gEdgeIngressJobCounter);
}

void edgeIngressAsyncWorker(void* rawContext) {
    EdgeIngressWorkerContext* context = static_cast<EdgeIngressWorkerContext*>(rawContext);

    for (;;) {
        EdgeIngressAsyncTask* task = nullptr;
        if (xQueueReceive(gEdgeIngressAsyncQueue, &task, portMAX_DELAY) != pdTRUE || task == nullptr) {
            continue;
        }

        EdgeIngressAsyncResult running;
        running.state = "running";
        running.statusCode = 102;
        running.contentType = "application/json";
        running.body = "";
        running.updatedAtMs = millis();
        upsertEdgeIngressAsyncResult(task->jobId, running);

        EdgeIngressExecutionResult exec = executeEdgeIngressStage(
            context->machine,
            context->ffs,
            task->file,
            task->programMap,
            task->inputQueue,
            task->message,
            task->maxBytes,
            task->runRouter,
            task->convertMtToXml,
            &task->policy,
            nullptr,
            &context->executionCache,
            true
        );

        EdgeIngressAsyncResult done;
        done.state = "completed";
        done.statusCode = exec.statusCode;
        done.contentType = exec.contentType;
        done.body = exec.body;
        done.updatedAtMs = millis();
        upsertEdgeIngressAsyncResult(task->jobId, done);

        delete task;
    }
}

void ensureEdgeIngressAsyncWorkerStarted(pmachine::PMachine& machine, FederatedFileSystem* ffs) {
    if (gEdgeIngressAsyncQueue != nullptr) return;

    loadEdgeIngressConfigOnce();

    gEdgeIngressAsyncQueue = xQueueCreate(gEdgeIngressConfig.queueLength, sizeof(EdgeIngressAsyncTask*));
    gEdgeIngressAsyncResultsMutex = xSemaphoreCreateMutex();

    if (gEdgeIngressAsyncQueue == nullptr || gEdgeIngressAsyncResultsMutex == nullptr) {
        Serial.println("[edge_ingress_async] initialization failed");
        return;
    }

    gEdgeIngressWorkerTasks.clear();
    gEdgeIngressWorkerContexts.clear();
    gEdgeIngressWorkerTasks.resize(gEdgeIngressConfig.workerCount, nullptr);
    gEdgeIngressWorkerContexts.resize(gEdgeIngressConfig.workerCount);

    for (size_t i = 0; i < gEdgeIngressConfig.workerCount; ++i) {
        gEdgeIngressWorkerContexts[i].ffs = ffs;
        gEdgeIngressWorkerContexts[i].machine.setFFS(ffs);

        BaseType_t created = xTaskCreatePinnedToCore(
            edgeIngressAsyncWorker,
            "edgeIngressAsync",
            gEdgeIngressConfig.workerStackBytes,
            &gEdgeIngressWorkerContexts[i],
            gEdgeIngressConfig.workerPriority,
            &gEdgeIngressWorkerTasks[i],
            (gEdgeIngressConfig.preferredCore <= 1)
              ? static_cast<BaseType_t>(gEdgeIngressConfig.preferredCore)
              : static_cast<BaseType_t>(i % 2)
        );

        if (created != pdPASS) {
            created = xTaskCreate(
                edgeIngressAsyncWorker,
                "edgeIngressAsync",
                gEdgeIngressConfig.workerStackBytes,
                &gEdgeIngressWorkerContexts[i],
                gEdgeIngressConfig.workerPriority,
                &gEdgeIngressWorkerTasks[i]
            );
        }

        if (created == pdPASS) {
            Serial.print("[edge_ingress_async] worker started index=");
            Serial.println((unsigned long)i);
        } else {
            Serial.print("[edge_ingress_async] worker creation failed index=");
            Serial.println((unsigned long)i);
        }
    }
}
#endif

}

void registerPMachineRoutes(AsyncWebServer& server, pmachine::PMachine& machine, FederatedFileSystem* ffs) {
    // PMachine file open
    server.on("/pmachine/file/open", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("file", true) || !request->hasParam("mode", true)) {
            request->send(400, "text/plain", "Missing file or mode param");
            return;
        }
        String file = request->getParam("file", true)->value();
        String mode = request->getParam("mode", true)->value();
        int handle = machine.openFile(file, mode);
        if (handle == 0) {
            request->send(500, "text/plain", "Failed to open file");
        } else {
            request->send(200, "application/json", String(handle));
        }
    });

    // PMachine file close
    server.on("/pmachine/file/close", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("handle", true)) {
            request->send(400, "text/plain", "Missing handle param");
            return;
        }
        int handle = request->getParam("handle", true)->value().toInt();
        bool ok = machine.closeFile(handle);
        request->send(ok ? 200 : 500, "text/plain", ok ? "Closed" : "Failed to close");
    });

    // PMachine file read line
    server.on("/pmachine/file/readline", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("handle")) {
            request->send(400, "text/plain", "Missing handle param");
            return;
        }
        int handle = request->getParam("handle")->value().toInt();
        String line;
        bool ok = machine.readLine(handle, line);
        if (!ok) {
            request->send(404, "text/plain", "No line or invalid handle");
        } else {
            request->send(200, "text/plain", line);
        }
    });

    // PMachine file write line
    server.on("/pmachine/file/writeline", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("handle", true) || !request->hasParam("line", true)) {
            request->send(400, "text/plain", "Missing handle or line param");
            return;
        }
        int handle = request->getParam("handle", true)->value().toInt();
        String line = request->getParam("line", true)->value();
        bool ok = machine.writeLine(handle, line);
        request->send(ok ? 200 : 500, "text/plain", ok ? "Written" : "Failed to write");
    });

    // PMachine status endpoint
    server.on("/pmachine/status", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        auto s = machine.getStatus();
        String json = "{";
        json += "\"numPages\":" + String(s.numPages) + ",";
        json += "\"backingFile\":\"" + String(s.backingFile.c_str()) + "\",";
        json += "\"maxSpace\":" + String((unsigned long)s.maxSpace) + ",";
        json += "\"dynamicLibs\":[";
        for (size_t i = 0; i < s.dynamicLibs.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + String(s.dynamicLibs[i].c_str()) + "\"";
        }
        json += "],";
        json += "\"running\":" + String(s.running ? "true" : "false") + ",";
        json += "\"pc\":" + String(s.pc) + ",";
        json += "\"runtimeUnit\":{";
        json += "\"kind\":\"" + String(
            s.runtimeUnit.kind == pmachine::RuntimeUnitKind::Program
                ? "program"
                : (s.runtimeUnit.kind == pmachine::RuntimeUnitKind::Daemon ? "daemon" : "service")
        ) + "\",";
        json += "\"id\":\"" + String(s.runtimeUnit.id.c_str()) + "\",";
        json += "\"refreshMs\":" + String(s.runtimeUnit.refreshMs) + ",";
        json += "\"loadedAtMs\":" + String(s.runtimeUnit.loadedAtMs) + ",";
        json += "\"lastRefreshAtMs\":" + String(s.runtimeUnit.lastRefreshAtMs) + ",";
        json += "\"resident\":" + String(s.runtimeUnit.resident ? "true" : "false");
        json += "},";
        json += "\"paging\":{";
        json += "\"pageSizeBytes\":" + String((unsigned long)s.pagingConfig.pageSizeBytes) + ",";
        json += "\"maxFrames\":" + String((unsigned long)s.pagingConfig.maxFrames) + ",";
        json += "\"pageFaults\":" + String(s.pagingStats.pageFaults) + ",";
        json += "\"evictions\":" + String(s.pagingStats.evictions) + ",";
        json += "\"ffsReads\":" + String(s.pagingStats.ffsReads) + ",";
        json += "\"cacheHits\":" + String(s.pagingStats.cacheHits);
        json += "},";
        json += "\"residentAssets\":[";
        for (size_t i = 0; i < s.residentAssets.size(); ++i) {
            if (i > 0) json += ",";
            const auto& asset = s.residentAssets[i];
            String domainName = "program-image";
            if (asset.domain == pmachine::ResidentDomain::StringPool) domainName = "string-pool";
            else if (asset.domain == pmachine::ResidentDomain::GlobalEnumeratedTypes) domainName = "global-enumerated-types";
            else if (asset.domain == pmachine::ResidentDomain::GlobalTypes) domainName = "global-types";
            else if (asset.domain == pmachine::ResidentDomain::MapperArtifacts) domainName = "mapper-artifacts";
            json += "{";
            json += "\"domain\":\"" + domainName + "\",";
            json += "\"id\":\"" + String(asset.id.c_str()) + "\",";
            json += "\"bytes\":" + String((unsigned long)asset.bytes) + ",";
            json += "\"pinCount\":" + String(asset.pinCount) + ",";
            json += "\"resident\":" + String(asset.resident ? "true" : "false");
            json += "}";
        }
        json += "],";
        json += "\"breakpoints\":[";
        for (size_t i = 0; i < s.breakpoints.size(); ++i) {
            if (i > 0) json += ",";
            json += String(s.breakpoints[i]);
        }
        json += "],";
        json += "\"memoryMap\":[";
        {
            size_t idx = 0;
            for (const auto& entry : s.memoryMap) {
                if (idx++ > 0) json += ",";
                json += "{\"vpage\":" + String(entry.first) + ",\"frame\":" + String((unsigned long)entry.second) + "}";
            }
        }
        json += "],";
        json += "\"thunks\":{";
        {
            size_t idx = 0;
            for (const auto& entry : s.thunkBindings) {
                if (idx++ > 0) json += ",";
                json += "\"" + String(entry.first.c_str()) + "\":" + String(entry.second);
            }
        }
        json += "}}";
        request->send(200, "application/json", json);
    });

    server.on("/pmachine/image-map", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        request->send(200, "application/json", String(machine.getImageMemoryMapJson().c_str()));
    });

    server.on("/pmachine/thunks", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        const auto bindings = machine.getThunkBindings();
        String json = "{";
        json += "\"count\":" + String((unsigned long)bindings.size()) + ",";
        json += "\"bindings\":{";
        size_t idx = 0;
        for (const auto& entry : bindings) {
            if (idx++ > 0) json += ",";
            json += "\"" + String(entry.first.c_str()) + "\":" + String(entry.second);
        }
        json += "}}";
        request->send(200, "application/json", json);
    });

    server.on("/pmachine/thunks/clear", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        machine.clearAllThunkBindings();
        request->send(200, "application/json", "{\"ok\":true,\"message\":\"all thunk bindings cleared\"}");
    });

    server.on("/pmachine/thunks/clearOne", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        String symbol;
        if (!getRequestParam(request, "symbol", symbol)) {
            request->send(400, "application/json", "{\"ok\":false,\"error\":\"missing symbol\"}");
            return;
        }
        const bool cleared = machine.clearThunkBinding(std::string(trimCopy(symbol).c_str()));
        request->send(cleared ? 200 : 404, "application/json", cleared
            ? "{\"ok\":true,\"message\":\"thunk binding cleared\"}"
            : "{\"ok\":false,\"error\":\"symbol not found\"}");
    });

    // PMachine program load (POST, expects raw binary in body, plus ?file= and ?max=)
    server.on("/pmachine/load", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("file") || !request->hasParam("max")) {
            request->send(400, "text/plain", "Missing file or max param");
            return;
        }
        String file = request->getParam("file")->value();
        size_t max = request->getParam("max")->value().toInt();
        PMachineExecutionPolicy policy;
        parseExecutionPolicy(request, policy);
        if (policy.hasPagingConfig) {
            machine.setMemoryConfig(policy.pageSizeBytes, policy.maxFrames);
        }
        // Read binary from body
        std::vector<uint8_t> pcode;
        if (request->hasParam("pcode", true)) {
            String bin = request->getParam("pcode", true)->value();
            pcode.assign(bin.begin(), bin.end());
        }
        bool ok = machine.loadProgram(pcode, file.c_str(), max);
        if (ok) {
            applyRuntimeAndResidencyPolicy(machine, &policy, nullptr);
        }
        request->send(ok ? 200 : 500, "text/plain", ok ? "Loaded" : "Load failed");
    });

    // Explicit runtime unit load lifecycle (program/service/daemon)
    server.on("/pmachine/unit/load", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("kind", true) || !request->hasParam("id", true)) {
            request->send(400, "text/plain", "Missing kind or id param");
            return;
        }
        String kind = request->getParam("kind", true)->value();
        String id = request->getParam("id", true)->value();
        uint32_t refreshMs = 0;
        if (request->hasParam("refreshMs", true)) {
            refreshMs = static_cast<uint32_t>(request->getParam("refreshMs", true)->value().toInt());
        }
        bool ok = machine.loadUnit(std::string(kind.c_str()), std::string(id.c_str()), refreshMs);
        request->send(ok ? 200 : 500, "text/plain", ok ? "Unit loaded" : "Unit load failed");
    });

    server.on("/pmachine/unit/unload", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        bool ok = machine.unloadUnit();
        request->send(ok ? 200 : 500, "text/plain", ok ? "Unit unloaded" : "Unit unload failed");
    });

    server.on("/pmachine/domain/load", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("domain", true) || !request->hasParam("id", true)) {
            request->send(400, "text/plain", "Missing domain or id param");
            return;
        }
        String domain = request->getParam("domain", true)->value();
        String id = request->getParam("id", true)->value();
        size_t bytes = 0;
        bool pin = false;
        if (request->hasParam("bytes", true)) {
            bytes = static_cast<size_t>(request->getParam("bytes", true)->value().toInt());
        }
        if (request->hasParam("pin", true)) {
            String pinText = toUpperCopy(trimCopy(request->getParam("pin", true)->value()));
            pin = (pinText == "1" || pinText == "TRUE" || pinText == "YES" || pinText == "ON");
        }
        bool ok = machine.loadResidentDomain(std::string(domain.c_str()), std::string(id.c_str()), bytes, pin);
        request->send(ok ? 200 : 500, "text/plain", ok ? "Domain loaded" : "Domain load failed");
    });

    server.on("/pmachine/domain/unload", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("domain", true) || !request->hasParam("id", true)) {
            request->send(400, "text/plain", "Missing domain or id param");
            return;
        }
        String domain = request->getParam("domain", true)->value();
        String id = request->getParam("id", true)->value();
        bool ok = machine.unloadResidentDomain(std::string(domain.c_str()), std::string(id.c_str()));
        request->send(ok ? 200 : 404, "text/plain", ok ? "Domain unloaded" : "Domain asset not found");
    });

    server.on("/pmachine/memory/config", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("pageSizeBytes", true) || !request->hasParam("maxFrames", true)) {
            request->send(400, "text/plain", "Missing pageSizeBytes or maxFrames param");
            return;
        }
        size_t pageSize = static_cast<size_t>(request->getParam("pageSizeBytes", true)->value().toInt());
        size_t maxFrames = static_cast<size_t>(request->getParam("maxFrames", true)->value().toInt());
        machine.setMemoryConfig(pageSize, maxFrames);
        request->send(200, "text/plain", "Memory config updated");
    });

    // PMachine run
    server.on("/pmachine/run", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        //machine.run(pcode);
        request->send(200, "text/plain", "Run complete");
    });

    // PMachine single step
    server.on("/pmachine/step", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        machine.singleStep();
        request->send(200, "text/plain", "Step complete");
    });

    // PMachine breakpoints
    server.on("/pmachine/break/set", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("pc")) {
            request->send(400, "text/plain", "Missing pc param");
            return;
        }
        uint16_t pc = request->getParam("pc")->value().toInt();
        machine.setBreakpoint(pc);
        request->send(200, "text/plain", "Breakpoint set");
    });
    server.on("/pmachine/break/clear", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("pc")) {
            request->send(400, "text/plain", "Missing pc param");
            return;
        }
        uint16_t pc = request->getParam("pc")->value().toInt();
        machine.clearBreakpoint(pc);
        request->send(200, "text/plain", "Breakpoint cleared");
    });
    server.on("/pmachine/break/clearall", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        machine.clearAllBreakpoints();
        request->send(200, "text/plain", "All breakpoints cleared");
    });

    // PMachine service endpoints
    server.on("/pmachine/pcode", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        String json = "{";
        bool first = true;
        for (const auto& pair : machine.getPCodeMap()) {
            if (!first) json += ",";
            json += "\"" + String(pair.first) + "\":\"0x" + String(pair.second, HEX) + "\"";
            first = false;
        }
        json += "}";
        request->send(200, "application/json", json);
    });
    server.on("/pmachine/memory", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        String json = "{";
        bool first = true;
        for (const auto& pair : machine.getMemoryMap()) {
            if (!first) json += ",";
            json += "\"" + String(pair.first) + "\":\"0x" + String(pair.second, HEX) + "\"";
            first = false;
        }
        json += "}";
        request->send(200, "application/json", json);
    });
    server.on("/pmachine/strings", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        String json = "[";
        auto pool = machine.getStringPool();
        for (size_t i = 0; i < pool.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + String(pool[i].c_str()) + "\"";
        }
        json += "]";
        request->send(200, "application/json", json);
    });
    server.on("/pmachine/enums", HTTP_GET, [&machine](AsyncWebServerRequest *request){
        String json = "{";
        bool first = true;
        for (const auto& pair : machine.getEnumTypes()) {
            if (!first) json += ",";
            json += "\"" + String(pair.first.c_str()) + ":" + String(pair.second);
            first = false;
        }
        json += "}";
        request->send(200, "application/json", json);
    });
    // PMachine load and run from FFS with tracing (accepts query params)
    server.on("/pmachine/load_and_run", HTTP_ANY, [&machine](AsyncWebServerRequest *request){
        Serial.println("[TRACE] /pmachine/load_and_run called");
        if (!request->hasParam("file") || !request->hasParam("max")) {
            Serial.println("[TRACE] Missing file or max param");
            request->send(400, "text/plain", "Missing file or max param");
            return;
        }
        String file = request->getParam("file")->value();
        size_t max = request->getParam("max")->value().toInt();
        PMachineExecutionPolicy policy;
        parseExecutionPolicy(request, policy);
        if (policy.hasPagingConfig) {
            machine.setMemoryConfig(policy.pageSizeBytes, policy.maxFrames);
        }
        Serial.print("[TRACE] file param: "); Serial.println(file);
        Serial.print("[TRACE] max param: "); Serial.println(max);
        File f = LittleFS.open(file, "r");
        if (!f) {
            Serial.println("[TRACE] File not found or read error");
            request->send(404, "text/plain", "File not found or read error");
            return;
        }
        String text = f.readString();
        f.close();
        Serial.print("[TRACE] pcode text size: "); Serial.println(text.length());
        if ((size_t)text.length() > max) {
            Serial.println("[TRACE] File too large");
            request->send(413, "text/plain", "File too large");
            return;
        }

        std::vector<pmachine::PInstruction> instructions = pmachine::loadTextPCode(std::string(text.c_str()));
        applyRuntimeAndResidencyPolicy(machine, &policy, nullptr);
        machine.clearRoutingDeliveries();
        machine.setRoutingContext("", "");
        machine.run(instructions);

        request->send(200, "text/plain", "Loaded and run");
    });

    // Run generated router .pcode with runtime queue/message context
    server.on("/pmachine/pcode_router_run", HTTP_ANY, [&machine, ffs](AsyncWebServerRequest *request){
        String file;
        String programMap = "/router-mapper.program.json";
        String inputQueue;
        String message;
        String maxParam = "32768";
        PMachineExecutionPolicy policy;
        parseExecutionPolicy(request, policy);

        if (!getRequestParam(request, "file", file)) {
            request->send(400, "text/plain", "Missing file param");
            return;
        }
        if (!getRequestParam(request, "inputQueue", inputQueue)) {
            request->send(400, "text/plain", "Missing inputQueue param");
            return;
        }
        if (!getRequestParam(request, "message", message)) {
            request->send(400, "text/plain", "Missing message param");
            return;
        }
        getRequestParam(request, "programMap", programMap);
        getRequestParam(request, "max", maxParam);
        size_t max = maxParam.toInt();

        if (policy.hasPagingConfig) {
            machine.setMemoryConfig(policy.pageSizeBytes, policy.maxFrames);
        }

        String text;
        if (!readTextFromPath(file, ffs, text)) {
            request->send(404, "text/plain", "File not found or read error");
            return;
        }
        if ((size_t)text.length() > max) {
            request->send(413, "text/plain", "File too large");
            return;
        }

        std::vector<pmachine::PInstruction> instructions = pmachine::loadTextPCode(std::string(text.c_str()));
        std::vector<pmachine::MappingDef> mappingDefs;
        std::map<std::string, std::vector<std::string>> procedureSignatures;
        String mappingError;
        ProgramMapMetadata metadata;
        if (!loadProgramMapMappings(programMap, ffs, mappingDefs, &procedureSignatures, mappingError, &metadata)) {
            request->send(404, "text/plain", mappingError);
            return;
        }
        applyRuntimeAndResidencyPolicy(machine, &policy, &metadata);
        machine.setMappings(mappingDefs);
        machine.setProcedureSignatures(procedureSignatures);
        machine.clearRoutingDeliveries();
        machine.setRoutingContext(std::string(inputQueue.c_str()), std::string(message.c_str()));
        machine.run(instructions);

        JsonDocument out;
        out["inputQueue"] = inputQueue;
        out["sourceMessage"] = message;
        JsonObject runtime = out["runtimeUnit"].to<JsonObject>();
        runtime["kind"] = metadata.runtimeKind;
        runtime["id"] = metadata.runtimeId;
        runtime["refreshMs"] = metadata.runtimeRefreshMs;
        JsonObject policyJson = out["policy"].to<JsonObject>();
        policyJson["hasCodeLibrarianRole"] = metadata.hasCodeLibrarianRole;
        policyJson["hasLibraryBindings"] = metadata.hasLibraryBindings;
        if (metadata.raw["interoperability"].is<JsonArrayConst>()) {
            policyJson["interoperability"] = metadata.raw["interoperability"];
        }
        JsonArray deliveries = out["deliveries"].to<JsonArray>();
        const std::vector<pmachine::RouteDelivery>& routed = machine.getRoutingDeliveries();
        for (const auto& d : routed) {
            JsonObject item = deliveries.add<JsonObject>();
            item["queueName"] = d.queueName.c_str();
            item["message"] = d.message.c_str();
        }
        out["publishedCount"] = routed.size();
        JsonArray stdoutLines = out["stdout"].to<JsonArray>();
        for (const auto& line : machine.getLastRunTextOutput()) {
            stdoutLines.add(line.c_str());
        }

        String response;
        serializeJson(out, response);
        request->send(200, "application/json", response);
    });

    // Edge ingress stage: sanitize + classify + optional router pcode execution in one call
    server.on("/pmachine/edge_ingress_stage", HTTP_ANY, [&machine, ffs](AsyncWebServerRequest *request){
        String file = "/router-mapper.pcode";
        String programMap = "/router-mapper.program.json";
        String inputQueue;
        String message;
        String maxParam = "32768";
        String runRouterParam = "1";
        String asyncParam = "1";
        String convertMtToXmlParam = "0";
        PMachineExecutionPolicy policy;
        parseExecutionPolicy(request, policy);

        if (!getRequestParam(request, "message", message)) {
            request->send(400, "text/plain", "Missing message param");
            return;
        }

        getRequestParam(request, "inputQueue", inputQueue);
        getRequestParam(request, "file", file);
        getRequestParam(request, "programMap", programMap);
        getRequestParam(request, "max", maxParam);
        getRequestParam(request, "runRouter", runRouterParam);
        getRequestParam(request, "async", asyncParam);
        getRequestParam(request, "convertMtToXml", convertMtToXmlParam);

        const size_t messageLimit = resolveIngressMessageLimit();
        if (message.length() > messageLimit) {
            JsonDocument out;
            out["error"] = "message too large";
            out["maxMessageBytes"] = static_cast<uint32_t>(messageLimit);
            out["actualMessageBytes"] = static_cast<uint32_t>(message.length());
            out["deviceRole"] = DEVICE_ROLE;
            String response;
            serializeJson(out, response);
            request->send(413, "application/json", response);
            return;
        }

        String normalized = normalizeIngressMessage(message);
        String messageType = detectIngressMessageType(normalized);
        String effectiveInputQueue = inferIngressQueueFromType(messageType, inputQueue);

        String runRouterUpper = toUpperCopy(trimCopy(runRouterParam));
        bool runRouter = !(runRouterUpper == "0" || runRouterUpper == "FALSE" || runRouterUpper == "NO");
        String asyncUpper = toUpperCopy(trimCopy(asyncParam));
        bool useAsync = !(asyncUpper == "0" || asyncUpper == "FALSE" || asyncUpper == "NO");
        String convertUpper = toUpperCopy(trimCopy(convertMtToXmlParam));
        bool convertMtToXml = (convertUpper == "1" || convertUpper == "TRUE" || convertUpper == "YES" || convertUpper == "ON");

    #if defined(ESP32)
        ensureEdgeIngressAsyncWorkerStarted(machine, ffs);
        if (useAsync && gEdgeIngressAsyncQueue != nullptr) {
            EdgeIngressAsyncTask* task = new EdgeIngressAsyncTask();
            task->jobId = makeEdgeIngressJobId();
            task->file = file;
            task->programMap = programMap;
            task->inputQueue = effectiveInputQueue;
            task->message = normalized;
            task->maxBytes = maxParam.toInt();
            task->runRouter = runRouter;
            task->convertMtToXml = convertMtToXml;
            task->policy = policy;

            BaseType_t ok = xQueueSend(gEdgeIngressAsyncQueue, &task, 0);
            if (ok == pdTRUE) {
            JsonDocument out;
            out["stage"] = "edge_ingress_stage_v1";
            out["mode"] = "async";
            out["jobId"] = task->jobId;
            out["messageType"] = messageType;
            out["inputQueue"] = effectiveInputQueue;
            out["runRouter"] = runRouter;
            out["conversionRequested"] = convertMtToXml;
            out["statusUrl"] = String("/pmachine/edge_ingress_status?jobId=") + task->jobId;
            String response;
            serializeJson(out, response);
            request->send(202, "application/json", response);
            return;
            }
            delete task;
            request->send(503, "text/plain", "Edge ingress queue is full");
            return;
        }
    #endif

        EdgeIngressExecutionResult exec = executeEdgeIngressStage(
            machine,
            ffs,
            file,
            programMap,
            effectiveInputQueue,
            normalized,
            maxParam.toInt(),
            runRouter,
            convertMtToXml,
            &policy,
            nullptr,
            nullptr,
            true
        );
        request->send(exec.statusCode, exec.contentType, exec.body);
    });

#if defined(ESP32)
    server.on("/pmachine/edge_ingress_status", HTTP_GET, [](AsyncWebServerRequest *request){
        if (!request->hasParam("jobId")) {
            request->send(400, "text/plain", "Missing jobId param");
            return;
        }

        String jobId = request->getParam("jobId")->value();
        EdgeIngressAsyncResult result;
        if (!readEdgeIngressAsyncResult(jobId, result)) {
            request->send(404, "text/plain", "Unknown jobId");
            return;
        }

        JsonDocument out;
        out["jobId"] = jobId;
        out["state"] = result.state;
        out["statusCode"] = result.statusCode;
        out["contentType"] = result.contentType;
        out["body"] = result.body;
        out["updatedAtMs"] = result.updatedAtMs;
        String response;
        serializeJson(out, response);
        request->send(result.statusCode, result.contentType, response);
    });

    server.on("/pmachine/edge_ingress_config", HTTP_GET, [](AsyncWebServerRequest *request){
#if defined(ESP32)
        loadEdgeIngressConfigOnce();
        JsonDocument out;
        out["workerCount"] = gEdgeIngressConfig.workerCount;
        out["queueLength"] = gEdgeIngressConfig.queueLength;
        out["resultLimit"] = gEdgeIngressConfig.resultLimit;
        out["workerStackBytes"] = gEdgeIngressConfig.workerStackBytes;
        out["workerPriority"] = gEdgeIngressConfig.workerPriority;
        out["preferredCore"] = (gEdgeIngressConfig.preferredCore <= 1) ? gEdgeIngressConfig.preferredCore : -1;
        out["loaded"] = gEdgeIngressConfigLoaded;
        out["queueDepth"] = (gEdgeIngressAsyncQueue != nullptr) ? uxQueueMessagesWaiting(gEdgeIngressAsyncQueue) : 0;
        out["queueCapacity"] = gEdgeIngressConfig.queueLength;
        String response;
        serializeJson(out, response);
        request->send(200, "application/json", response);
#else
        request->send(200, "application/json", "{}");
#endif
    });

    server.on("/pmachine/edge_ingress_config", HTTP_POST, [](AsyncWebServerRequest *request){
#if defined(ESP32)
        loadEdgeIngressConfigOnce();
        EdgeIngressConfig next = gEdgeIngressConfig;

        String value;
        bool anyProvided = false;

        if (getRequestParam(request, "workerCount", value)) {
            next.workerCount = clampSizeT(static_cast<size_t>(value.toInt()), 1, PROFILE_MAX_CONCURRENT_TASKS);
            anyProvided = true;
        }
        if (getRequestParam(request, "queueLength", value)) {
            next.queueLength = clampSizeT(static_cast<size_t>(value.toInt()), 1, 256);
            anyProvided = true;
        }
        if (getRequestParam(request, "resultLimit", value)) {
            next.resultLimit = clampSizeT(static_cast<size_t>(value.toInt()), 1, 256);
            anyProvided = true;
        }
        if (getRequestParam(request, "workerStackBytes", value)) {
            next.workerStackBytes = clampSizeT(static_cast<size_t>(value.toInt()), 8192, 16384);
            anyProvided = true;
        }
        if (getRequestParam(request, "workerPriority", value)) {
            next.workerPriority = static_cast<uint32_t>(clampSizeT(static_cast<size_t>(value.toInt()), 1, 5));
            anyProvided = true;
        }
        if (getRequestParam(request, "preferredCore", value)) {
            int preferredCore = value.toInt();
            next.preferredCore = (preferredCore >= 0 && preferredCore <= 1)
              ? static_cast<uint8_t>(preferredCore)
              : 255;
            anyProvided = true;
        }

        if (!anyProvided) {
            request->send(400, "application/json", "{\"error\":\"No config params provided\"}");
            return;
        }

        if (!saveEdgeIngressConfig(next)) {
            request->send(500, "application/json", "{\"error\":\"Failed to persist config\"}");
            return;
        }

        gEdgeIngressConfig = next;
        gEdgeIngressConfigLoaded = true;

        String rebootParam = "0";
        getRequestParam(request, "reboot", rebootParam);
        String rebootUpper = toUpperCopy(trimCopy(rebootParam));
        bool rebootNow = (rebootUpper == "1" || rebootUpper == "TRUE" || rebootUpper == "YES" || rebootUpper == "ON");

        JsonDocument out;
        out["status"] = "saved";
        out["appliesOnNextBoot"] = true;
        out["rebootRequested"] = rebootNow;
        out["workerCount"] = next.workerCount;
        out["queueLength"] = next.queueLength;
        out["resultLimit"] = next.resultLimit;
        out["workerStackBytes"] = next.workerStackBytes;
        out["workerPriority"] = next.workerPriority;
        out["preferredCore"] = (next.preferredCore <= 1) ? next.preferredCore : -1;
        out["currentQueueDepth"] = (gEdgeIngressAsyncQueue != nullptr) ? uxQueueMessagesWaiting(gEdgeIngressAsyncQueue) : 0;
                out["currentQueueCapacity"] = (gEdgeIngressAsyncQueue != nullptr)
                    ? (uxQueueMessagesWaiting(gEdgeIngressAsyncQueue) + uxQueueSpacesAvailable(gEdgeIngressAsyncQueue))
                    : 0;
        out["message"] = rebootNow
          ? "Config saved. Rebooting to apply queue capacity changes."
          : "Config saved. Reboot required to apply queue capacity changes.";

        String response;
        serializeJson(out, response);
        request->send(200, "application/json", response);

        if (rebootNow) {
            delay(250);
            ESP.restart();
        }
#else
        request->send(200, "application/json", "{\"status\":\"unsupported\"}");
#endif
    });

        server.on("/pmachine/edge_ingress_cache/clear", HTTP_POST, [](AsyncWebServerRequest *request){
    #if defined(ESP32)
        size_t cleared = clearEdgeIngressExecutionCaches();
        JsonDocument out;
        out["status"] = "ok";
        out["clearedCaches"] = (unsigned long)cleared;
        out["workerCount"] = (unsigned long)gEdgeIngressWorkerContexts.size();
        out["message"] = "Edge ingress execution caches cleared";
        String response;
        serializeJson(out, response);
        request->send(200, "application/json", response);
    #else
        request->send(200, "application/json", "{\"status\":\"ok\",\"clearedCaches\":0}");
    #endif
        });
#endif

    // PMachine aggregator-router execution (rules-driven fanout)
    server.on("/pmachine/router/run", HTTP_ANY, [ffs](AsyncWebServerRequest *request){
        String inputQueue;
        String message;
        String serviceId = "aggregator-router-service";
        String rulesPath = "/router-rules.generated.json";
        String mappingsPath = "/data-mappings.generated.json";

        if (!getRequestParam(request, "inputQueue", inputQueue)) {
            request->send(400, "text/plain", "Missing inputQueue param");
            return;
        }
        if (!getRequestParam(request, "message", message)) {
            request->send(400, "text/plain", "Missing message param");
            return;
        }
        getRequestParam(request, "serviceId", serviceId);
        getRequestParam(request, "rules", rulesPath);
        getRequestParam(request, "mappings", mappingsPath);
        String requestMethodUpper = toUpperCopy(trimCopy(requestMethodName(request)));

        JsonDocument rulesDoc;
        JsonArrayConst rules;
        if (!loadRouterRulesArray(rulesPath, ffs, rulesDoc, rules)) {
            request->send(404, "text/plain", "Unable to load router rules file");
            return;
        }

        JsonDocument mappingsDoc;
        JsonArrayConst mappings;
        if (!loadMappingsArray(mappingsPath, ffs, mappingsDoc, mappings)) {
            if (!(rulesDoc.is<JsonObject>() && rulesDoc["dataMappings"].is<JsonArray>())) {
                request->send(404, "text/plain", "Unable to load mappings file");
                return;
            }
            mappings = rulesDoc["dataMappings"].as<JsonArrayConst>();
        }

        JsonDocument outDoc;
        outDoc["inputQueue"] = inputQueue;
        outDoc["serviceId"] = serviceId;
        outDoc["rulesFile"] = rulesPath;
        outDoc["mappingsFile"] = mappingsPath;
        outDoc["sourceMessage"] = message;

        int matchedRuleCount = 0;
        int publishedCount = 0;
        JsonArray deliveries = outDoc["deliveries"].to<JsonArray>();

        for (JsonObjectConst rule : rules) {
            bool enabled = !rule["enabled"].is<bool>() || rule["enabled"].as<bool>();
            if (!enabled) continue;

            const char* inQueue = rule["inputQueue"] | "";
            if (String(inQueue) != inputQueue) continue;

            const char* ruleService = rule["serviceId"] | "";
            if (String(ruleService).length() > 0 && String(ruleService) != serviceId) continue;
            if (!ruleAllowsMethod(rule, requestMethodUpper)) continue;

            matchedRuleCount += 1;

            JsonArrayConst outputs = rule["outputs"].as<JsonArrayConst>();
            for (JsonObjectConst output : outputs) {
                String whenRule = output["whenRule"] | "";
                if (!evaluateWhenRule(whenRule, message)) continue;

                bool transformApplied = false;
                String transformRule = output["transformRule"] | "";
                String transformError;
                String routed = applyTransformRule(transformRule, message, mappings, transformApplied, transformError);

                JsonObject d = deliveries.add<JsonObject>();
                d["ruleId"] = rule["id"] | "";
                d["outputQueue"] = output["queueName"] | "";
                d["message"] = routed;
                d["transformApplied"] = transformApplied;
                if (transformError.length() > 0) {
                    d["transformError"] = transformError;
                }
                publishedCount += 1;
            }
        }

        outDoc["matchedRuleCount"] = matchedRuleCount;
        outDoc["publishedCount"] = publishedCount;

        String response;
        serializeJson(outDoc, response);
        request->send(200, "application/json", response);
    });
}
