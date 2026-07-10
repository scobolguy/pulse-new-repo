#pragma once

#include "core/Types.h"

namespace pulse::services::doorbell {

class DoorbellAlertService {
public:
    void handle(const core::AlertEvent& alert) const;
};

} // namespace pulse::services::doorbell
