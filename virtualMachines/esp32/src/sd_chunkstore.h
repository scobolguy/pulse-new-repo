#ifndef SD_CHUNKSTORE_H
#define SD_CHUNKSTORE_H

#include <Arduino.h>
#include <SD.h>
#include <map>
#include <vector>
#include <string>

// Forward declarations
struct ChunkHeader;
struct FileHandle;
class SDChunkstore;

/**
 * Chunk Header
 * 
 * Metadata stored at the beginning of each chunk.
 * Total size: 16 bytes
 */
struct ChunkHeader {
    uint32_t magic;         // Magic number: 0x50434F44 ("PCOD")
    uint32_t chunkId;       // Unique chunk identifier
    uint32_t nextChunkId;   // Next chunk in chain (0 = end of chain)
    uint16_t dataLength;    // Actual data length in this chunk
    uint16_t checksum;      // CRC16 checksum of data
    
    ChunkHeader() : magic(0x50434F44), chunkId(0), nextChunkId(0),
                   dataLength(0), checksum(0) {}
};

/**
 * File Handle
 * 
 * Represents an open file in the chunkstore.
 */
struct FileHandle {
    std::string path;
    int mode;               // 0=read, 1=write, 2=append
    uint32_t firstChunkId;  // First chunk in file
    uint32_t currentChunkId; // Current chunk for read/write
    uint32_t position;      // Current position in file
    uint32_t fileSize;      // Total file size
    bool valid;
    
    FileHandle() : path(""), mode(0), firstChunkId(0), currentChunkId(0),
                  position(0), fileSize(0), valid(false) {}
};

/**
 * Chunk Metadata
 * 
 * Metadata for chunk management and wear leveling.
 */
struct ChunkMetadata {
    uint32_t chunkId;
    uint32_t writeCount;    // Number of times chunk has been written
    bool allocated;         // Is chunk currently allocated
    uint32_t fileId;        // File this chunk belongs to (0 = free)
    
    ChunkMetadata() : chunkId(0), writeCount(0), allocated(false), fileId(0) {}
};

/**
 * SD Chunkstore
 * 
 * Wear-leveling storage system for SD cards using fixed-size chunks.
 * Provides file-like interface with automatic wear leveling and
 * garbage collection.
 * 
 * Features:
 * - Fixed-size chunks (default 512 bytes)
 * - Wear leveling to distribute writes evenly
 * - Chunk chaining for files larger than chunk size
 * - CRC16 checksums for data integrity
 * - Garbage collection for deleted files
 * - File handle management
 */
class SDChunkstore {
public:
    /**
     * Constructor
     * @param csPin Chip select pin for SD card
     * @param chunkSize Size of each chunk in bytes (default 512)
     */
    SDChunkstore(int csPin, int chunkSize = 512);
    ~SDChunkstore();
    
    // ========================================================================
    // Initialization
    // ========================================================================
    
    /**
     * Initialize SD card and chunkstore
     * @return true if initialization successful
     */
    bool begin();
    
    /**
     * Format chunkstore (erase all data)
     * @return true if format successful
     */
    bool format();
    
    /**
     * Load metadata from SD card
     * @return true if load successful
     */
    bool loadMetadata();
    
    /**
     * Save metadata to SD card
     * @return true if save successful
     */
    bool saveMetadata();
    
    // ========================================================================
    // File Operations
    // ========================================================================
    
    /**
     * Open file
     * @param path File path
     * @param mode 0=read, 1=write, 2=append
     * @return File handle (>= 0) or -1 on error
     */
    int open(const char* path, int mode);
    
    /**
     * Read from file
     * @param handle File handle
     * @param buffer Buffer to read into
     * @param size Number of bytes to read
     * @return Number of bytes read, or -1 on error
     */
    int read(int handle, uint8_t* buffer, int size);
    
    /**
     * Write to file
     * @param handle File handle
     * @param data Data to write
     * @param size Number of bytes to write
     * @return Number of bytes written, or -1 on error
     */
    int write(int handle, const uint8_t* data, int size);
    
    /**
     * Seek to position in file
     * @param handle File handle
     * @param position Position to seek to
     * @return true if seek successful
     */
    bool seek(int handle, uint32_t position);
    
    /**
     * Get current position in file
     * @param handle File handle
     * @return Current position, or -1 on error
     */
    int tell(int handle);
    
    /**
     * Close file
     * @param handle File handle
     * @return true if close successful
     */
    bool close(int handle);
    
    /**
     * Delete file
     * @param path File path
     * @return true if delete successful
     */
    bool deleteFile(const char* path);
    
    /**
     * Check if file exists
     * @param path File path
     * @return true if file exists
     */
    bool exists(const char* path);
    
    /**
     * Get file size
     * @param path File path
     * @return File size in bytes, or -1 if file not found
     */
    int getFileSize(const char* path);
    
    /**
     * List all files
     * @return Vector of file paths
     */
    std::vector<std::string> listFiles();
    
    // ========================================================================
    // Chunk Management
    // ========================================================================
    
    /**
     * Allocate a new chunk
     * @return Chunk ID, or 0 on error
     */
    uint32_t allocateChunk();
    
    /**
     * Free a chunk
     * @param chunkId Chunk ID to free
     * @return true if free successful
     */
    bool freeChunk(uint32_t chunkId);
    
    /**
     * Read chunk data
     * @param chunkId Chunk ID
     * @param buffer Buffer to read into (must be at least chunkSize bytes)
     * @return true if read successful
     */
    bool readChunk(uint32_t chunkId, uint8_t* buffer);
    
    /**
     * Write chunk data
     * @param chunkId Chunk ID
     * @param data Data to write (must be at least chunkSize bytes)
     * @return true if write successful
     */
    bool writeChunk(uint32_t chunkId, const uint8_t* data);
    
    /**
     * Read chunk header
     * @param chunkId Chunk ID
     * @param header Output parameter for header
     * @return true if read successful
     */
    bool readChunkHeader(uint32_t chunkId, ChunkHeader& header);
    
    /**
     * Write chunk header
     * @param chunkId Chunk ID
     * @param header Header to write
     * @return true if write successful
     */
    bool writeChunkHeader(uint32_t chunkId, const ChunkHeader& header);
    
    // ========================================================================
    // Wear Leveling
    // ========================================================================
    
    /**
     * Get write count for chunk
     * @param chunkId Chunk ID
     * @return Write count
     */
    uint32_t getWriteCount(uint32_t chunkId);
    
    /**
     * Balance wear across chunks
     * Redistributes data to even out write counts
     */
    void balanceWear();
    
    /**
     * Get chunk with lowest write count
     * @return Chunk ID with lowest write count
     */
    uint32_t getLeastWornChunk();
    
    /**
     * Get average write count
     * @return Average write count across all chunks
     */
    uint32_t getAverageWriteCount();
    
    // ========================================================================
    // Garbage Collection
    // ========================================================================
    
    /**
     * Collect garbage (free unused chunks)
     */
    void collectGarbage();
    
    /**
     * Compact storage (defragment)
     */
    void compact();
    
    // ========================================================================
    // Status and Diagnostics
    // ========================================================================
    
    /**
     * Check if chunkstore is initialized
     * @return true if initialized
     */
    bool isInitialized() const { return initialized; }
    
    /**
     * Get total number of chunks
     * @return Total chunks
     */
    int getTotalChunks() const { return totalChunks; }
    
    /**
     * Get number of free chunks
     * @return Free chunks
     */
    int getFreeChunks() const;
    
    /**
     * Get number of allocated chunks
     * @return Allocated chunks
     */
    int getAllocatedChunks() const;
    
    /**
     * Get chunk size
     * @return Chunk size in bytes
     */
    int getChunkSize() const { return chunkSize; }
    
    /**
     * Get storage utilization percentage
     * @return Utilization (0-100)
     */
    int getUtilization() const;
    
    /**
     * Get last error message
     * @return Error message string
     */
    const char* getLastError() const { return lastError.c_str(); }
    
    /**
     * Run diagnostics
     * @return true if all checks pass
     */
    bool runDiagnostics();
    
private:
    // Configuration
    int csPin;
    int chunkSize;
    int totalChunks;
    
    // State
    bool initialized;
    std::string lastError;
    
    // Chunk metadata
    std::map<uint32_t, ChunkMetadata> chunkMetadata;
    uint32_t nextChunkId;
    
    // File handles
    std::map<int, FileHandle> openFiles;
    int nextHandle;
    
    // File directory (path -> first chunk ID)
    std::map<std::string, uint32_t> fileDirectory;
    
    // Helper methods
    void setError(const char* error);
    void clearError();
    uint16_t calculateCRC16(const uint8_t* data, int length);
    bool verifyChecksum(uint32_t chunkId);
    uint32_t getChunkOffset(uint32_t chunkId);
    bool isValidHandle(int handle);
    FileHandle* getFileHandle(int handle);
};

// Global chunkstore instance
extern SDChunkstore* globalChunkstore;

// Initialization helper
void initializeSDChunkstore(int csPin, int chunkSize = 512);

#endif // SD_CHUNKSTORE_H

// Made with Bob
