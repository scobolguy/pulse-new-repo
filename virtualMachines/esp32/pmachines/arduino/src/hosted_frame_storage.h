#pragma once

#include "pmachine_value.h"
#include <array>
#include <cstddef>
#include <cstring>

namespace pmachine {

template<size_t SlotCapacity = 256, size_t NameCapacity = 4096,
         size_t DepthCapacity = 32, size_t FrameCapacity = 128>
class BoundedHostedFrames {
public:
    BoundedHostedFrames() { reset(); }

    void reset() {
        usedSlots = usedNames = 0;
        frameDepth = 1;
        frames[0] = Frame{};
        peakSlots = peakNames = 0;
        peakDepth = 1;
    }

    const Value* find(const char* name) const {
        for (size_t index = usedSlots; index > 0; --index) {
            const Slot& slot = slots[index - 1];
            if (std::strcmp(names.data() + slot.nameOffset, name) == 0)
                return &slot.value;
        }
        return nullptr;
    }

    bool containsLocal(const char* name) const {
        return localSlot(name) != usedSlots;
    }

    const char* store(const char* name, const Value& value) {
        const size_t existing = localSlot(name);
        if (existing != usedSlots) {
            slots[existing].value = value;
            return nullptr;
        }
        if (usedSlots - frames[frameDepth - 1].slotStart >= FrameCapacity)
            return "hosted frame variable capacity exceeded";
        if (usedSlots == SlotCapacity)
            return "hosted variable slot capacity exceeded";
        const size_t length = std::strlen(name);
        if (length >= NameCapacity - usedNames)
            return "hosted variable name capacity exceeded";
        Slot& slot = slots[usedSlots++];
        slot.nameOffset = usedNames;
        slot.value = value;
        std::memcpy(names.data() + usedNames, name, length + 1);
        usedNames += length + 1;
        if (usedSlots > peakSlots) peakSlots = usedSlots;
        if (usedNames > peakNames) peakNames = usedNames;
        return nullptr;
    }

    const char* push(int returnPc) {
        if (frameDepth == DepthCapacity) return "hosted call depth exceeded";
        Frame& frame = frames[frameDepth++];
        frame.slotStart = usedSlots;
        frame.nameStart = usedNames;
        frame.returnPc = returnPc;
        if (frameDepth > peakDepth) peakDepth = frameDepth;
        return nullptr;
    }

    bool pop(int& returnPc) {
        if (frameDepth == 1) return false;
        const Frame& frame = frames[--frameDepth];
        usedSlots = frame.slotStart;
        usedNames = frame.nameStart;
        returnPc = frame.returnPc;
        return true;
    }

    template<typename Visitor>
    void forEachValue(Visitor visit) const {
        for (size_t index = 0; index < usedSlots; ++index) visit(slots[index].value);
    }

    template<typename Visitor>
    void forEachBinding(size_t frame, Visitor visit) const {
        if (frame >= frameDepth) return;
        const size_t end = frame + 1 < frameDepth ? frames[frame + 1].slotStart : usedSlots;
        for (size_t index = frames[frame].slotStart; index < end; ++index)
            visit(names.data() + slots[index].nameOffset, slots[index].value);
    }

    size_t depth() const { return frameDepth; }
    size_t size() const { return usedSlots; }
    size_t nameBytes() const { return usedNames; }
    size_t slotHighWater() const { return peakSlots; }
    size_t nameHighWater() const { return peakNames; }
    size_t depthHighWater() const { return peakDepth; }

private:
    static_assert(SlotCapacity > 0 && NameCapacity > 0 &&
                  DepthCapacity > 0 && FrameCapacity > 0, "hosted storage must be nonempty");
    struct Slot {
        Value value;
        size_t nameOffset = 0;
    };
    struct Frame {
        size_t slotStart = 0;
        size_t nameStart = 0;
        int returnPc = 0;
    };

    size_t localSlot(const char* name) const {
        const size_t start = frames[frameDepth - 1].slotStart;
        for (size_t index = usedSlots; index > start; --index) {
            if (std::strcmp(names.data() + slots[index - 1].nameOffset, name) == 0)
                return index - 1;
        }
        return usedSlots;
    }

    std::array<Slot, SlotCapacity> slots;
    std::array<char, NameCapacity> names;
    std::array<Frame, DepthCapacity> frames;
    size_t usedSlots = 0, usedNames = 0, frameDepth = 1;
    size_t peakSlots = 0, peakNames = 0, peakDepth = 1;
};

using HostedFrameStorage = BoundedHostedFrames<>;

}
