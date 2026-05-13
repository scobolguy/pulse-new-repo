
#include "pmachine_routes.h"
#include <ArduinoJson.h>
#include <FS.h>
#include <LittleFS.h>
#include <vector>

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

bool loadProgramMapMappings(const String& programMapPath, FederatedFileSystem* ffs, std::vector<pmachine::MappingDef>& mappingsOut, String& errorOut) {
    JsonDocument doc;
    if (!deserializeDocFromPath(programMapPath, ffs, doc)) {
        errorOut = "Unable to load program map file";
        return false;
    }

    JsonArrayConst entries;
    if (doc.is<JsonArray>()) {
        entries = doc.as<JsonArrayConst>();
    } else if (doc.is<JsonObject>() && doc["entries"].is<JsonArray>()) {
        entries = doc["entries"].as<JsonArrayConst>();
    } else {
        errorOut = "Program map has no entries array";
        return false;
    }

    mappingsOut.clear();
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
        json += "\"breakpoints\":[";
        for (size_t i = 0; i < s.breakpoints.size(); ++i) {
            if (i > 0) json += ",";
            json += String(s.breakpoints[i]);
        }
        json += "]}";
        request->send(200, "application/json", json);
    });

    // PMachine program load (POST, expects raw binary in body, plus ?file= and ?max=)
    server.on("/pmachine/load", HTTP_POST, [&machine](AsyncWebServerRequest *request){
        if (!request->hasParam("file") || !request->hasParam("max")) {
            request->send(400, "text/plain", "Missing file or max param");
            return;
        }
        String file = request->getParam("file")->value();
        size_t max = request->getParam("max")->value().toInt();
        // Read binary from body
        std::vector<uint8_t> pcode;
        if (request->hasParam("pcode", true)) {
            String bin = request->getParam("pcode", true)->value();
            pcode.assign(bin.begin(), bin.end());
        }
        bool ok = machine.loadProgram(pcode, file.c_str(), max);
        request->send(ok ? 200 : 500, "text/plain", ok ? "Loaded" : "Load failed");
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

        File f = LittleFS.open(file, "r");
        if (!f) {
            request->send(404, "text/plain", "File not found or read error");
            return;
        }
        String text = f.readString();
        f.close();
        if ((size_t)text.length() > max) {
            request->send(413, "text/plain", "File too large");
            return;
        }

        std::vector<pmachine::PInstruction> instructions = pmachine::loadTextPCode(std::string(text.c_str()));
        std::vector<pmachine::MappingDef> mappingDefs;
        String mappingError;
        if (!loadProgramMapMappings(programMap, ffs, mappingDefs, mappingError)) {
            request->send(404, "text/plain", mappingError);
            return;
        }
        machine.setMappings(mappingDefs);
        machine.clearRoutingDeliveries();
        machine.setRoutingContext(std::string(inputQueue.c_str()), std::string(message.c_str()));
        machine.run(instructions);

        JsonDocument out;
        out["inputQueue"] = inputQueue;
        out["sourceMessage"] = message;
        JsonArray deliveries = out["deliveries"].to<JsonArray>();
        const std::vector<pmachine::RouteDelivery>& routed = machine.getRoutingDeliveries();
        for (const auto& d : routed) {
            JsonObject item = deliveries.add<JsonObject>();
            item["queueName"] = d.queueName.c_str();
            item["message"] = d.message.c_str();
        }
        out["publishedCount"] = routed.size();

        String response;
        serializeJson(out, response);
        request->send(200, "application/json", response);
    });

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
