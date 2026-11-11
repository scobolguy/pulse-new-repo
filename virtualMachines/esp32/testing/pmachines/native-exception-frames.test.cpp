#include "../../pmachines/arduino/src/pmachine.h"
#include <cassert>

int main() {
    const auto instructions = pmachine::loadTextPCode(
        "TRY_BEGIN CATCH\n"
        "CALL THROWER 0\n"
        "TRY_END\n"
        "HALT\n"
        "CATCH:\n"
        "PRINT\n"
        "PRINT_NL\n"
        "HALT\n"
        "THROWER:\n"
        "PUSH_STR \"native boom\"\n"
        "RETHROW\n"
    );
    pmachine::PMachine machine;
    machine.run(instructions);
    assert(machine.getFlowState().find("__runtime_error") == machine.getFlowState().end());
    const auto& output = machine.getLastRunTextOutput();
    assert(output.size() == 1);
    assert(output.front() == "native boom");
    return 0;
}
