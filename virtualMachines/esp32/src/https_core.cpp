// IDF HTTPS proxy — must NOT include ESPAsyncWebServer.h.
// ESPAsyncWebServer and esp_https_server both define HTTP_GET/POST/DELETE etc.
// as enum values; mixing them in one translation unit causes compile errors.
// Route registration lives in https_service.cpp which includes ESPAsyncWebServer.h.
#if defined(ENABLE_HTTPS) && defined(ESP32)

// Arduino.h + WiFi.h must come first so lwIP is initialised before
// esp_https_server.h pulls in a second lwIP include path via nghttp/http_parser.h.
#include <Arduino.h>
#include <WiFi.h>
#include "esp_https_server.h"
#include <LittleFS.h>
#include <HTTPClient.h>
#include "https_service.h"
#include "tls_default_pair.h"

static constexpr size_t kMaxProxyBodyBytes = 32768;

static httpd_handle_t sHttpsHandle = nullptr;
static uint8_t* sCertBuf = nullptr;
static size_t   sCertLen = 0;
static uint8_t* sKeyBuf  = nullptr;
static size_t   sKeyLen  = 0;
static bool     sUsingBundledPair = false;

static bool loadPemFile(const char* path, uint8_t** buf, size_t* len) {
    if (!LittleFS.exists(path)) return false;
    File f = LittleFS.open(path, "r");
    if (!f) return false;
    const size_t sz = f.size();
    if (sz == 0 || sz > 8192) { f.close(); return false; }
    uint8_t* tmp = (uint8_t*)malloc(sz + 1);
    if (!tmp) { f.close(); return false; }
    f.readBytes((char*)tmp, sz);
    f.close();
    tmp[sz] = '\0';
    *buf = tmp;
    *len = sz + 1;
    return true;
}

static bool loadBundledPemPair(uint8_t** certBuf, size_t* certLen, uint8_t** keyBuf, size_t* keyLen) {
    const size_t bundledCertLen = strlen(kDefaultTlsCertPem) + 1;
    const size_t bundledKeyLen = strlen(kDefaultTlsKeyPem) + 1;
    uint8_t* certCopy = static_cast<uint8_t*>(malloc(bundledCertLen));
    uint8_t* keyCopy = static_cast<uint8_t*>(malloc(bundledKeyLen));
    if (!certCopy || !keyCopy) {
        free(certCopy);
        free(keyCopy);
        return false;
    }
    memcpy(certCopy, kDefaultTlsCertPem, bundledCertLen);
    memcpy(keyCopy, kDefaultTlsKeyPem, bundledKeyLen);
    *certBuf = certCopy;
    *certLen = bundledCertLen;
    *keyBuf = keyCopy;
    *keyLen = bundledKeyLen;
    return true;
}

static const char* statusStr(int code) {
    switch (code) {
        case 200: return "200 OK";
        case 201: return "201 Created";
        case 204: return "204 No Content";
        case 400: return "400 Bad Request";
        case 401: return "401 Unauthorized";
        case 403: return "403 Forbidden";
        case 404: return "404 Not Found";
        case 409: return "409 Conflict";
        case 503: return "503 Service Unavailable";
        default:  return "500 Internal Server Error";
    }
}

// Proxy handler: terminates TLS then forwards request to HTTP port 80.
// Uses IDF httpd_method_t enum — HTTP_GET=1, HTTP_POST=3, HTTP_PUT=4,
// HTTP_DELETE=0, HTTP_PATCH=28 — not the AsyncWebServer bitmask values.
static esp_err_t proxyHandler(httpd_req_t* req) {
    char uriCopy[512];
    strlcpy(uriCopy, req->uri, sizeof(uriCopy));
    const String targetUrl = String("http://127.0.0.1") + String(uriCopy);

    String body;
    if (req->content_len > 0) {
        if (req->content_len > kMaxProxyBodyBytes) {
            httpd_resp_set_status(req, "413 Content Too Large");
            httpd_resp_set_type(req, "application/json");
            const char* err = "{\"error\":\"body too large for HTTPS proxy\"}";
            httpd_resp_send(req, err, strlen(err));
            return ESP_OK;
        }
        char* bodyBuf = (char*)malloc(req->content_len + 1);
        if (!bodyBuf) {
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OOM");
            return ESP_OK;
        }
        int received = 0;
        while (received < (int)req->content_len) {
            const int ret = httpd_req_recv(req, bodyBuf + received, req->content_len - received);
            if (ret <= 0) break;
            received += ret;
        }
        bodyBuf[received] = '\0';
        body = String(bodyBuf);
        free(bodyBuf);
    }

    char contentType[128] = "";
    char authHeader[256]  = "";
    httpd_req_get_hdr_value_str(req, "Content-Type",  contentType, sizeof(contentType));
    httpd_req_get_hdr_value_str(req, "Authorization", authHeader,  sizeof(authHeader));

    HTTPClient http;
    if (!http.begin(targetUrl)) {
        httpd_resp_set_status(req, "503 Service Unavailable");
        httpd_resp_set_type(req, "application/json");
        const char* e = "{\"error\":\"proxy connect failed\"}";
        httpd_resp_send(req, e, strlen(e));
        return ESP_OK;
    }

    if (strlen(contentType) > 0) http.addHeader("Content-Type",  String(contentType));
    if (strlen(authHeader)  > 0) http.addHeader("Authorization", String(authHeader));
    http.addHeader("X-Forwarded-Proto", "https");
    http.setTimeout(8000);

    // Compare against IDF httpd_method_t integer values (http_parser.h order).
    int code = -1;
    const int m = (int)req->method;
    if      (m == HTTP_GET)    code = http.GET();
    else if (m == HTTP_POST)   code = http.POST(body);
    else if (m == HTTP_PUT)    code = http.PUT(body);
    else if (m == HTTP_DELETE) code = http.sendRequest("DELETE", body);
    else if (m == HTTP_PATCH)  code = http.sendRequest("PATCH",  body);
    else                       code = http.GET();

    if (code <= 0) {
        http.end();
        httpd_resp_set_status(req, "503 Service Unavailable");
        httpd_resp_set_type(req, "application/json");
        const char* e = "{\"error\":\"proxy request failed\"}";
        httpd_resp_send(req, e, strlen(e));
        return ESP_OK;
    }

    String respContentType = http.header("Content-Type");
    if (respContentType.length() == 0) respContentType = "application/json";
    const String responseBody = http.getString();
    http.end();

    httpd_resp_set_status(req, statusStr(code));
    httpd_resp_set_type(req, respContentType.c_str());
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_send(req, responseBody.c_str(), responseBody.length());
    return ESP_OK;
}

bool startHttpsService() {
    if (sHttpsHandle) return true;

    sUsingBundledPair = false;

    if (!sCertBuf || !sKeyBuf) {
        uint8_t* certBuf = nullptr;
        uint8_t* keyBuf = nullptr;
        size_t certLen = 0;
        size_t keyLen = 0;

        const bool certLoaded = loadPemFile("/tls/cert.pem", &certBuf, &certLen);
        const bool keyLoaded = loadPemFile("/tls/key.pem", &keyBuf, &keyLen);
        if (!certLoaded || !keyLoaded) {
            if (certBuf) { free(certBuf); certBuf = nullptr; certLen = 0; }
            if (keyBuf) { free(keyBuf); keyBuf = nullptr; keyLen = 0; }
            Serial.println("[TLS] Missing persistent cert/key pair — using bundled self-signed fallback");
            if (!loadBundledPemPair(&certBuf, &certLen, &keyBuf, &keyLen)) {
                Serial.println("[TLS] Failed to allocate bundled TLS fallback");
                return false;
            }
            sUsingBundledPair = true;
        }

        sCertBuf = certBuf;
        sCertLen = certLen;
        sKeyBuf = keyBuf;
        sKeyLen = keyLen;
    }

    httpd_ssl_config_t conf = HTTPD_SSL_CONFIG_DEFAULT();
    conf.httpd.stack_size       = 12288;
    conf.httpd.max_uri_handlers = 8;
    conf.httpd.uri_match_fn     = httpd_uri_match_wildcard;
    // In this IDF build cacert_pem/cacert_len hold the SERVER cert (see comment in header).
    conf.cacert_pem      = sCertBuf;
    conf.cacert_len      = sCertLen;
    conf.prvtkey_pem     = sKeyBuf;
    conf.prvtkey_len     = sKeyLen;
    conf.port_secure            = 443;

    const esp_err_t ret = httpd_ssl_start(&sHttpsHandle, &conf);
    if (ret != ESP_OK) {
        Serial.printf("[TLS] httpd_ssl_start failed: %d\n", (int)ret);
        sHttpsHandle = nullptr;
        return false;
    }

    // Wildcard handlers — IDF HTTP_* enum values used here (not AsyncWebServer bitmasks).
    static httpd_uri_t hGet    = { "/*", HTTP_GET,    proxyHandler, nullptr };
    static httpd_uri_t hPost   = { "/*", HTTP_POST,   proxyHandler, nullptr };
    static httpd_uri_t hPut    = { "/*", HTTP_PUT,    proxyHandler, nullptr };
    static httpd_uri_t hDelete = { "/*", HTTP_DELETE, proxyHandler, nullptr };
    static httpd_uri_t hPatch  = { "/*", HTTP_PATCH,  proxyHandler, nullptr };
    httpd_register_uri_handler(sHttpsHandle, &hGet);
    httpd_register_uri_handler(sHttpsHandle, &hPost);
    httpd_register_uri_handler(sHttpsHandle, &hPut);
    httpd_register_uri_handler(sHttpsHandle, &hDelete);
    httpd_register_uri_handler(sHttpsHandle, &hPatch);

    Serial.println("[TLS] HTTPS server started on port 443");
    return true;
}

void stopHttpsService() {
    if (!sHttpsHandle) return;
    httpd_stop(sHttpsHandle);
    sHttpsHandle = nullptr;
    // Free cert buffers so startHttpsService() reloads fresh from LittleFS.
    if (sCertBuf) { free(sCertBuf); sCertBuf = nullptr; sCertLen = 0; }
    if (sKeyBuf)  { free(sKeyBuf);  sKeyBuf  = nullptr; sKeyLen  = 0; }
    Serial.println("[TLS] HTTPS server stopped");
}

bool isHttpsRunning() {
    return sHttpsHandle != nullptr;
}

bool isHttpsUsingBundledPair() {
    return sUsingBundledPair;
}

#endif // ENABLE_HTTPS && ESP32
