#include "pmachine_process_slots.h"

#include <ArduinoJson.h>
#include <cstdio>
#include <cstring>

namespace pmachine {

PmachineProcessSlots::PmachineProcessSlots() {
    slots_[0] = { "", ProcessSlotKind::RESIDENT, 0, false };
    slots_[1] = { "", ProcessSlotKind::TRANSIENT, 0, false };
    for (uint8_t index = 1; index <= PMACHINE_SERVICE_LIMIT; ++index) {
        slots_[index + 1] = { "", ProcessSlotKind::SERVICE, index, false };
    }
}

bool PmachineProcessSlots::validServiceIndex(uint8_t serviceIndex) {
    return serviceIndex >= 1 && serviceIndex <= PMACHINE_SERVICE_LIMIT;
}

std::string PmachineProcessSlots::slotName(ProcessSlotKind kind, uint8_t serviceIndex) {
    if (kind == ProcessSlotKind::RESIDENT) return "resident";
    if (kind == ProcessSlotKind::TRANSIENT) return "transient";
    char name[12];
    std::snprintf(name, sizeof(name), "service-%02u", serviceIndex);
    return name;
}

ProcessSlot* PmachineProcessSlots::findMutable(const std::string& key) {
    for (auto& slot : slots_) {
        if (slot.occupied && slot.key == key) return &slot;
    }
    return nullptr;
}

ProcessSlot* PmachineProcessSlots::findByIdentity(ProcessSlotKind kind, uint8_t serviceIndex) {
    if (kind == ProcessSlotKind::SERVICE && !validServiceIndex(serviceIndex)) return nullptr;
    const uint8_t index = kind == ProcessSlotKind::RESIDENT
        ? 0
        : kind == ProcessSlotKind::TRANSIENT ? 1 : static_cast<uint8_t>(serviceIndex + 1);
    return &slots_[index];
}

bool PmachineProcessSlots::claim(const std::string& key, ProcessSlotKind kind,
                                 uint8_t serviceIndex, std::string& error) {
    if (key.empty()) {
        error = "process slot key is required";
        return false;
    }
    if (kind == ProcessSlotKind::SERVICE && !validServiceIndex(serviceIndex)) {
        error = "service index must be between 1 and 15";
        return false;
    }
    if (findMutable(key) != nullptr) return true;

    ProcessSlot* slot = findByIdentity(kind, serviceIndex);
    if (slot == nullptr) {
        error = "invalid process slot";
        return false;
    }
    if (slot->occupied) {
        error = slotName(kind, serviceIndex) + " is already occupied";
        return false;
    }
    slot->key = key;
    slot->kind = kind;
    slot->serviceIndex = serviceIndex;
    slot->occupied = true;
    return true;
}

bool PmachineProcessSlots::release(const std::string& key) {
    ProcessSlot* slot = findMutable(key);
    if (slot == nullptr) return false;
    slot->key.clear();
    slot->occupied = false;
    return true;
}

const ProcessSlot* PmachineProcessSlots::find(const std::string& key) const {
    for (const auto& slot : slots_) {
        if (slot.occupied && slot.key == key) return &slot;
    }
    return nullptr;
}

const ProcessSlot& PmachineProcessSlots::at(uint8_t index) const {
    return slots_.at(index);
}

std::string PmachineProcessSlots::serialize() const {
    JsonDocument document;
    JsonArray entries = document["slots"].to<JsonArray>();
    for (const auto& slot : slots_) {
        if (!slot.occupied) continue;
        JsonObject entry = entries.add<JsonObject>();
        entry["key"] = slot.key;
        entry["kind"] = slot.kind == ProcessSlotKind::RESIDENT
            ? "resident" : slot.kind == ProcessSlotKind::TRANSIENT ? "transient" : "service";
        if (slot.kind == ProcessSlotKind::SERVICE) entry["serviceIndex"] = slot.serviceIndex;
    }
    std::string output;
    serializeJson(document, output);
    return output;
}

bool PmachineProcessSlots::restore(const std::string& state, std::string& error) {
    JsonDocument document;
    if (deserializeJson(document, state) != DeserializationError::Ok
        || !document["slots"].is<JsonArrayConst>()) {
        error = "invalid process slot state";
        return false;
    }
    PmachineProcessSlots restored;
    for (JsonObjectConst entry : document["slots"].as<JsonArrayConst>()) {
        if (!entry["key"].is<const char*>() || !entry["kind"].is<const char*>()) {
            error = "process slot state contains an invalid entry";
            return false;
        }
        const char* kindText = entry["kind"].as<const char*>();
        ProcessSlotKind kind;
        uint8_t serviceIndex = 0;
        if (strcmp(kindText, "resident") == 0) {
            kind = ProcessSlotKind::RESIDENT;
        } else if (strcmp(kindText, "transient") == 0) {
            kind = ProcessSlotKind::TRANSIENT;
        } else if (strcmp(kindText, "service") == 0
                   && entry["serviceIndex"].is<uint8_t>()) {
            kind = ProcessSlotKind::SERVICE;
            serviceIndex = entry["serviceIndex"].as<uint8_t>();
        } else {
            error = "process slot state contains an invalid kind";
            return false;
        }
        if (!restored.claim(entry["key"].as<const char*>(), kind, serviceIndex, error))
            return false;
    }
    slots_ = restored.slots_;
    return true;
}

} // namespace pmachine
