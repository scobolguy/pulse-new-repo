#include <iostream>
#include <string>
#include <vector>

#include "pmachine.h"

int main() {
    // Minimal host smoke for C++ PMachine runtime: route-free arithmetic + print.
    const std::string pcodeText =
        "PUSH_INT 2\n"
        "PUSH_INT 3\n"
        "ADD\n"
        "PRINT\n"
        "PRINT_NL\n"
        "HALT\n";

    pmachine::PMachine vm;
    const std::vector<pmachine::PInstruction> instructions = pmachine::loadTextPCode(pcodeText);
    vm.run(instructions);

    const auto output = vm.getLastRunTextOutput();
    std::cout << "[pmachine-native-smoke] lines=" << output.size() << "\n";
    for (const auto& line : output) {
        std::cout << "[pmachine-native-smoke] " << line << "\n";
    }

    return output.empty() ? 1 : 0;
}
