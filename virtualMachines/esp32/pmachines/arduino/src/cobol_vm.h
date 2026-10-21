// COBOL execution engine for Tandem COBOL-85 P-code.
//
// The JS PMachine (pmachines/javascript/src/runtime.mjs) is the reference: values, decimal
// arithmetic, dynamic scope, BY REFERENCE slices, edited/display formatting and the
// host bindings COBOL programs use (text, intrinsic math and dates) are reproduced here
// exactly. ISAM files stay with the desktop file manager and are reached through the host.
// The engine has no Arduino dependencies so it can be built and verified on a desktop
// against the JS runtime.
#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace cobolvm {

// True when the P-code text was produced by the COBOL compiler or uses COBOL-only opcodes.
bool isCobolPcode(const std::string& text);

// Argument or result of a host binding the engine does not implement itself.
struct HostArg {
    bool isString = false;
    double number = 0;
    std::string text;  // UTF-8
};

struct ProcedureInfo {
    std::vector<std::string> params;
    std::vector<std::string> locals;
};

struct RunOptions {
    const std::map<std::string, ProcedureInfo>* procedures = nullptr;
    const std::vector<std::string>* globals = nullptr;
    bool hasSourceMessage = false;
    std::string sourceMessage;  // UTF-8, bound to `src`
    size_t maxSteps = 200000;
    size_t maxStack = 4096;
    size_t maxCallDepth = 2048;
    // Receives each completed DISPLAY line (UTF-8). When unset, lines go to RunResult::lines.
    std::function<void(const std::string&)> onLine;
    // Called every `yieldInterval` steps so a device can feed its watchdog.
    std::function<void()> onYield;
    size_t yieldInterval = 1024;
    // Copy the final global frame into RunResult::globals.
    bool collectGlobals = true;
    // Delegated host bindings (host.isam_*: the ISAM file manager runs on the desktop).
    // Arguments are already checked against the binding contract.
    std::function<bool(const std::string& name, const std::vector<HostArg>& args, HostArg& result, std::string& error)> hostFallback;
    // Uniform [0, 1) source for FUNCTION RANDOM without a seed.
    std::function<double()> random;
};

struct GlobalOut {
    enum Kind : uint8_t { Number, String, Real } kind = Number;
    double number = 0;
    std::string text;  // UTF-8; decimals use their canonical text form
};

struct RunResult {
    std::vector<std::string> lines;
    size_t steps = 0;
    bool stepLimitHit = false;
    bool hasError = false;
    std::string error;
    std::vector<std::pair<std::string, GlobalOut>> globals;
};

struct Program;

// Parsed form of a COBOL P-code program; reusable across runs.
class CompiledProgram {
public:
    CompiledProgram();
    ~CompiledProgram();
    CompiledProgram(CompiledProgram&&) noexcept;
    CompiledProgram& operator=(CompiledProgram&&) noexcept;
    bool parse(const std::string& text, std::string& error);
    RunResult run(const RunOptions& options) const;
    size_t instructionCount() const;
private:
    std::unique_ptr<Program> program;
};

RunResult runText(const std::string& pcodeText, const RunOptions& options);

}  // namespace cobolvm
