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
    return true;
}

FFSStatus FederatedFileSystem::write(const String &logicalName, const uint8_t *data, size_t len) {
    String path = logicalName;
    File f;
    // Federation: path starts with '\'
    if (path.startsWith("\\")) {
        // Federation stub: not implemented
        return FFSStatus::ERR_UNSUPPORTED;
    }
#if defined(ESP32)
    // SD card: path starts with "sd/"
    if (path.startsWith("sd/")) {
        String sdPath = path.substring(3); // remove 'sd/'
        f = SD.open(sdPath, FILE_WRITE);
    } else {
        f = LittleFS.open(path, FILE_WRITE);
    }
#else
    // Only LittleFS for ESP8266
    f = LittleFS.open(path, "w");
#endif
    if (!f) return FFSStatus::ERR_IO;
    size_t written = f.write(data, len);
    f.close();
    return (written == len) ? FFSStatus::OK : FFSStatus::ERR_FULL;
}

FFSStatus FederatedFileSystem::read(const String &logicalName, std::vector<uint8_t> &outData) {
    String path = logicalName;
    File f;
    if (path.startsWith("\\")) {
        return FFSStatus::ERR_UNSUPPORTED;
    }
#if defined(ESP32)
    if (path.startsWith("sd/")) {
        String sdPath = path.substring(3);
        f = SD.open(sdPath, FILE_READ);
    } else {
        f = LittleFS.open(path, FILE_READ);
    }
#else
    f = LittleFS.open(path, "r");
#endif
    if (!f) return FFSStatus::ERR_NOT_FOUND;
    outData.clear();
    while (f.available()) {
        outData.push_back(f.read());
    }
    f.close();
    return FFSStatus::OK;
}

FFSStatus FederatedFileSystem::remove(const String &logicalName) {
    String path = logicalName;
    bool exists = false;
    bool removed = false;
    if (path.startsWith("\\")) {
        return FFSStatus::ERR_UNSUPPORTED;
    }
#if defined(ESP32)
    if (path.startsWith("sd/")) {
        String sdPath = path.substring(3);
        exists = SD.exists(sdPath);
        if (exists) removed = SD.remove(sdPath);
    } else {
        exists = LittleFS.exists(path);
        if (exists) removed = LittleFS.remove(path);
    }
#else
    exists = LittleFS.exists(path);
    if (exists) removed = LittleFS.remove(path);
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
            outNames.push_back(String(file.name()));
            file = lfsRoot.openNextFile();
        }
        lfsRoot.close();
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
    // TODO: Implement file push to remote peer (via broker)
    return FFSStatus::ERR_UNSUPPORTED;
}

FFSStatus FederatedFileSystem::fetchFileFromPeer(const String &logicalName, const String &peerId) {
    // peerId is expected to be the peer's IP or hostname
    String url = "http://" + peerId + "/ffs/chunk?file=" + logicalName + "&chunk=";
    size_t totalSize = 0;
    // Determine file path and open in append mode
    String path = logicalName;
    File f;
#if defined(ESP32)
    if (path.startsWith("sd/")) {
        String sdPath = path.substring(3);
        f = SD.open(sdPath, FILE_APPEND);
    } else {
        f = LittleFS.open(path, FILE_APPEND);
    }
#else
    f = LittleFS.open(path, "a");
#endif
    if (!f) {
        // Try to create the file if it doesn't exist
#if defined(ESP32)
        if (path.startsWith("sd/")) {
            String sdPath = path.substring(3);
            f = SD.open(sdPath, FILE_WRITE);
        } else {
            f = LittleFS.open(path, FILE_WRITE);
        }
#else
        f = LittleFS.open(path, "w");
#endif
        if (!f) return FFSStatus::ERR_IO;
    }
    // Get current file size to determine resume point
    size_t currentSize = f.size();
    size_t chunkIdx = currentSize / FFS_CHUNK_SIZE;
    if (currentSize % FFS_CHUNK_SIZE != 0) {
        // File is not chunk-aligned, treat as error or truncate
        f.close();
        // Optionally, truncate or remove the file here
        return FFSStatus::ERR_IO;
    }
    f.close();
    while (true) {
        String chunkUrl = url + String(chunkIdx);
        chunkUrl += "&size=" + String(FFS_CHUNK_SIZE);
#if defined(ESP32)
        HTTPClient http;
        http.begin(chunkUrl);
        int httpCode = http.GET();
        if (httpCode != 200) {
            http.end();
            if (chunkIdx == 0) return FFSStatus::ERR_NOT_FOUND;
            break;
        }
        WiFiClient *stream = http.getStreamPtr();
        size_t chunkSize = http.getSize();
        std::vector<uint8_t> chunkData(chunkSize);
        size_t read = 0;
        while (read < chunkSize) {
            int n = stream->read(&chunkData[read], chunkSize - read);
            if (n <= 0) break;
            read += n;
        }
        String crcHeader = http.header("X-Chunk-CRC32");
        uint32_t crcExpected = strtoul(crcHeader.c_str(), nullptr, 16);
        uint32_t crc = 0xFFFFFFFF;
        for (size_t i = 0; i < chunkData.size(); ++i) {
            uint8_t b = chunkData[i];
            crc ^= b;
            for (int k = 0; k < 8; ++k)
                crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
        }
        crc ^= 0xFFFFFFFF;
        if (crc != crcExpected) {
            http.end();
            return FFSStatus::ERR_IO;
        }
        // Append chunk to file
        if (chunkSize > 0) {
#if defined(ESP32)
            if (path.startsWith("sd/")) {
                String sdPath = path.substring(3);
                f = SD.open(sdPath, FILE_APPEND);
            } else {
                f = LittleFS.open(path, FILE_APPEND);
            }
#else
            f = LittleFS.open(path, "a");
#endif
            if (!f) {
                http.end();
                return FFSStatus::ERR_IO;
            }
            f.write(chunkData.data(), chunkSize);
            f.close();
        }
        String fileSizeHeader = http.header("X-File-Size");
        if (fileSizeHeader.length() > 0) {
            totalSize = fileSizeHeader.toInt();
            if (((chunkIdx + 1) * FFS_CHUNK_SIZE) >= totalSize || chunkSize == 0) {
                http.end();
                break;
            }
        }
        http.end();
        ++chunkIdx;
#elif defined(ESP8266)
        HTTPClient http;
        WiFiClient client;
        http.begin(client, chunkUrl);
        int httpCode = http.GET();
        if (httpCode != 200) {
            http.end();
            if (chunkIdx == 0) return FFSStatus::ERR_NOT_FOUND;
            break;
        }
        WiFiClient *stream = http.getStreamPtr();
        size_t chunkSize = http.getSize();
        std::vector<uint8_t> chunkData(chunkSize);
        size_t read = 0;
        while (read < chunkSize) {
            int n = stream->read(&chunkData[read], chunkSize - read);
            if (n <= 0) break;
            read += n;
        }
        String crcHeader = http.header("X-Chunk-CRC32");
        uint32_t crcExpected = strtoul(crcHeader.c_str(), nullptr, 16);
        uint32_t crc = 0xFFFFFFFF;
        for (size_t i = 0; i < chunkData.size(); ++i) {
            uint8_t b = chunkData[i];
            crc ^= b;
            for (int k = 0; k < 8; ++k)
                crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
        }
        crc ^= 0xFFFFFFFF;
        if (crc != crcExpected) {
            http.end();
            return FFSStatus::ERR_IO;
        }
        if (chunkSize > 0) {
#if defined(ESP32)
            if (path.startsWith("sd/")) {
                String sdPath = path.substring(3);
                f = SD.open(sdPath, FILE_APPEND);
            } else {
                f = LittleFS.open(path, FILE_APPEND);
            }
#else
            f = LittleFS.open(path, "a");
#endif
            if (!f) {
                http.end();
                return FFSStatus::ERR_IO;
            }
            f.write(chunkData.data(), chunkSize);
            f.close();
        }
        String fileSizeHeader = http.header("X-File-Size");
        if (fileSizeHeader.length() > 0) {
            totalSize = fileSizeHeader.toInt();
            if (((chunkIdx + 1) * FFS_CHUNK_SIZE) >= totalSize || chunkSize == 0) {
                http.end();
                break;
            }
        }
        http.end();
        ++chunkIdx;
#else
        return FFSStatus::ERR_UNSUPPORTED;
#endif
    }
    // Success if file exists and is nonzero size
#if defined(ESP32)
    if (path.startsWith("sd/")) {
        String sdPath = path.substring(3);
        f = SD.open(sdPath, FILE_READ);
    } else {
        f = LittleFS.open(path, FILE_READ);
    }
#else
    f = LittleFS.open(path, "r");
#endif
    if (!f || f.size() == 0) {
        if (f) f.close();
        return FFSStatus::ERR_NOT_FOUND;
    }
    f.close();
    return FFSStatus::OK;
}
