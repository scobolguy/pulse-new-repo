#include "ffs/FederatedFileSystem.h"
// pmachine.h
// ESPVM Portable P Machine - Header
#pragma once
#include <map>
#include <vector>
#include <string>
#include <cstdint>

namespace pmachine {

// Global enumerated type for the VM
enum class GlobalType {
    TYPE_INT,
    TYPE_FLOAT,
    TYPE_STRING,
    TYPE_BOOL,
    // Add more as needed
};

// String pool for the VM
class StringPool {
public:
    uint16_t add(const std::string& str);
    const std::string& get(uint16_t idx) const;
    std::vector<std::string> getAll() const;
private:
    std::vector<std::string> pool;
};

// Pcode and memory map types
using PCodeMap = std::map<uint16_t, uint8_t>;
using MemoryMap = std::map<uint16_t, uint32_t>;


struct Status {
    int numPages;
    std::string backingFile;
    size_t maxSpace;
    std::vector<std::string> dynamicLibs;
    bool running;
    uint16_t pc;
    std::vector<uint16_t> breakpoints;
};

class PMachine {
public:
    // File handle/line I/O (delegates to FFS)
    int openFile(const String &logicalName, const String &mode);
    bool closeFile(int handle);
    bool readLine(int handle, String &outLine);
    bool writeLine(int handle, const String &line);
    // Set the FederatedFileSystem pointer after construction
    void setFFS(FederatedFileSystem *ffsPtr) { ffs = ffsPtr; }
    PMachine();
    // Service interface
    const PCodeMap& getPCodeMap() const;
    const MemoryMap& getMemoryMap() const;
    const std::vector<std::string> getStringPool() const;
    std::map<std::string, int> getEnumTypes() const;
    pmachine::Status getStatus() const;
    // Program loading/execution
    bool loadProgram(const std::vector<uint8_t>& pcode, const std::string& backingFile, size_t maxSpace);
    void run();
    void singleStep();
    void setBreakpoint(uint16_t pc);
    void clearBreakpoint(uint16_t pc);
    void clearAllBreakpoints();
private:
    FederatedFileSystem *ffs = nullptr;
    PCodeMap pcodeMap;
    MemoryMap memoryMap;
    StringPool stringPool;
    std::map<std::string, int> enumTypes;
    // Status fields
    int numPages = 0;
    std::string backingFile = "";
    size_t maxSpace = 0;
    std::vector<std::string> dynamicLibs;
    bool running = false;
    uint16_t pc = 0;
    std::vector<uint16_t> breakpoints;
};

} // namespace pmachine
