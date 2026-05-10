

#include <sstream>
#include "pmachine.h"
#include "StringPool.h"

namespace pmachine {


PMachine::PMachine() {
    init_handler_table();
}
// Handler implementations for core opcodes
namespace {
    void handle_LIT(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        stack[sp++] = instr.value;
        ++pc;
    }
    void handle_OPR(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        switch (instr.value) {
            case 0: // RET
                sp = bp;
                pc = stack[sp + 2]; // return address
                bp = stack[sp + 1]; // dynamic link
                break;
            case 1: // NEG
                stack[sp-1] = -stack[sp-1];
                ++pc;
                break;
            case 2: // ADD
                --sp; stack[sp-1] += stack[sp]; ++pc;
                break;
            case 3: // SUB
                --sp; stack[sp-1] -= stack[sp]; ++pc;
                break;
            case 4: // MUL
                --sp; stack[sp-1] *= stack[sp]; ++pc;
                break;
            case 5: // DIV
                --sp; stack[sp-1] /= stack[sp]; ++pc;
                break;
            default:
                ++pc;
                break;
        }
    }
    void handle_LOD(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[sp++] = stack[base(instr.level, bp) + instr.address];
        ++pc;
    }
    void handle_STO(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[base(instr.level, bp) + instr.address] = stack[--sp];
        ++pc;
    }
    void handle_CAL(PMachine& vm, const PInstruction& instr, int* stack, int& sp, int& bp, int& pc) {
        stack[sp] = 0; // static link (filled below)
        stack[sp+1] = bp; // dynamic link
        stack[sp+2] = pc + 1; // return address
        // static link
        auto base = [&](int l, int b) -> int {
            int b1 = b;
            while (l > 0) { b1 = stack[b1]; --l; }
            return b1;
        };
        stack[sp] = base(instr.level, bp);
        bp = sp;
        pc = instr.address;
    }
    void handle_INT(PMachine&, const PInstruction& instr, int* /*stack*/, int& sp, int& /*bp*/, int& pc) {
        sp += instr.value;
        ++pc;
    }
    void handle_JMP(PMachine&, const PInstruction& instr, int* /*stack*/, int& /*sp*/, int& /*bp*/, int& pc) {
        pc = instr.address;
    }
    void handle_JZ(PMachine&, const PInstruction& instr, int* stack, int& sp, int& /*bp*/, int& pc) {
        if (stack[--sp] == 0) pc = instr.address; else ++pc;
    }
    void handle_HALT(PMachine&, const PInstruction&, int*, int&, int&, int&) {
        // No-op: run() will exit after handler returns
    }
    void handle_NOP(PMachine&, const PInstruction&, int*, int&, int&, int&) {
        // No operation
    }
}

void PMachine::init_handler_table() {
    handler_table[OP_LIT] = handle_LIT;
    handler_table[OP_OPR] = handle_OPR;
    handler_table[OP_LOD] = handle_LOD;
    handler_table[OP_STO] = handle_STO;
    handler_table[OP_CAL] = handle_CAL;
    handler_table[OP_INT] = handle_INT;
    handler_table[OP_JMP] = handle_JMP;
    handler_table[OP_JZ] = handle_JZ;
    handler_table[OP_HALT] = handle_HALT;
    handler_table[OP_NOP] = handle_NOP;
}

void PMachine::register_extension(uint8_t opcode, HandlerFunc func) {
    handler_table[opcode] = func;
}
int PMachine::openFile(const String&, const String&) { return -1; }
bool PMachine::closeFile(int) { return false; }
bool PMachine::readLine(int, String&) { return false; }
bool PMachine::writeLine(int, const String&) { return false; }
const PCodeMap& PMachine::getPCodeMap() const { static PCodeMap m; return m; }
const MemoryMap& PMachine::getMemoryMap() const { static MemoryMap m; return m; }
const std::vector<std::string> PMachine::getStringPool() const { static std::vector<std::string> v; return v; }
std::map<std::string, int> PMachine::getEnumTypes() const { return {}; }
Status PMachine::getStatus() const { return Status{}; }
bool PMachine::loadProgram(const std::vector<uint8_t>&, const std::string&, size_t) { return false; }
void PMachine::singleStep() {}
void PMachine::setBreakpoint(uint16_t) {}
void PMachine::clearBreakpoint(uint16_t) {}
void PMachine::clearAllBreakpoints() {}

// Standalone loader function (inside pmachine namespace, fully qualified types)
std::vector<pmachine::PInstruction> loadTextPCode(const std::string& text) {
    std::vector<pmachine::PInstruction> instructions;
    std::map<std::string, size_t> labelToIndex;
    std::vector<std::pair<size_t, std::string>> unresolvedJumps;
    std::istringstream iss(text);
    std::string line;
    while (std::getline(iss, line)) {
        // Remove comments and trim
        auto comment = line.find('#');
        if (comment != std::string::npos) line = line.substr(0, comment);
        size_t first = line.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) continue;
        size_t last = line.find_last_not_of(" \t\r\n");
        line = line.substr(first, last - first + 1);
        if (line.empty()) continue;

        // Check for label: prefix
        std::string label, rest = line;
        size_t colon = line.find(':');
        if (colon != std::string::npos && colon > 0 && isalpha(line[0])) {
            label = line.substr(0, colon);
            rest = line.substr(colon + 1);
            // Remove leading whitespace after colon
            size_t first2 = rest.find_first_not_of(" \t");
            if (first2 != std::string::npos) rest = rest.substr(first2);
            else rest = "";
        }
        if (!label.empty()) {
            labelToIndex[label] = instructions.size();
        }
        if (rest.empty()) continue;

        std::istringstream lss(rest);
        std::string mnemonic;
        lss >> mnemonic;
        uint8_t opcode = pmachine::opcodeFromMnemonic(mnemonic);
        pmachine::PInstruction instr;
        instr.opcode = opcode;
        instr.type = pmachine::OperandType::NONE;
        instr.intOperand = 0;
        instr.strOperand = "";
        instr.label = "";

        if (opcode == pmachine::OP_PUSH_STR) {
            std::string rest2;
            std::getline(lss, rest2);
            size_t q1 = rest2.find('"');
            size_t q2 = rest2.find('"', q1 + 1);
            if (q1 != std::string::npos && q2 != std::string::npos && q2 > q1) {
                instr.strOperand = rest2.substr(q1 + 1, q2 - q1 - 1);
                instr.type = pmachine::OperandType::STRING;
            }
        } else if (opcode == pmachine::OP_PUSH_INT) {
            int value;
            lss >> value;
            instr.intOperand = value;
            instr.type = pmachine::OperandType::INT;
        } else if (opcode == pmachine::OP_PUSH_ENUM) {
            std::string enumType, enumValue;
            lss >> enumType >> enumValue;
            instr.enumType = enumType;
            instr.strOperand = enumValue;
            instr.type = pmachine::OperandType::INT;
        } else if (opcode == pmachine::OP_JMP || opcode == pmachine::OP_JZ) {
            std::string targetLabel;
            lss >> targetLabel;
            instr.label = targetLabel;
            unresolvedJumps.push_back({instructions.size(), targetLabel});
        } else if (opcode == pmachine::OP_ADD || opcode == pmachine::OP_SUB || opcode == pmachine::OP_MUL || opcode == pmachine::OP_DIV) {
            instr.type = pmachine::OperandType::NONE;
        } else if (opcode == pmachine::OP_PRINT_INT || opcode == pmachine::OP_PRINT_ENUM) {
            instr.type = pmachine::OperandType::NONE;
        }
        instructions.push_back(instr);
    }
    // Resolve jump targets
    for (auto& pair : unresolvedJumps) {
        size_t idx = pair.first;
        const std::string& lbl = pair.second;
        auto it = labelToIndex.find(lbl);
        if (it != labelToIndex.end()) {
            instructions[idx].intOperand = static_cast<int>(it->second);
        } else {
            // Unresolved label, set to -1
            instructions[idx].intOperand = -1;
        }
    }
    return instructions;
}

void PMachine::run(const std::vector<PInstruction>& instructions) {
    static const int STACK_SIZE = 1024;
    int stack[STACK_SIZE] = {0};
    int sp = 0;
    int bp = 0;
    int pc = 0;
    PMTRACE(Serial.println("[DEBUG] Executing pinstructions:"));
    while (pc < (int)instructions.size()) {
        const auto& instr = instructions[pc];
        PMTRACE({
            Serial.print("[STEP] ");
            Serial.print(pc);
            Serial.print(": opcode=0x");
            Serial.print(instr.opcode, HEX);
            Serial.print(", level=");
            Serial.print(instr.level);
            Serial.print(", address=");
            Serial.print(instr.address);
            Serial.print(", value=");
            Serial.print(instr.value);
            Serial.print(", label=");
            Serial.print(instr.label.c_str());
            Serial.print(" | stack: [");
            for (int j = 0; j < sp; ++j) {
                Serial.print(stack[j]);
                if (j + 1 < sp) Serial.print(", ");
            }
            Serial.println("]");
        });
        HandlerFunc handler = handler_table[instr.opcode];
        if (handler) {
            handler(*this, instr, stack, sp, bp, pc);
            if (instr.opcode == OP_HALT) {
                PMTRACE(Serial.println("[HALT]"));
                return;
            }
        } else {
            // Unknown opcode: skip
            ++pc;
        }
    }
    PMTRACE(Serial.println("[DEBUG] Execution finished."));
}
}
