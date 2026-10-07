#pragma once

#include <stddef.h>
#include <stdint.h>

namespace udp_ingress {
constexpr size_t kMaxPacketBytes = 1024;
constexpr uint32_t kMinFreeHeapBytes = 32768;
constexpr uint32_t kMinLargestBlockBytes = 8192;

enum class Decision { accept, oversized, lowMemory };

constexpr Decision decide(size_t packetBytes, uint32_t freeHeapBytes, uint32_t largestBlockBytes) {
    return packetBytes > kMaxPacketBytes ? Decision::oversized
        : freeHeapBytes < kMinFreeHeapBytes || largestBlockBytes < kMinLargestBlockBytes
            ? Decision::lowMemory : Decision::accept;
}
}
