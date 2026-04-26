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
    String path = _basePath + logicalName;
    File f;
    if (_backend == FFSBackend::LittleFS) {
        f = LittleFS.open(path, FILE_WRITE);
    }
#if defined(SD_H) || defined(ARDUINO_ARCH_ESP32)
    else if (_backend == FFSBackend::SD) {
        f = SD.open(path, FILE_WRITE);
    }
#endif
    else if (_fs) {
        f = _fs->open(path, FILE_WRITE);
    }
    if (!f) return FFSStatus::ERR_IO;
    size_t written = f.write(data, len);
    f.close();
    return (written == len) ? FFSStatus::OK : FFSStatus::ERR_FULL;
}

FFSStatus FederatedFileSystem::read(const String &logicalName, std::vector<uint8_t> &outData) {
    String path = _basePath + logicalName;
    File f;
    if (_backend == FFSBackend::LittleFS) {
        f = LittleFS.open(path, FILE_READ);
    }
#if defined(SD_H) || defined(ARDUINO_ARCH_ESP32)
    else if (_backend == FFSBackend::SD) {
        f = SD.open(path, FILE_READ);
    }
#endif
    else if (_fs) {
        f = _fs->open(path, FILE_READ);
    }
    if (!f) return FFSStatus::ERR_NOT_FOUND;
    outData.clear();
    while (f.available()) {
        outData.push_back(f.read());
    }
    f.close();
    return FFSStatus::OK;
}

FFSStatus FederatedFileSystem::remove(const String &logicalName) {
    String path = _basePath + logicalName;
    bool exists = false;
    bool removed = false;
    if (_backend == FFSBackend::LittleFS) {
        exists = LittleFS.exists(path);
        if (exists) removed = LittleFS.remove(path);
    }
#if defined(SD_H) || defined(ARDUINO_ARCH_ESP32)
    else if (_backend == FFSBackend::SD) {
        exists = SD.exists(path);
        if (exists) removed = SD.remove(path);
    }
#endif
    else if (_fs) {
        exists = _fs->exists(path);
        if (exists) removed = _fs->remove(path);
    }
    if (!exists) return FFSStatus::ERR_NOT_FOUND;
    return removed ? FFSStatus::OK : FFSStatus::ERR_IO;
}

FFSStatus FederatedFileSystem::listFiles(std::vector<String> &outNames) {
    outNames.clear();
    File root;
    if (_backend == FFSBackend::LittleFS) {
        root = LittleFS.open(_basePath);
    }
#if defined(SD_H) || defined(ARDUINO_ARCH_ESP32)
    else if (_backend == FFSBackend::SD) {
        root = SD.open(_basePath);
    }
#endif
    else if (_fs) {
        root = _fs->open(_basePath);
    }
    if (!root || !root.isDirectory()) return FFSStatus::ERR_IO;
    File file = root.openNextFile();
    while (file) {
        outNames.push_back(String(file.name()));
        file = root.openNextFile();
    }
    root.close();
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
    // TODO: Implement file fetch from remote peer (via broker)
    return FFSStatus::ERR_UNSUPPORTED;
}
