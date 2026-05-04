// Minimal, clean, and buildable header for pmachine
#define PMTRACE(x)
#pragma once
#include <Arduino.h> // For String
#include <map>
#include <vector>
#include <string>
#include <cstdint>
#include "ffs/FederatedFileSystem.h"
#include "StringPool.h"


// Standalone EnumManager
class EnumManager {
public:
    void registerEnum(const std::string& name, const std::vector<std::string>& values) {
        for (size_t i = 0; i < values.size(); ++i) {
            valueToInt[name][values[i]] = (int)i;
            intToValue[name][(int)i] = values[i];
        }
        enums[name] = values;
    }
    int getValue(const std::string& name, const std::string& value) const {
        auto it = valueToInt.find(name);
        if (it != valueToInt.end()) {
            auto jt = it->second.find(value);
            if (jt != it->second.end()) return jt->second;
        }
        return -1;
    }
    std::string getName(const std::string& name, int value) const {
        auto it = intToValue.find(name);
        if (it != intToValue.end()) {
            auto jt = it->second.find(value);
            if (jt != it->second.end()) return jt->second;
        }
        return "";
    }
    bool hasEnum(const std::string& name) const { return enums.count(name) > 0; }
private:
    std::map<std::string, std::vector<std::string>> enums;
    std::map<std::string, std::map<std::string, int>> valueToInt;
    std::map<std::string, std::map<int, std::string>> intToValue;
};



namespace pmachine {

enum Opcode : uint8_t {
    OP_NOP = 0x00,
    OP_PUSH_STR = 0x01,
    OP_PRINT = 0x02,
    OP_PUSH_INT = 0x10,
    OP_ADD = 0x11,
    OP_SUB = 0x12,
    OP_MUL = 0x13,
    OP_DIV = 0x14,
    OP_PRINT_INT = 0x15,
    OP_PUSH_ENUM = 0x20,
    OP_PRINT_ENUM = 0x21,
    OP_JMP = 0x30,
    OP_JZ = 0x31,
    OP_HALT = 0xFF
};

    enum class OperandType { NONE, INT, STRING };

    struct PInstruction {
        uint8_t opcode;
        OperandType type = OperandType::NONE;
        int intOperand = 0;
        std::string strOperand;
        std::string enumType; // for enum instructions
        std::string label;    // for JMP/JZ, label name (resolved to intOperand after parsing)
    };

    inline uint8_t opcodeFromMnemonic(const std::string& mnemonic) {
        if (mnemonic == "PUSH_STR") return OP_PUSH_STR;
        if (mnemonic == "PUSH_INT") return OP_PUSH_INT;
        if (mnemonic == "ADD") return OP_ADD;
        if (mnemonic == "SUB") return OP_SUB;
        if (mnemonic == "MUL") return OP_MUL;
        if (mnemonic == "DIV") return OP_DIV;
        if (mnemonic == "PRINT") return OP_PRINT;
        if (mnemonic == "PRINT_INT") return OP_PRINT_INT;
        if (mnemonic == "PUSH_ENUM") return OP_PUSH_ENUM;
        if (mnemonic == "PRINT_ENUM") return OP_PRINT_ENUM;
        if (mnemonic == "JMP") return OP_JMP;
        if (mnemonic == "JZ") return OP_JZ;
        if (mnemonic == "HALT") return OP_HALT;
        if (mnemonic == "NOP") return OP_NOP;
        return 0xFE;
    }

using PCodeMap = std::map<uint16_t, uint8_t>;
using MemoryMap = std::map<uint16_t, uint32_t>;

struct Status {
    int numPages;
    std::string backingFile;
    size_t maxSpace = 0;
    std::vector<std::string> dynamicLibs;
    bool running = false;
    uint16_t pc = 0;
    std::vector<uint16_t> breakpoints;
};

} // namespace pmachine


namespace pmachine {

class PMachine {
public:
    void setEnumManager(::EnumManager* mgr) { enumManager = mgr; }
    int openFile(const String &logicalName, const String &mode);
    bool closeFile(int handle);
    bool readLine(int handle, String &outLine);
    bool writeLine(int handle, const String &line);
    void setFFS(::FederatedFileSystem *ffsPtr) { ffs = ffsPtr; }
    PMachine();
    const PCodeMap& getPCodeMap() const;
    const MemoryMap& getMemoryMap() const;
    const std::vector<std::string> getStringPool() const;
    std::map<std::string, int> getEnumTypes() const;
    Status getStatus() const;
    bool loadProgram(const std::vector<uint8_t>& pcode, const std::string& backingFile, size_t maxSpace);
    void run(const std::vector<PInstruction>& instructions);
    void singleStep();
    void setBreakpoint(uint16_t pc);
    void clearBreakpoint(uint16_t pc);
    void clearAllBreakpoints();
private:
    ::FederatedFileSystem *ffs = nullptr;
    PCodeMap pcodeMap;
    MemoryMap memoryMap;
    std::map<std::string, int> enumTypes;
    int numPages = 0;
    std::string backingFile = "";
    size_t maxSpace = 0;
    std::vector<std::string> dynamicLibs;
    bool running = false;
    uint16_t pc = 0;
    std::vector<uint16_t> breakpoints;
    ::EnumManager* enumManager = nullptr;
};

// Standalone loader function
typedef PInstruction PInstruction;
std::vector<PInstruction> loadTextPCode(const std::string& text);

} // namespace pmachine
