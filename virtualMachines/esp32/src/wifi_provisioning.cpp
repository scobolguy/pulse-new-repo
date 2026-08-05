#include "wifi_provisioning.h"

#include <ArduinoJson.h>
#include <FS.h>
#include <LittleFS.h>
#if defined(ESP32)
#include <Preferences.h>
#include <mbedtls/base64.h>
#include <mbedtls/gcm.h>
#endif
#include "config_types.h"
#include "main_globals.h"
#include "NodeConfig.h"

#if defined(ESP32)
#include <esp_wifi.h>
#if __has_include(<esp_wpa2.h>)
#include <esp_wpa2.h>
#endif
#endif

namespace {

const char* kCredsPath = "/wifi-credentials.json";
const char* kLegacyWifiConfigPath = "/wifi.json";
constexpr size_t kMaxStoredWifiProfiles = 5;
#if defined(ESP32)
constexpr size_t kCredentialKeySize = 32;
constexpr size_t kCredentialNonceSize = 12;
const char* kCredentialPrefsNamespace = "wifi-prov";
const char* kCredentialPrefsKey = "enc_key";
#endif

#if defined(ARDUINO_ARCH_ESP8266)
constexpr uint8_t kOpenWifiEncryption = ENC_TYPE_NONE;
#else
constexpr uint8_t kOpenWifiEncryption = WIFI_AUTH_OPEN;
#endif

bool tryGetParam(AsyncWebServerRequest* request, const char* key, String& value) {
    if (request->hasParam(key, true)) {
        value = request->getParam(key, true)->value();
        return true;
    }
    if (request->hasParam(key)) {
        value = request->getParam(key)->value();
        return true;
    }
    return false;
}

bool parseIpAddress(const String& raw, IPAddress& out) {
    if (raw.isEmpty()) {
        return false;
    }
    return out.fromString(raw);
}

bool parseBoolLike(const String& raw, bool defaultValue = false) {
    if (raw.isEmpty()) return defaultValue;
    return raw == "1" || raw.equalsIgnoreCase("true") || raw.equalsIgnoreCase("yes") || raw.equalsIgnoreCase("on");
}

#if defined(ESP32)
bool getCredentialKey(uint8_t key[kCredentialKeySize]) {
    Preferences prefs;
    if (!prefs.begin(kCredentialPrefsNamespace, false)) {
        return false;
    }

    const size_t storedLength = prefs.getBytesLength(kCredentialPrefsKey);
    if (storedLength == kCredentialKeySize) {
        const size_t read = prefs.getBytes(kCredentialPrefsKey, key, kCredentialKeySize);
        prefs.end();
        return read == kCredentialKeySize;
    }

    for (size_t i = 0; i < kCredentialKeySize; i += sizeof(uint32_t)) {
        const uint32_t r = esp_random();
        const size_t remaining = kCredentialKeySize - i;
        const size_t chunk = remaining < sizeof(uint32_t) ? remaining : sizeof(uint32_t);
        memcpy(key + i, &r, chunk);
    }

    const size_t written = prefs.putBytes(kCredentialPrefsKey, key, kCredentialKeySize);
    prefs.end();
    return written == kCredentialKeySize;
}

String base64Encode(const uint8_t* data, size_t length) {
    size_t outputLength = 0;
    mbedtls_base64_encode(nullptr, 0, &outputLength, data, length);
    std::vector<uint8_t> output(outputLength + 1, 0);
    if (mbedtls_base64_encode(output.data(), output.size(), &outputLength, data, length) != 0) {
        return String();
    }
    output[outputLength] = 0;
    return String(reinterpret_cast<const char*>(output.data()));
}

bool base64Decode(const String& encoded, std::vector<uint8_t>& output) {
    output.clear();
    if (encoded.isEmpty()) {
        return false;
    }
    size_t outputLength = 0;
    const int rc = mbedtls_base64_decode(nullptr, 0, &outputLength,
                                          reinterpret_cast<const unsigned char*>(encoded.c_str()), encoded.length());
    if (rc != 0 && rc != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) {
        return false;
    }
    output.resize(outputLength);
    if (mbedtls_base64_decode(output.data(), output.size(), &outputLength,
                              reinterpret_cast<const unsigned char*>(encoded.c_str()), encoded.length()) != 0) {
        output.clear();
        return false;
    }
    output.resize(outputLength);
    return true;
}

bool encryptCredentialPayload(const String& plaintext, JsonDocument& envelope) {
    uint8_t key[kCredentialKeySize];
    uint8_t nonce[kCredentialNonceSize];
    if (!getCredentialKey(key)) {
        return false;
    }

    for (size_t i = 0; i < kCredentialNonceSize; ++i) {
        nonce[i] = static_cast<uint8_t>(esp_random() & 0xFF);
    }

    mbedtls_gcm_context ctx;
    mbedtls_gcm_init(&ctx);
    bool ok = false;
    std::vector<uint8_t> ciphertext(plaintext.length());
    uint8_t tag[16];

    if (mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 256) == 0 &&
        mbedtls_gcm_crypt_and_tag(&ctx, MBEDTLS_GCM_ENCRYPT, plaintext.length(), nonce, kCredentialNonceSize,
                                   nullptr, 0,
                                   reinterpret_cast<const uint8_t*>(plaintext.c_str()), ciphertext.data(),
                                   sizeof(tag), tag) == 0) {
        envelope.clear();
        envelope["version"] = 3;
        envelope["cipher"] = "aes-256-gcm";
        envelope["nonce"] = base64Encode(nonce, sizeof(nonce));
        envelope["tag"] = base64Encode(tag, sizeof(tag));
        envelope["payload"] = base64Encode(ciphertext.data(), plaintext.length());
        ok = envelope["nonce"].as<String>().length() > 0 && envelope["tag"].as<String>().length() > 0 && envelope["payload"].as<String>().length() > 0;
    }

    mbedtls_gcm_free(&ctx);
    return ok;
}

bool decryptCredentialPayload(const JsonDocument& envelope, String& plaintext) {
    if (!envelope["payload"].is<const char*>() || !envelope["nonce"].is<const char*>() || !envelope["tag"].is<const char*>()) {
        return false;
    }

    std::vector<uint8_t> nonce;
    std::vector<uint8_t> tag;
    std::vector<uint8_t> ciphertext;
    if (!base64Decode(envelope["nonce"].as<String>(), nonce) || nonce.size() != kCredentialNonceSize) {
        return false;
    }
    if (!base64Decode(envelope["tag"].as<String>(), tag) || tag.size() != 16) {
        return false;
    }
    if (!base64Decode(envelope["payload"].as<String>(), ciphertext)) {
        return false;
    }

    uint8_t key[kCredentialKeySize];
    if (!getCredentialKey(key)) {
        return false;
    }

    std::vector<uint8_t> clear(ciphertext.size() + 1, 0);
    mbedtls_gcm_context ctx;
    mbedtls_gcm_init(&ctx);
    const int rc = mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 256);
    const int decRc = (rc == 0)
        ? mbedtls_gcm_auth_decrypt(&ctx, ciphertext.size(), nonce.data(), kCredentialNonceSize,
                                   nullptr, 0, tag.data(), tag.size(), ciphertext.data(), clear.data())
        : rc;
    mbedtls_gcm_free(&ctx);
    if (decRc != 0) {
        return false;
    }

    clear[ciphertext.size()] = 0;
    plaintext = reinterpret_cast<const char*>(clear.data());
    return true;
}
#endif

String normalizeAuthMode(const String& raw) {
    String mode = raw;
    mode.trim();
    mode.toLowerCase();
    if (mode.length() == 0) return "wpa2-psk";
    if (mode == "wpa2-enterprise" || mode == "enterprise" || mode == "wpa-eap") return "wpa2-enterprise";
    return "wpa2-psk";
}

bool isEnterpriseMode(const WiFiCredentials& creds) {
    return normalizeAuthMode(creds.authMode) == "wpa2-enterprise";
}

String effectiveEnterpriseSecret(const WiFiCredentials& creds) {
    if (!creds.enterprisePassword.isEmpty()) return creds.enterprisePassword;
    return creds.password;
}

void disableEnterpriseAuthIfEnabled() {
#if defined(ESP32)
    #if defined(WIFI_PROV_HAS_ESP_EAP_CLIENT)
    esp_wifi_sta_enterprise_disable();
    #elif defined(WIFI_PROV_HAS_ESP_WPA2_LEGACY)
    esp_wifi_sta_wpa2_ent_disable();
    #endif
#endif
}

bool configureEnterpriseAuth(const WiFiCredentials& creds) {
#if defined(ESP32)
    const String identity = creds.identity.length() ? creds.identity : creds.username;
    const String username = creds.username.length() ? creds.username : identity;
    const String password = effectiveEnterpriseSecret(creds);

    if (identity.isEmpty() || username.isEmpty() || password.isEmpty()) {
        Serial.println("[WIFI-PROV] Enterprise mode requires identity/username/password");
        return false;
    }

    disableEnterpriseAuthIfEnabled();

#if __has_include(<esp_wpa2.h>)
    esp_wifi_sta_wpa2_ent_set_identity(reinterpret_cast<const unsigned char*>(identity.c_str()), identity.length());
    esp_wifi_sta_wpa2_ent_set_username(reinterpret_cast<const unsigned char*>(username.c_str()), username.length());
    esp_wifi_sta_wpa2_ent_set_password(reinterpret_cast<const unsigned char*>(password.c_str()), password.length());
    const esp_err_t enableResult = esp_wifi_sta_wpa2_ent_enable();
    if (enableResult != ESP_OK) {
        Serial.printf("[WIFI-PROV] esp_wifi_sta_wpa2_ent_enable failed: %d\n", static_cast<int>(enableResult));
        return false;
    }
    return true;
#else
    Serial.println("[WIFI-PROV] Enterprise auth headers unavailable in this ESP32 build");
    return false;
#endif
#else
    (void)creds;
    Serial.println("[WIFI-PROV] Enterprise WiFi provisioning is not supported on this target");
    return false;
#endif
}

bool sameProfileKey(const WiFiCredentials& a, const WiFiCredentials& b) {
    if (a.ssid.equalsIgnoreCase(b.ssid)) {
        return true;
    }
    if (!a.hostname.isEmpty() && !b.hostname.isEmpty() && a.hostname.equalsIgnoreCase(b.hostname) && a.ssid.equalsIgnoreCase(b.ssid)) {
        return true;
    }
    return false;
}

void writeProfileJson(JsonObject profile, const WiFiCredentials& creds) {
    profile["ssid"] = creds.ssid;
    profile["password"] = creds.password;
    profile["authMode"] = normalizeAuthMode(creds.authMode);
    profile["eapMethod"] = creds.eapMethod;
    profile["identity"] = creds.identity;
    profile["username"] = creds.username;
    profile["enterprisePassword"] = creds.enterprisePassword;
    profile["hostname"] = creds.hostname;
    profile["dhcp"] = creds.dhcp;
    profile["staticIP"] = creds.staticIP;
    profile["gateway"] = creds.gateway;
    profile["subnet"] = creds.subnet;
    profile["dns1"] = creds.dns1;
    profile["dns2"] = creds.dns2;
}

bool readProfileJson(JsonVariantConst profile, WiFiCredentials& creds) {
    creds.ssid = profile["ssid"].as<String>();
    creds.password = profile["password"].as<String>();
    creds.authMode = normalizeAuthMode(profile["authMode"].as<String>());
    creds.eapMethod = profile["eapMethod"].as<String>();
    creds.identity = profile["identity"].as<String>();
    creds.username = profile["username"].as<String>();
    creds.enterprisePassword = profile["enterprisePassword"].as<String>();
    creds.hostname = profile["hostname"].as<String>();
    creds.dhcp = !profile["dhcp"].is<bool>() || profile["dhcp"].as<bool>();
    creds.staticIP = profile["staticIP"].as<String>();
    creds.gateway = profile["gateway"].as<String>();
    creds.subnet = profile["subnet"].as<String>();
    creds.dns1 = profile["dns1"].as<String>();
    creds.dns2 = profile["dns2"].as<String>();
    return !creds.ssid.isEmpty();
}

bool loadPlainOrEncryptedProfiles(JsonDocument& doc, JsonDocument& plaintextDoc) {
#if defined(ESP32)
    if (doc["payload"].is<const char*>() && doc["nonce"].is<const char*>() && doc["tag"].is<const char*>()) {
        String plaintext;
        if (!decryptCredentialPayload(doc, plaintext)) {
            return false;
        }
        const DeserializationError err = deserializeJson(plaintextDoc, plaintext);
        return !err;
    }
#endif
    String serialized;
    serializeJson(doc, serialized);
    const DeserializationError err = deserializeJson(plaintextDoc, serialized);
    return !err;
}

String normalizeNodeName(const String& raw) {
    String out = raw;
    out.trim();
    if (out.length() == 0) return out;

    String cleaned;
    cleaned.reserve(out.length());
    for (size_t i = 0; i < out.length(); ++i) {
        const char c = out.charAt(i);
        const bool alphaNum = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
        const bool safePunct = (c == '-') || (c == '_') || (c == '.');
        if (alphaNum || safePunct) {
            cleaned += c;
        }
    }
    if (cleaned.length() > 32) {
        cleaned.remove(32);
    }
    return cleaned;
}

bool persistNodeName(const String& requested, String* appliedOut = nullptr) {
    const String normalized = normalizeNodeName(requested);
    if (normalized.length() == 0) {
        return false;
    }

    nodeName = normalized;

    File f = LittleFS.open(NODE_NAME_PATH, "w");
    if (!f) {
        return false;
    }
    f.print(nodeName);
    f.close();

    if (!loadNodeConfig(nodeConfig)) {
        nodeConfig = NodeConfig();
    }
    nodeConfig.nodeName = nodeName;
    saveNodeConfig(nodeConfig);

#if defined(ESP32)
    WiFi.setHostname(nodeName.c_str());
#elif defined(ESP8266)
    WiFi.hostname(nodeName.c_str());
#endif

    if (appliedOut) {
        *appliedOut = nodeName;
    }
    return true;
}

}  // namespace

WiFiProvisioning* globalWiFiProvisioning = nullptr;

void registerWiFiProvisioningRoutes(AsyncWebServer& server) {
    server.on("/api/wifi/scan", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!globalWiFiProvisioning) {
            globalWiFiProvisioning = new WiFiProvisioning();
            globalWiFiProvisioning->begin("ESP32-Device");
        }

        const bool scanOk = globalWiFiProvisioning->startWiFiScanner();

        JsonDocument doc;
        doc["ok"] = scanOk;
        doc["method"] = "wifi_scanner";

        JsonArray arr = doc["networks"].to<JsonArray>();
        if (scanOk) {
            int count = WiFi.scanComplete();
            if (count < 0) {
                count = WiFi.scanNetworks();
            }
            if (count > 0) {
                for (int i = 0; i < count; ++i) {
                    const String ssid = WiFi.SSID(i);
                    if (ssid.isEmpty()) {
                        continue;
                    }
                    JsonObject n = arr.add<JsonObject>();
                    n["ssid"] = ssid;
                    n["rssi"] = WiFi.RSSI(i);
                    n["channel"] = WiFi.channel(i);
                    n["secure"] = (WiFi.encryptionType(i) != kOpenWifiEncryption);
                }
            }
            WiFi.scanDelete();
        }

        doc["count"] = static_cast<uint32_t>(arr.size());
        String body;
        serializeJson(doc, body);
        request->send(scanOk ? 200 : 500, "application/json", body);
    });

    server.on("/api/wifi/provision", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!globalWiFiProvisioning) {
            globalWiFiProvisioning = new WiFiProvisioning();
            globalWiFiProvisioning->begin("ESP32-Device");
        }

        WiFiCredentials creds;
        String requestedNodeName;
        String rebootAfterSaveRaw;

        tryGetParam(request, "ssid", creds.ssid);
        tryGetParam(request, "password", creds.password);
        tryGetParam(request, "authMode", creds.authMode);
        tryGetParam(request, "eapMethod", creds.eapMethod);
        tryGetParam(request, "identity", creds.identity);
        tryGetParam(request, "username", creds.username);
        tryGetParam(request, "enterprisePassword", creds.enterprisePassword);
        tryGetParam(request, "hostname", creds.hostname);
        tryGetParam(request, "nodeName", requestedNodeName);
        tryGetParam(request, "reboot", rebootAfterSaveRaw);

        creds.authMode = normalizeAuthMode(creds.authMode);

        if (isEnterpriseMode(creds) && creds.enterprisePassword.isEmpty()) {
            creds.enterprisePassword = creds.password;
        }

        String dhcpValue;
        const bool hasDhcp = tryGetParam(request, "dhcp", dhcpValue);
        creds.dhcp = !hasDhcp || parseBoolLike(dhcpValue, true);

        if (!creds.dhcp) {
            tryGetParam(request, "staticIP", creds.staticIP);
            tryGetParam(request, "gateway", creds.gateway);
            tryGetParam(request, "subnet", creds.subnet);
            tryGetParam(request, "dns1", creds.dns1);
            tryGetParam(request, "dns2", creds.dns2);
        }

        if (creds.ssid.isEmpty()) {
            request->send(400, "application/json", "{\"error\":\"ssid is required\"}");
            return;
        }

        String appliedNodeName;
        if (!requestedNodeName.isEmpty()) {
            if (!persistNodeName(requestedNodeName, &appliedNodeName)) {
                request->send(400, "application/json", "{\"error\":\"invalid nodeName\"}");
                return;
            }
            if (creds.hostname.isEmpty()) {
                creds.hostname = appliedNodeName;
            }
        }

        if (!globalWiFiProvisioning->addOrUpdateCredential(creds, kMaxStoredWifiProfiles)) {
            request->send(500, "application/json", "{\"error\":\"failed to save WiFi credentials\"}");
            return;
        }

        globalWiFiProvisioning->eraseLegacyCredentialStores();

        std::vector<WiFiCredentials> profiles;
        globalWiFiProvisioning->loadCredentialsList(profiles);

        JsonDocument doc;
        doc["ok"] = true;
        doc["ssid"] = creds.ssid;
        doc["authMode"] = creds.authMode;
        doc["eapMethod"] = creds.eapMethod;
        doc["identity"] = creds.identity;
        doc["username"] = creds.username;
        doc["hostname"] = creds.hostname;
        doc["nodeName"] = appliedNodeName.length() ? appliedNodeName : nodeName;
        doc["saved"] = true;
        doc["profilesStored"] = static_cast<uint32_t>(profiles.size());
        doc["rebooting"] = parseBoolLike(rebootAfterSaveRaw, false);
        String body;
        serializeJson(doc, body);
        request->send(200, "application/json", body);

        if (parseBoolLike(rebootAfterSaveRaw, false)) {
            delay(150);
            ESP.restart();
        }
    });

    server.on("/api/wifi/profiles", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!globalWiFiProvisioning) {
            globalWiFiProvisioning = new WiFiProvisioning();
            globalWiFiProvisioning->begin("ESP32-Device");
        }

        std::vector<WiFiCredentials> profiles;
        globalWiFiProvisioning->loadCredentialsList(profiles);

        JsonDocument doc;
        doc["ok"] = true;
        doc["count"] = static_cast<uint32_t>(profiles.size());
        JsonArray arr = doc["profiles"].to<JsonArray>();
        for (const auto& p : profiles) {
            JsonObject o = arr.add<JsonObject>();
            o["ssid"] = p.ssid;
            o["hostname"] = p.hostname;
            o["authMode"] = normalizeAuthMode(p.authMode);
            o["eapMethod"] = p.eapMethod;
            o["identity"] = p.identity;
            o["username"] = p.username;
            o["dhcp"] = p.dhcp;
            o["hasPassword"] = p.password.length() > 0;
            o["hasEnterprisePassword"] = effectiveEnterpriseSecret(p).length() > 0;
            o["staticIP"] = p.staticIP;
        }
        String body;
        serializeJson(doc, body);
        request->send(200, "application/json", body);
    });

    server.on("/api/wifi/profiles", HTTP_DELETE, [](AsyncWebServerRequest* request) {
        if (!globalWiFiProvisioning) {
            globalWiFiProvisioning = new WiFiProvisioning();
            globalWiFiProvisioning->begin("ESP32-Device");
        }

        const bool removed = globalWiFiProvisioning->clearCredentials();
        WiFi.disconnect(true, true);

        JsonDocument doc;
        doc["ok"] = removed;
        doc["cleared"] = removed;
        doc["status"] = removed ? "wifi_profiles_cleared" : "clear_failed";
        String body;
        serializeJson(doc, body);
        request->send(removed ? 200 : 500, "application/json", body);
    });
}

WiFiProvisioning::WiFiProvisioning()
    : provMethod(PROV_NONE),
      dnsServer(nullptr),
      portalServer(nullptr),
      portalActive(false),
      credsReceived(false),
      portalStartTime(0),
      portalTimeout(0),
      provButtonPin(-1),
      provButtonActiveLevel(LOW),
      provButtonEnabled(false) {}

WiFiProvisioning::~WiFiProvisioning() {
    stopCaptivePortal();
}

bool WiFiProvisioning::begin(const char* name) {
    deviceName = name ? name : "ESP32-Device";
#if defined(ARDUINO_ARCH_ESP8266)
    if (!LittleFS.begin()) {
#else
    if (!LittleFS.begin(true)) {
#endif
        Serial.println("[WIFI-PROV] LittleFS mount failed");
        return false;
    }
    return true;
}

bool WiFiProvisioning::hasStoredCredentials() {
    return LittleFS.exists(kCredsPath);
}

bool WiFiProvisioning::loadCredentials(WiFiCredentials& creds) {
    std::vector<WiFiCredentials> credsList;
    if (!loadCredentialsList(credsList) || credsList.empty()) {
        return false;
    }
    creds = credsList.front();
    return true;
}

bool WiFiProvisioning::saveCredentials(const WiFiCredentials& creds) {
    return addOrUpdateCredential(creds, kMaxStoredWifiProfiles);
}

bool WiFiProvisioning::loadCredentialsList(std::vector<WiFiCredentials>& credsList) {
    credsList.clear();
    if (!hasStoredCredentials()) {
        return false;
    }

    File f = LittleFS.open(kCredsPath, "r");
    if (!f) {
        Serial.println("[WIFI-PROV] Failed to open credentials file");
        return false;
    }

    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        Serial.println("[WIFI-PROV] Failed to parse credentials JSON");
        return false;
    }

    JsonDocument plaintextDoc;
    if (!loadPlainOrEncryptedProfiles(doc, plaintextDoc)) {
        Serial.println("[WIFI-PROV] Failed to decrypt credentials JSON");
        return false;
    }

    if (plaintextDoc["networks"].is<JsonArray>()) {
        for (JsonVariantConst item : plaintextDoc["networks"].as<JsonArray>()) {
            WiFiCredentials profile;
            if (readProfileJson(item, profile)) {
                credsList.push_back(profile);
                if (credsList.size() >= kMaxStoredWifiProfiles) {
                    break;
                }
            }
        }
    } else {
        // Backward compatibility: single profile object.
        WiFiCredentials profile;
        if (readProfileJson(doc.as<JsonObjectConst>(), profile)) {
            credsList.push_back(profile);
        }
    }

    return !credsList.empty();
}

bool WiFiProvisioning::saveCredentialsList(const std::vector<WiFiCredentials>& credsList) {
    if (credsList.empty()) {
        return false;
    }

    JsonDocument doc;
    doc["version"] = 2;
    JsonArray arr = doc["networks"].to<JsonArray>();
    size_t count = 0;
    for (const auto& creds : credsList) {
        if (creds.ssid.isEmpty()) continue;
        JsonObject entry = arr.add<JsonObject>();
        writeProfileJson(entry, creds);
        ++count;
        if (count >= kMaxStoredWifiProfiles) break;
    }

    if (arr.size() == 0) {
        return false;
    }

    String plaintext;
    serializeJson(doc, plaintext);

#if defined(ESP32)
    JsonDocument envelope;
    if (!encryptCredentialPayload(plaintext, envelope)) {
        Serial.println("[WIFI-PROV] Failed to encrypt credentials JSON");
        return false;
    }

    envelope["schema"] = "wifi-credentials";

    String body;
    serializeJson(envelope, body);

    File f = LittleFS.open(kCredsPath, "w");
    if (!f) {
        Serial.println("[WIFI-PROV] Failed to open credentials file for write");
        return false;
    }

    f.print(body);
    f.close();
    return true;
#else
    File f = LittleFS.open(kCredsPath, "w");
    if (!f) {
        Serial.println("[WIFI-PROV] Failed to open credentials file for write");
        return false;
    }

    serializeJson(doc, f);
    f.close();
    return true;
#endif
}

bool WiFiProvisioning::addOrUpdateCredential(const WiFiCredentials& creds, size_t maxProfiles) {
    if (creds.ssid.isEmpty()) {
        return false;
    }

    std::vector<WiFiCredentials> existing;
    loadCredentialsList(existing);

    std::vector<WiFiCredentials> next;
    next.reserve(maxProfiles > 0 ? maxProfiles : kMaxStoredWifiProfiles);
    next.push_back(creds);

    for (const auto& item : existing) {
        if (sameProfileKey(item, creds)) {
            continue;
        }
        next.push_back(item);
        if (next.size() >= (maxProfiles > 0 ? maxProfiles : kMaxStoredWifiProfiles)) {
            break;
        }
    }

    return saveCredentialsList(next);
}

bool WiFiProvisioning::clearCredentials() {
    bool ok = true;
    if (LittleFS.exists(kCredsPath)) {
        ok = LittleFS.remove(kCredsPath) && ok;
    }
    ok = eraseLegacyCredentialStores() && ok;
    return ok;
}

bool WiFiProvisioning::eraseLegacyCredentialStores() {
    bool ok = true;
    if (LittleFS.exists(kLegacyWifiConfigPath)) {
        ok = LittleFS.remove(kLegacyWifiConfigPath) && ok;
    }
    return ok;
}

bool WiFiProvisioning::startCaptivePortal(uint32_t timeout) {
    provMethod = PROV_CAPTIVE_PORTAL;
    credsReceived = false;
    portalTimeout = timeout;
    portalStartTime = millis();

    WiFi.mode(WIFI_AP_STA);

    String ssidBase = deviceName.length() ? deviceName : String("ESP32");
    ssidBase.replace(" ", "-");
    String apName = String("Pulse-") + ssidBase + "-Provision";
    if (apName.length() > 31) {
        apName = apName.substring(0, 31);
    }
    WiFi.softAP(apName.c_str());

    setupCaptivePortal();
    Serial.printf("[WIFI-PROV] Captive portal started. AP: %s\n", apName.c_str());

    while (!credsReceived) {
        update();
        if (portalTimeout > 0 && (millis() - portalStartTime) > portalTimeout * 1000UL) {
            Serial.println("[WIFI-PROV] Captive portal timeout reached");
            break;
        }
        delay(20);
    }

    stopCaptivePortal();
    WiFi.softAPdisconnect(true);

    if (!credsReceived) {
        return false;
    }

    saveCredentials(currentCreds);
    return connectWiFi(&currentCreds);
}

bool WiFiProvisioning::startBLEProvisioning(uint32_t timeout) {
    (void)timeout;
    provMethod = PROV_BLE;
    Serial.println("[WIFI-PROV] BLE provisioning is not implemented yet");
    return false;
}

bool WiFiProvisioning::startWiFiScanner(uint32_t timeout) {
    (void)timeout;
    provMethod = PROV_WIFI_SCANNER;
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(false, false);
    delay(100);
    const int count = WiFi.scanNetworks();
    if (count < 0) {
        Serial.println("[WIFI-PROV] WiFi scan failed");
        return false;
    }
    Serial.printf("[WIFI-PROV] WiFi scan complete. Networks: %d\n", count);
    return true;
}

bool WiFiProvisioning::startWPSProvisioning(uint32_t timeout) {
    (void)timeout;
    provMethod = PROV_WPS;
    Serial.println("[WIFI-PROV] WPS provisioning is not implemented yet");
    return false;
}

bool WiFiProvisioning::connectWiFi(const WiFiCredentials* creds, uint32_t timeout) {
    std::vector<WiFiCredentials> candidates;
    if (creds) {
        candidates.push_back(*creds);
    } else if (!loadCredentialsList(candidates) || candidates.empty()) {
        Serial.println("[WIFI-PROV] No credentials available for WiFi connect");
        return false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);

    for (size_t i = 0; i < candidates.size(); ++i) {
        WiFiCredentials profile = candidates[i];
        if (profile.ssid.isEmpty()) {
            continue;
        }

        currentCreds = profile;
        if (!currentCreds.hostname.isEmpty()) {
#if defined(ARDUINO_ARCH_ESP8266)
            WiFi.hostname(currentCreds.hostname.c_str());
#else
            WiFi.setHostname(currentCreds.hostname.c_str());
#endif
        }

        if (!currentCreds.dhcp) {
            configureStaticIP(currentCreds);
        }

        Serial.printf("[WIFI-PROV] Connecting to SSID (%u/%u): %s\n",
                      static_cast<unsigned>(i + 1),
                      static_cast<unsigned>(candidates.size()),
                      currentCreds.ssid.c_str());

        const bool enterpriseMode = isEnterpriseMode(currentCreds);
        if (enterpriseMode) {
            if (!configureEnterpriseAuth(currentCreds)) {
                Serial.println("[WIFI-PROV] Enterprise auth setup failed; skipping profile");
                continue;
            }
        } else {
            disableEnterpriseAuthIfEnabled();
        }

        WiFi.disconnect();
        delay(50);
        if (enterpriseMode) {
            WiFi.begin(currentCreds.ssid.c_str());
        } else if (currentCreds.password.length() > 0) {
            WiFi.begin(currentCreds.ssid.c_str(), currentCreds.password.c_str());
        } else {
            WiFi.begin(currentCreds.ssid.c_str());
        }

        const unsigned long startMs = millis();
        while (WiFi.status() != WL_CONNECTED) {
            if ((millis() - startMs) > timeout * 1000UL) {
                Serial.println("[WIFI-PROV] WiFi connection timeout for profile");
                break;
            }
            delay(250);
        }

        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("[WIFI-PROV] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
            if (!creds && i > 0) {
                addOrUpdateCredential(currentCreds, kMaxStoredWifiProfiles);
            }
            return true;
        }
    }

    return false;
}

bool WiFiProvisioning::autoProvision() {
    if (hasStoredCredentials() && connectWiFi(nullptr)) {
        provMethod = PROV_STORED;
        return true;
    }

    return startCaptivePortal();
}

bool WiFiProvisioning::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

String WiFiProvisioning::getStatus() {
    switch (WiFi.status()) {
        case WL_CONNECTED:
            return "connected";
        case WL_NO_SSID_AVAIL:
            return "ssid_not_found";
        case WL_CONNECT_FAILED:
            return "connect_failed";
        case WL_CONNECTION_LOST:
            return "connection_lost";
        case WL_DISCONNECTED:
            return "disconnected";
        default:
            return "idle";
    }
}

void WiFiProvisioning::setProvisionButton(int pin, int activeLevel) {
    provButtonPin = pin;
    provButtonActiveLevel = activeLevel;
    provButtonEnabled = (pin >= 0);
    if (provButtonEnabled) {
        pinMode(pin, INPUT_PULLUP);
    }
}

bool WiFiProvisioning::isProvisionButtonPressed() {
    if (!provButtonEnabled) {
        return false;
    }
    return digitalRead(provButtonPin) == provButtonActiveLevel;
}

void WiFiProvisioning::update() {
    if (portalActive && dnsServer) {
        dnsServer->processNextRequest();
    }
}

void WiFiProvisioning::setupCaptivePortal() {
    if (portalActive) {
        return;
    }

    if (!dnsServer) {
        dnsServer = new DNSServer();
    }
    if (!portalServer) {
        portalServer = new AsyncWebServer(80);
    }

    dnsServer->start(53, "*", WiFi.softAPIP());

    portalServer->on("/", HTTP_GET, [this](AsyncWebServerRequest* request) { handlePortalRoot(request); });
    portalServer->on("/scan", HTTP_GET, [this](AsyncWebServerRequest* request) { handlePortalScan(request); });
    portalServer->on("/save", HTTP_POST, [this](AsyncWebServerRequest* request) { handlePortalSave(request); });
    portalServer->onNotFound([this](AsyncWebServerRequest* request) { handlePortalRoot(request); });

    portalServer->begin();
    portalActive = true;
}

void WiFiProvisioning::stopCaptivePortal() {
    if (!portalActive) {
        return;
    }

    if (portalServer) {
        portalServer->end();
        delete portalServer;
        portalServer = nullptr;
    }
    if (dnsServer) {
        dnsServer->stop();
        delete dnsServer;
        dnsServer = nullptr;
    }

    portalActive = false;
}

String WiFiProvisioning::generatePortalHTML() {
    String html;
    html.reserve(3500);
    html += "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>WiFi Setup</title><style>body{font-family:Arial,sans-serif;max-width:520px;margin:24px auto;padding:0 12px;}";
    html += "label{display:block;margin:10px 0 4px;}input,select,button{width:100%;padding:10px;font-size:16px;}";
    html += ".row{display:flex;gap:8px}.row>*{flex:1}button{cursor:pointer}small{color:#555}</style></head><body>";
    html += "<h2>WiFi Provisioning</h2><p>Select a network using WiFi Scanner or enter manually.</p>";
    html += "<div class='row'><button type='button' onclick='scanNetworks()'>WiFi Scanner</button><button type='button' onclick='manual()'>Manual Entry</button></div>";
    html += "<label for='ssidList'>Detected Networks</label><select id='ssidList'><option value=''>Scan to load networks</option></select>";
    html += "<small id='scanStatus'>No scan started.</small>";
    html += "<form method='POST' action='/save'>";
    html += "<label for='ssid'>SSID</label><input id='ssid' name='ssid' required>";
    html += "<label for='password'>Password</label><input id='password' name='password' type='password'>";
    html += "<label for='nodeName'>Node Name (optional)</label><input id='nodeName' name='nodeName' placeholder='esp32-lab-01'>";
    html += "<label for='hostname'>Hostname (optional)</label><input id='hostname' name='hostname' placeholder='ESP32-Device'>";
    html += "<label><input type='checkbox' id='dhcp' name='dhcp' checked onchange='toggleIp()'> Use DHCP</label>";
    html += "<div id='staticFields' style='display:none'>";
    html += "<label>Static IP</label><input name='staticIP' placeholder='192.168.1.50'>";
    html += "<label>Gateway</label><input name='gateway' placeholder='192.168.1.1'>";
    html += "<label>Subnet</label><input name='subnet' placeholder='255.255.255.0'>";
    html += "<label>DNS1</label><input name='dns1' placeholder='8.8.8.8'>";
    html += "<label>DNS2</label><input name='dns2' placeholder='1.1.1.1'>";
    html += "</div><br><button type='submit'>Save and Connect</button></form>";
    html += "<script>";
    html += "function toggleIp(){document.getElementById('staticFields').style.display=document.getElementById('dhcp').checked?'none':'block';}";
    html += "function manual(){document.getElementById('ssid').focus();}";
    html += "function setStatus(t){document.getElementById('scanStatus').innerText=t;}";
    html += "async function scanNetworks(){setStatus('Scanning...');try{const r=await fetch('/scan');const d=await r.json();const s=document.getElementById('ssidList');";
    html += "s.innerHTML='';if(!d.networks||d.networks.length===0){s.innerHTML='<option value="">No networks found</option>';setStatus('No networks found');return;}";
    html += "for(const n of d.networks){const o=document.createElement('option');o.value=n.ssid;o.text=n.ssid+' ('+n.rssi+' dBm)';s.appendChild(o);}setStatus('Found '+d.networks.length+' network(s)');";
    html += "if(s.options.length>0){document.getElementById('ssid').value=s.options[0].value;}}catch(e){setStatus('Scan failed');}}";
    html += "document.getElementById('ssidList').addEventListener('change',e=>{document.getElementById('ssid').value=e.target.value;});";
    html += "</script></body></html>";
    return html;
}

void WiFiProvisioning::handlePortalRoot(AsyncWebServerRequest* request) {
    request->send(200, "text/html", generatePortalHTML());
}

void WiFiProvisioning::handlePortalSave(AsyncWebServerRequest* request) {
    WiFiCredentials creds;

    tryGetParam(request, "ssid", creds.ssid);
    tryGetParam(request, "password", creds.password);
    tryGetParam(request, "hostname", creds.hostname);

    String requestedNodeName;
    tryGetParam(request, "nodeName", requestedNodeName);
    if (!requestedNodeName.isEmpty()) {
        String appliedNodeName;
        if (!persistNodeName(requestedNodeName, &appliedNodeName)) {
            request->send(400, "text/plain", "Node Name is invalid");
            return;
        }
        if (creds.hostname.isEmpty()) {
            creds.hostname = appliedNodeName;
        }
    }

    String dhcpValue;
    const bool hasDhcp = tryGetParam(request, "dhcp", dhcpValue);
    creds.dhcp = hasDhcp;

    if (!creds.dhcp) {
        tryGetParam(request, "staticIP", creds.staticIP);
        tryGetParam(request, "gateway", creds.gateway);
        tryGetParam(request, "subnet", creds.subnet);
        tryGetParam(request, "dns1", creds.dns1);
        tryGetParam(request, "dns2", creds.dns2);
    }

    if (creds.ssid.isEmpty()) {
        request->send(400, "text/plain", "SSID is required");
        return;
    }

    currentCreds = creds;
    credsReceived = true;

    request->send(200, "text/html",
                  "<html><body><h3>Saved</h3><p>Credentials saved. Device will now connect.</p></body></html>");
}

void WiFiProvisioning::handlePortalScan(AsyncWebServerRequest* request) {
    // Scanner mode is explicit for telemetry and behavior tracking.
    provMethod = PROV_WIFI_SCANNER;

    WiFi.mode(WIFI_AP_STA);
    WiFi.disconnect(false, false);
    delay(100);

    const int count = WiFi.scanNetworks();
    JsonDocument doc;
    JsonArray arr = doc["networks"].to<JsonArray>();

    if (count > 0) {
        for (int i = 0; i < count; ++i) {
            const String ssid = WiFi.SSID(i);
            if (ssid.isEmpty()) {
                continue;
            }
            JsonObject n = arr.add<JsonObject>();
            n["ssid"] = ssid;
            n["rssi"] = WiFi.RSSI(i);
            n["channel"] = WiFi.channel(i);
            n["secure"] = (WiFi.encryptionType(i) != kOpenWifiEncryption);
        }
    }

    doc["count"] = static_cast<uint32_t>(arr.size());
    String body;
    serializeJson(doc, body);
    request->send(200, "application/json", body);
    WiFi.scanDelete();
}

bool WiFiProvisioning::configureStaticIP(const WiFiCredentials& creds) {
    if (creds.staticIP.isEmpty() || creds.gateway.isEmpty() || creds.subnet.isEmpty()) {
        Serial.println("[WIFI-PROV] Static IP requested but required fields missing; falling back to DHCP");
        return false;
    }

    IPAddress ip;
    IPAddress gateway;
    IPAddress subnet;
    IPAddress dns1;
    IPAddress dns2;

    if (!parseIpAddress(creds.staticIP, ip) || !parseIpAddress(creds.gateway, gateway) ||
        !parseIpAddress(creds.subnet, subnet)) {
        Serial.println("[WIFI-PROV] Invalid static IP configuration; falling back to DHCP");
        return false;
    }

    const bool hasDns1 = parseIpAddress(creds.dns1, dns1);
    const bool hasDns2 = parseIpAddress(creds.dns2, dns2);

    if (hasDns1 && hasDns2) {
        return WiFi.config(ip, gateway, subnet, dns1, dns2);
    }
    if (hasDns1) {
        return WiFi.config(ip, gateway, subnet, dns1);
    }
    return WiFi.config(ip, gateway, subnet);
}

void initializeWiFiProvisioning(const char* deviceName) {
    if (!globalWiFiProvisioning) {
        globalWiFiProvisioning = new WiFiProvisioning();
    }
    globalWiFiProvisioning->begin(deviceName);
}
