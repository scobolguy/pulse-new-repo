// COBOL execution engine for Tandem COBOL-85 P-code.
//
// The JS PMachine (pmachines/javascript/src/runtime.mjs) is the reference: values, decimal
// arithmetic, dynamic scope, BY REFERENCE slices, edited/display formatting and the
// host bindings COBOL programs use (text, intrinsic math, dates and ISAM files) are
// reproduced here exactly. The engine has no Arduino dependencies so it can be built and
// verified on a desktop against the JS runtime.
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

// Backing store for ISAM file images. Paths are relative to a granted root alias.
class IsamStorage {
public:
    virtual ~IsamStorage() = default;
    virtual bool exists(const std::string& root, const std::string& path) = 0;
    virtual bool readText(const std::string& root, const std::string& path, std::string& out, std::string& error) = 0;
    virtual bool writeText(const std::string& root, const std::string& path, const std::string& text, std::string& error) = 0;
};

class MemoryIsamStorage : public IsamStorage {
public:
    bool exists(const std::string& root, const std::string& path) override;
    bool readText(const std::string& root, const std::string& path, std::string& out, std::string& error) override;
    bool writeText(const std::string& root, const std::string& path, const std::string& text, std::string& error) override;
    void clear() { files.clear(); }
private:
    std::map<std::string, std::string> files;
};

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
    // ISAM file images; a per-run in-memory store is used when null.
    IsamStorage* storage = nullptr;
    // Host bindings outside the built-in set.
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
