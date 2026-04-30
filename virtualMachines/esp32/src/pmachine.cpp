

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

        std::istringstream lss(line);
        std::string mnemonic;
        lss >> mnemonic;
        uint8_t opcode = pmachine::opcodeFromMnemonic(mnemonic);
        pmachine::PInstruction instr;
        instr.opcode = opcode;
        instr.type = pmachine::OperandType::NONE;
        instr.intOperand = 0;
        instr.strOperand = "";

        if (opcode == pmachine::OP_PUSH_STR) {
            std::string rest;
            std::getline(lss, rest);
            size_t q1 = rest.find('"');
            size_t q2 = rest.find('"', q1 + 1);
            if (q1 != std::string::npos && q2 != std::string::npos && q2 > q1) {
                instr.strOperand = rest.substr(q1 + 1, q2 - q1 - 1);
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
        } else if (opcode == pmachine::OP_ADD || opcode == pmachine::OP_SUB || opcode == pmachine::OP_MUL || opcode == pmachine::OP_DIV) {
            instr.type = pmachine::OperandType::NONE;
        } else if (opcode == pmachine::OP_PRINT_INT || opcode == pmachine::OP_PRINT_ENUM) {
            instr.type = pmachine::OperandType::NONE;
        }
        instructions.push_back(instr);
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
    for (size_t i = 0; i < instructions.size(); ++i) {
        const auto& instr = instructions[i];
        PMTRACE({
            Serial.print("[STEP] ");
            Serial.print(i);
            Serial.print(": opcode=0x");
            Serial.print(instr.opcode, HEX);
            Serial.print(", type=");
            Serial.print((int)instr.type);
            Serial.print(", intOperand=");
            Serial.print(instr.intOperand);
            Serial.print(", strOperand='");
            Serial.print(instr.strOperand.c_str());
            Serial.print("' | stack: [");
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

        // Simulate execution (same as before)
        switch (instr.opcode) {
            case pmachine::OP_PUSH_STR:
                stack.push_back({pmachine::OperandType::STRING, 0, instr.strOperand, ""});
                break;
            case pmachine::OP_PUSH_INT:
                stack.push_back({pmachine::OperandType::INT, instr.intOperand, "", ""});
                break;
            case pmachine::OP_PUSH_ENUM:
                if (enumManager && enumManager->hasEnum(instr.enumType)) {
                    int val = enumManager->getValue(instr.enumType, instr.strOperand);
                    stack.push_back({pmachine::OperandType::INT, val, "", instr.enumType});
                } else {
                    PMTRACE(Serial.println("[ERROR] Enum type not found"));
                }
                break;
            case pmachine::OP_ADD:
            case pmachine::OP_SUB:
            case pmachine::OP_MUL:
            case pmachine::OP_DIV:
                if (stack.size() < 2) {
                    PMTRACE(Serial.println("[ERROR] Not enough values on stack for arithmetic"));
                    break;
                }
                if (stack[stack.size()-1].type != pmachine::OperandType::INT || stack[stack.size()-2].type != pmachine::OperandType::INT) {
                    PMTRACE(Serial.println("[ERROR] Type error: expected two integers"));
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
                break;
            case pmachine::OP_PRINT:
                if (!stack.empty() && stack.back().type == pmachine::OperandType::STRING) {
                    Serial.print("[PRINT] ");
                    Serial.println(stack.back().strValue.c_str());
                    stack.pop_back();
                } else {
                    PMTRACE(Serial.println("[PRINT] Stack underflow or type error"));
                }
                break;
            case pmachine::OP_PRINT_INT:
                if (!stack.empty() && stack.back().type == pmachine::OperandType::INT) {
                    Serial.print("[PRINT_INT] ");
                    Serial.println(stack.back().intValue);
                    stack.pop_back();
                } else {
                    PMTRACE(Serial.println("[PRINT_INT] Stack underflow or type error"));
                }
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
                break;
            case pmachine::OP_HALT:
                PMTRACE(Serial.println("[HALT]"));
                return;
            default:
                break;
        }
    }
    PMTRACE(Serial.println("[DEBUG] Execution finished."));


}}
