// Route management for TLS cert upload — includes ESPAsyncWebServer.h only.
// IDF proxy code lives in https_core.cpp which must NOT be mixed with this header.
#if defined(ENABLE_HTTPS) && defined(ESP32)

#include "https_service.h"
#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

namespace {

#ifndef TLS_BOOTSTRAP_TOKEN_BYTES
#define TLS_BOOTSTRAP_TOKEN_BYTES 16
#endif

struct TlsEnrollmentState {
    String sessionId;
    unsigned long sessionExpiresAtMs = 0;
    String enrollmentState = "bootstrap";
    bool mtlsRequired = false;
};

TlsEnrollmentState gTlsState;
bool gTlsStateLoaded = false;
const char* kTlsStatePath = "/tls/state.json";
const char* kTlsBootstrapTokenPath = "/tls/bootstrap.token";
const unsigned long kSessionTtlMs = 5UL * 60UL * 1000UL;
const unsigned long kAuthLockMs = 2UL * 60UL * 1000UL;
const uint8_t kMaxAuthFailures = 5;
String gBootstrapToken;
unsigned long gAuthLockUntilMs = 0;
uint8_t gAuthFailureCount = 0;

String makeSessionId() {
    const uint32_t r = esp_random();
    return String("enr-") + String((unsigned long)millis()) + String("-") + String((unsigned long)r, HEX);
}

String getDeviceId() {
    const uint64_t mac = ESP.getEfuseMac();
    const uint32_t tail = static_cast<uint32_t>(mac & 0xFFFFFFFFULL);
    return String("esp32-") + String((unsigned long)tail, HEX);
}

void ensureTlsDir() {
    if (!LittleFS.exists("/tls")) {
        LittleFS.mkdir("/tls");
    }
}

bool writeTextFile(const char* path, const String& content) {
    File f = LittleFS.open(path, "w");
    if (!f) return false;
    const size_t written = f.write(reinterpret_cast<const uint8_t*>(content.c_str()), content.length());
    f.close();
    return written == content.length();
}

String bytesToHex(const uint8_t* bytes, size_t len) {
    static const char* hex = "0123456789abcdef";
    String out;
    out.reserve(len * 2);
    for (size_t i = 0; i < len; ++i) {
        const uint8_t b = bytes[i];
        out += hex[(b >> 4) & 0x0F];
        out += hex[b & 0x0F];
    }
    return out;
}

String generateBootstrapToken() {
    uint8_t token[TLS_BOOTSTRAP_TOKEN_BYTES];
    for (size_t i = 0; i < TLS_BOOTSTRAP_TOKEN_BYTES; i += 4) {
        const uint32_t r = esp_random();
        token[i] = static_cast<uint8_t>(r & 0xFF);
        if (i + 1 < TLS_BOOTSTRAP_TOKEN_BYTES) token[i + 1] = static_cast<uint8_t>((r >> 8) & 0xFF);
        if (i + 2 < TLS_BOOTSTRAP_TOKEN_BYTES) token[i + 2] = static_cast<uint8_t>((r >> 16) & 0xFF);
        if (i + 3 < TLS_BOOTSTRAP_TOKEN_BYTES) token[i + 3] = static_cast<uint8_t>((r >> 24) & 0xFF);
    }
    return bytesToHex(token, TLS_BOOTSTRAP_TOKEN_BYTES);
}

String loadOrCreateBootstrapToken() {
    if (gBootstrapToken.length() > 0) return gBootstrapToken;

    ensureTlsDir();
    if (LittleFS.exists(kTlsBootstrapTokenPath)) {
        File f = LittleFS.open(kTlsBootstrapTokenPath, "r");
        if (f) {
            gBootstrapToken = f.readString();
            gBootstrapToken.trim();
            f.close();
        }
    }

    if (gBootstrapToken.length() == 0) {
        gBootstrapToken = generateBootstrapToken();
        writeTextFile(kTlsBootstrapTokenPath, gBootstrapToken + "\n");
        Serial.printf("[TLS] Generated bootstrap token: %s\n", gBootstrapToken.c_str());
    }

    return gBootstrapToken;
}

void loadTlsState() {
    if (gTlsStateLoaded) return;
    gTlsStateLoaded = true;

    if (!LittleFS.exists(kTlsStatePath)) {
        return;
    }

    File f = LittleFS.open(kTlsStatePath, "r");
    if (!f) return;

    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return;

    if (doc["enrollmentState"].is<const char*>()) {
        gTlsState.enrollmentState = doc["enrollmentState"].as<const char*>();
    }
    if (doc["mtlsRequired"].is<bool>()) {
        gTlsState.mtlsRequired = doc["mtlsRequired"].as<bool>();
    }
}

void saveTlsState() {
    ensureTlsDir();
    JsonDocument doc;
    doc["enrollmentState"] = gTlsState.enrollmentState;
    doc["mtlsRequired"] = gTlsState.mtlsRequired;

    File f = LittleFS.open(kTlsStatePath, "w");
    if (!f) return;
    serializeJson(doc, f);
    f.close();
}

bool isSessionValid(const String& sessionId) {
    if (gTlsState.sessionId.length() == 0) return false;
    if (gTlsState.sessionId != sessionId) return false;
    return millis() <= gTlsState.sessionExpiresAtMs;
}

bool isRequestFromHttpsProxy(AsyncWebServerRequest* request) {
    if (!request || !request->hasHeader("X-Forwarded-Proto")) return false;
    const AsyncWebHeader* h = request->getHeader("X-Forwarded-Proto");
    if (!h || !h->value().equalsIgnoreCase("https")) return false;
    if (!request->client()) return false;
    const IPAddress rip = request->client()->remoteIP();
    return rip[0] == 127 && rip[1] == 0 && rip[2] == 0 && rip[3] == 1;
}

bool enforceHttpsProxy(AsyncWebServerRequest* request) {
    if (isRequestFromHttpsProxy(request)) return true;
    request->send(403, "application/json", "{\"error\":\"https_required\"}");
    return false;
}

void noteAuthFailure() {
    if (gAuthFailureCount < 255) ++gAuthFailureCount;
    if (gAuthFailureCount >= kMaxAuthFailures) {
        gAuthLockUntilMs = millis() + kAuthLockMs;
        gAuthFailureCount = 0;
    }
}

bool isAuthTemporarilyLocked() {
    return gAuthLockUntilMs != 0 && millis() <= gAuthLockUntilMs;
}

bool hasPersistentTlsPair() {
    return LittleFS.exists("/tls/cert.pem") && LittleFS.exists("/tls/key.pem");
}

void handleJsonBody(
    AsyncWebServerRequest* request,
    uint8_t* data,
    size_t len,
    size_t index,
    size_t total,
    const std::function<void(AsyncWebServerRequest*, const String&)>& onComplete
) {
    String* body = reinterpret_cast<String*>(request->_tempObject);
    if (index == 0) {
        body = new String();
        body->reserve(total + 1);
        request->_tempObject = body;
    }
    if (!body) {
        request->send(500, "application/json", "{\"error\":\"body buffer allocation failed\"}");
        return;
    }

    for (size_t i = 0; i < len; ++i) {
        body->concat(static_cast<char>(data[i]));
    }

    if (index + len == total) {
        String payload = *body;
        delete body;
        request->_tempObject = nullptr;
        onComplete(request, payload);
    }
}

} // namespace

void registerHttpsTlsRoutes(AsyncWebServer& srv) {
    loadTlsState();
    loadOrCreateBootstrapToken();

    srv.on("/tls/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["httpsRunning"] = isHttpsRunning();
        doc["bundledFallback"] = isHttpsUsingBundledPair();
        doc["certPresent"]  = LittleFS.exists("/tls/cert.pem");
        doc["keyPresent"]   = LittleFS.exists("/tls/key.pem");
        doc["caPresent"]    = LittleFS.exists("/tls/ca.pem");
        doc["mtlsRequired"] = gTlsState.mtlsRequired;
        doc["enrollmentState"] = gTlsState.enrollmentState;
        doc["deviceId"] = getDeviceId();
        doc["hardware"] = "esp32";
        doc["contractVersion"] = "v1";
        doc["enrollmentHttpsRequired"] = true;
        doc["port"]         = 443;
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });

    srv.on("/tls/enroll/start", HTTP_POST,
        [](AsyncWebServerRequest* request) { (void)request; },
        nullptr,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!enforceHttpsProxy(request)) return;
            handleJsonBody(request, data, len, index, total,
                [](AsyncWebServerRequest* request, const String& payload) {
                    if (isAuthTemporarilyLocked()) {
                        request->send(429, "application/json", "{\"error\":\"auth_temporarily_locked\"}");
                        return;
                    }
                    if (gTlsState.enrollmentState == "enrolled" && hasPersistentTlsPair()) {
                        request->send(409, "application/json", "{\"error\":\"already_enrolled\"}");
                        return;
                    }

                    JsonDocument in;
                    if (deserializeJson(in, payload)) {
                        request->send(400, "application/json", "{\"error\":\"invalid_json\"}");
                        return;
                    }

                    String secret = in["bootstrapSecret"].as<String>();
                    if (secret != loadOrCreateBootstrapToken()) {
                        noteAuthFailure();
                        request->send(401, "application/json", "{\"error\":\"invalid_secret\"}");
                        return;
                    }

                    gTlsState.sessionId = makeSessionId();
                    gTlsState.sessionExpiresAtMs = millis() + kSessionTtlMs;
                    gTlsState.enrollmentState = "pending";
                    saveTlsState();

                    JsonDocument out;
                    out["sessionId"] = gTlsState.sessionId;
                    out["expiresInMs"] = kSessionTtlMs;
                    out["deviceId"] = getDeviceId();
                    out["hardware"] = "esp32";
                    out["mac"] = WiFi.macAddress();
                    String response;
                    serializeJson(out, response);
                    request->send(200, "application/json", response);
                }
            );
        }
    );

    srv.on("/tls/enroll/csr", HTTP_POST,
        [](AsyncWebServerRequest* request) { (void)request; },
        nullptr,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!enforceHttpsProxy(request)) return;
            handleJsonBody(request, data, len, index, total,
                [](AsyncWebServerRequest* request, const String& payload) {
                    JsonDocument in;
                    if (deserializeJson(in, payload)) {
                        request->send(400, "application/json", "{\"error\":\"invalid_json\"}");
                        return;
                    }

                    const String sessionId = in["sessionId"].as<String>();
                    if (!isSessionValid(sessionId)) {
                        request->send(401, "application/json", "{\"error\":\"invalid_or_expired_session\"}");
                        return;
                    }

                    request->send(501, "application/json", "{\"error\":\"csr_not_implemented\",\"message\":\"Provide cert/key via /tls/enroll/commit for now\"}");
                }
            );
        }
    );

    srv.on("/tls/enroll/commit", HTTP_POST,
        [](AsyncWebServerRequest* request) { (void)request; },
        nullptr,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (!enforceHttpsProxy(request)) return;
            handleJsonBody(request, data, len, index, total,
                [](AsyncWebServerRequest* request, const String& payload) {
                    JsonDocument in;
                    if (deserializeJson(in, payload)) {
                        request->send(400, "application/json", "{\"error\":\"invalid_json\"}");
                        return;
                    }

                    const String sessionId = in["sessionId"].as<String>();
                    if (!isSessionValid(sessionId)) {
                        request->send(401, "application/json", "{\"error\":\"invalid_or_expired_session\"}");
                        return;
                    }

                    const String certPem = in["certPem"].as<String>();
                    const String keyPem = in["keyPem"].as<String>();
                    const String caPem = in["caPem"].as<String>();
                    const bool requireMtls = in["requireMtls"].is<bool>() ? in["requireMtls"].as<bool>() : false;

                    if (certPem.length() == 0 || keyPem.length() == 0) {
                        request->send(400, "application/json", "{\"error\":\"missing_cert_or_key\"}");
                        return;
                    }

                    ensureTlsDir();
                    if (!writeTextFile("/tls/cert.pem", certPem) || !writeTextFile("/tls/key.pem", keyPem)) {
                        request->send(500, "application/json", "{\"error\":\"failed_to_write_tls_material\"}");
                        return;
                    }
                    if (caPem.length() > 0 && !writeTextFile("/tls/ca.pem", caPem)) {
                        request->send(500, "application/json", "{\"error\":\"failed_to_write_ca\"}");
                        return;
                    }

                    stopHttpsService();
                    const bool httpsOk = startHttpsService();

                    gTlsState.mtlsRequired = requireMtls;
                    gTlsState.enrollmentState = "enrolled";
                    gTlsState.sessionId = "";
                    gTlsState.sessionExpiresAtMs = 0;
                    saveTlsState();

                    JsonDocument out;
                    out["installed"] = true;
                    out["httpsRunning"] = httpsOk;
                    out["bundledFallback"] = isHttpsUsingBundledPair();
                    out["enrollmentState"] = gTlsState.enrollmentState;
                    String response;
                    serializeJson(out, response);
                    request->send(httpsOk ? 200 : 202, "application/json", response);
                }
            );
        }
    );

    // Legacy direct cert/key writes are disabled. Use /tls/enroll/commit.
    srv.on("/tls/cert", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(410, "application/json", "{\"error\":\"endpoint_disabled\",\"message\":\"use /tls/enroll/commit\"}");
    });

    srv.on("/tls/key", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(410, "application/json", "{\"error\":\"endpoint_disabled\",\"message\":\"use /tls/enroll/commit\"}");
    });

    Serial.println("[TLS] TLS management routes registered");
}

#endif // ENABLE_HTTPS && ESP32
