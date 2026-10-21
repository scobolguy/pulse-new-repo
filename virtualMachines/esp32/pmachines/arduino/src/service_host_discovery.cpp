#include "service_host.h"
#if defined(ESP32)
#include <algorithm>
#include <cstdio>
#include <cstring>

// The node no longer runs its own aggregator discovery. Lifecycle reports go to the
// aggregator that acknowledged this node's firmware beacon (udp_runtime nodeBeaconAck).
namespace pmachine {
namespace {
constexpr size_t IDENTITY_LIMIT = 128;

// Same charset the aggregator enforces for its identity: [A-Za-z0-9_.:-]{1,128}.
bool aggregatorIdentity(const char* text) {
    const size_t length = strlen(text);
    if (!length || length > IDENTITY_LIMIT) return false;
    for (size_t index = 0; index < length; ++index) {
        const char ch = text[index];
        if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')
              || ch == '_' || ch == '.' || ch == ':' || ch == '-')) return false;
    }
    return true;
}
}

void ServiceHost::setStorage(FederatedFileSystem& ffs) { swapFileSystem = &ffs; }

void ServiceHost::learnAggregator(const char* aggregatorId, const char* address, uint16_t httpPort) {
    if (!aggregatorId || !address || !httpPort || !aggregatorIdentity(aggregatorId)) return;
    char endpoint[sizeof(LearnedAggregator::endpoint)];
    const int written = snprintf(endpoint, sizeof(endpoint), "http://%s:%u/api/runtime/instances/report",
                                 address, static_cast<unsigned>(httpPort));
    if (written <= 0 || static_cast<size_t>(written) >= sizeof(endpoint)) return;
    portENTER_CRITICAL(&learnedLock);
    strncpy(learnedAggregator.id, aggregatorId, sizeof(learnedAggregator.id) - 1);
    learnedAggregator.id[sizeof(learnedAggregator.id) - 1] = '\0';
    memcpy(learnedAggregator.endpoint, endpoint, static_cast<size_t>(written) + 1);
    portEXIT_CRITICAL(&learnedLock);
}

ServiceHost::LearnedAggregator ServiceHost::learnedAggregatorSnapshot() const {
    LearnedAggregator copy;
    portENTER_CRITICAL(&learnedLock);
    copy = learnedAggregator;
    portEXIT_CRITICAL(&learnedLock);
    return copy;
}

std::vector<ServiceHost::AggregatorTarget> ServiceHost::reportTargetsFor(const Context& context) const {
    // Explicit URLs and credentials override the beacon-learned URL for the same identity.
    auto targets = context.lifecycle.reportTargets;
    const LearnedAggregator learned = learnedAggregatorSnapshot();
    if (learned.id[0] && std::none_of(targets.begin(), targets.end(), [&](const AggregatorTarget& target) {
            return target.aggregatorId == learned.id;
        })) {
        AggregatorTarget target;
        target.aggregatorId = learned.id;
        target.endpoint = learned.endpoint;
        targets.push_back(std::move(target));
    }
    return targets;
}}  // namespace pmachine
#endif