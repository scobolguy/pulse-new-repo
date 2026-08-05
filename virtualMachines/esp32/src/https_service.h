#pragma once
// Forward-declare AsyncWebServer to avoid pulling in ESPAsyncWebServer.h here.
// Both ESPAsyncWebServer.h and esp_https_server.h define HTTP_GET/POST/DELETE
// etc. as enum values and will conflict if included in the same translation unit.
// Keep these two header worlds in separate .cpp files:
//   https_core.cpp    — IDF esp_https_server only
//   https_service.cpp — ESPAsyncWebServer routes only

#if defined(ENABLE_HTTPS) && (defined(ESP32) || defined(ESP8266))

class AsyncWebServer;

bool startHttpsService();
void stopHttpsService();
bool isHttpsRunning();
bool isHttpsUsingBundledPair();
void registerHttpsTlsRoutes(AsyncWebServer& srv);

#endif // ENABLE_HTTPS && (ESP32 || ESP8266)
