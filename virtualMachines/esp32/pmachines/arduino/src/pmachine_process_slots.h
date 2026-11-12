#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace pmachine {

constexpr uint8_t PMACHINE_SERVICE_LIMIT = 15;
constexpr uint8_t PMACHINE_SLOT_COUNT = PMACHINE_SERVICE_LIMIT + 2;

enum class ProcessSlotKind : uint8_t {
    RESIDENT = 0,
    TRANSIENT = 1,
    SERVICE = 2
};

struct ProcessSlot {
    std::string key;
    ProcessSlotKind kind;
    uint8_t serviceIndex;
    bool occupied;

    ProcessSlot()
        : kind(ProcessSlotKind::SERVICE), serviceIndex(0), occupied(false) {}
    ProcessSlot(const std::string& keyValue, ProcessSlotKind kindValue,
                uint8_t serviceIndexValue, bool occupiedValue)
        : key(keyValue), kind(kindValue), serviceIndex(serviceIndexValue),
          occupied(occupiedValue) {}
};

/**
 * Fixed-capacity process residency table.
 *
 * This is deliberately separate from PMachineScheduler: scheduler contexts
 * are execution details, while these slots are deployment ownership and
 * recovery identities.
 */
class PmachineProcessSlots {
public:
    PmachineProcessSlots();

    bool claim(const std::string& key, ProcessSlotKind kind, uint8_t serviceIndex,
               std::string& error);
    bool release(const std::string& key);
    const ProcessSlot* find(const std::string& key) const;
    const ProcessSlot& at(uint8_t index) const;
    std::string serialize() const;
    bool restore(const std::string& state, std::string& error);
    uint8_t size() const { return PMACHINE_SLOT_COUNT; }

private:
    std::array<ProcessSlot, PMACHINE_SLOT_COUNT> slots_;

    static bool validServiceIndex(uint8_t serviceIndex);
    static std::string slotName(ProcessSlotKind kind, uint8_t serviceIndex);
    ProcessSlot* findMutable(const std::string& key);
    ProcessSlot* findByIdentity(ProcessSlotKind kind, uint8_t serviceIndex);
};

} // namespace pmachine
