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


// PL/0-style opcodes
enum Opcode : uint8_t {
    OP_NOP = 0x00,
    OP_LIT = 0x01,      // LIT 0, a: Push constant a
    OP_OPR = 0x02,      // OPR 0, a: Operator (return, arithmetic, etc)
    OP_LOD = 0x03,      // LOD l, a: Load variable at level l, address a
    OP_STO = 0x04,      // STO l, a: Store variable at level l, address a
    OP_CAL = 0x05,      // CAL l, a: Call procedure at level l, address a
    OP_INT = 0x06,      // INT 0, a: Increment stack for locals
    OP_JMP = 0x07,      // JMP 0, a: Jump to address a
    OP_JZ  = 0x08,      // JZ  0, a: Jump if zero
    OP_PUSH_INT = 0x09, // Push integer operand
    OP_PUSH_STR = 0x0A, // Push string operand
    OP_PUSH_ENUM = 0x0B,// Push enum operand
    OP_ADD = 0x0C,      // Add
    OP_SUB = 0x0D,      // Subtract
    OP_MUL = 0x0E,      // Multiply
    OP_DIV = 0x0F,      // Divide
    OP_PRINT_INT = 0x10,// Print integer
    OP_PRINT_ENUM = 0x11,// Print enum
    OP_HALT = 0xFF      // HALT
};

    enum class OperandType { NONE, INT, STRING };


    struct PInstruction {
        uint8_t opcode;
        int level = 0;         // Lexical level (for LOD, STO, CAL)
        int address = 0;       // Address/offset (for LOD, STO, CAL, JMP, etc)
        int value = 0;         // For LIT, INT, OPR
        std::string label;     // For JMP/JZ, label name (resolved to address after parsing)
        // Added fields for extended operand support
        OperandType type = OperandType::NONE;
        int intOperand = 0;
        std::string strOperand;
        std::string enumType;
    };

    inline uint8_t opcodeFromMnemonic(const std::string& mnemonic) {
        if (mnemonic == "LIT") return OP_LIT;
        if (mnemonic == "OPR") return OP_OPR;
        if (mnemonic == "LOD") return OP_LOD;
        if (mnemonic == "STO") return OP_STO;
        if (mnemonic == "CAL") return OP_CAL;
        if (mnemonic == "INT") return OP_INT;
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

    // Handler table for opcode dispatch
    using HandlerFunc = void (*)(PMachine&, const PInstruction&, int*, int&, int&, int&);
    HandlerFunc handler_table[256] = {nullptr};
    void init_handler_table();
public:
    // Register a native extension handler for an opcode
    void register_extension(uint8_t opcode, HandlerFunc func);
    // (For testing/diagnostics) Get handler for an opcode
    HandlerFunc get_handler(uint8_t opcode) const { return handler_table[opcode]; }
};

// Standalone loader function
typedef PInstruction PInstruction;
std::vector<PInstruction> loadTextPCode(const std::string& text);

} // namespace pmachine
