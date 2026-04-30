
#include "pmachine_routes.h"
#include <ArduinoJson.h>
#include <FS.h>
#include <LittleFS.h>

void registerPMachineRoutes(AsyncWebServer& server, pmachine::PMachine& machine) {
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
        // Read file as text
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
        Serial.println("[TRACE] pcode ASCII:");
        Serial.println(text);
        Serial.println("[TRACE] pcode HEX:");
        for (size_t i = 0; i < text.length(); ++i) {
            char c = text[i];
            if (i % 16 == 0) Serial.print("\n");
            if ((uint8_t)c < 16) Serial.print("0");
            Serial.print((uint8_t)c, HEX); Serial.print(" ");
        }
        Serial.println();
        bool ok = false;
        //bool ok = pm.loadTextPCode(std::string(text.c_str()));
        Serial.print("[TRACE] loadTextPCode result: "); Serial.println(ok ? "true" : "false");
        if (!ok) {
            Serial.println("[TRACE] Load failed");
            request->send(500, "text/plain", "Load failed");
            return;
        }
        //pm.run();
        Serial.println("[TRACE] pm.run() called");
        request->send(200, "text/plain", "Loaded and run");
    });
}
