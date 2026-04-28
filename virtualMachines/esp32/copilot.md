# Key Working Files in This Project

This document summarizes the main files that make up the ESP Federated File System and related infrastructure. Use this as a quick reference for navigation and understanding the codebase.

---

## Top-Level Project Structure
- **platformio.ini**: Main PlatformIO configuration for all environments (ESP32, ESP8266, Pico W).
- **data/web/**: Web assets served by the device (HTML, etc).
- **documents/**: Project documentation, specs, and API docs.
- **dsl/**: Domain-specific language and compiler service files.
- **src/**: Main source code for firmware and services.

---

## Main Source Files (`src/`)
- **main.cpp**
  - Entry point for firmware.
  - Sets up config, web server, FFS endpoints, federation, and pmachine (if enabled).
  - Handles all HTTP endpoints for file/directory management, federation, and service advertisement.
  - Contains conditional logic for ESP32/ESP8266/Pico W, SD/LittleFS, and compile-time feature flags.

- **pmachine.h / pmachine.cpp**
  - Portable virtual machine for script execution.
  - Provides file handle and line-based I/O methods, delegating to FederatedFileSystem.
  - All code is wrapped in `#ifdef ENABLE_PMACHINE` for optional inclusion.

- **ffs/FederatedFileSystem.h / FederatedFileSystem.cpp**
  - Abstraction layer for file operations across LittleFS, SD, and federated nodes.
  - Handles dynamic backend selection, federation logic, file handle management, and line-based I/O.
  - Implements chunked HTTP transfer and CRC validation for robust federation.

---

## Configuration and Schema
- **ConfigSchema.h**
  - Defines schema/type manager for DRY, extensible config (de)serialization.
  - Used by main.cpp for all config I/O.

---

## Documentation
- **documents/FFS_API.md**
  - HTTP API documentation for the Federated File System endpoints.
- **documents/ESPVM_Architecture_Spec_v1.0.txt**
  - High-level architecture and design notes.

---

## DSL and Compiler
- **dsl/languages/PulseSys/**
  - Grammar and language definition for PulseSys DSL.
- **dsl/services/Pulse0Compiler/**
  - Compiler service, parser generation scripts, and related code.

---

## Testing
- **src/ffs/tests/**
  - Test programs and scripts for FFS and related modules.

---

## Notes
- All file and directory operations are portable and robust, supporting both LittleFS and SD (ESP32).
- Federation and advanced features are implemented in FederatedFileSystem and exposed via HTTP endpoints in main.cpp.
- Pico W support and multi-main program structure are handled via PlatformIO environments and conditional compilation.
