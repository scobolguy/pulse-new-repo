#include "serial_provisioning.h"

#include <ArduinoJson.h>
#include <LittleFS.h>
#include "NodeConfig.h"
#include "main_globals.h"
#include "udp_runtime.h"
#include "wifi_provisioning.h"

namespace {

String gSerialBuffer;

bool persistNodeNameFromSerial(const String& requestedNodeName) {
    String normalized = requestedNodeName;
    normalized.trim();
    if (normalized.isEmpty()) {
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
    return true;
}

void printSerialResult(const char* status, const JsonDocument& doc) {
    String body;
    serializeJson(doc, body);
    Serial.print("[SERIAL-PROV] ");
    Serial.print(status);
    Serial.print(" ");
    Serial.println(body);
}

}  // namespace

void serialProvisioningPoll() {
    while (Serial.available() > 0) {
        const char ch = static_cast<char>(Serial.read());
        if (ch == '\r') {
            continue;
        }
        if (ch == '\n') {
            String line = gSerialBuffer;
            gSerialBuffer = "";
            line.trim();
            if (line.isEmpty()) {
                continue;
            }

            if (line.equalsIgnoreCase("PING")) {
                Serial.println("[SERIAL-PROV] pong");
                continue;
            }

            if (line.equalsIgnoreCase("STATUS")) {
                JsonDocument status;
                status["nodeName"] = nodeName;
                status["wifiConnected"] = WiFi.status() == WL_CONNECTED;
                status["ip"] = WiFi.localIP().toString();
                status["apMode"] = WiFi.getMode() == WIFI_AP || WiFi.getMode() == WIFI_AP_STA;
                printSerialResult("status", status);
                continue;
            }

            if (!line.startsWith("PROVISION ")) {
                Serial.println("[SERIAL-PROV] Use: PROVISION {json}");
                continue;
            }

            String jsonText = line.substring(String("PROVISION ").length());
            JsonDocument payload;
            const DeserializationError err = deserializeJson(payload, jsonText);
            if (err) {
                Serial.print("[SERIAL-PROV] invalid JSON: ");
                Serial.println(err.c_str());
                continue;
            }

            WiFiCredentials creds;
            creds.ssid = payload["ssid"] | "";
            creds.password = payload["password"] | "";
            creds.authMode = payload["authMode"] | "wpa2-psk";
            creds.eapMethod = payload["eapMethod"] | "";
            creds.identity = payload["identity"] | "";
            creds.username = payload["username"] | "";
            creds.enterprisePassword = payload["enterprisePassword"] | "";
            creds.hostname = payload["hostname"] | "";
            creds.dhcp = payload["dhcp"].is<bool>() ? payload["dhcp"].as<bool>() : true;
            creds.staticIP = payload["staticIP"] | "";
            creds.gateway = payload["gateway"] | "";
            creds.subnet = payload["subnet"] | "";
            creds.dns1 = payload["dns1"] | "";
            creds.dns2 = payload["dns2"] | "";

            if (creds.ssid.isEmpty()) {
                Serial.println("[SERIAL-PROV] ssid is required");
                continue;
            }

            String requestedNodeName = payload["nodeName"] | "";
            if (requestedNodeName.length() > 0 && !persistNodeNameFromSerial(requestedNodeName)) {
                Serial.println("[SERIAL-PROV] invalid nodeName");
                continue;
            }
            if (creds.hostname.isEmpty() && requestedNodeName.length() > 0) {
                creds.hostname = nodeName;
            }

            if (!globalWiFiProvisioning) {
                globalWiFiProvisioning = new WiFiProvisioning();
                globalWiFiProvisioning->begin(nodeName.c_str());
            }

            const bool saved = globalWiFiProvisioning->addOrUpdateCredential(creds, 5);
            if (!saved) {
                Serial.println("[SERIAL-PROV] failed to save encrypted Wi-Fi profile");
                continue;
            }

            wifiConfig.ssid = creds.ssid;
            wifiConfig.password = creds.password;
            udpRuntimeConfigureWifiCredentials(creds.ssid, creds.password);

            JsonDocument response;
            response["ok"] = true;
            response["ssid"] = creds.ssid;
            response["authMode"] = creds.authMode;
            response["storedEncrypted"] = true;
            response["nodeName"] = nodeName;
            response["connectRequested"] = payload["connect"].is<bool>() ? payload["connect"].as<bool>() : true;
            printSerialResult("saved", response);

            if (payload["connect"].is<bool>() ? payload["connect"].as<bool>() : true) {
                const uint32_t timeoutSec = payload["timeoutSec"].is<uint32_t>() ? payload["timeoutSec"].as<uint32_t>() : 20;
                if (globalWiFiProvisioning->connectWiFi(&creds, timeoutSec)) {
                    Serial.println("[SERIAL-PROV] Wi-Fi connected");
                    if (payload["reboot"].is<bool>() && payload["reboot"].as<bool>()) {
                        Serial.println("[SERIAL-PROV] rebooting");
                        delay(500);
                        ESP.restart();
                    }
                } else {
                    Serial.println("[SERIAL-PROV] Wi-Fi connection failed after save");
                }
            }
            continue;
        }

        if (gSerialBuffer.length() < 1024) {
            gSerialBuffer += ch;
        } else {
            gSerialBuffer = "";
            Serial.println("[SERIAL-PROV] buffer overflow, input cleared");
        }
    }
}
