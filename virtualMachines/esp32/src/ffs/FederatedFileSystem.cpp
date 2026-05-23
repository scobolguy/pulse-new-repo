// FederatedFileSystem.cpp
#include "FederatedFileSystem.h"
#include <ArduinoJson.h>
#if defined(ESP32)
#include <SD.h>
#include <LittleFS.h>
#elif defined(ESP8266)
#include <LittleFS.h>
#endif

namespace {

String trimPath(const String& in) {
    String out = in;
    out.trim();
    return out;
}

bool isUnderMount(const String& path, const String& mountPoint) {
    if (!path.startsWith(mountPoint)) return false;
    if (path.length() == mountPoint.length()) return true;
    if (mountPoint == "/") return true;
    return path[mountPoint.length()] == '/';
}

String joinMountPath(const String& mountPoint, const String& targetPath, const String& logicalName) {
    String suffix = logicalName.substring(mountPoint.length());
    if (suffix.startsWith("/")) suffix.remove(0, 1);

    String base = targetPath;
    if (!base.startsWith("/")) base = "/" + base;
    if (base.endsWith("/")) base.remove(base.length() - 1);
    if (suffix.length() == 0) return base;
    if (suffix.startsWith("/")) return base + suffix;
    return base + "/" + suffix;
}

} // namespace

String FederatedFileSystem::makeAbsolutePath(const String &logicalName) const {
    String path = trimPath(logicalName);
    if (path.length() == 0) return "/";
    if (!path.startsWith("/")) path = "/" + path;
    return path;
}

FederatedFileSystem::ResolvedPath FederatedFileSystem::resolvePath(const String &logicalName) const {
    ResolvedPath resolved;
    resolved.logicalPath = makeAbsolutePath(logicalName);

    const FFSMountEntry* best = nullptr;
    for (const auto& mount : _mounts) {
        String mountPoint = makeAbsolutePath(mount.mountPoint);
        if (!isUnderMount(resolved.logicalPath, mountPoint)) continue;
        if (!best || mountPoint.length() > makeAbsolutePath(best->mountPoint).length()) {
            best = &mount;
        }
    }

    if (!best) {
        resolved.resolvedPath = resolved.logicalPath;
        return resolved;
    }

    resolved.mounted = true;
    resolved.remote = best->type == FFSMountType::Peer;
    resolved.readOnly = best->readOnly;
    resolved.peerId = best->peerId;
    resolved.mountPoint = makeAbsolutePath(best->mountPoint);
    resolved.resolvedPath = joinMountPath(resolved.mountPoint, best->targetPath, resolved.logicalPath);
    return resolved;
}

FFSStatus FederatedFileSystem::readLocalFile(const String &path, std::vector<uint8_t> &outData) const {
    File f;
#if defined(ESP32)
    if (path.startsWith("/sd/")) {
        f = SD.open(path.substring(3), FILE_READ);
    } else if (path.startsWith("sd/")) {
        f = SD.open(path.substring(3), FILE_READ);
    } else {
        f = LittleFS.open(path, FILE_READ);
    }
#else
    f = LittleFS.open(path, "r");
#endif
    if (!f) return FFSStatus::ERR_NOT_FOUND;
    outData.clear();
    while (f.available()) outData.push_back(static_cast<uint8_t>(f.read()));
    f.close();
    return FFSStatus::OK;
}

FFSStatus FederatedFileSystem::writeLocalFile(const String &path, const uint8_t *data, size_t len) {
    File f;
#if defined(ESP32)
    if (path.startsWith("/sd/")) {
        f = SD.open(path.substring(3), FILE_WRITE);
    } else if (path.startsWith("sd/")) {
        f = SD.open(path.substring(3), FILE_WRITE);
    } else {
        f = LittleFS.open(path, FILE_WRITE);
    }
#else
    f = LittleFS.open(path, "w");
#endif
    if (!f) return FFSStatus::ERR_IO;
    size_t written = f.write(data, len);
    f.close();
    return written == len ? FFSStatus::OK : FFSStatus::ERR_FULL;
}

bool FederatedFileSystem::removeLocalFile(const String &path) const {
#if defined(ESP32)
    if (path.startsWith("/sd/")) return SD.remove(path.substring(3));
    if (path.startsWith("sd/")) return SD.remove(path.substring(3));
    return LittleFS.remove(path);
#else
    return LittleFS.remove(path);
#endif
}

void FederatedFileSystem::ensureMountParentDirectory() const {
    if (!LittleFS.exists("/ffs")) {
        LittleFS.mkdir("/ffs");
    }
}
// --- File handle/line I/O ---
int FederatedFileSystem::openFile(const String &logicalName, const String &mode) {
    ResolvedPath resolved = resolvePath(logicalName);
    String path = resolved.resolvedPath;
    File f;
#if defined(ESP32)
    if (path.startsWith("sd/")) {
        String sdPath = path.substring(3);
        f = SD.open(sdPath, mode.c_str());
    } else {
        f = LittleFS.open(path, mode.c_str());
    }
#else
    f = LittleFS.open(path, mode.c_str());
#endif
    if (!f) return 0;
    int handle = _nextHandle++;
    _openFiles[handle] = {f, mode};
    return handle;
}

bool FederatedFileSystem::closeFile(int handle) {
    auto it = _openFiles.find(handle);
    if (it == _openFiles.end()) return false;
    it->second.file.close();
    _openFiles.erase(it);
    return true;
}

bool FederatedFileSystem::readLine(int handle, String &outLine) {
    auto it = _openFiles.find(handle);
    if (it == _openFiles.end()) return false;
    outLine = it->second.file.readStringUntil('\n');
    // Remove trailing \r or \n
    outLine.trim();
    return outLine.length() > 0;
}

bool FederatedFileSystem::writeLine(int handle, const String &line) {
    auto it = _openFiles.find(handle);
    if (it == _openFiles.end()) return false;
    size_t written = it->second.file.print(line + "\n");
    return written == (line.length() + 1);
}
// FederatedFileSystem.cpp
// ESP32 Federated File System (FFS) core implementation
// Supports SD (SD_MMC/SD) and LittleFS backends
// C++11, Arduino compatible

#include "FederatedFileSystem.h"

#include <vector>
#include <LittleFS.h>
#if __has_include(<SD.h>)
#include <SD.h>
#endif
#if defined(ESP32)
#include <HTTPClient.h>
#include <WiFiClient.h>
#elif defined(ESP8266)
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#endif

FederatedFileSystem::FederatedFileSystem() : _backend(FFSBackend::LittleFS), _fs(nullptr), _basePath("/"), _inTransaction(false) {}

bool FederatedFileSystem::begin(FFSBackend backend, fs::FS &fs, const String &basePath) {
    _backend = backend;
    _fs = &fs;
    _basePath = basePath;
    // Mount the selected backend if needed
    if (_backend == FFSBackend::LittleFS) {
        if (!LittleFS.begin()) return false;
    }
#if defined(SD_H) || defined(ARDUINO_ARCH_ESP32)
    if (_backend == FFSBackend::SD) {
        if (!SD.begin()) return false;
    }
#endif
    reloadMountPoints();
    return true;
}

FFSStatus FederatedFileSystem::write(const String &logicalName, const uint8_t *data, size_t len) {
    ResolvedPath resolved = resolvePath(logicalName);
    if (resolved.remote) {
        return FFSStatus::ERR_UNSUPPORTED;
    }
    if (resolved.readOnly) {
        return FFSStatus::ERR_UNSUPPORTED;
    }
    return writeLocalFile(resolved.resolvedPath, data, len);
}

FFSStatus FederatedFileSystem::read(const String &logicalName, std::vector<uint8_t> &outData) {
    ResolvedPath resolved = resolvePath(logicalName);
    if (!resolved.remote) {
        return readLocalFile(resolved.resolvedPath, outData);
    }

    outData.clear();
    String peer = resolved.peerId;
    String filePath = resolved.resolvedPath;
    size_t chunkIdx = 0;
    size_t fileSize = 0;

#if defined(ESP32)
    while (true) {
        String chunkUrl = String("http://") + peer + "/ffs/chunk?file=" + filePath + "&chunk=" + String(chunkIdx) + "&size=" + String(FFS_CHUNK_SIZE);
        HTTPClient http;
        http.begin(chunkUrl);
        int httpCode = http.GET();
        if (httpCode != 200) {
            http.end();
            return chunkIdx == 0 ? FFSStatus::ERR_NOT_FOUND : FFSStatus::OK;
        }
        const int bodySize = http.getSize();
        if (bodySize <= 0) {
            http.end();
            return FFSStatus::ERR_IO;
        }
        std::vector<uint8_t> chunkData(static_cast<size_t>(bodySize));
        WiFiClient* stream = http.getStreamPtr();
        size_t readBytes = 0;
        while (readBytes < chunkData.size()) {
            int n = stream->read(&chunkData[readBytes], chunkData.size() - readBytes);
            if (n <= 0) break;
            readBytes += static_cast<size_t>(n);
        }
        if (readBytes != chunkData.size()) {
            http.end();
            return FFSStatus::ERR_IO;
        }
        outData.insert(outData.end(), chunkData.begin(), chunkData.end());
        String fileSizeHeader = http.header("X-File-Size");
        if (fileSizeHeader.length() > 0) fileSize = fileSizeHeader.toInt();
        http.end();
        ++chunkIdx;
        if (fileSize > 0 && outData.size() >= fileSize) break;
        if (bodySize < static_cast<int>(FFS_CHUNK_SIZE)) break;
    }
    return FFSStatus::OK;
#else
    return FFSStatus::ERR_UNSUPPORTED;
#endif
}

FFSStatus FederatedFileSystem::remove(const String &logicalName) {
    ResolvedPath resolved = resolvePath(logicalName);
    if (resolved.remote || resolved.readOnly) {
        return FFSStatus::ERR_UNSUPPORTED;
    }
    bool exists = false;
    bool removed = false;
#if defined(ESP32)
    if (resolved.resolvedPath.startsWith("sd/")) {
        String sdPath = resolved.resolvedPath.substring(3);
        exists = SD.exists(sdPath);
        if (exists) removed = SD.remove(sdPath);
    } else {
        exists = LittleFS.exists(resolved.resolvedPath);
        if (exists) removed = LittleFS.remove(resolved.resolvedPath);
    }
#else
    exists = LittleFS.exists(resolved.resolvedPath);
    if (exists) removed = LittleFS.remove(resolved.resolvedPath);
#endif
    if (!exists) return FFSStatus::ERR_NOT_FOUND;
    return removed ? FFSStatus::OK : FFSStatus::ERR_IO;
}

FFSStatus FederatedFileSystem::listFiles(std::vector<String> &outNames) {
    outNames.clear();
#if defined(ESP32)
    // List SD files under "sd/"
    File sdRoot = SD.open("/");
    if (sdRoot && sdRoot.isDirectory()) {
        File file = sdRoot.openNextFile();
        while (file) {
            outNames.push_back(String("sd/") + String(file.name()));
            file = sdRoot.openNextFile();
        }
        sdRoot.close();
    }
#endif
    // List LittleFS files at root
#if defined(ESP8266)
    File lfsRoot = LittleFS.open("/", "r");
#else
    File lfsRoot = LittleFS.open("/");
#endif
    if (lfsRoot && lfsRoot.isDirectory()) {
        File file = lfsRoot.openNextFile();
        while (file) {
            String name = String(file.name());
            if (file.isDirectory()) {
                // Mark as directory (for FFS listing)
                outNames.push_back(name + "/");
            } else {
                outNames.push_back(name);
            }
            file = lfsRoot.openNextFile();
        }
        lfsRoot.close();
    }

    for (const auto& mount : _mounts) {
        outNames.push_back(makeAbsolutePath(mount.mountPoint) + "/");
    }
    return FFSStatus::OK;
}

// Advanced FFS API stubs
FFSStatus FederatedFileSystem::appendChunk(const String &logicalName, const uint8_t *data, size_t len, size_t &outChunkId) {
    // TODO: Implement chunked append (allocate chunk, write, update index)
    outChunkId = 0;
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::readChunk(const String &logicalName, size_t chunkId, std::vector<uint8_t> &outData) {
    // TODO: Implement chunked read (lookup chunk, read data)
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::listChunks(const String &logicalName, std::vector<FFSChunkInfo> &outChunks) {
    // TODO: Implement chunk index listing
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::beginTransaction() {
    // TODO: Implement journaling/atomic commit
    _inTransaction = true;
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::commitTransaction() {
    // TODO: Commit journal, finalize atomic write
    _inTransaction = false;
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::abortTransaction() {
    // TODO: Rollback journal, abort atomic write
    _inTransaction = false;
    return FFSStatus::ERR_UNSUPPORTED;
}

bool FederatedFileSystem::inTransaction() const {
    return _inTransaction;
}

FFSStatus FederatedFileSystem::sync() {
    // TODO: Flush all pending writes to media
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::pushFileToPeer(const String &logicalName, const String &peerId) {
    std::vector<uint8_t> data;
    FFSStatus st = read(logicalName, data);
    if (st != FFSStatus::OK) return st;

#if defined(ESP32)
    String url = String("http://") + peerId + "/ffs/upload?file=" + logicalName;
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/octet-stream");
    int code = http.POST(data.data(), data.size());
    http.end();
    return code >= 200 && code < 300 ? FFSStatus::OK : FFSStatus::ERR_IO;
#else
    return FFSStatus::ERR_UNSUPPORTED;
#endif
}

FFSStatus FederatedFileSystem::fetchFileFromPeer(const String &logicalName, const String &peerId) {
    String chunkUrlBase = String("http://") + peerId + "/ffs/chunk?file=" + logicalName + "&chunk=";
    String path = logicalName;
    size_t chunkIdx = 0;

    while (true) {
        String chunkUrl = chunkUrlBase + String(chunkIdx) + "&size=" + String(FFS_CHUNK_SIZE);
#if defined(ESP32)
        HTTPClient http;
        http.begin(chunkUrl);
        int httpCode = http.GET();
        if (httpCode != 200) {
            http.end();
            return chunkIdx == 0 ? FFSStatus::ERR_NOT_FOUND : FFSStatus::OK;
        }

        size_t chunkSize = http.getSize();
        if (chunkSize == 0) {
            http.end();
            break;
        }

        std::vector<uint8_t> chunkData(chunkSize);
        WiFiClient *stream = http.getStreamPtr();
        size_t readBytes = 0;
        while (readBytes < chunkSize) {
            int n = stream->read(&chunkData[readBytes], chunkSize - readBytes);
            if (n <= 0) break;
            readBytes += static_cast<size_t>(n);
        }
        if (readBytes != chunkSize) {
            http.end();
            return FFSStatus::ERR_IO;
        }

        File f;
        if (path.startsWith("sd/")) {
            String sdPath = path.substring(3);
            f = SD.open(sdPath, FILE_APPEND);
        } else {
            f = LittleFS.open(path, FILE_APPEND);
        }
        if (!f) {
            http.end();
            return FFSStatus::ERR_IO;
        }
        f.write(chunkData.data(), chunkSize);
        f.close();

        String fileSizeHeader = http.header("X-File-Size");
        size_t totalSize = fileSizeHeader.length() > 0 ? static_cast<size_t>(fileSizeHeader.toInt()) : 0;
        http.end();
        ++chunkIdx;
        if (totalSize > 0 && (chunkIdx * FFS_CHUNK_SIZE) >= totalSize) break;
        if (chunkSize < FFS_CHUNK_SIZE) break;
#elif defined(ESP8266)
        HTTPClient http;
        WiFiClient client;
        http.begin(client, chunkUrl);
        int httpCode = http.GET();
        if (httpCode != 200) {
            http.end();
            return chunkIdx == 0 ? FFSStatus::ERR_NOT_FOUND : FFSStatus::OK;
        }

        size_t chunkSize = http.getSize();
        if (chunkSize == 0) {
            http.end();
            break;
        }

        std::vector<uint8_t> chunkData(chunkSize);
        WiFiClient *stream = http.getStreamPtr();
        size_t readBytes = 0;
        while (readBytes < chunkSize) {
            int n = stream->read(&chunkData[readBytes], chunkSize - readBytes);
            if (n <= 0) break;
            readBytes += static_cast<size_t>(n);
        }
        if (readBytes != chunkSize) {
            http.end();
            return FFSStatus::ERR_IO;
        }

        File f = LittleFS.open(path, "a");
        if (!f) {
            http.end();
            return FFSStatus::ERR_IO;
        }
        f.write(chunkData.data(), chunkSize);
        f.close();

        String fileSizeHeader = http.header("X-File-Size");
        size_t totalSize = fileSizeHeader.length() > 0 ? static_cast<size_t>(fileSizeHeader.toInt()) : 0;
        http.end();
        ++chunkIdx;
        if (totalSize > 0 && (chunkIdx * FFS_CHUNK_SIZE) >= totalSize) break;
        if (chunkSize < FFS_CHUNK_SIZE) break;
#else
        return FFSStatus::ERR_UNSUPPORTED;
#endif
    }

    return FFSStatus::OK;
}

    FFSStatus FederatedFileSystem::addMountPoint(const String &mountPoint, const String &targetPath, FFSMountType type, const String &peerId, bool readOnly) {
        String mount = makeAbsolutePath(mountPoint);
        if (mount == "/") return FFSStatus::ERR_INVALID_ARG;
        if (targetPath.length() == 0 && type == FFSMountType::LocalAlias) return FFSStatus::ERR_INVALID_ARG;

        for (auto& entry : _mounts) {
            if (makeAbsolutePath(entry.mountPoint) == mount) {
                entry.mountPoint = mount;
                entry.targetPath = targetPath;
                entry.peerId = peerId;
                entry.type = type;
                entry.readOnly = readOnly;
                return saveMountPoints();
            }
        }

        _mounts.push_back({mount, targetPath, peerId, type, readOnly});
        return saveMountPoints();
    }

    FFSStatus FederatedFileSystem::removeMountPoint(const String &mountPoint) {
        String mount = makeAbsolutePath(mountPoint);
        for (auto it = _mounts.begin(); it != _mounts.end(); ++it) {
            if (makeAbsolutePath(it->mountPoint) == mount) {
                _mounts.erase(it);
                return saveMountPoints();
            }
        }
        return FFSStatus::ERR_NOT_FOUND;
    }

    std::vector<FFSMountEntry> FederatedFileSystem::listMountPoints() const {
        return _mounts;
    }

    FFSStatus FederatedFileSystem::reloadMountPoints() {
        ensureMountParentDirectory();
        if (!LittleFS.exists(MOUNT_TABLE_PATH)) {
            _mounts.clear();
            return FFSStatus::OK;
        }

        File f = LittleFS.open(MOUNT_TABLE_PATH, "r");
        if (!f) return FFSStatus::ERR_IO;
        String raw = f.readString();
        f.close();

        JsonDocument doc;
        auto err = deserializeJson(doc, raw);
        if (err) return FFSStatus::ERR_INDEX;

        _mounts.clear();
        JsonArrayConst mounts = doc["mounts"].as<JsonArrayConst>();
        if (!mounts.isNull()) {
            for (JsonVariantConst v : mounts) {
                FFSMountEntry entry;
                entry.mountPoint = String(v["mountPoint"] | "");
                entry.targetPath = String(v["targetPath"] | "");
                entry.peerId = String(v["peerId"] | "");
                String type = String(v["type"] | "local");
                entry.type = (type == "peer") ? FFSMountType::Peer : FFSMountType::LocalAlias;
                entry.readOnly = bool(v["readOnly"] | true);
                if (entry.mountPoint.length() > 0) {
                    _mounts.push_back(entry);
                }
            }
        }
        return FFSStatus::OK;
    }

    FFSStatus FederatedFileSystem::saveMountPoints() const {
        ensureMountParentDirectory();
        JsonDocument doc;
        JsonArray arr = doc["mounts"].to<JsonArray>();
        for (const auto& entry : _mounts) {
            JsonObject obj = arr.add<JsonObject>();
            obj["mountPoint"] = makeAbsolutePath(entry.mountPoint);
            obj["targetPath"] = String(entry.targetPath);
            obj["peerId"] = String(entry.peerId);
            obj["type"] = entry.type == FFSMountType::Peer ? "peer" : "local";
            obj["readOnly"] = entry.readOnly;
        }

        String out;
        serializeJsonPretty(doc, out);
        File f = LittleFS.open(MOUNT_TABLE_PATH, "w");
        if (!f) return FFSStatus::ERR_IO;
        size_t written = f.print(out);
        f.close();
        return written == out.length() ? FFSStatus::OK : FFSStatus::ERR_FULL;
    }
