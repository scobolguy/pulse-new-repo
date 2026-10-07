#if defined(PULSE_ESP8266_SENSOR)
#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <array>
#include <new>
#include "pmachine.h"
#include "program.h"

namespace {
constexpr int dhtPin = 4, buttonPin = 14;
constexpr uint32_t clockMask = 0x7fffffff;
constexpr size_t serialLimit = 384;
DHT dht(dhtPin, DHT11);
ESP8266WebServer server(80);
pmachine::PMachine machine;
struct State { std::string name; int value = 0; };
std::array<State, 16> state;
size_t stateCount = 0;
char serialInput[serialLimit + 1];
size_t serialLength = 0;
bool serialOverflow = false, validSample = false, runtimeFailed = false;
uint32_t lastTick = 0, sampleAt = 0;
float temperature = NAN, humidity = NAN;
String nodeName;
char runtimeError[160] = {};

bool deviceCall(const std::string& operation, const std::vector<pmachine::HostValue>& args,
                pmachine::HostValue& result, std::string& error, void*) {
    const auto fail = [&](const char* message) { error = message; return false; };
    result.isString = false;
    result.integer = 0;
    if (operation == "device.clock") {
        if (!args.empty()) return fail("clock takes no arguments");
        result.integer = static_cast<int>(millis() & clockMask);
    } else if (operation == "device.elapsed") {
        if (args.size() != 1 || args[0].isString || args[0].integer < 0) return fail("Invalid clock stamp");
        result.integer = static_cast<int>((millis() - static_cast<uint32_t>(args[0].integer)) & clockMask);
    } else if (operation == "device.gpio_read" || operation == "device.dht_read") {
        if (args.size() != 1 || args[0].isString) return fail("Pin must be an integer");
        if (operation == "device.gpio_read") {
            if (args[0].integer != buttonPin) return fail("Only the configured button pin is readable");
            result.integer = digitalRead(buttonPin);
        } else {
            if (args[0].integer != dhtPin) return fail("Invalid DHT11 pin");
            temperature = dht.readTemperature();
            humidity = dht.readHumidity();
            validSample = !isnan(temperature) && !isnan(humidity);
            sampleAt = millis();
            result.integer = validSample ? 1 : 0;
        }
    } else if (operation == "device.dht_temperature" || operation == "device.dht_humidity") {
        if (!args.empty() || !validSample) return fail("No valid DHT11 sample");
        char text[24];
        snprintf(text, sizeof(text), "%.1f", operation == "device.dht_temperature" ? temperature : humidity);
        result.isString = true;
        result.text = text;
    } else if (operation == "device.state_get" || operation == "device.state_set") {
        const bool write = operation == "device.state_set";
        if (args.size() != (write ? 2u : 1u) || !args[0].isString
            || args[0].text.empty() || args[0].text.size() > 32
            || (write && args[1].isString)) return fail("Invalid device state arguments");
        size_t index = 0;
        while (index < stateCount && state[index].name != args[0].text) ++index;
        if (index == stateCount) {
            if (!write) return true; // Uninitialized persistent integer state starts at zero.
            if (stateCount == state.size()) return fail("Device state capacity exceeded");
            state[index].name = args[0].text;
            ++stateCount;
        }
        if (write) state[index].value = args[1].integer;
        result.integer = state[index].value;
    } else return fail("Unknown device binding");
    return true;
}

void printLine(const std::string& line, void*) { Serial.println(line.c_str()); }

void sendStatus() {
    JsonDocument doc;
    doc["nodeId"] = nodeName;
    doc["hardware"] = "ESP8266";
    doc["role"] = "sensor";
    doc["runtime"] = "pmachine";
    doc["status"] = runtimeFailed ? "error" : "ready";
    if (runtimeFailed) doc["error"] = runtimeError;
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
    doc["valid"] = validSample;
    doc["sampled"] = sampleAt != 0;
    if (sampleAt != 0) doc["sampleAgeMs"] = static_cast<uint32_t>(millis() - sampleAt);
    if (validSample) {
        doc["temperature"] = temperature;
        doc["humidity"] = humidity;
        doc["unit"] = "C";
    } else doc["sensorError"] = sampleAt == 0 ? "not_sampled" : "dht_read_failed";
    char json[512];
    const size_t expected = measureJson(doc);
    if (doc.overflowed() || expected >= sizeof(json)) {
        Serial.println("[HTTP] Status serialization capacity exceeded");
        server.send(503, "application/json", "{\"error\":\"status_capacity_exceeded\"}");
        return;
    }
    serializeJson(doc, json, sizeof(json));
    server.send(runtimeFailed ? 503 : 200, "application/json", json);
}

void provision(const char* line) {
    constexpr char prefix[] = "PROVISION ";
    if (strncmp(line, prefix, sizeof(prefix) - 1) != 0) {
        Serial.println("[PROVISION] Expected PROVISION {\"ssid\":\"...\",\"password\":\"...\"}");
        return;
    }
    JsonDocument doc;
    const auto parsed = deserializeJson(doc, line + sizeof(prefix) - 1);
    if (parsed || !doc["ssid"].is<const char*>() || !doc["password"].is<const char*>()) {
        Serial.println("[PROVISION] Invalid JSON or missing ssid/password");
        return;
    }
    const String ssid = doc["ssid"].as<String>(), password = doc["password"].as<String>();
    if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 64
        || (password.length() > 0 && password.length() < 8)) {
        Serial.println("[PROVISION] Invalid SSID or password length");
        return;
    }
    WiFi.persistent(true);
    WiFi.begin(ssid.c_str(), password.c_str());
    WiFi.persistent(false);
    Serial.println("[PROVISION] Credentials saved; connecting");
}

void pollSerial() {
    size_t budget = 64;
    while (budget-- && Serial.available()) {
        const char byte = static_cast<char>(Serial.read());
        if (byte == '\r') continue;
        if (byte == '\n') {
            if (serialOverflow) Serial.println("[PROVISION] Command exceeds 384 bytes");
            else if (serialLength) {
                serialInput[serialLength] = '\0';
                provision(serialInput);
            }
            memset(serialInput, 0, sizeof(serialInput));
            serialLength = 0;
            serialOverflow = false;
        } else if (serialLength < serialLimit && !serialOverflow) serialInput[serialLength++] = byte;
        else serialOverflow = true;
    }
}

void runTick() {
    try {
        machine.runImage(sensor_program::count, sensor_program::at);
        const auto flow = machine.getFlowStateSnapshot();
        const auto error = flow.find("__runtime_error");
        if (error != flow.end() || machine.didLastRunHitStepLimit()) {
            snprintf(runtimeError, sizeof(runtimeError), "%s",
                     error != flow.end() ? error->second.c_str() : "Instruction budget exceeded");
            runtimeFailed = true;
        }
    } catch (const std::bad_alloc&) {
        runtimeFailed = true;
        snprintf(runtimeError, sizeof(runtimeError), "%s", "Sensor PMachine allocation failed");
    }
    if (runtimeFailed) Serial.printf("[PMACHINE] %s; execution stopped\n", runtimeError);
}
}

void setup() {
    Serial.begin(115200);
    pinMode(buttonPin, INPUT_PULLUP);
    dht.begin();
    nodeName = "pulse-esp8266-" + String(ESP.getChipId(), HEX);
    machine.setHostCallHook(deviceCall);
    machine.setTextOutputHook(printLine);
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin();
    server.on("/status", HTTP_GET, sendStatus);
    server.on("/sensor/latest", HTTP_GET, sendStatus);
    server.onNotFound([] { server.send(404, "application/json", "{\"error\":\"not_found\"}"); });
    server.begin();
    Serial.println("Provision Wi-Fi over serial with PROVISION {\"ssid\":\"...\",\"password\":\"...\"}");
    runTick();
}

void loop() {
    pollSerial();
    server.handleClient();
    const uint32_t now = millis();
    if (!runtimeFailed && static_cast<uint32_t>(now - lastTick) >= 10) {
        lastTick = now;
        runTick();
    }
    static bool connected = false;
    const bool ready = WiFi.status() == WL_CONNECTED;
    if (ready != connected) {
        connected = ready;
        if (ready) Serial.printf("[WIFI] Connected: http://%s/status\n", WiFi.localIP().toString().c_str());
        else Serial.println("[WIFI] Disconnected; reconnecting");
    }
    delay(1);
}
#endif
