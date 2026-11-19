#pragma once

#include <algorithm>
#include <cstdint>
#include <functional>
#include <limits>
#include <map>
#include <memory>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace pulse { namespace image {

using Scalar = std::variant<int64_t, std::string>;

struct Instruction {
    std::string op;
    std::string operand;
    uint32_t target = 0;
    uint32_t argCount = 0;
};

struct Entry {
    uint32_t entry = 0;
    std::vector<std::string> params;
    bool returnsValue = true;
};

struct Image {
    uint32_t formatVersion = 1;
    std::string abi = "pulse-scalar-v1";
    std::string moduleId;
    std::string contentHash;
    std::vector<Instruction> instructions;
    std::vector<Entry> entries;
    std::vector<std::string> globals;
};

struct Limits {
    uint32_t maxInstructions = 200000;
    uint32_t maxImageBytes = 8 * 1024 * 1024;
    uint32_t maxGlobals = 4096;
    uint32_t maxSlots = 4096;
    uint32_t maxModules = 64;
    uint32_t maxArity = 8;
};

inline void require(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}

// UTF-8 netstrings avoid JSON spelling, property-order and escaping differences.
inline std::string canonicalBytes(const Image& image) {
    std::string out = "PMI1";
    const auto text = [&](const std::string& value) {
        require(value.size() <= UINT32_MAX, "Image field overflow");
        out += std::to_string(value.size()) + ":" + value;
    };
    const auto number = [&](uint64_t value) { text(std::to_string(value)); };
    number(image.formatVersion);
    text(image.abi);
    text(image.moduleId);
    number(image.instructions.size());
    for (const auto& instruction : image.instructions) {
        text(instruction.op);
        text(instruction.operand);
        number(instruction.target);
        number(instruction.argCount);
    }
    number(image.entries.size());
    for (const auto& entry : image.entries) {
        number(entry.entry);
        number(entry.returnsValue ? 1 : 0);
        number(entry.params.size());
        for (const auto& param : entry.params) text(param);
    }
    number(image.globals.size());
    for (const auto& global : image.globals) text(global);
    return out;
}

inline const Entry& entryAt(const Image& image, uint32_t target) {
    const auto found = std::find_if(image.entries.begin(), image.entries.end(),
        [&](const Entry& entry) { return entry.entry == target; });
    require(found != image.entries.end(), "Invalid image entry");
    return *found;
}

inline void validateScalarInstruction(const Instruction& instruction) {
    static const std::set<std::string> ops = {
        "ADD", "AND", "CALL", "CONCAT", "EQ", "GE", "GT", "HALT", "JMP", "JZ",
        "LE", "LOAD", "LOAD_NAME", "LT", "MUL", "NEQ", "NOP", "NOT", "OR",
        "PUSH_INT", "PUSH_STR", "RET", "STORE", "STORE_NAME", "STREQ", "STRNEQ", "SUB"
    };
    require(ops.count(instruction.op) != 0, "Unsupported image opcode");
    if (instruction.op == "PUSH_INT") {
        const auto& text = instruction.operand;
        require(!text.empty() && text.size() <= 11, "Invalid image integer");
        size_t used = 0;
        const auto value = std::stoll(text, &used);
        require(used == text.size() && std::to_string(value) == text
            && value >= INT32_MIN && value <= INT32_MAX, "Invalid image integer");
    } else if (instruction.op == "LOAD" || instruction.op == "LOAD_NAME"
        || instruction.op == "STORE" || instruction.op == "STORE_NAME") {
        require(!instruction.operand.empty() && instruction.operand.size() <= 256, "Invalid image variable");
    } else if (instruction.op != "PUSH_STR") {
        require(instruction.operand.empty(), "Unexpected image operand");
    }
}

class Context {
    struct Module {
        std::shared_ptr<const Image> image;
        std::map<std::string, Scalar> globals;
        uint32_t bytes = 0;
        uint32_t active = 0;
    };
    struct Binding {
        std::shared_ptr<Module> module;
        uint32_t entry;
        uint32_t arity;
    };
    struct Pending {
        std::shared_ptr<Module> module;
        std::map<uint32_t, Binding> slots;
    };
public:
    struct Handle {
        const Context* owner = nullptr;
        uint64_t id = 0;
    };
    class Call {
        friend class Context;
        std::shared_ptr<Module> module_;
        uint32_t entry_;
        explicit Call(const Binding& binding) : module_(binding.module), entry_(binding.entry) {
            require(module_->active == 0, "Image call already active");
            ++module_->active;
        }
    public:
        Call(const Call&) = delete;
        Call& operator=(const Call&) = delete;
        Call(Call&& other) noexcept : module_(std::move(other.module_)), entry_(other.entry_) {}
        ~Call() { if (module_) --module_->active; }
        const Image& image() const { return *module_->image; }
        const Entry& entry() const { return entryAt(image(), entry_); }
        std::map<std::string, Scalar>& globals() { return module_->globals; }
    };

    using Hash = std::function<std::string(const std::string&)>;
    using ValidateInstruction = std::function<void(const Instruction&)>;

    Context(Hash hash, ValidateInstruction validate, Limits limits = {})
        : hash_(std::move(hash)), validate_(std::move(validate)), limits_(limits) {
        require(bool(hash_) && bool(validate_), "Image verifier required");
    }
    Context(const Context&) = delete;
    Context& operator=(const Context&) = delete;
    Context(Context&&) = delete;
    Context& operator=(Context&&) = delete;

    Handle stage(const Image& input) {
        require(!released_, "Context released");
        require(input.formatVersion == 1 && input.abi == "pulse-scalar-v1", "Unsupported image ABI");
        require(!input.moduleId.empty() && input.moduleId.size() <= 256, "Invalid module identity");
        require(input.contentHash.size() == 64 && input.contentHash.find_first_not_of("0123456789abcdef")
            == std::string::npos, "Invalid content identity");
        require(!input.instructions.empty() && input.instructions.size() <= limits_.maxInstructions,
            "Image instruction limit");
        require(input.entries.size() > 0 && input.entries.size() <= input.instructions.size(),
            "Image entry limit");
        require(input.globals.size() <= limits_.maxGlobals, "Image globals limit");
        require(modules_.size() + pending_.size() < limits_.maxModules, "Image module limit");
        for (const auto& pair : modules_) checkIdentity(*pair.second->image, input);
        for (const auto& pair : pending_) checkIdentity(*pair.second.module->image, input);
        std::set<uint32_t> entries;
        for (const auto& entry : input.entries) {
            require(entry.entry < input.instructions.size() && entries.insert(entry.entry).second,
                "Invalid image entry");
            require(entry.params.size() <= limits_.maxArity, "Image arity limit");
            checkNames(entry.params);
        }
        checkNames(input.globals);
        // Check a conservative lower bound before constructing canonical storage.
        uint64_t minimumBytes = input.moduleId.size() + input.abi.size();
        for (const auto& instruction : input.instructions) {
            minimumBytes += uint64_t(instruction.op.size()) + instruction.operand.size() + 8;
            require(minimumBytes <= limits_.maxImageBytes, "Image byte limit");
            require(instruction.argCount <= limits_.maxArity, "Image arity limit");
            if (instruction.op == "CALL" || instruction.op == "JMP" || instruction.op == "JZ") {
                require(instruction.target < input.instructions.size(), "Image target bounds");
                require(instruction.operand.empty(), "Unresolved image target");
                if (instruction.op == "CALL")
                    require(entryAt(input, instruction.target).params.size() == instruction.argCount,
                        "Image call arity mismatch");
            } else require(instruction.target == 0, "Unexpected image target");
            if (instruction.op != "CALL" && instruction.op != "CALL_EXT")
                require(instruction.argCount == 0, "Unexpected image arity");
            validate_(instruction);
        }
        for (const auto& entry : input.entries) {
            for (const auto& param : entry.params) minimumBytes += uint64_t(param.size()) + 2;
        }
        for (const auto& global : input.globals) minimumBytes += uint64_t(global.size()) + 2;
        require(minimumBytes <= limits_.maxImageBytes, "Image byte limit");
        const auto bytes = canonicalBytes(input);
        require(bytes.size() <= limits_.maxImageBytes, "Image byte limit");
        require(hash_(bytes) == input.contentHash, "Corrupt image identity");
        uint64_t instructions = input.instructions.size(), globals = input.globals.size(), totalBytes = bytes.size();
        const auto count = [&](const Module& module) {
            instructions += module.image->instructions.size();
            globals += module.image->globals.size();
            totalBytes += module.bytes;
        };
        for (const auto& pair : modules_) count(*pair.second);
        for (const auto& pair : pending_) count(*pair.second.module);
        require(instructions <= limits_.maxInstructions && globals <= limits_.maxGlobals
            && totalBytes <= limits_.maxImageBytes, "Context image resource limit");
        require(nextHandle_ != UINT64_MAX, "Stage handle overflow");
        auto module = std::make_shared<Module>();
        module->image = std::make_shared<const Image>(input);
        module->bytes = static_cast<uint32_t>(bytes.size());
        for (const auto& global : input.globals) module->globals.emplace(global, int64_t{0});
        const auto id = ++nextHandle_;
        pending_.emplace(id, Pending{module, {}});
        return Handle{this, id};
    }

    void bind(Handle handle, uint32_t slot, uint32_t entry, uint32_t arity) {
        auto& pending = getPending(handle);
        require(slot < limits_.maxSlots, "Image slot bounds");
        require(entryAt(*pending.module->image, entry).params.size() == arity, "Image binding arity mismatch");
        require(slots_.count(slot) == 0 && pending.slots.count(slot) == 0, "Image slot already owned");
        pending.slots.emplace(slot, Binding{pending.module, entry, arity});
    }

    void commit(Handle handle) {
        auto& pending = getPending(handle);
        require(pending.module->active == 0, "Staged image has active calls");
        for (const auto& pair : pending.slots)
            require(slots_.count(pair.first) == 0, "Image slot already owned");
        // Allocate before swapping either table: allocation failure publishes nothing.
        auto slots = slots_;
        auto modules = modules_;
        slots.insert(pending.slots.begin(), pending.slots.end());
        modules.emplace(pending.module->image->moduleId, pending.module);
        slots_.swap(slots);
        modules_.swap(modules);
        pending_.erase(handle.id);
    }

    void abort(Handle handle) {
        const auto& pending = getPending(handle);
        require(pending.module->active == 0, "Staged image has active calls");
        pending_.erase(handle.id);
    }

    Call acquire(uint32_t slot, uint32_t arity) {
        require(!released_, "Context released");
        const auto found = slots_.find(slot);
        require(found != slots_.end(), "Unpublished image slot");
        require(found->second.arity == arity, "Image call arity mismatch");
        return Call(found->second);
    }

    Call acquireStaged(Handle handle, uint32_t entry, uint32_t arity) {
        auto& pending = getPending(handle);
        require(entryAt(*pending.module->image, entry).params.size() == arity, "Image call arity mismatch");
        return Call(Binding{pending.module, entry, arity});
    }

    void release() {
        for (const auto& pair : modules_) require(pair.second->active == 0, "Context has active calls");
        for (const auto& pair : pending_) require(pair.second.module->active == 0, "Context has active calls");
        pending_.clear();
        slots_.clear();
        modules_.clear();
        released_ = true;
    }
    size_t moduleCount() const { return modules_.size(); }
    size_t slotCount() const { return slots_.size(); }

private:
    static void checkNames(const std::vector<std::string>& names) {
        std::set<std::string> seen;
        for (const auto& name : names)
            require(!name.empty() && name.size() <= 256 && seen.insert(name).second, "Invalid image variable");
    }
    static void checkIdentity(const Image& pinned, const Image& input) {
        if (pinned.moduleId != input.moduleId) return;
        require(pinned.contentHash == input.contentHash, "Conflicting pinned image identity");
        throw std::runtime_error("Image identity already staged or pinned");
    }
    Pending& getPending(Handle handle) {
        require(!released_ && handle.owner == this, "Foreign image stage");
        const auto found = pending_.find(handle.id);
        require(found != pending_.end(), "Invalid image stage");
        return found->second;
    }
    Hash hash_;
    ValidateInstruction validate_;
    Limits limits_;
    uint64_t nextHandle_ = 0;
    bool released_ = false;
    std::map<uint64_t, Pending> pending_;
    std::map<std::string, std::shared_ptr<Module>> modules_;
    std::map<uint32_t, Binding> slots_;
};

} }
