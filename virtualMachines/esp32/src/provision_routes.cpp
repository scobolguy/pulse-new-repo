
#include "config_types.h"
#include "main_globals.h"
#include "provision_routes.h"
#include <LittleFS.h>
#include <ArduinoJson.h>


namespace provision {
 
void registerProvisionRoutes(AsyncWebServer& server) {
    server.on("/provision", HTTP_POST, [](AsyncWebServerRequest *request){
        String ssid, password, newName;
        if (request->hasParam("ssid", true)) ssid = request->getParam("ssid", true)->value();
        if (request->hasParam("password", true)) password = request->getParam("password", true)->value();
        if (request->hasParam("nodeName", true)) newName = request->getParam("nodeName", true)->value();
        // Force SSID and password for logbin
        if (newName == "logbin") {
            ssid = "Home";
            password = "Brady123";
        }
        if (ssid.length() && password.length() && newName.length()) {
            nodeName = newName;
            File f = LittleFS.open(NODE_NAME_PATH, "w");
            if (f) {
                f.print(nodeName);
                f.close();
            }
#if defined(ESP32)
            WiFi.setHostname(nodeName.c_str());
#elif defined(ESP8266)
            WiFi.hostname(nodeName.c_str());
#endif
            // Save WiFi credentials to LittleFS
            wifiConfig.ssid = ssid;
            wifiConfig.password = password;
            //saveConfigToFile(wifiConfig, WifiConfig::schema, 2, WIFI_CONFIG_PATH);
            //saveConfigToFile(wifiConfig, WifiConfig::schema, 2, WIFI_CONFIG_PATH, LittleFS);
            request->send(200, "text/plain", "Provisioned. Rebooting...");
            delay(1000);
            ESP.restart();
        } else {
            request->send(400, "text/plain", "Missing parameters");
        }
    });
}

} // namespace provision
