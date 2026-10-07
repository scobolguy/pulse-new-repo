#include "../../src/udp_ingress_policy.h"
#include <cassert>

int main() {
    using namespace udp_ingress;
    assert(decide(kMaxPacketBytes, kMinFreeHeapBytes, kMinLargestBlockBytes) == Decision::accept);
    assert(decide(kMaxPacketBytes + 1, 100000, 100000) == Decision::oversized);
    assert(decide(1, kMinFreeHeapBytes - 1, kMinLargestBlockBytes) == Decision::lowMemory);
    assert(decide(1, kMinFreeHeapBytes, kMinLargestBlockBytes - 1) == Decision::lowMemory);
    assert(decide(1, 100000, 100000) == Decision::accept);
    assert(decide(kMaxPacketBytes + 1, 0, 0) == Decision::oversized);
    assert(decide(1, 0, 0) == Decision::lowMemory);
    assert(decide(1, kMinFreeHeapBytes, kMinLargestBlockBytes) == Decision::accept);
}
