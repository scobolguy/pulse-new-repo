#include "Dht11HttpServer.h"

#if defined(ENABLE_DHT11_HTTP_SERVER)

#include <ArduinoJson.h>
#include <DHT.h>

#if !defined(DHT11_DATA_PIN)
#error "Set DHT11_DATA_PIN in the active PlatformIO environment"
#endif

#if !defined(DHT11_HTTP_PATH)
#error "Set DHT11_HTTP_PATH in the active PlatformIO environment"
#endif

namespace {
DHT dhtSensor(DHT11_DATA_PIN, DHT11);
}

namespace Dht11HttpServer {

void registerRoutes(AsyncWebServer& server) {
    dhtSensor.begin();

    server.on(DHT11_HTTP_PATH, HTTP_GET, [](AsyncWebServerRequest* request) {
        const float temperatureC = dhtSensor.readTemperature();
        const float humidityPercent = dhtSensor.readHumidity();

        JsonDocument response;
        int statusCode = 200;
        if (isnan(temperatureC) || isnan(humidityPercent)) {
            statusCode = 503;
            response["valid"] = false;
            response["error"] = "sensor_read_failed";
        } else {
            response["valid"] = true;
            response["temperatureC"] = temperatureC;
            response["humidityPercent"] = humidityPercent;
        }

        String json;
        serializeJson(response, json);
        request->send(statusCode, "application/json", json);
    });
}

}

#endif