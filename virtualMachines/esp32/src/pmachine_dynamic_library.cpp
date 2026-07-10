/**
 * ESP Virtual P-Machine: Dynamic Library System Implementation
 *
 * Implementation of dynamic library loading, thunk resolution, and
 * library registry management.
 */

#include <Arduino.h>
#include "serial_compat.h"
#include <ArduinoJson.h>
#include "pmachine_dynamic_library.h"
#include <algorithm>
#include <sstream>
#include <ctime>

// ============================================================================
// THUNK TABLE IMPLEMENTATION
// ============================================================================

uint16_t ThunkTable::registerThunk(const std::string& libraryName, 
                                   const std::string& functionName) {
    std::string key = makeThunkKey(libraryName, functionName);
    
    // Check if thunk already exists
    auto it = thunkIndex.find(key);
    if (it != thunkIndex.end()) {
        return it->second;
    }
    
    // Create new thunk
    Thunk thunk;
    thunk.libraryName = libraryName;
    thunk.functionName = functionName;
    thunk.targetPC = 0;
    thunk.resolved = false;
    thunk.callCount = 0;
    
    uint16_t thunkId = thunks.size();
    thunks.push_back(thunk);
    thunkIndex[key] = thunkId;
    
    return thunkId;
}

bool ThunkTable::resolveThunk(uint16_t thunkId, uint16_t targetPC) {
    if (thunkId >= thunks.size()) {
        return false;
    }
    
    thunks[thunkId].targetPC = targetPC;
    thunks[thunkId].resolved = true;
    
    return true;
}

Thunk* ThunkTable::getThunk(uint16_t thunkId) {
    if (thunkId >= thunks.size()) {
        return nullptr;
    }
    return &thunks[thunkId];
}

Thunk* ThunkTable::findThunk(const std::string& libraryName, 
                             const std::string& functionName) {
    std::string key = makeThunkKey(libraryName, functionName);
    auto it = thunkIndex.find(key);
    
    if (it == thunkIndex.end()) {
        return nullptr;
    }
    
    return &thunks[it->second];
}

void ThunkTable::clear() {
    thunks.clear();
    thunkIndex.clear();
}

size_t ThunkTable::getResolvedCount() const {
    size_t count = 0;
    for (const auto& thunk : thunks) {
        if (thunk.resolved) {
            count++;
        }
    }
    return count;
}

// ============================================================================
// LIBRARY REGISTRY IMPLEMENTATION
// ============================================================================

LibraryRegistry::LibraryRegistry() {
}

LibraryRegistry::~LibraryRegistry() {
    clear();
}

bool LibraryRegistry::loadLibrary(const LibraryManifest& manifest, uint16_t basePC) {
    // Check if already loaded
    if (isLibraryLoaded(manifest.name)) {
        SERIAL_PRINTF("Library %s already loaded\n", manifest.name.c_str());
        return true;
    }
    
    // Create loaded library instance
    LoadedLibrary library;
    library.manifest = manifest;
    library.basePC = basePC;
    library.initialized = false;
#if defined(PLATFORM_RPIB)
    library.loadTime = static_cast<uint32_t>(std::time(nullptr));
#else
    library.loadTime = millis();
#endif
    library.refCount = 1;
    
    // Build export map
    for (const auto& exp : manifest.exports) {
        uint16_t absolutePC = basePC + exp.entryPoint;
        library.exportMap[exp.name] = absolutePC;
    }
    
    // Add to registry
    libraries[manifest.name] = library;
    
    SERIAL_PRINTF("Loaded library: %s v%s (%u exports)\n",
                  manifest.name.c_str(),
                  manifest.version.c_str(),
                  static_cast<unsigned>(manifest.exports.size()));
    
    return true;
}

bool LibraryRegistry::unloadLibrary(const std::string& name) {
    auto it = libraries.find(name);
    if (it == libraries.end()) {
        return false;
    }
    
    // Decrement reference count
    it->second.refCount--;
    
    // Only unload if no more references
    if (it->second.refCount == 0) {
        SERIAL_PRINTF("Unloading library: %s\n", name.c_str());
        libraries.erase(it);
    }
    
    return true;
}

bool LibraryRegistry::isLibraryLoaded(const std::string& name) const {
    return libraries.find(name) != libraries.end();
}

LoadedLibrary* LibraryRegistry::getLibrary(const std::string& name) {
    auto it = libraries.find(name);
    if (it == libraries.end()) {
        return nullptr;
    }
    return &it->second;
}

uint16_t LibraryRegistry::resolveFunction(const std::string& libraryName, 
                                         const std::string& functionName) {
    auto library = getLibrary(libraryName);
    if (!library) {
        return 0;
    }
    
    auto it = library->exportMap.find(functionName);
    if (it == library->exportMap.end()) {
        return 0;
    }
    
    return it->second;
}

std::vector<std::string> LibraryRegistry::getLoadedLibraries() const {
    std::vector<std::string> names;
    for (const auto& pair : libraries) {
        names.push_back(pair.first);
    }
    return names;
}

void LibraryRegistry::clear() {
    libraries.clear();
}

// ============================================================================
// DYNAMIC LIBRARY LOADER IMPLEMENTATION
// ============================================================================

DynamicLibraryLoader::DynamicLibraryLoader(LibraryRegistry& registry, 
                                           ThunkTable& thunkTable)
    : registry(registry), thunkTable(thunkTable), librarySearchPath("/libraries/") {
}

bool DynamicLibraryLoader::loadLibraryFromFile(const std::string& libraryPath,
                                               uint16_t basePC) {
    // TODO: Implement file loading from SD card
    // For now, return error
    SERIAL_PRINTF("ERROR: File loading not yet implemented: %s\n", libraryPath.c_str());
    return false;
}

bool DynamicLibraryLoader::loadLibraryFromJSON(const std::string& jsonManifest, 
                                               uint16_t basePC) {
    LibraryManifest manifest;
    
    // Parse manifest
    if (!parseManifest(jsonManifest, manifest)) {
        SERIAL_PRINTLN("ERROR: Failed to parse library manifest");
        return false;
    }
    
    // Load dependencies first
    uint16_t depBasePC = basePC;
    if (!loadDependencies(manifest.dependencies, depBasePC)) {
        SERIAL_PRINTLN("ERROR: Failed to load dependencies");
        return false;
    }
    
    // Load library
    if (!registry.loadLibrary(manifest, basePC)) {
        SERIAL_PRINTLN("ERROR: Failed to load library into registry");
        return false;
    }
    
    // Register exports in thunk table
    if (!registerExports(manifest.name, manifest.exports, basePC)) {
        SERIAL_PRINTLN("ERROR: Failed to register exports");
        return false;
    }
    
    return true;
}

bool DynamicLibraryLoader::parseManifest(const std::string& json, 
                                        LibraryManifest& manifest) {
    // Use ArduinoJson for parsing
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, json);
    
    if (error) {
        SERIAL_PRINTF("JSON parse error: %s\n", error.c_str());
        return false;
    }
    
    // Parse basic fields
    manifest.name = doc["name"].as<std::string>();
    manifest.version = doc["version"].as<std::string>();
    
    if (doc["author"].is<const char*>()) {
        manifest.author = doc["author"].as<std::string>();
    }
    
    if (doc["description"].is<const char*>()) {
        manifest.description = doc["description"].as<std::string>();
    }
    
    // Parse dependencies
    if (doc["dependencies"].is<JsonArray>()) {
        JsonArray deps = doc["dependencies"];
        for (JsonVariant dep : deps) {
            manifest.dependencies.push_back(dep.as<std::string>());
        }
    }
    
    // Parse exports
    if (doc["exports"].is<JsonArray>()) {
        JsonArray exports = doc["exports"];
        for (JsonVariant expVar : exports) {
            JsonObject expObj = expVar.as<JsonObject>();
            
            LibraryExport exp;
            exp.name = expObj["name"].as<std::string>();
            exp.signature = expObj["signature"].as<std::string>();
            exp.entryPoint = expObj["entryPoint"].as<uint16_t>();
            
            // Parse signature to get param count and return type
            std::vector<std::string> paramTypes;
            std::string returnType;
            if (parseSignature(exp.signature, paramTypes, returnType)) {
                exp.paramCount = paramTypes.size();
                exp.returnsValue = (returnType != "void");
            } else {
                exp.paramCount = 0;
                exp.returnsValue = false;
            }
            
            manifest.exports.push_back(exp);
        }
    }
    
    // Parse P-code segments
    if (doc["pcodeSegments"].is<JsonArray>()) {
        JsonArray segments = doc["pcodeSegments"];
        for (JsonVariant segVar : segments) {
            JsonObject segObj = segVar.as<JsonObject>();
            
            PCodeSegment segment;
            segment.offset = segObj["offset"].as<uint32_t>();
            segment.length = segObj["length"].as<uint32_t>();
            segment.checksum = segObj["checksum"].as<std::string>();
            
            // TODO: Load actual P-code data
            // For now, just store metadata
            
            manifest.pcodeSegments.push_back(segment);
        }
    }
    
    return true;
}

bool DynamicLibraryLoader::loadDependencies(const std::vector<std::string>& dependencies, 
                                           uint16_t& basePC) {
    for (const auto& depName : dependencies) {
        // Check if already loaded
        if (registry.isLibraryLoaded(depName)) {
            continue;
        }
        
        // Try to load dependency
        std::string depPath = librarySearchPath + depName + ".json";
        if (!loadLibraryFromFile(depPath, basePC)) {
            SERIAL_PRINTF("ERROR: Failed to load dependency: %s\n", depName.c_str());
            return false;
        }
        
        // Advance base PC for next library
        // TODO: Calculate actual size from loaded library
        basePC += 1000; // Placeholder
    }
    
    return true;
}

bool DynamicLibraryLoader::verifyChecksum(const PCodeSegment& segment) {
    // TODO: Implement SHA256 checksum verification
    // For now, always return true
    return true;
}

bool DynamicLibraryLoader::registerExports(const std::string& libraryName,
                                          const std::vector<LibraryExport>& exports,
                                          uint16_t basePC) {
    for (const auto& exp : exports) {
        // Register thunk
        uint16_t thunkId = thunkTable.registerThunk(libraryName, exp.name);
        
        // Resolve thunk immediately (eager binding)
        uint16_t absolutePC = basePC + exp.entryPoint;
        thunkTable.resolveThunk(thunkId, absolutePC);
        
        SERIAL_PRINTF("  Registered: %s.%s -> PC %d\n",
                      libraryName.c_str(),
                      exp.name.c_str(),
                      absolutePC);
    }
    
    return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

bool parseSignature(const std::string& signature,
                   std::vector<std::string>& paramTypes,
                   std::string& returnType) {
    // Parse signature format: "(type1, type2, ...) -> returnType"
    // or just "() -> returnType" for no parameters
    
    paramTypes.clear();
    returnType = "void";
    
    // Find opening and closing parentheses
    size_t openParen = signature.find('(');
    size_t closeParen = signature.find(')');
    
    if (openParen == std::string::npos || closeParen == std::string::npos) {
        return false;
    }
    
    // Extract parameter list
    std::string paramList = signature.substr(openParen + 1, closeParen - openParen - 1);
    
    // Parse parameters
    if (!paramList.empty()) {
        std::istringstream iss(paramList);
        std::string param;
        while (std::getline(iss, param, ',')) {
            // Trim whitespace
            param.erase(0, param.find_first_not_of(" \t"));
            param.erase(param.find_last_not_of(" \t") + 1);
            
            if (!param.empty()) {
                paramTypes.push_back(param);
            }
        }
    }
    
    // Find return type
    size_t arrowPos = signature.find("->");
    if (arrowPos != std::string::npos) {
        returnType = signature.substr(arrowPos + 2);
        // Trim whitespace
        returnType.erase(0, returnType.find_first_not_of(" \t"));
        returnType.erase(returnType.find_last_not_of(" \t") + 1);
    }
    
    return true;
}

std::string makeThunkKey(const std::string& libraryName, 
                        const std::string& functionName) {
    return libraryName + "." + functionName;
}

// Made with Bob
