#pragma once

#include "pmachine_value.h"
#include <array>
#include <cstddef>
#include <cstdint>
#include <string>

namespace pmachine {

struct VariableReference {
    size_t frame = 0;
    uint64_t identity = 0;
    std::string name;
    int32_t offset = -1;
    int32_t length = 0;
};

class ManagedReferences {
public:
    static constexpr size_t CAPACITY = 256;
    static constexpr size_t NAME_BYTES = 4096;

    bool store(const VariableReference& reference, Value& value) {
        for (size_t index = 0; index < CAPACITY; ++index) {
            const auto& entry = entries[index];
            if (used[index] && entry.frame == reference.frame && entry.identity == reference.identity &&
                entry.name == reference.name && entry.offset == reference.offset && entry.length == reference.length) {
                value = Value::makeReference(static_cast<uint16_t>(index));
                return true;
            }
        }
        for (size_t index = 0; index < CAPACITY; ++index) {
            if (used[index]) continue;
            if (reference.name.size() + 1 > NAME_BYTES - nameBytes) return false;
            entries[index] = reference;
            used[index] = true;
            nameBytes += reference.name.size() + 1;
            value = Value::makeReference(static_cast<uint16_t>(index));
            return true;
        }
        return false;
    }

    const VariableReference* get(Value value) const {
        return value.isReference() && value.handle < CAPACITY && used[value.handle]
            ? &entries[value.handle] : nullptr;
    }

    template<typename IsLive>
    void sweep(IsLive live) {
        for (size_t index = 0; index < CAPACITY; ++index) {
            if (used[index] && !live(static_cast<uint16_t>(index))) {
                nameBytes -= entries[index].name.size() + 1;
                entries[index] = VariableReference{};
                used[index] = false;
            }

        }
    }

    template<typename ResolveIdentity>
    bool restoreIdentities(ResolveIdentity resolve) {
        for (size_t index = 0; index < CAPACITY; ++index) {
            if (!used[index]) continue;
            entries[index].identity = resolve(entries[index]);
            if (!entries[index].identity) return false;
        }
        return true;
    }

private:
    std::array<VariableReference, CAPACITY> entries;
    std::array<bool, CAPACITY> used{};
    size_t nameBytes = 0;
};

}
