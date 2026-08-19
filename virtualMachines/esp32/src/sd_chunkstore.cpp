#include "sd_chunkstore.h"
#include <ArduinoJson.h>

// Global chunkstore instance
SDChunkstore* globalChunkstore = nullptr;

void initializeSDChunkstore(int csPin, int chunkSize) {
    if (globalChunkstore == nullptr) {
        globalChunkstore = new SDChunkstore(csPin, chunkSize);
    }
}

SDChunkstore::SDChunkstore(int csPin, int chunkSize)
    : csPin(csPin), chunkSize(chunkSize), totalChunks(0),
      initialized(false), nextChunkId(1), nextHandle(1) {
    clearError();
}

SDChunkstore::~SDChunkstore() {
    // Close all open files
    for (auto& pair : openFiles) {
        close(pair.first);
    }
    
    // Save metadata
    if (initialized) {
        saveMetadata();
    }
}

// ============================================================================
// Initialization
// ============================================================================

bool SDChunkstore::begin() {
    clearError();
    
    // Initialize SD card
    if (!SD.begin(csPin)) {
        setError("SD card initialization failed");
        return false;
    }
    
    // Calculate total chunks based on SD card size
    uint64_t cardSize = SD.cardSize();
    totalChunks = (cardSize / chunkSize) - 1; // Reserve first chunk for metadata
    
    // Load or create metadata
    if (!loadMetadata()) {
        // First time initialization
        format();
    }
    
    initialized = true;
    return true;
}

bool SDChunkstore::format() {
    clearError();
    
    // Clear all metadata
    chunkMetadata.clear();
    fileDirectory.clear();
    nextChunkId = 1;
    
    // Initialize chunk metadata
    for (int i = 1; i <= totalChunks; i++) {
        ChunkMetadata meta;
        meta.chunkId = i;
        meta.writeCount = 0;
        meta.allocated = false;
        meta.fileId = 0;
        chunkMetadata[i] = meta;
    }
    
    // Save metadata
    return saveMetadata();
}

bool SDChunkstore::loadMetadata() {
    // Open metadata file
    File file = SD.open("/chunkstore.meta", FILE_READ);
    if (!file) {
        return false;
    }
    
    // Read JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        setError("Metadata parse error");
        return false;
    }
    
    // Load chunk metadata
    JsonArray chunks = doc["chunks"];
    for (JsonObject chunk : chunks) {
        ChunkMetadata meta;
        meta.chunkId = chunk["id"];
        meta.writeCount = chunk["writes"];
        meta.allocated = chunk["allocated"];
        meta.fileId = chunk["fileId"];
        chunkMetadata[meta.chunkId] = meta;
    }
    
    // Load file directory
    JsonObject files = doc["files"];
    for (JsonPair kv : files) {
        fileDirectory[kv.key().c_str()] = kv.value();
    }
    
    nextChunkId = doc["nextChunkId"] | 1;
    
    return true;
}

bool SDChunkstore::saveMetadata() {
    // Create JSON document
    JsonDocument doc;
    
    // Save chunk metadata (only allocated chunks to save space)
    JsonArray chunks = doc["chunks"].to<JsonArray>();
    for (const auto& pair : chunkMetadata) {
        if (pair.second.allocated) {
            JsonObject chunk = chunks.add<JsonObject>();
            chunk["id"] = pair.second.chunkId;
            chunk["writes"] = pair.second.writeCount;
            chunk["allocated"] = pair.second.allocated;
            chunk["fileId"] = pair.second.fileId;
        }
    }
    
    // Save file directory
    JsonObject files = doc["files"].to<JsonObject>();
    for (const auto& pair : fileDirectory) {
        files[pair.first] = pair.second;
    }
    
    doc["nextChunkId"] = nextChunkId;
    
    // Write to file
    File file = SD.open("/chunkstore.meta", FILE_WRITE);
    if (!file) {
        setError("Failed to open metadata file");
        return false;
    }
    
    serializeJson(doc, file);
    file.close();
    
    return true;
}

// ============================================================================
// File Operations
// ============================================================================

int SDChunkstore::open(const char* path, int mode) {
    clearError();
    
    if (!initialized) {
        setError("Not initialized");
        return -1;
    }
    
    FileHandle handle;
    handle.path = path;
    handle.mode = mode;
    handle.position = 0;
    handle.valid = true;
    
    // Check if file exists
    auto it = fileDirectory.find(path);
    
    if (mode == 0) { // Read mode
        if (it == fileDirectory.end()) {
            setError("File not found");
            return -1;
        }
        handle.firstChunkId = it->second;
        handle.currentChunkId = it->second;
        
        // Calculate file size
        uint32_t chunkId = handle.firstChunkId;
        handle.fileSize = 0;
        while (chunkId != 0) {
            ChunkHeader header;
            if (!readChunkHeader(chunkId, header)) {
                setError("Failed to read chunk header");
                return -1;
            }
            handle.fileSize += header.dataLength;
            chunkId = header.nextChunkId;
        }
        
    } else if (mode == 1) { // Write mode
        // Allocate first chunk
        handle.firstChunkId = allocateChunk();
        if (handle.firstChunkId == 0) {
            setError("Failed to allocate chunk");
            return -1;
        }
        handle.currentChunkId = handle.firstChunkId;
        handle.fileSize = 0;
        
        // Add to directory
        fileDirectory[path] = handle.firstChunkId;
        
    } else if (mode == 2) { // Append mode
        if (it == fileDirectory.end()) {
            // File doesn't exist, create it
            return open(path, 1);
        }
        
        handle.firstChunkId = it->second;
        
        // Find last chunk and calculate file size
        uint32_t chunkId = handle.firstChunkId;
        handle.fileSize = 0;
        while (chunkId != 0) {
            ChunkHeader header;
            if (!readChunkHeader(chunkId, header)) {
                setError("Failed to read chunk header");
                return -1;
            }
            handle.fileSize += header.dataLength;
            handle.currentChunkId = chunkId;
            if (header.nextChunkId == 0) break;
            chunkId = header.nextChunkId;
        }
        handle.position = handle.fileSize;
    }
    
    // Store handle
    int handleId = nextHandle++;
    openFiles[handleId] = handle;
    
    return handleId;
}

int SDChunkstore::read(int handle, uint8_t* buffer, int size) {
    clearError();
    
    if (!isValidHandle(handle)) {
        setError("Invalid handle");
        return -1;
    }
    
    FileHandle* fh = getFileHandle(handle);
    if (fh->mode != 0) {
        setError("File not open for reading");
        return -1;
    }
    
    int bytesRead = 0;
    uint8_t chunkBuffer[chunkSize];
    
    while (bytesRead < size && fh->currentChunkId != 0) {
        // Read chunk header
        ChunkHeader header;
        if (!readChunkHeader(fh->currentChunkId, header)) {
            return bytesRead;
        }
        
        // Read chunk data
        if (!readChunk(fh->currentChunkId, chunkBuffer)) {
            return bytesRead;
        }
        
        // Calculate offset within chunk
        uint32_t chunkOffset = fh->position % (chunkSize - sizeof(ChunkHeader));
        uint32_t bytesInChunk = header.dataLength - chunkOffset;
        uint32_t bytesToCopy = min((uint32_t)(size - bytesRead), bytesInChunk);
        
        // Copy data
        memcpy(buffer + bytesRead, chunkBuffer + sizeof(ChunkHeader) + chunkOffset, bytesToCopy);
        
        bytesRead += bytesToCopy;
        fh->position += bytesToCopy;
        
        // Move to next chunk if needed
        if (chunkOffset + bytesToCopy >= header.dataLength) {
            fh->currentChunkId = header.nextChunkId;
        }
    }
    
    return bytesRead;
}

int SDChunkstore::write(int handle, const uint8_t* data, int size) {
    clearError();
    
    if (!isValidHandle(handle)) {
        setError("Invalid handle");
        return -1;
    }
    
    FileHandle* fh = getFileHandle(handle);
    if (fh->mode == 0) {
        setError("File not open for writing");
        return -1;
    }
    
    int bytesWritten = 0;
    uint8_t chunkBuffer[chunkSize];
    
    while (bytesWritten < size) {
        // Calculate how much we can write to current chunk
        uint32_t chunkOffset = fh->position % (chunkSize - sizeof(ChunkHeader));
        uint32_t spaceInChunk = (chunkSize - sizeof(ChunkHeader)) - chunkOffset;
        uint32_t bytesToWrite = min((uint32_t)(size - bytesWritten), spaceInChunk);
        
        // Read existing chunk data
        ChunkHeader header;
        if (!readChunkHeader(fh->currentChunkId, header)) {
            return bytesWritten;
        }
        
        if (!readChunk(fh->currentChunkId, chunkBuffer)) {
            return bytesWritten;
        }
        
        // Update chunk data
        memcpy(chunkBuffer + sizeof(ChunkHeader) + chunkOffset, data + bytesWritten, bytesToWrite);
        
        // Update header
        header.dataLength = max(header.dataLength, (uint16_t)(chunkOffset + bytesToWrite));
        header.checksum = calculateCRC16(chunkBuffer + sizeof(ChunkHeader), header.dataLength);
        
        // Write chunk
        if (!writeChunkHeader(fh->currentChunkId, header)) {
            return bytesWritten;
        }
        
        if (!writeChunk(fh->currentChunkId, chunkBuffer)) {
            return bytesWritten;
        }
        
        bytesWritten += bytesToWrite;
        fh->position += bytesToWrite;
        fh->fileSize = max(fh->fileSize, fh->position);
        
        // Allocate next chunk if needed
        if (chunkOffset + bytesToWrite >= (chunkSize - sizeof(ChunkHeader)) && bytesWritten < size) {
            if (header.nextChunkId == 0) {
                uint32_t newChunkId = allocateChunk();
                if (newChunkId == 0) {
                    return bytesWritten;
                }
                header.nextChunkId = newChunkId;
                writeChunkHeader(fh->currentChunkId, header);
            }
            fh->currentChunkId = header.nextChunkId;
        }
    }
    
    return bytesWritten;
}

bool SDChunkstore::seek(int handle, uint32_t position) {
    clearError();
    
    if (!isValidHandle(handle)) {
        setError("Invalid handle");
        return false;
    }
    
    FileHandle* fh = getFileHandle(handle);
    
    if (position > fh->fileSize) {
        setError("Seek beyond end of file");
        return false;
    }
    
    // Find the chunk containing the position
    uint32_t chunkId = fh->firstChunkId;
    uint32_t currentPos = 0;
    
    while (chunkId != 0) {
        ChunkHeader header;
        if (!readChunkHeader(chunkId, header)) {
            return false;
        }
        
        if (currentPos + header.dataLength > position) {
            fh->currentChunkId = chunkId;
            fh->position = position;
            return true;
        }
        
        currentPos += header.dataLength;
        chunkId = header.nextChunkId;
    }
    
    return false;
}

int SDChunkstore::tell(int handle) {
    if (!isValidHandle(handle)) {
        return -1;
    }
    return getFileHandle(handle)->position;
}

bool SDChunkstore::close(int handle) {
    clearError();
    
    if (!isValidHandle(handle)) {
        setError("Invalid handle");
        return false;
    }
    
    openFiles.erase(handle);
    saveMetadata();
    
    return true;
}

bool SDChunkstore::deleteFile(const char* path) {
    clearError();
    
    auto it = fileDirectory.find(path);
    if (it == fileDirectory.end()) {
        setError("File not found");
        return false;
    }
    
    // Free all chunks in chain
    uint32_t chunkId = it->second;
    while (chunkId != 0) {
        ChunkHeader header;
        if (!readChunkHeader(chunkId, header)) {
            return false;
        }
        uint32_t nextId = header.nextChunkId;
        freeChunk(chunkId);
        chunkId = nextId;
    }
    
    // Remove from directory
    fileDirectory.erase(it);
    saveMetadata();
    
    return true;
}

bool SDChunkstore::exists(const char* path) {
    return fileDirectory.find(path) != fileDirectory.end();
}

int SDChunkstore::getFileSize(const char* path) {
    auto it = fileDirectory.find(path);
    if (it == fileDirectory.end()) {
        return -1;
    }
    
    // Calculate file size
    uint32_t chunkId = it->second;
    int size = 0;
    
    while (chunkId != 0) {
        ChunkHeader header;
        if (!readChunkHeader(chunkId, header)) {
            return -1;
        }
        size += header.dataLength;
        chunkId = header.nextChunkId;
    }
    
    return size;
}

std::vector<std::string> SDChunkstore::listFiles() {
    std::vector<std::string> files;
    for (const auto& pair : fileDirectory) {
        files.push_back(pair.first);
    }
    return files;
}

// ============================================================================
// Chunk Management
// ============================================================================

uint32_t SDChunkstore::allocateChunk() {
    // Find chunk with lowest write count (wear leveling)
    uint32_t bestChunkId = 0;
    uint32_t lowestWrites = UINT32_MAX;
    
    for (const auto& pair : chunkMetadata) {
        if (!pair.second.allocated && pair.second.writeCount < lowestWrites) {
            bestChunkId = pair.first;
            lowestWrites = pair.second.writeCount;
        }
    }
    
    if (bestChunkId == 0) {
        setError("No free chunks");
        return 0;
    }
    
    // Mark as allocated
    chunkMetadata[bestChunkId].allocated = true;
    
    // Initialize chunk header
    ChunkHeader header;
    header.chunkId = bestChunkId;
    header.nextChunkId = 0;
    header.dataLength = 0;
    header.checksum = 0;
    writeChunkHeader(bestChunkId, header);
    
    return bestChunkId;
}

bool SDChunkstore::freeChunk(uint32_t chunkId) {
    auto it = chunkMetadata.find(chunkId);
    if (it == chunkMetadata.end()) {
        return false;
    }
    
    it->second.allocated = false;
    it->second.fileId = 0;
    
    return true;
}

bool SDChunkstore::readChunk(uint32_t chunkId, uint8_t* buffer) {
    uint32_t offset = getChunkOffset(chunkId);
    
    File file = SD.open("/chunkstore.dat", FILE_READ);
    if (!file) {
        setError("Failed to open chunkstore file");
        return false;
    }
    
    file.seek(offset);
    int bytesRead = file.read(buffer, chunkSize);
    file.close();
    
    return (bytesRead == chunkSize);
}

bool SDChunkstore::writeChunk(uint32_t chunkId, const uint8_t* data) {
    uint32_t offset = getChunkOffset(chunkId);
    
    File file = SD.open("/chunkstore.dat", FILE_WRITE);
    if (!file) {
        setError("Failed to open chunkstore file");
        return false;
    }
    
    file.seek(offset);
    int bytesWritten = file.write(data, chunkSize);
    file.close();
    
    // Update write count
    chunkMetadata[chunkId].writeCount++;
    
    return (bytesWritten == chunkSize);
}

bool SDChunkstore::readChunkHeader(uint32_t chunkId, ChunkHeader& header) {
    uint8_t buffer[sizeof(ChunkHeader)];
    uint32_t offset = getChunkOffset(chunkId);
    
    File file = SD.open("/chunkstore.dat", FILE_READ);
    if (!file) {
        return false;
    }
    
    file.seek(offset);
    int bytesRead = file.read(buffer, sizeof(ChunkHeader));
    file.close();
    
    if (bytesRead != sizeof(ChunkHeader)) {
        return false;
    }
    
    memcpy(&header, buffer, sizeof(ChunkHeader));
    return true;
}

bool SDChunkstore::writeChunkHeader(uint32_t chunkId, const ChunkHeader& header) {
    uint8_t buffer[sizeof(ChunkHeader)];
    memcpy(buffer, &header, sizeof(ChunkHeader));
    
    uint32_t offset = getChunkOffset(chunkId);
    
    File file = SD.open("/chunkstore.dat", FILE_WRITE);
    if (!file) {
        return false;
    }
    
    file.seek(offset);
    int bytesWritten = file.write(buffer, sizeof(ChunkHeader));
    file.close();
    
    return (bytesWritten == sizeof(ChunkHeader));
}

// ============================================================================
// Wear Leveling
// ============================================================================

uint32_t SDChunkstore::getWriteCount(uint32_t chunkId) {
    auto it = chunkMetadata.find(chunkId);
    if (it == chunkMetadata.end()) {
        return 0;
    }
    return it->second.writeCount;
}

void SDChunkstore::balanceWear() {
    // Find chunks with high write counts
    uint32_t avgWrites = getAverageWriteCount();
    
    for (auto& pair : chunkMetadata) {
        if (pair.second.allocated && pair.second.writeCount > avgWrites * 2) {
            // Find a less-worn chunk
            uint32_t newChunkId = getLeastWornChunk();
            if (newChunkId != 0 && newChunkId != pair.first) {
                // Copy data to new chunk
                uint8_t buffer[chunkSize];
                if (readChunk(pair.first, buffer)) {
                    writeChunk(newChunkId, buffer);
                    
                    // Update references
                    // (This is simplified - real implementation would update all references)
                    freeChunk(pair.first);
                    chunkMetadata[newChunkId].allocated = true;
                }
            }
        }
    }
}

uint32_t SDChunkstore::getLeastWornChunk() {
    uint32_t bestChunkId = 0;
    uint32_t lowestWrites = UINT32_MAX;
    
    for (const auto& pair : chunkMetadata) {
        if (!pair.second.allocated && pair.second.writeCount < lowestWrites) {
            bestChunkId = pair.first;
            lowestWrites = pair.second.writeCount;
        }
    }
    
    return bestChunkId;
}

uint32_t SDChunkstore::getAverageWriteCount() {
    if (chunkMetadata.empty()) return 0;
    
    uint64_t total = 0;
    for (const auto& pair : chunkMetadata) {
        total += pair.second.writeCount;
    }
    
    return total / chunkMetadata.size();
}

// ============================================================================
// Garbage Collection
// ============================================================================

void SDChunkstore::collectGarbage() {
    // Free chunks that are not referenced by any file
    for (auto& pair : chunkMetadata) {
        if (pair.second.allocated && pair.second.fileId == 0) {
            freeChunk(pair.first);
        }
    }
    
    saveMetadata();
}

void SDChunkstore::compact() {
    // Defragment storage by moving data to lower chunk IDs
    // This is a simplified implementation
    collectGarbage();
}

// ============================================================================
// Status and Diagnostics
// ============================================================================

int SDChunkstore::getFreeChunks() const {
    int count = 0;
    for (const auto& pair : chunkMetadata) {
        if (!pair.second.allocated) {
            count++;
        }
    }
    return count;
}

int SDChunkstore::getAllocatedChunks() const {
    int count = 0;
    for (const auto& pair : chunkMetadata) {
        if (pair.second.allocated) {
            count++;
        }
    }
    return count;
}

int SDChunkstore::getUtilization() const {
    if (totalChunks == 0) return 0;
    return (getAllocatedChunks() * 100) / totalChunks;
}

bool SDChunkstore::runDiagnostics() {
    clearError();
    
    // Check all allocated chunks have valid headers
    for (const auto& pair : chunkMetadata) {
        if (pair.second.allocated) {
            if (!verifyChecksum(pair.first)) {
                setError("Checksum verification failed");
                return false;
            }
        }
    }
    
    return true;
}

// ============================================================================
// Helper Methods
// ============================================================================

void SDChunkstore::setError(const char* error) {
    lastError = error;
}

void SDChunkstore::clearError() {
    lastError = "";
}

uint16_t SDChunkstore::calculateCRC16(const uint8_t* data, int length) {
    uint16_t crc = 0xFFFF;
    
    for (int i = 0; i < length; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            if (crc & 1) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    
    return crc;
}

bool SDChunkstore::verifyChecksum(uint32_t chunkId) {
    uint8_t buffer[chunkSize];
    if (!readChunk(chunkId, buffer)) {
        return false;
    }
    
    ChunkHeader header;
    memcpy(&header, buffer, sizeof(ChunkHeader));
    
    uint16_t calculatedCRC = calculateCRC16(buffer + sizeof(ChunkHeader), header.dataLength);
    return (calculatedCRC == header.checksum);
}

uint32_t SDChunkstore::getChunkOffset(uint32_t chunkId) {
    return chunkId * chunkSize;
}

bool SDChunkstore::isValidHandle(int handle) {
    return openFiles.find(handle) != openFiles.end();
}

FileHandle* SDChunkstore::getFileHandle(int handle) {
    auto it = openFiles.find(handle);
    if (it == openFiles.end()) {
        return nullptr;
    }
    return &it->second;
}

// Made with Bob
