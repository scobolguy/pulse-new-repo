/**
 * ESP Virtual P-Machine: Dynamic Library System
 * 
 * Provides dynamic library loading, thunk-based binding, and lazy resolution
 * for the ESP Virtual P-Machine.
 * 
 * Features:
 * - JSON manifest-based library definition
 * - Thunk table for late binding
 * - Lazy loading and resolution
 * - Dependency management
 * - P-code segment loading
 * - Export table management
 * 
 * Author: ESP VM Team
 * Date: June 2026
 * Version: 1.0.0
 */

#ifndef PMACHINE_DYNAMIC_LIBRARY_H
#define PMACHINE_DYNAMIC_LIBRARY_H

#include <string>
#include <vector>
#include <map>
#include <memory>
#include <cstdint>

// ============================================================================
// LIBRARY MANIFEST STRUCTURES
// ============================================================================

/**
 * Function export definition
 */
struct LibraryExport {
    std::string name;           // Function name (e.g., "sha256")
    std::string signature;      // Type signature (e.g., "(string) -> string")
    uint16_t entryPoint;        // P-code entry point offset
    uint8_t paramCount;         // Number of parameters
    bool returnsValue;          // Whether function returns a value
};

/**
 * P-code segment definition
 */
struct PCodeSegment {
    uint32_t offset;            // Offset in library file
    uint32_t length;            // Length in bytes
    std::string checksum;       // SHA256 checksum for verification
    std::vector<uint8_t> code;  // Loaded P-code instructions
};

/**
 * Library manifest (loaded from JSON)
 */
struct LibraryManifest {
    std::string name;                       // Library name
    std::string version;                    // Semantic version
    std::vector<std::string> dependencies;  // Required libraries
    std::vector<LibraryExport> exports;     // Exported functions
    std::vector<PCodeSegment> pcodeSegments;// P-code segments
    std::string author;                     // Optional: author
    std::string description;                // Optional: description
};

// ============================================================================
// THUNK SYSTEM
// ============================================================================

/**
 * Thunk entry for late binding
 */
struct Thunk {
    std::string libraryName;    // Library providing the function
    std::string functionName;   // Function name
    uint16_t targetPC;          // Resolved program counter
    bool resolved;              // Whether thunk has been resolved
    uint32_t callCount;         // Number of times called (for profiling)
};

/**
 * Thunk table for managing late binding
 */
class ThunkTable {
public:
    /**
     * Register a new thunk
     * @param libraryName Library name
     * @param functionName Function name
     * @return Thunk ID
     */
    uint16_t registerThunk(const std::string& libraryName, 
                          const std::string& functionName);
    
    /**
     * Resolve a thunk to a target PC
     * @param thunkId Thunk ID
     * @param targetPC Target program counter
     * @return true if successful
     */
    bool resolveThunk(uint16_t thunkId, uint16_t targetPC);
    
    /**
     * Get thunk by ID
     * @param thunkId Thunk ID
     * @return Pointer to thunk or nullptr
     */
    Thunk* getThunk(uint16_t thunkId);
    
    /**
     * Get thunk by library and function name
     * @param libraryName Library name
     * @param functionName Function name
     * @return Pointer to thunk or nullptr
     */
    Thunk* findThunk(const std::string& libraryName, 
                     const std::string& functionName);
    
    /**
     * Clear all thunks
     */
    void clear();
    
    /**
     * Get statistics
     */
    size_t getThunkCount() const { return thunks.size(); }
    size_t getResolvedCount() const;

private:
    std::vector<Thunk> thunks;
    std::map<std::string, uint16_t> thunkIndex; // "library.function" -> thunk ID
};

// ============================================================================
// LOADED LIBRARY
// ============================================================================

/**
 * Loaded library instance
 */
struct LoadedLibrary {
    LibraryManifest manifest;           // Library manifest
    uint16_t basePC;                    // Base program counter for this library
    bool initialized;                   // Whether library has been initialized
    uint32_t loadTime;                  // Timestamp when loaded
    uint32_t refCount;                  // Reference count for unloading
    std::map<std::string, uint16_t> exportMap; // Function name -> absolute PC
};

// ============================================================================
// LIBRARY REGISTRY
// ============================================================================

/**
 * Library registry for managing loaded libraries
 */
class LibraryRegistry {
public:
    LibraryRegistry();
    ~LibraryRegistry();
    
    /**
     * Load a library from manifest
     * @param manifest Library manifest
     * @param basePC Base program counter to load at
     * @return true if successful
     */
    bool loadLibrary(const LibraryManifest& manifest, uint16_t basePC);
    
    /**
     * Unload a library
     * @param name Library name
     * @return true if successful
     */
    bool unloadLibrary(const std::string& name);
    
    /**
     * Check if library is loaded
     * @param name Library name
     * @return true if loaded
     */
    bool isLibraryLoaded(const std::string& name) const;
    
    /**
     * Get loaded library
     * @param name Library name
     * @return Pointer to loaded library or nullptr
     */
    LoadedLibrary* getLibrary(const std::string& name);
    
    /**
     * Resolve function address
     * @param libraryName Library name
     * @param functionName Function name
     * @return Absolute PC or 0 if not found
     */
    uint16_t resolveFunction(const std::string& libraryName, 
                            const std::string& functionName);
    
    /**
     * Get all loaded libraries
     */
    std::vector<std::string> getLoadedLibraries() const;
    
    /**
     * Clear all libraries
     */
    void clear();
    
    /**
     * Get statistics
     */
    size_t getLibraryCount() const { return libraries.size(); }

private:
    std::map<std::string, LoadedLibrary> libraries;
};

// ============================================================================
// DYNAMIC LIBRARY LOADER
// ============================================================================

/**
 * Dynamic library loader
 */
class DynamicLibraryLoader {
public:
    DynamicLibraryLoader(LibraryRegistry& registry, ThunkTable& thunkTable);
    
    /**
     * Load library from file
     * @param libraryPath Path to library manifest JSON
     * @param basePC Base program counter to load at
     * @return true if successful
     */
    bool loadLibraryFromFile(const std::string& libraryPath, uint16_t basePC);
    
    /**
     * Load library from JSON string
     * @param jsonManifest JSON manifest string
     * @param basePC Base program counter to load at
     * @return true if successful
     */
    bool loadLibraryFromJSON(const std::string& jsonManifest, uint16_t basePC);
    
    /**
     * Parse library manifest from JSON
     * @param json JSON string
     * @param manifest Output manifest
     * @return true if successful
     */
    bool parseManifest(const std::string& json, LibraryManifest& manifest);
    
    /**
     * Load dependencies recursively
     * @param dependencies List of dependency names
     * @param basePC Starting base PC
     * @return true if all dependencies loaded
     */
    bool loadDependencies(const std::vector<std::string>& dependencies, 
                         uint16_t& basePC);
    
    /**
     * Verify library checksum
     * @param segment P-code segment
     * @return true if checksum matches
     */
    bool verifyChecksum(const PCodeSegment& segment);
    
    /**
     * Register library exports in thunk table
     * @param libraryName Library name
     * @param exports Export list
     * @param basePC Base program counter
     * @return true if successful
     */
    bool registerExports(const std::string& libraryName,
                        const std::vector<LibraryExport>& exports,
                        uint16_t basePC);

private:
    LibraryRegistry& registry;
    ThunkTable& thunkTable;
    std::string librarySearchPath;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse function signature
 * @param signature Signature string (e.g., "(string, int) -> string")
 * @param paramTypes Output parameter types
 * @param returnType Output return type
 * @return true if valid signature
 */
bool parseSignature(const std::string& signature,
                   std::vector<std::string>& paramTypes,
                   std::string& returnType);

/**
 * Generate thunk key from library and function name
 * @param libraryName Library name
 * @param functionName Function name
 * @return Thunk key string
 */
std::string makeThunkKey(const std::string& libraryName, 
                        const std::string& functionName);

#endif // PMACHINE_DYNAMIC_LIBRARY_H

// Made with Bob
