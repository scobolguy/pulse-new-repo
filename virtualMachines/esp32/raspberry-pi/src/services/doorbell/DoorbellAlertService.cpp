#include "services/doorbell/DoorbellAlertService.h"

#include <iostream>

namespace pulse::services::doorbell {

void DoorbellAlertService::handle(const core::AlertEvent& alert) const {
    std::cout << "[doorbell] alert kind=" << alert.kind
              << " eventType=" << alert.eventType
              << " source=" << alert.sourceNode << '\n';

    if (!alert.snapshotUrl.empty()) {
        std::cout << "[doorbell] snapshot url=" << alert.snapshotUrl << '\n';
    }
}

} // namespace pulse::services::doorbell
