// ESP8266 TLS core lifecycle.
// Intentionally separate from ESP32 HTTPS runtime (esp_https_server based).
#if defined(ENABLE_HTTPS) && defined(ESP8266)

#include "https_service.h"
#include <LittleFS.h>
#include "tls_default_pair.h"

namespace {

bool sHttpsRunning = false;
bool sUsingBundledPair = false;

bool writeTextFile(const char* path, const char* content) {
    File f = LittleFS.open(path, "w");
    if (!f) return false;
    const size_t len = strlen(content);
    const size_t written = f.write(reinterpret_cast<const uint8_t*>(content), len);
    f.close();
    return written == len;
}

bool ensurePersistentTlsPair() {
    const bool certPresent = LittleFS.exists("/tls/cert.pem");
    const bool keyPresent = LittleFS.exists("/tls/key.pem");
    if (certPresent && keyPresent) {
        sUsingBundledPair = false;
        return true;
    }

    if (!LittleFS.exists("/tls")) {
        LittleFS.mkdir("/tls");
    }

    const bool certOk = writeTextFile("/tls/cert.pem", kDefaultTlsCertPem);
    const bool keyOk = writeTextFile("/tls/key.pem", kDefaultTlsKeyPem);
    if (certOk && keyOk) {
        sUsingBundledPair = true;
        Serial.println("[TLS-ESP8266] Installed bundled fallback cert/key to LittleFS");
        return true;
    }

    return false;
}

} // namespace

bool startHttpsService() {
    const bool pairReady = ensurePersistentTlsPair();
    if (!pairReady) {
        sHttpsRunning = false;
        Serial.println("[TLS-ESP8266] Failed to prepare TLS cert/key pair");
        return false;
    }

    // Runtime HTTPS listener is intentionally isolated from ESP32 implementation.
    // This ESP8266 path currently provisions cert/key only.
    sHttpsRunning = false;
    Serial.println("[TLS-ESP8266] TLS assets ready; HTTPS listener not enabled in ESP8266 build");
    return false;
}

void stopHttpsService() {
    sHttpsRunning = false;
}

bool isHttpsRunning() {
    return sHttpsRunning;
}

bool isHttpsUsingBundledPair() {
    return sUsingBundledPair;
}

#endif // ENABLE_HTTPS && ESP8266