

#include <sstream>
#include "pmachine.h"
#include "StringPool.h"

namespace pmachine {


PMachine::PMachine() = default;
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
    struct StackValue {
        pmachine::OperandType type;
        int intValue;
        std::string strValue;
        std::string enumType;
    };
    std::vector<StackValue> stack;
    PMTRACE(Serial.println("[DEBUG] Executing pinstructions:"));
    size_t pc = 0;
    while (pc < instructions.size()) {
        const auto& instr = instructions[pc];
        PMTRACE({
            Serial.print("[STEP] ");
            Serial.print(pc);
            Serial.print(": opcode=0x");
            Serial.print(instr.opcode, HEX);
            Serial.print(", type=");
            Serial.print((int)instr.type);
            Serial.print(", intOperand=");
            Serial.print(instr.intOperand);
            Serial.print(", strOperand='");
            Serial.print(instr.strOperand.c_str());
            Serial.print("', label=");
            Serial.print(instr.label.c_str());
            Serial.print(" | stack: [");
            for (size_t j = 0; j < stack.size(); ++j) {
                if (stack[j].type == pmachine::OperandType::INT) {
                    Serial.print(stack[j].intValue);
                } else if (stack[j].type == pmachine::OperandType::STRING) {
                    Serial.print('"');
                    Serial.print(stack[j].strValue.c_str());
                    Serial.print('"');
                }
                if (j + 1 < stack.size()) Serial.print(", ");
            }
            Serial.println("]");
        });

        switch (instr.opcode) {
            case pmachine::OP_PUSH_STR:
                stack.push_back({pmachine::OperandType::STRING, 0, instr.strOperand, ""});
                ++pc;
                break;
            case pmachine::OP_PUSH_INT:
                stack.push_back({pmachine::OperandType::INT, instr.intOperand, "", ""});
                ++pc;
                break;
            case pmachine::OP_PUSH_ENUM:
                if (enumManager && enumManager->hasEnum(instr.enumType)) {
                    int val = enumManager->getValue(instr.enumType, instr.strOperand);
                    stack.push_back({pmachine::OperandType::INT, val, "", instr.enumType});
                } else {
                    PMTRACE(Serial.println("[ERROR] Enum type not found"));
                }
                ++pc;
                break;
            case pmachine::OP_ADD:
            case pmachine::OP_SUB:
            case pmachine::OP_MUL:
            case pmachine::OP_DIV:
                if (stack.size() < 2) {
                    PMTRACE(Serial.println("[ERROR] Not enough values on stack for arithmetic"));
                    ++pc;
                    break;
                }
                if (stack[stack.size()-1].type != pmachine::OperandType::INT || stack[stack.size()-2].type != pmachine::OperandType::INT) {
                    PMTRACE(Serial.println("[ERROR] Type error: expected two integers"));
                    ++pc;
                    break;
                }
                {
                    int b = stack.back().intValue; stack.pop_back();
                    int a = stack.back().intValue; stack.pop_back();
                    int result = 0;
                    if (instr.opcode == pmachine::OP_ADD) result = a + b;
                    else if (instr.opcode == pmachine::OP_SUB) result = a - b;
                    else if (instr.opcode == pmachine::OP_MUL) result = a * b;
                    else if (instr.opcode == pmachine::OP_DIV) result = (b != 0) ? a / b : 0;
                    stack.push_back({pmachine::OperandType::INT, result, "", ""});
                }
                ++pc;
                break;
            case pmachine::OP_PRINT:
                if (!stack.empty() && stack.back().type == pmachine::OperandType::STRING) {
                    Serial.print("[PRINT] ");
                    Serial.println(stack.back().strValue.c_str());
                    stack.pop_back();
                } else {
                    PMTRACE(Serial.println("[PRINT] Stack underflow or type error"));
                }
                ++pc;
                break;
            case pmachine::OP_PRINT_INT:
                if (!stack.empty() && stack.back().type == pmachine::OperandType::INT) {
                    Serial.print("[PRINT_INT] ");
                    Serial.println(stack.back().intValue);
                    stack.pop_back();
                } else {
                    PMTRACE(Serial.println("[PRINT_INT] Stack underflow or type error"));
                }
                ++pc;
                break;
            case pmachine::OP_PRINT_ENUM:
                if (!stack.empty() && !stack.back().enumType.empty() && enumManager) {
                    std::string name = enumManager->getName(stack.back().enumType, stack.back().intValue);
                    Serial.print("[PRINT_ENUM] ");
                    Serial.println(name.c_str());
                    stack.pop_back();
                } else {
                    PMTRACE(Serial.println("[PRINT_ENUM] Stack underflow or type error"));
                }
                ++pc;
                break;
            case pmachine::OP_JMP:
                if (instr.intOperand >= 0 && static_cast<size_t>(instr.intOperand) < instructions.size()) {
                    pc = static_cast<size_t>(instr.intOperand);
                } else {
                    PMTRACE(Serial.println("[JMP] Invalid jump target"));
                    ++pc;
                }
                break;
            case pmachine::OP_JZ:
                if (!stack.empty() && stack.back().type == pmachine::OperandType::INT) {
                    int val = stack.back().intValue;
                    stack.pop_back();
                    if (val == 0 && instr.intOperand >= 0 && static_cast<size_t>(instr.intOperand) < instructions.size()) {
                        pc = static_cast<size_t>(instr.intOperand);
                    } else {
                        ++pc;
                    }
                } else {
                    PMTRACE(Serial.println("[JZ] Stack underflow or type error"));
                    ++pc;
                }
                break;
            case pmachine::OP_HALT:
                PMTRACE(Serial.println("[HALT]"));
                return;
            default:
                ++pc;
                break;
        }
    }
    PMTRACE(Serial.println("[DEBUG] Execution finished."));
}
}
