/**
 * ESP Virtual P-Machine: Dynamic Library System Unit Tests
 * 
 * Comprehensive test suite for dynamic library loading, thunk resolution,
 * and library registry management.
 */

#include "pmachine_dynamic_library.h"
#include <cassert>
#include <iostream>
#include <sstream>

// Test counter
static int testsRun = 0;
static int testsPassed = 0;

// Test helper macros
#define TEST(name) \
    void test_##name(); \
    void run_test_##name() { \
        testsRun++; \
        std::cout << "Running test: " << #name << "..."; \
        try { \
            test_##name(); \
            testsPassed++; \
            std::cout << " PASSED" << std::endl; \
        } catch (const std::exception& e) { \
            std::cout << " FAILED: " << e.what() << std::endl; \
        } \
    } \
    void test_##name()

#define ASSERT(condition) \
    if (!(condition)) { \
        throw std::runtime_error("Assertion failed: " #condition); \
    }

#define ASSERT_EQ(a, b) \
    if ((a) != (b)) { \
        std::ostringstream oss; \
        oss << "Expected " << (b) << " but got " << (a); \
        throw std::runtime_error(oss.str()); \
    }

// ============================================================================
// THUNK TABLE TESTS
// ============================================================================

TEST(thunk_table_register) {
    ThunkTable table;
    
    uint16_t id1 = table.registerThunk("crypto-utils", "sha256");
    uint16_t id2 = table.registerThunk("json-parser", "parse");
    
    ASSERT_EQ(id1, 0);
    ASSERT_EQ(id2, 1);
    ASSERT_EQ(table.getThunkCount(), 2);
}

TEST(thunk_table_duplicate_registration) {
    ThunkTable table;
    
    uint16_t id1 = table.registerThunk("crypto-utils", "sha256");
    uint16_t id2 = table.registerThunk("crypto-utils", "sha256");
    
    // Should return same ID for duplicate
    ASSERT_EQ(id1, id2);
    ASSERT_EQ(table.getThunkCount(), 1);
}

TEST(thunk_table_resolve) {
    ThunkTable table;
    
    uint16_t id = table.registerThunk("crypto-utils", "sha256");
    Thunk* thunk = table.getThunk(id);
    
    ASSERT(thunk != nullptr);
    ASSERT(!thunk->resolved);
    
    bool success = table.resolveThunk(id, 1000);
    ASSERT(success);
    ASSERT(thunk->resolved);
    ASSERT_EQ(thunk->targetPC, 1000);
}

TEST(thunk_table_find) {
    ThunkTable table;
    
    table.registerThunk("crypto-utils", "sha256");
    table.registerThunk("json-parser", "parse");
    
    Thunk* thunk = table.findThunk("json-parser", "parse");
    ASSERT(thunk != nullptr);
    ASSERT_EQ(thunk->libraryName, "json-parser");
    ASSERT_EQ(thunk->functionName, "parse");
    
    Thunk* notFound = table.findThunk("nonexistent", "function");
    ASSERT(notFound == nullptr);
}

TEST(thunk_table_resolved_count) {
    ThunkTable table;
    
    uint16_t id1 = table.registerThunk("lib1", "func1");
    uint16_t id2 = table.registerThunk("lib2", "func2");
    uint16_t id3 = table.registerThunk("lib3", "func3");
    
    ASSERT_EQ(table.getResolvedCount(), 0);
    
    table.resolveThunk(id1, 100);
    ASSERT_EQ(table.getResolvedCount(), 1);
    
    table.resolveThunk(id2, 200);
    ASSERT_EQ(table.getResolvedCount(), 2);
    
    table.resolveThunk(id3, 300);
    ASSERT_EQ(table.getResolvedCount(), 3);
}

// ============================================================================
// LIBRARY REGISTRY TESTS
// ============================================================================

TEST(library_registry_load) {
    LibraryRegistry registry;
    
    LibraryManifest manifest;
    manifest.name = "test-lib";
    manifest.version = "1.0.0";
    
    LibraryExport exp;
    exp.name = "testFunc";
    exp.entryPoint = 50;
    manifest.exports.push_back(exp);
    
    bool success = registry.loadLibrary(manifest, 1000);
    ASSERT(success);
    ASSERT(registry.isLibraryLoaded("test-lib"));
    ASSERT_EQ(registry.getLibraryCount(), 1);
}

TEST(library_registry_duplicate_load) {
    LibraryRegistry registry;
    
    LibraryManifest manifest;
    manifest.name = "test-lib";
    manifest.version = "1.0.0";
    
    registry.loadLibrary(manifest, 1000);
    bool secondLoad = registry.loadLibrary(manifest, 2000);
    
    // Should succeed but not create duplicate
    ASSERT(secondLoad);
    ASSERT_EQ(registry.getLibraryCount(), 1);
}

TEST(library_registry_resolve_function) {
    LibraryRegistry registry;
    
    LibraryManifest manifest;
    manifest.name = "test-lib";
    manifest.version = "1.0.0";
    
    LibraryExport exp;
    exp.name = "testFunc";
    exp.entryPoint = 50;
    manifest.exports.push_back(exp);
    
    registry.loadLibrary(manifest, 1000);
    
    uint16_t pc = registry.resolveFunction("test-lib", "testFunc");
    ASSERT_EQ(pc, 1050); // basePC + entryPoint
    
    uint16_t notFound = registry.resolveFunction("test-lib", "nonexistent");
    ASSERT_EQ(notFound, 0);
}

TEST(library_registry_unload) {
    LibraryRegistry registry;
    
    LibraryManifest manifest;
    manifest.name = "test-lib";
    manifest.version = "1.0.0";
    
    registry.loadLibrary(manifest, 1000);
    ASSERT(registry.isLibraryLoaded("test-lib"));
    
    bool success = registry.unloadLibrary("test-lib");
    ASSERT(success);
    ASSERT(!registry.isLibraryLoaded("test-lib"));
}

TEST(library_registry_get_loaded_libraries) {
    LibraryRegistry registry;
    
    LibraryManifest lib1, lib2, lib3;
    lib1.name = "lib1";
    lib2.name = "lib2";
    lib3.name = "lib3";
    
    registry.loadLibrary(lib1, 1000);
    registry.loadLibrary(lib2, 2000);
    registry.loadLibrary(lib3, 3000);
    
    std::vector<std::string> loaded = registry.getLoadedLibraries();
    ASSERT_EQ(loaded.size(), 3);
}

// ============================================================================
// DYNAMIC LIBRARY LOADER TESTS
// ============================================================================

TEST(loader_parse_manifest) {
    LibraryRegistry registry;
    ThunkTable thunkTable;
    DynamicLibraryLoader loader(registry, thunkTable);
    
    std::string json = R"({
        "name": "test-lib",
        "version": "1.0.0",
        "author": "Test Author",
        "description": "Test library",
        "exports": [
            {
                "name": "func1",
                "signature": "(string) -> string",
                "entryPoint": 0
            },
            {
                "name": "func2",
                "signature": "(int, int) -> int",
                "entryPoint": 50
            }
        ],
        "dependencies": [],
        "pcodeSegments": [
            {
                "offset": 0,
                "length": 100,
                "checksum": "abc123"
            }
        ]
    })";
    
    LibraryManifest manifest;
    bool success = loader.parseManifest(json, manifest);
    
    ASSERT(success);
    ASSERT_EQ(manifest.name, "test-lib");
    ASSERT_EQ(manifest.version, "1.0.0");
    ASSERT_EQ(manifest.author, "Test Author");
    ASSERT_EQ(manifest.exports.size(), 2);
    ASSERT_EQ(manifest.exports[0].name, "func1");
    ASSERT_EQ(manifest.exports[1].name, "func2");
    ASSERT_EQ(manifest.pcodeSegments.size(), 1);
}

TEST(loader_load_from_json) {
    LibraryRegistry registry;
    ThunkTable thunkTable;
    DynamicLibraryLoader loader(registry, thunkTable);
    
    std::string json = R"({
        "name": "test-lib",
        "version": "1.0.0",
        "exports": [
            {
                "name": "testFunc",
                "signature": "(string) -> string",
                "entryPoint": 0
            }
        ],
        "dependencies": [],
        "pcodeSegments": []
    })";
    
    bool success = loader.loadLibraryFromJSON(json, 1000);
    ASSERT(success);
    ASSERT(registry.isLibraryLoaded("test-lib"));
}

TEST(loader_register_exports) {
    LibraryRegistry registry;
    ThunkTable thunkTable;
    DynamicLibraryLoader loader(registry, thunkTable);
    
    std::vector<LibraryExport> exports;
    
    LibraryExport exp1;
    exp1.name = "func1";
    exp1.entryPoint = 0;
    exports.push_back(exp1);
    
    LibraryExport exp2;
    exp2.name = "func2";
    exp2.entryPoint = 50;
    exports.push_back(exp2);
    
    bool success = loader.registerExports("test-lib", exports, 1000);
    ASSERT(success);
    
    // Check thunks were registered
    Thunk* thunk1 = thunkTable.findThunk("test-lib", "func1");
    Thunk* thunk2 = thunkTable.findThunk("test-lib", "func2");
    
    ASSERT(thunk1 != nullptr);
    ASSERT(thunk2 != nullptr);
    ASSERT(thunk1->resolved);
    ASSERT(thunk2->resolved);
    ASSERT_EQ(thunk1->targetPC, 1000);
    ASSERT_EQ(thunk2->targetPC, 1050);
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

TEST(parse_signature_simple) {
    std::vector<std::string> paramTypes;
    std::string returnType;
    
    bool success = parseSignature("(string) -> string", paramTypes, returnType);
    
    ASSERT(success);
    ASSERT_EQ(paramTypes.size(), 1);
    ASSERT_EQ(paramTypes[0], "string");
    ASSERT_EQ(returnType, "string");
}

TEST(parse_signature_multiple_params) {
    std::vector<std::string> paramTypes;
    std::string returnType;
    
    bool success = parseSignature("(int, string, real) -> boolean", paramTypes, returnType);
    
    ASSERT(success);
    ASSERT_EQ(paramTypes.size(), 3);
    ASSERT_EQ(paramTypes[0], "int");
    ASSERT_EQ(paramTypes[1], "string");
    ASSERT_EQ(paramTypes[2], "real");
    ASSERT_EQ(returnType, "boolean");
}

TEST(parse_signature_no_params) {
    std::vector<std::string> paramTypes;
    std::string returnType;
    
    bool success = parseSignature("() -> void", paramTypes, returnType);
    
    ASSERT(success);
    ASSERT_EQ(paramTypes.size(), 0);
    ASSERT_EQ(returnType, "void");
}

TEST(make_thunk_key) {
    std::string key = makeThunkKey("crypto-utils", "sha256");
    ASSERT_EQ(key, "crypto-utils.sha256");
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

TEST(integration_full_workflow) {
    LibraryRegistry registry;
    ThunkTable thunkTable;
    DynamicLibraryLoader loader(registry, thunkTable);
    
    // Load library
    std::string json = R"({
        "name": "crypto-utils",
        "version": "1.0.0",
        "exports": [
            {
                "name": "sha256",
                "signature": "(string) -> string",
                "entryPoint": 0
            },
            {
                "name": "md5",
                "signature": "(string) -> string",
                "entryPoint": 50
            }
        ],
        "dependencies": [],
        "pcodeSegments": []
    })";
    
    bool loadSuccess = loader.loadLibraryFromJSON(json, 1000);
    ASSERT(loadSuccess);
    
    // Verify library is loaded
    ASSERT(registry.isLibraryLoaded("crypto-utils"));
    
    // Resolve functions
    uint16_t sha256PC = registry.resolveFunction("crypto-utils", "sha256");
    uint16_t md5PC = registry.resolveFunction("crypto-utils", "md5");
    
    ASSERT_EQ(sha256PC, 1000);
    ASSERT_EQ(md5PC, 1050);
    
    // Verify thunks
    Thunk* sha256Thunk = thunkTable.findThunk("crypto-utils", "sha256");
    Thunk* md5Thunk = thunkTable.findThunk("crypto-utils", "md5");
    
    ASSERT(sha256Thunk != nullptr);
    ASSERT(md5Thunk != nullptr);
    ASSERT(sha256Thunk->resolved);
    ASSERT(md5Thunk->resolved);
    
    // Unload library
    bool unloadSuccess = registry.unloadLibrary("crypto-utils");
    ASSERT(unloadSuccess);
    ASSERT(!registry.isLibraryLoaded("crypto-utils"));
}

// ============================================================================
// TEST RUNNER
// ============================================================================

int main() {
    std::cout << "==================================================" << std::endl;
    std::cout << "ESP Virtual P-Machine: Dynamic Library Tests" << std::endl;
    std::cout << "==================================================" << std::endl;
    std::cout << std::endl;
    
    // Run all tests
    run_test_thunk_table_register();
    run_test_thunk_table_duplicate_registration();
    run_test_thunk_table_resolve();
    run_test_thunk_table_find();
    run_test_thunk_table_resolved_count();
    
    run_test_library_registry_load();
    run_test_library_registry_duplicate_load();
    run_test_library_registry_resolve_function();
    run_test_library_registry_unload();
    run_test_library_registry_get_loaded_libraries();
    
    run_test_loader_parse_manifest();
    run_test_loader_load_from_json();
    run_test_loader_register_exports();
    
    run_test_parse_signature_simple();
    run_test_parse_signature_multiple_params();
    run_test_parse_signature_no_params();
    run_test_make_thunk_key();
    
    run_test_integration_full_workflow();
    
    // Print summary
    std::cout << std::endl;
    std::cout << "==================================================" << std::endl;
    std::cout << "Test Summary" << std::endl;
    std::cout << "==================================================" << std::endl;
    std::cout << "Tests run: " << testsRun << std::endl;
    std::cout << "Tests passed: " << testsPassed << std::endl;
    std::cout << "Tests failed: " << (testsRun - testsPassed) << std::endl;
    std::cout << "Success rate: " << (testsPassed * 100 / testsRun) << "%" << std::endl;
    std::cout << "==================================================" << std::endl;
    
    return (testsRun == testsPassed) ? 0 : 1;
}

// Made with Bob
