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
    OP_ROUTE_MATCH_QUEUE = 0x12, // Compare runtime input queue to operand queue, push 1/0
    OP_ROUTE_EVAL_WHEN = 0x13,   // Evaluate WHEN rule against current message, push 1/0
    OP_ROUTE_TRANSFORM = 0x14,   // Apply TRANSFORM rule to current message
    OP_ROUTE_EMIT = 0x15,        // Emit current message to operand output queue
    OP_PARSE_FIN_TEXT = 0x16,    // Parse routing source message from MT FIN text into JSON
    OP_ROUTE_SET_STATE = 0x17,   // Set runtime state from operand "key=value"
    OP_ROUTE_SET_MESSAGE = 0x24, // Pop stack value and set current routing message
    OP_LOAD_NAME = 0x18,         // Load named variable from runtime frame stack
    OP_STORE_NAME = 0x19,        // Store named variable to runtime frame stack
    OP_CALL_LABEL = 0x1A,        // Call label with stack-based args
    OP_RET = 0x1B,               // Return from call frame
    OP_EQ = 0x1C,                // Compare equality
    OP_NEQ = 0x1D,               // Compare inequality
    OP_LT = 0x1E,                // Compare less-than
    OP_LE = 0x1F,                // Compare less-or-equal
    OP_GT = 0x20,                // Compare greater-than
    OP_GE = 0x21,                // Compare greater-or-equal
    OP_PRINT = 0x22,             // Print string/int token to current output line
    OP_PRINT_NL = 0x23,          // End current output line
    OP_ORCH_SPAWN = 0x25,        // Queue orchestration subflow spawn metadata
    OP_ORCH_WAIT_ALL = 0x26,     // Await orchestration subflow completion (native transport hook)
    OP_ORCH_FAIL_TXN = 0x27,     // Fail current transaction when orchestration result is failure
    OP_ORCH_RETURN_SUCCESS = 0x28,// Return orchestration success payload
    OP_CALL_EXT = 0x29,          // Call external symbol through lazy thunk resolver
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
        if (mnemonic == "PUSH_INT") return OP_PUSH_INT;
        if (mnemonic == "PUSH_STR") return OP_PUSH_STR;
        if (mnemonic == "PUSH_ENUM") return OP_PUSH_ENUM;
        if (mnemonic == "ADD") return OP_ADD;
        if (mnemonic == "SUB") return OP_SUB;
        if (mnemonic == "MUL") return OP_MUL;
        if (mnemonic == "DIV") return OP_DIV;
        if (mnemonic == "PRINT_INT") return OP_PRINT_INT;
        if (mnemonic == "PRINT_ENUM") return OP_PRINT_ENUM;
        if (mnemonic == "ROUTE_MATCH_QUEUE") return OP_ROUTE_MATCH_QUEUE;
        if (mnemonic == "ROUTE_EVAL_WHEN") return OP_ROUTE_EVAL_WHEN;
        if (mnemonic == "ROUTE_TRANSFORM") return OP_ROUTE_TRANSFORM;
        if (mnemonic == "ROUTE_EMIT") return OP_ROUTE_EMIT;
        if (mnemonic == "PARSE_FIN_TEXT") return OP_PARSE_FIN_TEXT;
        if (mnemonic == "ROUTE_SET_STATE") return OP_ROUTE_SET_STATE;
        if (mnemonic == "ROUTE_SET_MESSAGE") return OP_ROUTE_SET_MESSAGE;
        if (mnemonic == "ORCH_SPAWN") return OP_ORCH_SPAWN;
        if (mnemonic == "ORCH_WAIT_ALL") return OP_ORCH_WAIT_ALL;
        if (mnemonic == "ORCH_FAIL_TXN") return OP_ORCH_FAIL_TXN;
        if (mnemonic == "ORCH_RETURN_SUCCESS") return OP_ORCH_RETURN_SUCCESS;
        if (mnemonic == "CALL_EXT") return OP_CALL_EXT;
        if (mnemonic == "LOAD") return OP_LOAD_NAME;
        if (mnemonic == "STORE") return OP_STORE_NAME;
        if (mnemonic == "CALL") return OP_CALL_LABEL;
        if (mnemonic == "RET") return OP_RET;
        if (mnemonic == "EQ") return OP_EQ;
        if (mnemonic == "NEQ") return OP_NEQ;
        if (mnemonic == "LT") return OP_LT;
        if (mnemonic == "LE") return OP_LE;
        if (mnemonic == "GT") return OP_GT;
        if (mnemonic == "GE") return OP_GE;
        if (mnemonic == "PRINT") return OP_PRINT;
        if (mnemonic == "PRINT_NL") return OP_PRINT_NL;
        if (mnemonic == "HALT") return OP_HALT;
        if (mnemonic == "NOP") return OP_NOP;
        return 0xFE;
    }

struct RouteDelivery {
    std::string queueName;
    std::string message;
};

struct MappingItem {
    std::string sourcePath;
    std::string targetPath;
    std::string conversionRule;
};

struct MappingDef {
    std::string id;
    std::string sourceTypeId;
    std::string targetTypeId;
    std::vector<MappingItem> items;
};

struct OrchestrationSpawnRequest {
    std::string subflowId;
    std::string nodeId;
    std::string payloadRef;
    uint32_t timeoutMs = 0;
    std::string handleRef;
};

struct OrchestrationTaskResult {
    std::string handleRef;
    std::string subflowId;
    std::string nodeId;
    bool success = false;
    std::string responseJson;
    std::string errorCode;
    std::string errorMessage;
};

using OrchestrationWaitHook = bool (*)(
    const std::vector<OrchestrationSpawnRequest>& requests,
    uint32_t timeoutMs,
    std::vector<OrchestrationTaskResult>& outResults,
    std::string& outError,
    void* context);

using ThunkResolveHook = bool (*)(
    const std::string& symbol,
    int& outTargetPc,
    std::string& outError,
    void* context);

enum class RuntimeUnitKind : uint8_t {
    Program = 0,
    Service = 1,
    Daemon = 2
};

enum class ResidentDomain : uint8_t {
    StringPool = 0,
    GlobalEnumeratedTypes = 1,
    GlobalTypes = 2,
    MapperArtifacts = 3,
    ProgramImage = 4
};

struct RuntimeUnitDescriptor {
    RuntimeUnitKind kind = RuntimeUnitKind::Service;
    std::string id;
    uint32_t refreshMs = 0;
    uint32_t loadedAtMs = 0;
    uint32_t lastRefreshAtMs = 0;
    bool resident = false;
};

struct ResidentAssetRecord {
    ResidentDomain domain = ResidentDomain::ProgramImage;
    std::string id;
    size_t bytes = 0;
    uint16_t pinCount = 0;
    uint32_t loadedAtMs = 0;
    uint32_t lastUsedAtMs = 0;
    bool resident = false;
};

struct PagingConfig {
    size_t pageSizeBytes = 1024;
    size_t maxFrames = 24;
};

struct PagingStats {
    uint32_t pageFaults = 0;
    uint32_t evictions = 0;
    uint32_t ffsReads = 0;
    uint32_t cacheHits = 0;
};

struct PageTableEntry {
    bool present = false;
    uint16_t frameIndex = 0;
};

struct PageFrame {
    bool used = false;
    bool pinned = false;
    uint16_t vpage = 0;
    uint32_t lastAccessTick = 0;
};

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
    RuntimeUnitDescriptor runtimeUnit;
    PagingConfig pagingConfig;
    PagingStats pagingStats;
    std::vector<ResidentAssetRecord> residentAssets;
    MemoryMap memoryMap;
    std::map<std::string, int> thunkBindings;
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
    bool loadUnit(const std::string& kind, const std::string& id, uint32_t refreshMs = 0);
    bool unloadUnit();
    void setMemoryConfig(size_t pageSizeBytes, size_t maxFrames);
    PagingConfig getPagingConfig() const;
    PagingStats getPagingStats() const;
    void setRuntimeUnit(const std::string& kind, const std::string& id, uint32_t refreshMs = 0);
    const RuntimeUnitDescriptor& getRuntimeUnit() const;
    bool loadResidentDomain(const std::string& domain, const std::string& id, size_t bytes = 0, bool pin = false);
    bool unloadResidentDomain(const std::string& domain, const std::string& id);
    std::vector<ResidentAssetRecord> getResidentAssets() const;
    void touchResidentAsset(const std::string& domain, const std::string& id);
    void tickDaemonRefresh(uint32_t nowMs = 0);
    bool readPCodeByte(uint32_t virtualAddress, uint8_t& outByte);
    void run(const std::vector<PInstruction>& instructions);
    void setRoutingContext(const std::string& inputQueue, const std::string& message);
    const std::vector<RouteDelivery>& getRoutingDeliveries() const;
    void clearRoutingDeliveries();
    void setMappings(const std::vector<MappingDef>& defs);
    void clearMappings();
    void setProcedureSignatures(const std::map<std::string, std::vector<std::string>>& signatures);
    void clearProcedureSignatures();
    const MappingDef* getMappingById(const std::string& mappingId) const;
    void singleStep();
    void setBreakpoint(uint16_t pc);
    void clearBreakpoint(uint16_t pc);
    void clearAllBreakpoints();
    bool didLastRunHitStepLimit() const;
    size_t getLastRunStepCount() const;
    const std::vector<std::string>& getLastRunTextOutput() const;
    std::map<std::string, std::string> getFlowStateSnapshot() const;
    void setOrchestrationWaitHook(OrchestrationWaitHook hook, void* context = nullptr);
    void setThunkResolverHook(ThunkResolveHook hook, void* context = nullptr);
    void setThunkBinding(const std::string& symbol, int targetPc);
    bool clearThunkBinding(const std::string& symbol);
    void clearAllThunkBindings();
    std::map<std::string, int> getThunkBindings() const;
    std::string getImageMemoryMapJson() const;
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
    std::string currentInputQueue;
    std::string currentMessage;
    std::vector<RouteDelivery> routingDeliveries;
    std::map<std::string, MappingDef> mappingDefs;
    std::map<std::string, std::vector<std::string>> procedureParamsByLabel;
    ::EnumManager* enumManager = nullptr;
    bool lastRunStepLimitHit = false;
    size_t lastRunStepCount = 0;
    std::vector<std::string> lastRunTextOutput;
    PagingConfig pagingConfig;
    PagingStats pagingStats;
    RuntimeUnitDescriptor runtimeUnit;
    std::vector<ResidentAssetRecord> residentAssets;
    std::vector<uint8_t> programImage;
    std::vector<PageTableEntry> pageTable;
    std::vector<PageFrame> frames;
    uint32_t lruTick = 0;
    OrchestrationWaitHook orchestrationWaitHook = nullptr;
    void* orchestrationHookContext = nullptr;
    ThunkResolveHook thunkResolveHook = nullptr;
    void* thunkResolverContext = nullptr;
    std::map<std::string, int> thunkBindings;

    // Handler table for opcode dispatch
    using HandlerFunc = void (*)(PMachine&, const PInstruction&, int*, int&, int&, int&);
    HandlerFunc handler_table[256] = {nullptr};
    void init_handler_table();
    int ensurePageResident(uint16_t vpage);
    int findLruVictimFrame() const;
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
