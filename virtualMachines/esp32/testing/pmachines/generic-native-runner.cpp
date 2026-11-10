#include "../../pmachines/arduino/src/scalar_runtime.h"
#include "../../pmachines/arduino/src/pmachine.h"
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
    namespace detail = pmachine::rtl::detail;
    detail::Json map;
    if (!detail::parseJson(detail::utf8ToLatin1(read(argv[2])), map)) return 3;
    std::map<std::string, std::vector<std::string>> signatures;
    if (const auto* values = map.get("procedures")) {
        for (const auto& entry : values->members) {
            const std::string label = detail::latin1ToUtf8(entry.first);
            if (const auto* params = entry.second.get("params"))
                for (const auto& name : params->items) signatures[label].push_back(detail::latin1ToUtf8(name.text));
            if (const auto* locals = entry.second.get("locals"))
                for (const auto& name : locals->items) signatures["@locals:" + label].push_back(detail::latin1ToUtf8(name.text));
        }
    }
    if (const auto* names = map.get("globals"))
        for (const auto& name : names->items) signatures["@globals"].push_back(detail::latin1ToUtf8(name.text));
    pmachine::PMachine machine;
    machine.setProcedureSignatures(signatures);
    if (const auto* input = map.get("__testInput"))
        machine.setRoutingContext("", detail::latin1ToUtf8(input->text));
    const auto instructions = pmachine::loadTextPCode(read(argv[1]));
    if (instructions.size() < 2) return 5;
    machine.run(instructions);
    const auto& flow = machine.getFlowState();
    auto error = flow.find("__runtime_error");
    if (error == flow.end()) error = flow.find("__thunk_error");
    std::cout << "{\"error\":";
    if (error != flow.end()) std::cout << detail::jsonQuote(detail::utf8ToLatin1(error->second));
    else std::cout << "null";
    std::cout << ",\"stdout\":[";
    const auto& lines = machine.getLastRunTextOutput();
    for (size_t index = 0; index < lines.size(); ++index) {
        if (index) std::cout << ',';
        std::cout << detail::latin1ToUtf8(detail::jsonQuote(detail::utf8ToLatin1(lines[index])));
    }
    std::cout << "],\"stepLimitHit\":" << (machine.didLastRunHitStepLimit() ? "true" : "false") << "}";
    return machine.didLastRunHitStepLimit() ? 4 : 0;
}
