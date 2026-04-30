

#include "main_globals.h"
#include "cluster_routes.h"
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "ClusterConfig.h"
#include "ConfigSchema.h"


#ifndef CONFIG_PATH
#define CONFIG_PATH "/config/cluster.json"
#endif

#ifndef CONFIG_PATH
#define CONFIG_PATH "/config/cluster.json"
#endif

#ifndef CONFIG_PATH
#define CONFIG_PATH "/config/cluster.json"
#endif



static void handleClusterConfigGet(AsyncWebServerRequest *request) {
    JsonDocument doc;
    //serializeWithSchema(clusterConfig, ClusterConfig::schema, 2, doc);
    String json;
    serializeJson(doc, json);
    request->send(200, "application/json", json);
}

static void handleClusterConfigSet(AsyncWebServerRequest *request) {
    if (request->hasParam("clusterId", true))
        clusterConfig.clusterId = request->getParam("clusterId", true)->value();
    if (request->hasParam("isGateway", true))
        clusterConfig.isGateway = request->getParam("isGateway", true)->value() == "true";
    //saveConfigToFile(clusterConfig, ClusterConfig::schema, 2, CONFIG_PATH);
    //saveConfigToFile(clusterConfig, ClusterConfig::schema, 2, CONFIG_PATH, LittleFS);
    request->send(200, "text/plain", "Config updated");
}

namespace cluster {

void registerClusterRoutes(AsyncWebServer& server) {
    // Serve cluster config UI
    server.on("/web/cluster.html", HTTP_GET, [](AsyncWebServerRequest *request){
        File file = LittleFS.open("/web/cluster.html", "r");
        if (!file) {
            request->send(500, "text/plain", "Config page not found");
            return;
        }
        String html = file.readString();
        request->send(200, "text/html", html);
        file.close();
    });
    // Cluster config endpoints
    server.on("/config/get", HTTP_GET, handleClusterConfigGet);
    server.on("/config/set", HTTP_POST, handleClusterConfigSet);
}

} // namespace cluster
