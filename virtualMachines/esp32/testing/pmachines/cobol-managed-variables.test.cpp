#include "../../pmachines/arduino/src/pmachine.h"
#include <cassert>
#include <string>
#include <vector>

struct Result {
    bool hasError = false;
    std::string error;
    std::vector<std::string> lines;
};

static Result execute(pmachine::PMachine& machine, const std::string& code) {
    machine.run(pmachine::loadTextPCode(code));
    Result result;
    result.lines = machine.getLastRunTextOutput();
    for (const auto& entry : machine.getFlowState()) {
        if (entry.first == "__runtime_error" || entry.first == "__thunk_error") {
            result.hasError = true;
            result.error = entry.second;
        }
    }
    return result;
}

int main() {
    pmachine::PMachine machine;
    const std::string code =
        "PUSH_STR \"abcdef\"\nSTORE A\n"
        "PUSH_DEC 123456789012345678901234567890 4\nSTORE D\n"
        "PUSH_REF A@1:3\nCALL CHANGE 1\n"
        "LOAD A\nPRINT\nPRINT_NL\nLOAD D\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n"
        "CHANGE:\nPUSH_STR \"XYZ\"\nSTORE P\nRET\n";
    std::map<std::string, std::vector<std::string>> signatures;
    signatures["CHANGE"] = {"P"};
    signatures["@locals:CHANGE"] = {"SCRATCH"};
    machine.setProcedureSignatures(signatures);
    for (int run = 0; run < 100; ++run) {
        auto result = execute(machine, code);
        assert(!result.hasError);
        assert(result.lines.size() == 2);
        assert(result.lines[0] == "aXYZef");
        assert(result.lines[1] == "12345678901234567890123456.7890");
    }
    auto exhausted = execute(machine, "PUSH_STR \"" + std::string(8193, 'x') + "\"\nSTORE X\nHALT\n");
    assert(exhausted.hasError);
    assert(exhausted.error.find("string storage capacity") != std::string::npos);
    assert(machine.getFlowStateSnapshot().at("__runtime_error") == exhausted.error);
    assert(exhausted.lines.empty());
    auto recovered = execute(machine, "PUSH_INT 42\nSTORE X\nLOAD X\nPRINT\nPRINT_NL\nHALT\n");
    assert(!recovered.hasError);
    assert(!machine.getHostedStorageError());
    assert(machine.getFlowStateSnapshot().count("__runtime_error") == 0);
    assert(recovered.lines[0] == "42");

    std::string churn = "PUSH_STR \"keep me\"\nSTORE SAVED\n";
    for (int i = 0; i < 300; ++i)
        churn += "PUSH_STR \"" + std::string(20 + i % 40, 'x') + "\"\nSTORE TEMP\n"
            "CALL LOCAL 0\n";
    churn += "LOAD SAVED\nPRINT\nPRINT_NL\nHALT\nLOCAL:\nPUSH_STR \"local data\"\nSTORE L\nRET\n";
    signatures["@locals:LOCAL"] = {"L"};
    machine.setProcedureSignatures(signatures);
    auto collected = execute(machine, churn);
    assert(!collected.hasError);
    assert(collected.lines[0] == "keep me");
}
