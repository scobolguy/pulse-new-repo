#include "control_plane_commands.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

#include "NodeConfig.h"
#include "main_globals.h"
#include "udp_runtime.h"
#include "wifi_provisioning.h"

namespace {

constexpr size_t kMaxControlLineBytes = 1024;

bool persistNodeName(const String& requestedNodeName) {
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

void printResult(Stream& io, const char* channelTag, const char* status, const JsonDocument& doc) {
    String body;
    serializeJson(doc, body);
    io.print("[");
    io.print(channelTag);
    io.print("] ");
    io.print(status);
    io.print(" ");
    io.println(body);
}

void printLine(Stream& io, const char* channelTag, const String& message) {
    io.print("[");
    io.print(channelTag);
    io.print("] ");
    io.println(message);
}

bool decodeBase64Field(const String& encoded, String& decoded, size_t maxBytes) {
    if (encoded.isEmpty() || encoded.length() > 128 || maxBytes > 64) return false;
    uint8_t buffer[65] = {0};
    size_t outputLength = 0;
    uint32_t accumulator = 0;
    uint8_t bits = 0;
    for (size_t index = 0; index < encoded.length(); ++index) {
        const char ch = encoded.charAt(index);
        if (ch == '=') break;
        int8_t value = -1;
        if (ch >= 'A' && ch <= 'Z') value = ch - 'A';
        else if (ch >= 'a' && ch <= 'z') value = ch - 'a' + 26;
        else if (ch >= '0' && ch <= '9') value = ch - '0' + 52;
        else if (ch == '+') value = 62;
        else if (ch == '/') value = 63;
        else return false;

        accumulator = (accumulator << 6) | static_cast<uint8_t>(value);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            if (outputLength >= maxBytes) return false;
            buffer[outputLength++] = static_cast<uint8_t>((accumulator >> bits) & 0xFF);
        }
    }
    if (outputLength == 0) return false;
    buffer[outputLength] = 0;
    decoded = reinterpret_cast<const char*>(buffer);
    return true;
}

bool provisionWifiLowMemory(const String& arguments, Stream& io, const char* channelTag) {
    const int separator = arguments.indexOf(' ');
    if (separator <= 0) {
        printLine(io, channelTag, "Use: PROVISION_WIFI <ssid-base64> <password-base64>");
        return false;
    }

    String ssid;
    String password;
    if (!decodeBase64Field(arguments.substring(0, separator), ssid, 32)
        || !decodeBase64Field(arguments.substring(separator + 1), password, 64)) {
        printLine(io, channelTag, "invalid PROVISION_WIFI fields");
        return false;
    }

    WiFiCredentials creds;
    creds.ssid = ssid;
    creds.password = password;
    if (!globalWiFiProvisioning) {
        globalWiFiProvisioning = new WiFiProvisioning();
        globalWiFiProvisioning->begin(nodeName.c_str());
    }
    if (!globalWiFiProvisioning->replaceCredentials(creds)) {
        printLine(io, channelTag, "failed to save encrypted Wi-Fi profile");
        return false;
    }

    wifiConfig.ssid = creds.ssid;
    wifiConfig.password = creds.password;
    udpRuntimeConfigureWifiCredentials(creds.ssid, creds.password);
    printLine(io, channelTag, "saved {\"ok\":true,\"storedEncrypted\":true,\"connectRequested\":true}");

    if (!globalWiFiProvisioning->connectWiFi(&creds, 30)) {
        printLine(io, channelTag, "Wi-Fi connection failed after save");
        return false;
    }
    printLine(io, channelTag, String("Wi-Fi connected ") + WiFi.localIP().toString());
    printLine(io, channelTag, "rebooting");
    delay(500);
    ESP.restart();
    return true;
}

}  // namespace

bool controlPlaneHandleLine(const String& rawLine, Stream& io, const char* channelTag) {
    String line = rawLine;
    line.trim();
    if (line.isEmpty()) {
        return false;
    }

    if (line.equalsIgnoreCase("PING")) {
        printLine(io, channelTag, "pong");
        return true;
    }

    if (line.equalsIgnoreCase("STATUS")) {
        JsonDocument status;
        status["nodeName"] = nodeName;
        status["wifiConnected"] = WiFi.status() == WL_CONNECTED;
        status["ip"] = WiFi.localIP().toString();
        status["apMode"] = WiFi.getMode() == WIFI_AP || WiFi.getMode() == WIFI_AP_STA;
        printResult(io, channelTag, "status", status);
        return true;
    }

    if (line.startsWith("PROVISION_WIFI ")) {
        return provisionWifiLowMemory(line.substring(String("PROVISION_WIFI ").length()), io, channelTag);
    }

    if (!line.startsWith("PROVISION ")) {
        printLine(io, channelTag, "Use: PROVISION_WIFI <ssid-base64> <password-base64> or PROVISION {json}");
        return false;
    }

    const String jsonText = line.substring(String("PROVISION ").length());
    JsonDocument payload;
    const DeserializationError err = deserializeJson(payload, jsonText);
    if (err) {
        io.print("[");
        io.print(channelTag);
        io.print("] invalid JSON: ");
        io.println(err.c_str());
        return false;
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
        printLine(io, channelTag, "ssid is required");
        return false;
    }

    const String requestedNodeName = payload["nodeName"] | "";
    if (requestedNodeName.length() > 0 && !persistNodeName(requestedNodeName)) {
        printLine(io, channelTag, "invalid nodeName");
        return false;
    }
    if (creds.hostname.isEmpty() && requestedNodeName.length() > 0) {
        creds.hostname = nodeName;
    }

    if (!globalWiFiProvisioning) {
        globalWiFiProvisioning = new WiFiProvisioning();
        globalWiFiProvisioning->begin(nodeName.c_str());
    }

    const bool saved = globalWiFiProvisioning->replaceCredentials(creds);
    if (!saved) {
        printLine(io, channelTag, "failed to save encrypted Wi-Fi profile");
        return false;
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
    printResult(io, channelTag, "saved", response);

    const bool connectRequested = payload["connect"].is<bool>() ? payload["connect"].as<bool>() : true;
    if (!connectRequested) {
        return true;
    }

    const uint32_t timeoutSec = payload["timeoutSec"].is<uint32_t>() ? payload["timeoutSec"].as<uint32_t>() : 20;
    if (globalWiFiProvisioning->connectWiFi(&creds, timeoutSec)) {
        printLine(io, channelTag, "Wi-Fi connected");
        if (payload["reboot"].is<bool>() && payload["reboot"].as<bool>()) {
            printLine(io, channelTag, "rebooting");
            delay(500);
            ESP.restart();
        }
    } else {
        printLine(io, channelTag, "Wi-Fi connection failed after save");
    }

    return true;
}

void controlPlanePollStream(Stream& io, String& buffer, const char* channelTag) {
    while (io.available() > 0) {
        const char ch = static_cast<char>(io.read());

        if (ch == '\r') {
            continue;
        }

        if (ch == '\n') {
            const String line = buffer;
            buffer = "";
            controlPlaneHandleLine(line, io, channelTag);
            continue;
        }

        if (buffer.length() < kMaxControlLineBytes) {
            buffer += ch;
        } else {
            buffer = "";
            printLine(io, channelTag, "buffer overflow, input cleared");
        }
    }
}
