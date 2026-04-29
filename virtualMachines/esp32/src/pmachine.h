// Minimal, clean, and buildable header for pmachine

#pragma once
#include <Arduino.h> // For String
#include <map>
#include <vector>
#include <string>
#include <cstdint>
#include "ffs/FederatedFileSystem.h"

namespace pmachine {

enum Opcode : uint8_t {
    OP_NOP = 0x00,
    OP_PUSH_STR = 0x01,
    OP_PUSH_INT = 0x10,
    OP_ADD = 0x11,
    OP_SUB = 0x12,
    OP_MUL = 0x13,
    OP_DIV = 0x14,
    OP_PRINT = 0x02,
    OP_PRINT_INT = 0x15,
    OP_HALT = 0xFF,
};

enum class OperandType { NONE, INT, STRING };
struct PInstruction {
    uint8_t opcode;
    OperandType type = OperandType::NONE;
    int intOperand = 0;
    std::string strOperand;
};

inline uint8_t opcodeFromMnemonic(const std::string& mnemonic) {
    if (mnemonic == "PUSH_STR") return pmachine::OP_PUSH_STR;
    if (mnemonic == "PUSH_INT") return pmachine::OP_PUSH_INT;
    if (mnemonic == "ADD") return pmachine::OP_ADD;
    if (mnemonic == "SUB") return pmachine::OP_SUB;
    if (mnemonic == "MUL") return pmachine::OP_MUL;
    if (mnemonic == "DIV") return pmachine::OP_DIV;
    if (mnemonic == "PRINT") return pmachine::OP_PRINT;
    if (mnemonic == "PRINT_INT") return pmachine::OP_PRINT_INT;
    if (mnemonic == "HALT") return pmachine::OP_HALT;
    if (mnemonic == "NOP") return pmachine::OP_NOP;
    return 0xFE;
}

class StringPool {
public:
    uint16_t add(const std::string& str);
    const std::string& get(uint16_t idx) const;
    std::vector<std::string> getAll() const;
private:
    std::vector<std::string> pool;
};

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
    int openFile(const String &logicalName, const String &mode);
    bool closeFile(int handle);
    bool readLine(int handle, String &outLine);
    bool writeLine(int handle, const String &line);
    void setFFS(FederatedFileSystem *ffsPtr) { ffs = ffsPtr; }
    PMachine();
    const PCodeMap& getPCodeMap() const;
    const MemoryMap& getMemoryMap() const;
    const std::vector<std::string> getStringPool() const;
    std::map<std::string, int> getEnumTypes() const;
    Status getStatus() const;
    bool loadProgram(const std::vector<uint8_t>& pcode, const std::string& backingFile, size_t maxSpace);
    void run();
    void singleStep();
    void setBreakpoint(uint16_t pc);
    void clearBreakpoint(uint16_t pc);
    void clearAllBreakpoints();
    std::vector<PInstruction> pinstructions;
    bool loadTextPCode(const std::string& text);
private:
    FederatedFileSystem *ffs = nullptr;
    PCodeMap pcodeMap;
    MemoryMap memoryMap;
    StringPool stringPool;
    std::map<std::string, int> enumTypes;
    int numPages = 0;
    std::string backingFile = "";
    size_t maxSpace = 0;
    std::vector<std::string> dynamicLibs;
    bool running = false;
    uint16_t pc = 0;
    std::vector<uint16_t> breakpoints;
};


} // namespace pmachine
