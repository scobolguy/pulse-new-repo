// FederatedFileSystem.h
// ESP32 Federated File System (FFS) core interface
// Supports SD (SD_MMC/SD) and LittleFS backends
// C++11, Arduino compatible

#ifndef FEDERATED_FILE_SYSTEM_H
#define FEDERATED_FILE_SYSTEM_H

#include <Arduino.h>
#include <FS.h>
#include <vector>

// FFS storage backend type
enum class FFSBackend {
    SD,
    LittleFS
};

// FFS status codes
enum class FFSStatus {
    OK = 0,
    ERR_NOT_FOUND,
    ERR_IO,
    ERR_FULL,
    ERR_JOURNAL,
    ERR_INDEX,
    ERR_INVALID_ARG,
    ERR_UNSUPPORTED
};

// Chunk size (default 512 bytes for SD sector alignment)
constexpr size_t FFS_CHUNK_SIZE = 512;

// FFS file handle (opaque)
struct FFSFileHandle {
    String logicalName;
    FFSBackend backend;
    File file;
    // Add chunk index, position, etc. as needed
};

// Chunk metadata structure
struct FFSChunkInfo {
    size_t chunkId;
    size_t offset;
    size_t length;
};

class FederatedFileSystem {
public:
    FederatedFileSystem();
    bool begin(FFSBackend backend, fs::FS &fs, const String &basePath = "/");

    // Basic file ops
    FFSStatus write(const String &logicalName, const uint8_t *data, size_t len);
    FFSStatus read(const String &logicalName, std::vector<uint8_t> &outData);
    FFSStatus remove(const String &logicalName);
    FFSStatus listFiles(std::vector<String> &outNames);

    // Advanced FFS API
    // Chunked storage
    FFSStatus appendChunk(const String &logicalName, const uint8_t *data, size_t len, size_t &outChunkId);
    FFSStatus readChunk(const String &logicalName, size_t chunkId, std::vector<uint8_t> &outData);
    FFSStatus listChunks(const String &logicalName, std::vector<FFSChunkInfo> &outChunks);

    // Journaling/atomic commit
    FFSStatus beginTransaction();
    FFSStatus commitTransaction();
    FFSStatus abortTransaction();
    bool inTransaction() const;

    // Sync (flush to media)
    FFSStatus sync();

    // Federation (stub)
    FFSStatus pushFileToPeer(const String &logicalName, const String &peerId);
    FFSStatus fetchFileFromPeer(const String &logicalName, const String &peerId);

private:
    FFSBackend _backend;
    fs::FS *_fs;
    String _basePath;
    bool _inTransaction;
    // TODO: chunk index, journal, transaction log, federation state, etc.
};

#endif // FEDERATED_FILE_SYSTEM_H
