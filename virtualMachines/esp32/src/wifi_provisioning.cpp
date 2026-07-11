#include "wifi_provisioning.h"

#include <ArduinoJson.h>
#include <FS.h>
#include <LittleFS.h>

namespace {

const char* kCredsPath = "/wifi-credentials.json";

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

    creds.ssid = doc["ssid"].as<String>();
    creds.password = doc["password"].as<String>();
    creds.hostname = doc["hostname"].as<String>();
    creds.dhcp = !doc["dhcp"].is<bool>() || doc["dhcp"].as<bool>();
    creds.staticIP = doc["staticIP"].as<String>();
    creds.gateway = doc["gateway"].as<String>();
    creds.subnet = doc["subnet"].as<String>();
    creds.dns1 = doc["dns1"].as<String>();
    creds.dns2 = doc["dns2"].as<String>();

    if (creds.ssid.isEmpty()) {
        return false;
    }

    return true;
}

bool WiFiProvisioning::saveCredentials(const WiFiCredentials& creds) {
    if (creds.ssid.isEmpty()) {
        return false;
    }

    JsonDocument doc;
    doc["ssid"] = creds.ssid;
    doc["password"] = creds.password;
    doc["hostname"] = creds.hostname;
    doc["dhcp"] = creds.dhcp;
    doc["staticIP"] = creds.staticIP;
    doc["gateway"] = creds.gateway;
    doc["subnet"] = creds.subnet;
    doc["dns1"] = creds.dns1;
    doc["dns2"] = creds.dns2;

    File f = LittleFS.open(kCredsPath, "w");
    if (!f) {
        Serial.println("[WIFI-PROV] Failed to open credentials file for write");
        return false;
    }

    serializeJson(doc, f);
    f.close();
    return true;
}

bool WiFiProvisioning::clearCredentials() {
    if (!LittleFS.exists(kCredsPath)) {
        return true;
    }
    return LittleFS.remove(kCredsPath);
}

bool WiFiProvisioning::startCaptivePortal(uint32_t timeout) {
    provMethod = PROV_CAPTIVE_PORTAL;
    credsReceived = false;
    portalTimeout = timeout;
    portalStartTime = millis();

    WiFi.mode(WIFI_AP_STA);

    const String apName = deviceName.length() ? (deviceName + "-Setup") : String("ESP32-Setup");
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
    WiFiCredentials local;
    const WiFiCredentials* selected = creds;
    if (!selected) {
        if (!loadCredentials(local)) {
            Serial.println("[WIFI-PROV] No credentials available for WiFi connect");
            return false;
        }
        selected = &local;
    }

    if (selected->ssid.isEmpty()) {
        return false;
    }

    currentCreds = *selected;
    WiFi.mode(WIFI_STA);

    if (!currentCreds.hostname.isEmpty()) {
        WiFi.setHostname(currentCreds.hostname.c_str());
    }

    if (!currentCreds.dhcp) {
        configureStaticIP(currentCreds);
    }

    Serial.printf("[WIFI-PROV] Connecting to SSID: %s\n", currentCreds.ssid.c_str());
    WiFi.begin(currentCreds.ssid.c_str(), currentCreds.password.c_str());

    const unsigned long startMs = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if ((millis() - startMs) > timeout * 1000UL) {
            Serial.println("[WIFI-PROV] WiFi connection timeout");
            return false;
        }
        delay(250);
    }

    Serial.printf("[WIFI-PROV] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
    return true;
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
