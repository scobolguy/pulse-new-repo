#include "FederatedFileSystemRoutes.h"
#include <vector>
#include <Arduino.h>
#if defined(ESP32)
#include <SD.h>
#endif
#include <LittleFS.h>

void registerFFSRoutes(AsyncWebServer& server, FederatedFileSystem& federatedFS) {
        // FFS: List discovered nodes endpoint
        server.on("/ffs/nodes", HTTP_GET, [](AsyncWebServerRequest *request){
            extern std::map<String, DiscoveredNode> discoveredNodeTable;
            String json = "[";
            bool first = true;
            for (const auto& pair : discoveredNodeTable) {
                if (!first) json += ",";
                json += "{\"mac\":\"" + pair.second.mac + "\",\"ip\":\"" + pair.second.ip + "\"}";
                first = false;
            }
            json += "]";
            request->send(200, "application/json", json);
        });

        // Federated file chunk endpoint: /ffs/chunk?file=...&chunk=...&size=...
        server.on("/ffs/chunk", HTTP_GET, [&federatedFS](AsyncWebServerRequest *request){
            if (!request->hasParam("file") || !request->hasParam("chunk")) {
                request->send(400, "text/plain", "Missing file or chunk param");
                return;
            }
            String file = request->getParam("file")->value();
            size_t chunkIdx = request->getParam("chunk")->value().toInt();
            size_t chunkSize = 512;
            if (request->hasParam("size")) chunkSize = request->getParam("size")->value().toInt();
            std::vector<uint8_t> data;
            if (federatedFS.read(file, data) != FFSStatus::OK) {
                request->send(404, "text/plain", "File not found");
                return;
            }
            size_t offset = chunkIdx * chunkSize;
            if (offset >= data.size()) {
                request->send(416, "text/plain", "Chunk out of range");
                return;
            }
            size_t actualSize = std::min(chunkSize, data.size() - offset);
            // Compute CRC32
            uint32_t crc = 0xFFFFFFFF;
            for (size_t i = 0; i < actualSize; ++i) {
                uint8_t b = data[offset + i];
                crc ^= b;
                for (int k = 0; k < 8; ++k)
                    crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
            }
            crc ^= 0xFFFFFFFF;
            // Prepare response (no deprecated beginResponse_P)
            AsyncWebServerResponse *response = request->beginResponse(200, "application/octet-stream", (const uint8_t*)&data[offset], actualSize);
            response->addHeader("X-Chunk-CRC32", String(crc, HEX));
            response->addHeader("X-Chunk-Offset", String(offset));
            response->addHeader("X-Chunk-Size", String(actualSize));
            response->addHeader("X-File-Size", String(data.size()));
            request->send(response);
        });
    // FFS: Create directory endpoint
    auto mkdirHandler = [&federatedFS](AsyncWebServerRequest *request){
        String dir;
        if (request->hasParam("dir", true)) {
            dir = request->getParam("dir", true)->value();
        } else if (request->hasParam("dir")) {
            dir = request->getParam("dir")->value();
        } else {
            request->send(400, "text/plain", "Missing dir param");
            return;
        }
        if (!dir.startsWith("/")) dir = "/" + dir;
        bool ok = false;
#if defined(ESP32)
        if (dir.startsWith("sd/")) {
            String sdPath = dir.substring(3);
            ok = SD.mkdir(sdPath);
        } else {
            ok = LittleFS.mkdir(dir);
        }
#else
        ok = LittleFS.mkdir(dir);
#endif
        request->send(ok ? 200 : 500, "text/plain", ok ? "Directory created" : "Failed to create directory");
    };
    server.on("/ffs/mkdir", HTTP_POST, mkdirHandler);
    server.on("/ffs/mkdir", HTTP_GET, mkdirHandler);

    // FFS: Remove directory endpoint
    auto rmdirHandler = [&federatedFS](AsyncWebServerRequest *request){
        String dir;
        if (request->hasParam("dir", true)) {
            dir = request->getParam("dir", true)->value();
        } else if (request->hasParam("dir")) {
            dir = request->getParam("dir")->value();
        } else {
            request->send(400, "text/plain", "Missing dir param");
            return;
        }
        if (!dir.startsWith("/")) dir = "/" + dir;
        bool ok = false;
#if defined(ESP32)
        if (dir.startsWith("sd/")) {
            String sdPath = dir.substring(3);
            ok = SD.rmdir(sdPath);
        } else {
            ok = LittleFS.rmdir(dir);
        }
#else
        ok = LittleFS.rmdir(dir);
#endif
        request->send(ok ? 200 : 500, "text/plain", ok ? "Directory removed" : "Failed to remove directory");
    };
    server.on("/ffs/rmdir", HTTP_POST, rmdirHandler);
    server.on("/ffs/rmdir", HTTP_GET, rmdirHandler);

    // FFS: Delete file endpoint
    auto deleteHandler = [&federatedFS](AsyncWebServerRequest *request){
        String file;
        if (request->hasParam("file", true)) {
            file = request->getParam("file", true)->value();
        } else if (request->hasParam("file")) {
            file = request->getParam("file")->value();
        } else {
            request->send(400, "text/plain", "Missing file param");
            return;
        }
        if (!file.startsWith("/")) file = "/" + file;
        FFSStatus st = federatedFS.remove(file);
        request->send(st == FFSStatus::OK ? 200 : 500, "text/plain", st == FFSStatus::OK ? "File deleted" : "Failed to delete file");
    };
    server.on("/ffs/delete", HTTP_POST, deleteHandler);
    server.on("/ffs/delete", HTTP_GET, deleteHandler);

    // FFS: Upload file endpoint (raw body)
    auto uploadHandler = [&federatedFS](AsyncWebServerRequest *request){
        String file;
        if (request->hasParam("file", true)) {
            file = request->getParam("file", true)->value();
        } else if (request->hasParam("file")) {
            file = request->getParam("file")->value();
        } else {
            request->send(400, "text/plain", "Missing file param");
            return;
        }
        if (!file.startsWith("/")) file = "/" + file;
        String body;
        if (request->hasParam("body", true)) {
            body = request->getParam("body", true)->value();
        } else if (request->hasParam("body")) {
            body = request->getParam("body")->value();
        } else {
            request->send(400, "text/plain", "Missing body param");
            return;
        }
        std::vector<uint8_t> data(body.begin(), body.end());
        FFSStatus st = federatedFS.write(file, data.data(), data.size());
        request->send(st == FFSStatus::OK ? 200 : 500, "text/plain", st == FFSStatus::OK ? "File uploaded" : "Failed to upload file");
    };
    server.on("/ffs/upload", HTTP_POST, uploadHandler);
    server.on("/ffs/upload", HTTP_GET, uploadHandler);

    // FFS: Download file endpoint (GET or POST)
    auto getHandler = [&federatedFS](AsyncWebServerRequest *request){
        String file;
        if (request->hasParam("file", true)) {
            file = request->getParam("file", true)->value();
        } else if (request->hasParam("file")) {
            file = request->getParam("file")->value();
        } else {
            request->send(400, "text/plain", "Missing file param");
            return;
        }
        if (!file.startsWith("/")) file = "/" + file;
        std::vector<uint8_t> data;
        if (federatedFS.read(file, data) != FFSStatus::OK) {
            request->send(404, "text/plain", "File not found");
            return;
        }
        request->send(200, "application/octet-stream", data.data(), data.size());
    };
    server.on("/ffs/get", HTTP_GET, getHandler);
    server.on("/ffs/get", HTTP_POST, getHandler);

    // FFS: List files endpoint
    server.on("/ffs/list", HTTP_GET, [&federatedFS](AsyncWebServerRequest *request){
        std::vector<String> files;
        if (federatedFS.listFiles(files) != FFSStatus::OK) {
            request->send(500, "application/json", "[]");
            return;
        }
        String json = "[";
        for (size_t i = 0; i < files.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + files[i] + "\"";
        }
        json += "]";
        request->send(200, "application/json", json);
    });
}
