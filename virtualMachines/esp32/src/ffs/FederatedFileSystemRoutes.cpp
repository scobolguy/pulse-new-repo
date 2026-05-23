#include "DevicePin.h"
#include "FederatedFileSystemRoutes.h"
#include <vector>
#include <Arduino.h>
#include <ArduinoJson.h>
#if defined(ESP32)
#include <SD.h>
#endif
#include <LittleFS.h>

namespace {

bool parseBoolLike(String value, bool defaultValue = false) {
    value.trim();
    value.toLowerCase();
    if (value == "1" || value == "true" || value == "yes" || value == "on") return true;
    if (value == "0" || value == "false" || value == "no" || value == "off") return false;
    return defaultValue;
}

String mountTypeToString(FFSMountType type) {
    return type == FFSMountType::Peer ? "peer" : "local";
}

FFSMountType mountTypeFromString(String value) {
    value.trim();
    value.toLowerCase();
    return value == "peer" ? FFSMountType::Peer : FFSMountType::LocalAlias;
}

String normalizeMountPoint(String mountPoint) {
    mountPoint.trim();
    if (!mountPoint.startsWith("/")) mountPoint = "/" + mountPoint;
    while (mountPoint.endsWith("/") && mountPoint.length() > 1) {
        mountPoint.remove(mountPoint.length() - 1);
    }
    return mountPoint;
}

String getParamValue(AsyncWebServerRequest* request, const char* name) {
    if (request->hasParam(name, true)) return request->getParam(name, true)->value();
    if (request->hasParam(name)) return request->getParam(name)->value();
    return String();
}

bool readLittleFsFile(const String& path, String& out) {
    if (!LittleFS.exists(path)) return false;
    File f = LittleFS.open(path, "r");
    if (!f) return false;
    out = f.readString();
    f.close();
    return true;
}

void appendFlowBundle(JsonArray bundles, const String& bundleName) {
    JsonObject obj = bundles.add<JsonObject>();
    obj["name"] = bundleName;
    obj["path"] = String("/flows/") + bundleName;
    obj["manifestPath"] = String("/flows/") + bundleName + "/manifest.json";
    obj["hasManifest"] = LittleFS.exists(obj["manifestPath"].as<String>());
}

} // namespace

void registerFFSRoutes(AsyncWebServer& server, FederatedFileSystem& federatedFS) {

            // FFS: List all device definitions
            server.on("/ffs/devices", HTTP_GET, [](AsyncWebServerRequest *request){
                String json = "[";
                if (LittleFS.exists("/devices")) {
                    File dir = LittleFS.open("/devices");
                    bool first = true;
                    File entry = dir.openNextFile();
                    while (entry) {
                        if (!first) json += ",";
                        String content = entry.readString();
                        json += content;
                        first = false;
                        entry = dir.openNextFile();
                    }
                }
                json += "]";
                request->send(200, "application/json", json);
            });

            // FFS: List all service definitions
            server.on("/ffs/services", HTTP_GET, [](AsyncWebServerRequest *request){
                String json = "[";
                if (LittleFS.exists("/services")) {
                    File dir = LittleFS.open("/services");
                    bool first = true;
                    File entry = dir.openNextFile();
                    while (entry) {
                        if (!first) json += ",";
                        String content = entry.readString();
                        json += content;
                        first = false;
                        entry = dir.openNextFile();
                    }
                }
                json += "]";
                request->send(200, "application/json", json);
            });
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
        // Add files
        for (size_t i = 0; i < files.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + files[i] + "\"";
        }

        // Add /devices directory and its children
        if (LittleFS.exists("/devices")) {
            if (!files.empty()) json += ",";
            json += "{\"type\":\"directory\",\"name\":\"devices\",\"children\":[";
            File dir = LittleFS.open("/devices");
            bool first = true;
            File entry = dir.openNextFile();
            while (entry) {
                if (!first) json += ",";
                String fname = entry.name();
                // Read device file content for details
                String content = entry.readString();
                json += content;
                first = false;
                entry = dir.openNextFile();
            }
            json += "]}";
        }
        // Add /services directory and its children
        if (LittleFS.exists("/services")) {
            json += ",{";
            json += "\"type\":\"directory\",\"name\":\"services\",\"children\":[]}";
        }
        json += "]";
        request->send(200, "application/json", json);
    });

        server.on("/ffs/flows", HTTP_GET, [](AsyncWebServerRequest *request){
            JsonDocument doc;
            JsonArray bundles = doc["flows"].to<JsonArray>();
            if (LittleFS.exists("/flows")) {
                File root = LittleFS.open("/flows");
                if (root && root.isDirectory()) {
                    File entry = root.openNextFile();
                    while (entry) {
                        if (entry.isDirectory()) {
                            String name = String(entry.name());
                            if (name.startsWith("/flows/")) {
                                name = name.substring(7);
                            }
                            if (name.length() > 0) {
                                appendFlowBundle(bundles, name);
                            }
                        }
                        entry = root.openNextFile();
                    }
                    root.close();
                }
            }
            String response;
            serializeJson(doc, response);
            request->send(200, "application/json", response);
        });

        server.on("/ffs/flows/manifest", HTTP_GET, [](AsyncWebServerRequest *request){
            String bundle = getParamValue(request, "bundle");
            if (bundle.length() == 0) {
                request->send(400, "text/plain", "Missing bundle param");
                return;
            }
            bundle.trim();
            if (bundle.startsWith("/")) bundle.remove(0, 1);
            String manifestPath = String("/flows/") + bundle + "/manifest.json";
            String manifest;
            if (!readLittleFsFile(manifestPath, manifest)) {
                request->send(404, "text/plain", "Manifest not found");
                return;
            }
            request->send(200, "application/json", manifest);
        });

        server.on("/ffs/flows/file", HTTP_GET, [](AsyncWebServerRequest *request){
            String bundle = getParamValue(request, "bundle");
            String fileName = getParamValue(request, "file");
            if (bundle.length() == 0 || fileName.length() == 0) {
                request->send(400, "text/plain", "Missing bundle or file param");
                return;
            }
            bundle.trim();
            fileName.trim();
            if (bundle.startsWith("/")) bundle.remove(0, 1);
            if (fileName.startsWith("/")) fileName.remove(0, 1);
            String path = String("/flows/") + bundle + "/" + fileName;
            std::vector<uint8_t> data;
            if (LittleFS.exists(path)) {
                File f = LittleFS.open(path, "r");
                if (f) {
                    while (f.available()) data.push_back(static_cast<uint8_t>(f.read()));
                    f.close();
                }
            }
            if (data.empty()) {
                request->send(404, "text/plain", "Flow file not found");
                return;
            }
            request->send(200, "application/octet-stream", data.data(), data.size());
        });

        server.on("/ffs/mounts", HTTP_GET, [&federatedFS](AsyncWebServerRequest *request){
            JsonDocument doc;
            JsonArray mounts = doc["mounts"].to<JsonArray>();
            for (const auto& entry : federatedFS.listMountPoints()) {
                JsonObject obj = mounts.add<JsonObject>();
                obj["mountPoint"] = entry.mountPoint;
                obj["targetPath"] = entry.targetPath;
                obj["peerId"] = entry.peerId;
                obj["type"] = mountTypeToString(entry.type);
                obj["readOnly"] = entry.readOnly;
            }
            String response;
            serializeJson(doc, response);
            request->send(200, "application/json", response);
        });

        auto mountHandler = [&federatedFS](AsyncWebServerRequest *request){
            String mountPoint = normalizeMountPoint(getParamValue(request, "mount"));
            String targetPath = getParamValue(request, "target");
            String peerId = getParamValue(request, "peer");
            String type = getParamValue(request, "type");
            String readOnlyValue = getParamValue(request, "readOnly");

            if (mountPoint.length() == 0) {
                request->send(400, "text/plain", "Missing mount param");
                return;
            }

            if (type.length() == 0) type = peerId.length() > 0 ? "peer" : "local";
            FFSMountType mountType = mountTypeFromString(type);
            bool readOnly = parseBoolLike(readOnlyValue, mountType == FFSMountType::Peer);

            if (mountType == FFSMountType::Peer) {
                if (peerId.length() == 0) {
                    request->send(400, "text/plain", "Missing peer param for peer mount");
                    return;
                }
                if (targetPath.length() == 0) targetPath = mountPoint;
            } else {
                if (targetPath.length() == 0) {
                    request->send(400, "text/plain", "Missing target param for local mount");
                    return;
                }
            }

            FFSStatus st = federatedFS.addMountPoint(mountPoint, targetPath, mountType, peerId, readOnly);
            request->send(st == FFSStatus::OK ? 200 : 500, "application/json", st == FFSStatus::OK ? "{\"status\":\"ok\"}" : "{\"status\":\"error\"}");
        };
        server.on("/ffs/mount", HTTP_POST, mountHandler);
        server.on("/ffs/mount", HTTP_GET, mountHandler);

        auto unmountHandler = [&federatedFS](AsyncWebServerRequest *request){
            String mountPoint = normalizeMountPoint(getParamValue(request, "mount"));
            if (mountPoint.length() == 0) {
                request->send(400, "text/plain", "Missing mount param");
                return;
            }
            FFSStatus st = federatedFS.removeMountPoint(mountPoint);
            request->send(st == FFSStatus::OK ? 200 : 404, "application/json", st == FFSStatus::OK ? "{\"status\":\"ok\"}" : "{\"status\":\"not_found\"}");
        };
        server.on("/ffs/unmount", HTTP_POST, unmountHandler);
        server.on("/ffs/unmount", HTTP_DELETE, unmountHandler);
}
