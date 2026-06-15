# ESP Virtual P-Machine: Dynamic Library System

**Version:** 1.0.0  
**Date:** June 2026  
**Status:** Production Ready

---

## Overview

The Dynamic Library System provides runtime loading and linking of P-code libraries for the ESP Virtual P-Machine. It enables modular code organization, code reuse, and late binding through a thunk-based resolution mechanism.

### Key Features

- **JSON Manifest Format** - Declarative library definition
- **Thunk-Based Binding** - Late binding with lazy resolution
- **Dependency Management** - Automatic dependency loading
- **Reference Counting** - Safe library unloading
- **Export Tables** - Fast function lookup
- **Signature Parsing** - Type-safe function calls
- **Call Profiling** - Track function usage

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                  Dynamic Library System                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Library    │  │    Thunk     │  │   Dynamic    │  │
│  │   Registry   │  │    Table     │  │   Library    │  │
│  │              │  │              │  │    Loader    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                  │           │
│         └─────────────────┴──────────────────┘           │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
         ┌──────▼──────┐        ┌──────▼──────┐
         │  OP_DL_LOAD │        │  OP_DL_CALL │
         │  OP_DL_UNLOAD│       │  OP_DL_RESOLVE│
         └─────────────┘        └─────────────┘
```

### Data Structures

#### LibraryManifest
```cpp
struct LibraryManifest {
    std::string name;                       // Library name
    std::string version;                    // Semantic version
    std::vector<std::string> dependencies;  // Required libraries
    std::vector<LibraryExport> exports;     // Exported functions
    std::vector<PCodeSegment> pcodeSegments;// P-code segments
    std::string author;                     // Optional: author
    std::string description;                // Optional: description
};
```

#### LibraryExport
```cpp
struct LibraryExport {
    std::string name;           // Function name
    std::string signature;      // Type signature
    uint16_t entryPoint;        // P-code entry point offset
    uint8_t paramCount;         // Number of parameters
    bool returnsValue;          // Whether function returns a value
};
```

#### Thunk
```cpp
struct Thunk {
    std::string libraryName;    // Library providing the function
    std::string functionName;   // Function name
    uint16_t targetPC;          // Resolved program counter
    bool resolved;              // Whether thunk has been resolved
    uint32_t callCount;         // Number of times called
};
```

---

## Manifest Format

### Example: crypto-utils.manifest.json

```json
{
  "name": "crypto-utils",
  "version": "1.0.0",
  "author": "ESP VM Team",
  "description": "Cryptographic utility functions",
  "exports": [
    {
      "name": "sha256",
      "signature": "(string) -> string",
      "entryPoint": 0,
      "paramCount": 1,
      "returnsValue": true
    },
    {
      "name": "aes_encrypt",
      "signature": "(string, string) -> string",
      "entryPoint": 100,
      "paramCount": 2,
      "returnsValue": true
    }
  ],
  "dependencies": [],
  "pcodeSegments": [
    {
      "offset": 0,
      "length": 500,
      "checksum": "abc123def456"
    }
  ]
}
```

### Signature Format

Function signatures follow the pattern: `(param1, param2, ...) -> returnType`

**Examples:**
- `(string) -> string` - Single parameter, returns string
- `(int, int) -> int` - Two parameters, returns int
- `() -> void` - No parameters, no return value
- `(real, real) -> real` - Floating-point parameters

**Supported Types:**
- `int` / `integer`
- `real` / `float`
- `string`
- `boolean` / `bool`
- `void`
- `object`

---

## API Reference

### LibraryRegistry

#### loadLibrary
```cpp
bool loadLibrary(const LibraryManifest& manifest, uint16_t basePC);
```
Load a library into the registry at the specified base program counter.

**Parameters:**
- `manifest` - Library manifest
- `basePC` - Base program counter for library code

**Returns:** `true` if successful

#### unloadLibrary
```cpp
bool unloadLibrary(const std::string& name);
```
Unload a library (decrements reference count).

**Parameters:**
- `name` - Library name

**Returns:** `true` if successful

#### isLibraryLoaded
```cpp
bool isLibraryLoaded(const std::string& name) const;
```
Check if a library is currently loaded.

#### resolveFunction
```cpp
uint16_t resolveFunction(const std::string& libraryName, 
                        const std::string& functionName);
```
Resolve a function to its absolute program counter.

**Returns:** Absolute PC or 0 if not found

### ThunkTable

#### registerThunk
```cpp
uint16_t registerThunk(const std::string& libraryName, 
                      const std::string& functionName);
```
Register a new thunk for late binding.

**Returns:** Thunk ID

#### resolveThunk
```cpp
bool resolveThunk(uint16_t thunkId, uint16_t targetPC);
```
Resolve a thunk to a target program counter.

#### getThunk
```cpp
Thunk* getThunk(uint16_t thunkId);
```
Get thunk by ID.

**Returns:** Pointer to thunk or nullptr

### DynamicLibraryLoader

#### loadLibraryFromJSON
```cpp
bool loadLibraryFromJSON(const std::string& jsonManifest, uint16_t basePC);
```
Load a library from a JSON manifest string.

#### parseManifest
```cpp
bool parseManifest(const std::string& json, LibraryManifest& manifest);
```
Parse a JSON manifest into a LibraryManifest structure.

---

## Opcodes

### OP_DL_LOAD (0xA0)
Load a dynamic library.

**Stack:**
- Input: `[basePC]` (optional, default 10000)
- Output: `[result]` (1 = success, 0 = failure)

**Operand:** Library name (string)

**Example:**
```
OP_DL_LOAD "crypto-utils"
```

### OP_DL_CALL (0xA1)
Call a library function via thunk.

**Stack:**
- Input: `[arg1, arg2, ..., argN]`
- Output: `[returnValue]` (if function returns value)

**Operand:** Thunk ID (uint16_t)

**Behavior:**
1. Look up thunk by ID
2. If not resolved, perform lazy resolution
3. Save return address on stack
4. Jump to target PC

**Example:**
```
PUSH_STR "Hello, World!"
OP_DL_CALL 0  ; Call thunk 0 (e.g., sha256)
```

### OP_DL_UNLOAD (0xA2)
Unload a dynamic library.

**Stack:**
- Output: `[result]` (1 = success, 0 = failure)

**Operand:** Library name (string)

**Example:**
```
OP_DL_UNLOAD "crypto-utils"
```

### OP_DL_RESOLVE (0xA3)
Manually resolve a function address.

**Stack:**
- Input: `[libraryNameIdx, functionNameIdx]`
- Output: `[targetPC]` (0 if not found)

### OP_DL_LIST (0xA4)
List all loaded libraries.

**Stack:**
- Output: `[count]`

**Side Effect:** Prints library list to serial

---

## Usage Examples

### Example 1: Load and Call Library Function

```cpp
// Initialize system
initializeDynamicLibrarySystem();

// Load library
std::string manifest = R"({
    "name": "crypto-utils",
    "version": "1.0.0",
    "exports": [
        {
            "name": "sha256",
            "signature": "(string) -> string",
            "entryPoint": 0
        }
    ],
    "dependencies": [],
    "pcodeSegments": []
})";

globalLibraryLoader->loadLibraryFromJSON(manifest, 1000);

// Call function
uint16_t thunkId = globalThunkTable->registerThunk("crypto-utils", "sha256");
Thunk* thunk = globalThunkTable->getThunk(thunkId);

// Thunk is automatically resolved on first call
```

### Example 2: Pascalish Code

```pascal
program CryptoExample;

library "crypto-utils" from librarian;

var
  data: string;
  hash: string;

begin
  data := "Hello, World!";
  hash := crypto_utils.sha256(data);
  print("SHA256: ");
  print(hash);
  print_nl();
end.
```

### Example 3: Check Loaded Libraries

```cpp
std::vector<std::string> libraries = globalLibraryRegistry->getLoadedLibraries();

for (const auto& lib : libraries) {
    std::cout << "Loaded: " << lib << std::endl;
}
```

---

## Integration with VM

### Initialization

```cpp
// In main.cpp or VM initialization
#include "pmachine_dynamic_library.h"

void setup() {
    // Initialize dynamic library system
    initializeDynamicLibrarySystem();
    
    // Load standard libraries
    loadStandardLibraries();
}

void loop() {
    // VM execution loop
}

void cleanup() {
    // Shutdown dynamic library system
    shutdownDynamicLibrarySystem();
}
```

### VM State Integration

The dynamic library system maintains global state:
- `globalLibraryRegistry` - Loaded libraries
- `globalThunkTable` - Thunk table
- `globalLibraryLoader` - Library loader

These are automatically initialized on first use of any OP_DL_* opcode.

---

## Performance Considerations

### Lazy Resolution
- Thunks are resolved on first call
- Subsequent calls use cached target PC
- Minimal overhead after resolution

### Call Profiling
- Each thunk tracks call count
- Use for optimization decisions
- Identify hot paths

### Memory Usage
- Each library: ~100-500 bytes (manifest + exports)
- Each thunk: ~40 bytes
- P-code segments: Variable (loaded on demand)

### Optimization Tips
1. **Preload frequently used libraries** at startup
2. **Batch library loads** to reduce overhead
3. **Unload unused libraries** to free memory
4. **Use reference counting** to prevent premature unloading

---

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
cd virtualMachines/esp32
g++ -std=c++11 \
    src/pmachine_dynamic_library.cpp \
    src/pmachine_dynamic_library_test.cpp \
    -I src \
    -o test_dynamic_library

./test_dynamic_library
```

### Test Coverage

- ✅ Thunk table operations (5 tests)
- ✅ Library registry operations (5 tests)
- ✅ Dynamic library loader (3 tests)
- ✅ Helper functions (4 tests)
- ✅ Integration workflow (1 test)

**Total: 18 tests**

---

## Troubleshooting

### Library Not Found
**Symptom:** `OP_DL_LOAD` returns 0

**Solutions:**
- Check library name spelling
- Verify manifest file exists
- Check file permissions
- Verify JSON format

### Function Not Resolved
**Symptom:** `OP_DL_CALL` returns -1

**Solutions:**
- Verify library is loaded
- Check function name in manifest
- Verify export entry point
- Check thunk registration

### Memory Issues
**Symptom:** System crashes or hangs

**Solutions:**
- Reduce number of loaded libraries
- Unload unused libraries
- Increase heap size
- Check for memory leaks

---

## Future Enhancements

### Planned Features
- [ ] Hot reloading of libraries
- [ ] Library versioning and compatibility checks
- [ ] Compressed P-code segments
- [ ] Encrypted library files
- [ ] Remote library loading (HTTP)
- [ ] Library dependency graph visualization

### Phase 8 Integration
- SD chunkstore integration for library storage
- Wear-leveling for library files
- Chunked P-code segment loading

---

## References

### Related Documentation
- **Target Architecture:** `documents/ESP_VIRTUAL_PMACHINE_TARGET_ARCHITECTURE_V2026.md`
- **Scheduler:** `src/SCHEDULER_README.md`
- **Extended Opcodes:** `src/pmachine_opcodes_extended.h`
- **Phase 5 Guide:** `dsl/PHASE5_IMPLEMENTATION_GUIDE.md`

### Source Files
- **Header:** `src/pmachine_dynamic_library.h`
- **Implementation:** `src/pmachine_dynamic_library.cpp`
- **Tests:** `src/pmachine_dynamic_library_test.cpp`
- **Opcodes:** `src/pmachine_opcodes_extended.cpp`

### Example Libraries
- `libraries/crypto-utils.manifest.json`
- `libraries/json-parser.manifest.json`
- `libraries/math-extended.manifest.json`

---

**Last Updated:** June 11, 2026  
**Maintainer:** ESP VM Team  
**License:** See LICENSE file