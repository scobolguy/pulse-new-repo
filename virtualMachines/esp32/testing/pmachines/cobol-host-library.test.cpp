#include "../../pmachines/arduino/src/cobol_host_contract.h"
#include "../../pmachines/arduino/src/pmachine.h"
#include <cassert>

static bool hasError(const pmachine::PMachine& machine) {
    const auto& flow = machine.getFlowState();
    return flow.count("__runtime_error") || flow.count("__thunk_error");
}

static bool host(const std::string& name, const std::vector<pmachine::HostValue>& args,
                 pmachine::HostValue& result, std::string&, void*) {
    if (name == "host.string_upper") {
        assert(args.size() == 1 && args[0].isString && args[0].text == "Hello");
        result.isString = true;
        result.text = "HOST MODULE";
    } else {
        assert(name == "host.isam_count");
        assert(args.size() == 1 && !args[0].isString && args[0].integer == 7);
        result.integer = 3;
    }
    return true;
}

int main() {
    pmachine::PMachine machine;
    machine.run(pmachine::loadTextPCode("PUSH_DEC 125 2\nPUSH_DEC 275 2\nADD\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n"));
    assert(!hasError(machine));
    assert(machine.getLastRunTextOutput() == std::vector<std::string>{"4.00"});
    const auto call = pmachine::loadTextPCode("PUSH_STR \"Hello\"\nCALL_EXT host.string_upper 1\nPRINT\nPRINT_NL\nHALT\n");
    machine.run(call);
#if PULSE_COBOL_HOST_LIBRARY
    assert(!hasError(machine));
    assert(machine.getLastRunTextOutput() == std::vector<std::string>{"HELLO"});
    machine.run(pmachine::loadTextPCode("PUSH_INT 5\nCALL_EXT host.math_factorial 1\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n"));
    assert(!hasError(machine));
    assert(machine.getLastRunTextOutput() == std::vector<std::string>{"120"});
#else
    assert(hasError(machine));
    machine.setHostCallHook(host);
    machine.run(call);
    assert(!hasError(machine));
    assert(machine.getLastRunTextOutput() == std::vector<std::string>{"HOST MODULE"});
#endif
    machine.setHostCallHook(nullptr);
    machine.run(pmachine::loadTextPCode("PUSH_INT 1\nCALL_EXT host.string_upper 1\nHALT\n"));
    assert(hasError(machine));
    machine.run(pmachine::loadTextPCode("CALL_EXT host.isam_count 1\nHALT\n"));
    assert(hasError(machine));
    machine.setHostCallHook(host);
    machine.run(pmachine::loadTextPCode("PUSH_INT 7\nCALL_EXT host.isam_count 1\nPRINT_INT\nPRINT_NL\nHALT\n"));
    assert(!hasError(machine));
    assert(machine.getLastRunTextOutput() == std::vector<std::string>{"3"});
}
