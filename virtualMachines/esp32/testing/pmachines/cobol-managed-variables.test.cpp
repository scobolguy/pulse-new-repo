#include "../../pmachines/arduino/src/cobol_vm.h"
#include <cassert>
#include <string>
#include <vector>

static cobolvm::RunResult execute(const std::string& code, uint8_t* arena, size_t bytes,
                                 const std::map<std::string, cobolvm::ProcedureInfo>* procedures = nullptr) {
    cobolvm::RunOptions options;
    options.variableArena = arena;
    options.variableArenaBytes = bytes;
    options.procedures = procedures;
    return cobolvm::runText(code, options);
}

int main() {
    uint8_t arena[8192];
    const std::string code =
        "PUSH_STR \"abcdef\"\nSTORE A\n"
        "PUSH_DEC 123456789012345678901234567890 4\nSTORE D\n"
        "PUSH_REF A@1:3\nCALL CHANGE 1\n"
        "LOAD A\nPRINT\nPRINT_NL\nLOAD D\nDEC_STR\nPRINT\nPRINT_NL\nHALT\n"
        "CHANGE:\nPUSH_STR \"XYZ\"\nSTORE P\nRET\n";
    std::map<std::string, cobolvm::ProcedureInfo> signatures;
    signatures["CHANGE"].params = {"P"};
    signatures["CHANGE"].locals = {"SCRATCH"};
    for (int run = 0; run < 100; ++run) {
        auto result = execute(code, arena, sizeof(arena), &signatures);
        assert(!result.hasError);
        assert(result.lines.size() == 2);
        assert(result.lines[0] == "aXYZef");
        assert(result.lines[1] == "12345678901234567890123456.7890");
    }
    auto exhausted = execute("PUSH_STR \"a payload larger than the arena\"\nSTORE X\nHALT\n", arena, 16);
    assert(exhausted.hasError);
    assert(exhausted.error.find("managed variable storage") != std::string::npos);
    auto recovered = execute("PUSH_INT 42\nSTORE X\nLOAD X\nPRINT\nPRINT_NL\nHALT\n", arena, sizeof(arena));
    assert(!recovered.hasError);
    assert(recovered.lines[0] == "42");

    std::string churn = "PUSH_STR \"keep me\"\nSTORE SAVED\n";
    for (int i = 0; i < 300; ++i)
        churn += "PUSH_STR \"" + std::string(20 + i % 40, 'x') + "\"\nSTORE TEMP\n"
            "CALL LOCAL 0\n";
    churn += "LOAD SAVED\nPRINT\nPRINT_NL\nHALT\nLOCAL:\nPUSH_STR \"local data\"\nSTORE L\nRET\n";
    signatures["LOCAL"].locals = {"L"};
    auto collected = execute(churn, arena, sizeof(arena), &signatures);
    assert(!collected.hasError);
    assert(collected.lines[0] == "keep me");
}
