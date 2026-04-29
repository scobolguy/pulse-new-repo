



#include <sstream>
#include "pmachine.h"

namespace pmachine {

uint16_t StringPool::add(const std::string&) { return 0; }


const std::string& StringPool::get(uint16_t) const { static std::string s; return s; }


// PMachine method stubs
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
void PMachine::run() {
	struct StackValue {
		OperandType type;
		int intValue;
		std::string strValue;
	};
	std::vector<StackValue> stack;
	Serial.println("[DEBUG] Executing pinstructions:");
	for (size_t i = 0; i < pinstructions.size(); ++i) {
		const auto& instr = pinstructions[i];
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
			if (stack[j].type == OperandType::INT) {
				Serial.print(stack[j].intValue);
			} else if (stack[j].type == OperandType::STRING) {
				Serial.print('"');
				Serial.print(stack[j].strValue.c_str());
				Serial.print('"');
			}
			if (j + 1 < stack.size()) Serial.print(", ");
		}
		Serial.println("]");

		// Simulate execution
		switch (instr.opcode) {
			case OP_PUSH_STR:
				stack.push_back({OperandType::STRING, 0, instr.strOperand});
				break;
			case OP_PUSH_INT:
				stack.push_back({OperandType::INT, instr.intOperand, ""});
				break;
			case OP_ADD:
			case OP_SUB:
			case OP_MUL:
			case OP_DIV:
				if (stack.size() < 2 && stack.size() > 0) {
					Serial.println("[ERROR] Not enough values on stack for arithmetic");
					break;
				}
				if (stack[stack.size()-1].type != OperandType::INT || stack[stack.size()-2].type != OperandType::INT) {
					Serial.println("[ERROR] Type error: expected two integers");
					break;
				}
				{
					int b = stack.back().intValue; stack.pop_back();
					int a = stack.back().intValue; stack.pop_back();
					int result = 0;
					if (instr.opcode == OP_ADD) result = a + b;
					else if (instr.opcode == OP_SUB) result = a - b;
					else if (instr.opcode == OP_MUL) result = a * b;
					else if (instr.opcode == OP_DIV) result = (b != 0) ? a / b : 0;
					stack.push_back({OperandType::INT, result, ""});
				}
				break;
			case OP_PRINT:
				if (!stack.empty() && stack.back().type == OperandType::STRING) {
					Serial.print("[PRINT] ");
					Serial.println(stack.back().strValue.c_str());
					stack.pop_back();
				} else {
					Serial.println("[PRINT] Stack underflow or type error");
				}
				break;
			case OP_PRINT_INT:
				if (!stack.empty() && stack.back().type == OperandType::INT) {
					Serial.print("[PRINT_INT] ");
					Serial.println(stack.back().intValue);
					stack.pop_back();
				} else {
					Serial.println("[PRINT_INT] Stack underflow or type error");
				}
				break;
			case OP_HALT:
				Serial.println("[HALT]");
				return;
			default:
				break;
		}
	}
	Serial.println("[DEBUG] Execution finished.");
}
void PMachine::singleStep() {}
void PMachine::setBreakpoint(uint16_t) {}
void PMachine::clearBreakpoint(uint16_t) {}
void PMachine::clearAllBreakpoints() {}
bool PMachine::loadTextPCode(const std::string& text) {
	pinstructions.clear();
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
		uint8_t opcode = opcodeFromMnemonic(mnemonic);
		PInstruction instr;
		instr.opcode = opcode;
		instr.type = OperandType::NONE;
		instr.intOperand = 0;
		instr.strOperand = "";

		if (opcode == OP_PUSH_STR) {
			std::string rest;
			std::getline(lss, rest);
			size_t q1 = rest.find('"');
			size_t q2 = rest.find('"', q1 + 1);
			if (q1 != std::string::npos && q2 != std::string::npos && q2 > q1) {
				instr.strOperand = rest.substr(q1 + 1, q2 - q1 - 1);
				instr.type = OperandType::STRING;
			}
		} else if (opcode == OP_PUSH_INT) {
			int value;
			lss >> value;
			instr.intOperand = value;
			instr.type = OperandType::INT;
		} else if (opcode == OP_ADD || opcode == OP_SUB || opcode == OP_MUL || opcode == OP_DIV) {
			instr.type = OperandType::NONE;
		} else if (opcode == OP_PRINT_INT) {
			instr.type = OperandType::NONE;
		}
		pinstructions.push_back(instr);
	}
	return true;
}

} // namespace pmachine
