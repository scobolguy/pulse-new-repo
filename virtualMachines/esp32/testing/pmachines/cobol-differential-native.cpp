#include "../../pmachines/arduino/src/cobol_vm_internal.h"
#if defined(TEST_GENERIC_PMACHINE)
#include "../../pmachines/arduino/src/pmachine.h"
#endif
#include <fstream>
#include <iostream>
#include <iterator>

static std::string read(const char* file) {
    std::ifstream stream(file, std::ios::binary);
    if (!stream) throw std::runtime_error("unable to read fixture");
    return std::string(std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
}

int main(int argc, char** argv) {
    if (argc != 3) return 2;
    using namespace cobolvm;
    namespace detail = cobolvm::detail;
    detail::Json map;
    if (!detail::parseJson(detail::utf8ToLatin1(read(argv[2])), map)) return 3;
    std::map<std::string, ProcedureInfo> procedures;
    if (const auto* values = map.get("procedures")) {
        for (const auto& entry : values->members) {
            ProcedureInfo info;
            if (const auto* params = entry.second.get("params"))
                for (const auto& name : params->items) info.params.push_back(detail::latin1ToUtf8(name.text));
            if (const auto* locals = entry.second.get("locals"))
                for (const auto& name : locals->items) info.locals.push_back(detail::latin1ToUtf8(name.text));
            procedures.emplace(detail::latin1ToUtf8(entry.first), info);
        }
    }
    std::vector<std::string> globals;
    if (const auto* names = map.get("globals"))
        for (const auto& name : names->items) globals.push_back(detail::latin1ToUtf8(name.text));
#if defined(TEST_GENERIC_PMACHINE)
    pmachine::PMachine machine;
    std::map<std::string, std::vector<std::string>> signatures;
    signatures["@globals"] = globals;
    for (const auto& entry : procedures) {
        signatures[entry.first] = entry.second.params;
        signatures["@locals:" + entry.first] = entry.second.locals;
    }
    machine.setProcedureSignatures(signatures);
    std::string code = read(argv[1]);
    const auto header = code.find("# Auto-generated from ANTLR Cobolish grammar");
    if (header != std::string::npos) code.replace(header,
        std::string("# Auto-generated from ANTLR Cobolish grammar").size(), "# Generic COBOL conformance");
    if (const auto* input = map.get("__testInput"))
        machine.setRoutingContext("", detail::latin1ToUtf8(input->text));
    const auto instructions = pmachine::loadTextPCode(code);
    machine.run(instructions);
    RunResult result;
    result.lines = machine.getLastRunTextOutput();
    const auto& flow = machine.getFlowState();
    const auto error = flow.find("__runtime_error");
    if (error != flow.end()) {
        result.hasError = true;
        result.error = error->second;
    }
    result.stepLimitHit = machine.didLastRunHitStepLimit();
#else
    RunOptions options;
    options.procedures = &procedures;
    options.globals = &globals;
    if (const auto* input = map.get("__testInput")) {
        options.hasSourceMessage = true;
        options.sourceMessage = detail::latin1ToUtf8(input->text);
    }
    const RunResult result = runText(read(argv[1]), options);
#endif
    std::cout << "{\"error\":";
    if (result.hasError) std::cout << detail::jsonQuote(detail::utf8ToLatin1(result.error));
    else std::cout << "null";
    std::cout << ",\"stdout\":[";
    for (size_t index = 0; index < result.lines.size(); ++index) {
        if (index) std::cout << ',';
        std::cout << detail::latin1ToUtf8(detail::jsonQuote(detail::utf8ToLatin1(result.lines[index])));
    }
    std::cout << "]}";
    return result.stepLimitHit ? 4 : 0;
}
